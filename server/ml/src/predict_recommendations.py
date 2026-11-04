"""
Online Inference and Recommendation Engine for Cheri Machine Learning System.
Implements:
  - Top-30 Candidate Pool expansion
  - Hybrid Recommendation + Diversity Re-ranking (6 Priority + 4 Exploration via Random Weighted Sampling)
  - 7-Day Exposure Rotation via 'recommendation_impressions' collection (with positive engagement exemption)
  - Strict preservation of original ML scores/ranks ('score', '_mlScore', 'rank', '_mlRank')
  - Multi-tier cold-start fallbacks (Category-based and Popularity-based) with synchronized diversification
"""

import sys
import json
import math
import argparse
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple, Set

# Ensure stdout uses utf-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

import numpy as np
import pandas as pd

# Setup paths
CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.config import (
    OUTPUT_DATA_DIR,
    OUTPUT_MODEL_DIR,
    RECOMMENDATION_DEFAULT_TOP_N,
    RECOMMENDATION_CANDIDATE_POOL_SIZE,
    RECOMMENDATION_PRIORITY_COUNT,
    RECOMMENDATION_EXPLORATION_COUNT,
    RECOMMENDATION_PRIORITY_RATIO,
    RECOMMENDATION_MAX_PER_CATEGORY,
    IMPRESSION_COLLECTION_NAME,
    IMPRESSION_LOOKBACK_DAYS,
    normalize_product_key,
    pseudonymize_user_key,
    is_valid_object_id,
    get_mongo_db,
)
from src.train_model import FEATURE_COLUMNS


def normalize_id(val: Any) -> str:
    """Normalizes a product identifier (handles pure ObjectId, compound ID, or SKU)."""
    if val is None:
        return ""
    return normalize_product_key(val)["clean_product_id"]


def normalize_user_key(user_id: Any) -> str:
    """
    Normalizes a user or guest identifier to match the SHA-256 pseudonymized 'user_key'
    format used in Offline Training ('usr_<16_hex>' or 'gst_<16_hex>').
    """
    return pseudonymize_user_key(user_id)


# Configure logging to stderr so stdout is reserved for pure JSON output
logger = logging.getLogger("cheri_inference")
if not logger.handlers:
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter("[%(levelname)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)


def load_catalog(data_dir: Optional[Path] = None) -> pd.DataFrame:
    """
    Loads product catalog from products_features.csv.
    Ensures essential columns exist with clean types.
    """
    base_dir = Path(data_dir) if data_dir else OUTPUT_DATA_DIR
    catalog_path = base_dir / "products_features.csv"

    if not catalog_path.exists():
        try:
            from src.extract_data import extract_products
            df = extract_products()
            if not df.empty:
                return df
        except Exception:
            pass
        logger.warning(f"Catalog file not found at {catalog_path}.")
        return pd.DataFrame()

    try:
        df = pd.read_csv(catalog_path, dtype={"product_id": str})
        df["product_id"] = df["product_id"].astype(str).str.strip()
        df["primary_category"] = df["primary_category"].fillna("Khác").astype(str)
        df["regular_price"] = pd.to_numeric(df.get("regular_price", 0), errors="coerce").fillna(0.0)
        df["sale_price"] = pd.to_numeric(df.get("sale_price", 0), errors="coerce").fillna(0.0)
        if "title_url" in df.columns:
            df["title_url"] = df["title_url"].fillna("").astype(str).str.strip()
        if "sku" in df.columns:
            df["sku"] = df["sku"].fillna("").astype(str).str.strip()

        if "in_stock" in df.columns:
            stock_num = pd.to_numeric(df["in_stock"], errors="coerce")
            if stock_num.isna().any():
                logger.warning("Found NaN or invalid values in 'in_stock' column of catalog; coercing to 0.")
            df["in_stock"] = stock_num.fillna(0).astype(int)
            df["is_in_stock"] = df["in_stock"] > 0
        elif "is_in_stock" in df.columns:
            raw_bool = df["is_in_stock"]
            if raw_bool.isna().any():
                logger.warning("Found NaN values in 'is_in_stock' column of catalog; coercing to False.")
            df["is_in_stock"] = raw_bool.where(raw_bool.notna(), False).astype(str).str.lower().isin(["true", "1", "1.0"])
            df["in_stock"] = df["is_in_stock"].astype(int)
        else:
            logger.warning("Catalog is missing both 'in_stock' and 'is_in_stock' columns; defaulting to 0/False.")
            df["in_stock"] = 0
            df["is_in_stock"] = False

        df["visibility"] = df.get("visibility", True).astype(bool)
        df["variant_count"] = pd.to_numeric(df.get("variant_count", 1), errors="coerce").fillna(1).astype(int)
        df["popularity_views"] = pd.to_numeric(df.get("popularity_views", 0), errors="coerce").fillna(0.0)
        return df
    except Exception as e:
        logger.error(f"Failed to load catalog: {e}")
        return pd.DataFrame()


def load_user_history(
    data_dir: Optional[Path] = None,
    raw_user_id: Optional[str] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Loads clean user interactions and orders from local CSVs ('interactions_clean.csv', 'orders_clean.csv')
    and optionally enriches with live MongoDB records for the active user/guest when running in online mode.
    """
    base_dir = Path(data_dir) if data_dir else OUTPUT_DATA_DIR
    interactions_path = base_dir / "interactions_clean.csv"
    orders_path = base_dir / "orders_clean.csv"

    interactions_df = pd.DataFrame()
    orders_df = pd.DataFrame()

    if interactions_path.exists():
        try:
            interactions_df = pd.read_csv(interactions_path, dtype={"user_key": str, "clean_product_id": str})
            if "clean_product_id" in interactions_df.columns and "product_id" not in interactions_df.columns:
                interactions_df["product_id"] = interactions_df["clean_product_id"].astype(str)
            elif "product_id" in interactions_df.columns and "clean_product_id" not in interactions_df.columns:
                interactions_df["clean_product_id"] = interactions_df["product_id"].astype(str)
        except Exception as e:
            logger.warning(f"Failed to read interactions_clean.csv: {e}")

    if orders_path.exists():
        try:
            orders_df = pd.read_csv(orders_path, dtype={"user_key": str, "clean_product_id": str})
        except Exception as e:
            logger.warning(f"Failed to read orders_clean.csv: {e}")

    # Live MongoDB enrichment for real-time feedback loop when running in default online mode
    if data_dir is None and raw_user_id:
        raw_str = str(raw_user_id).strip()
        u_key = normalize_user_key(raw_str)
        raw_uid_part = raw_str[4:].strip() if raw_str.lower().startswith("usr_") else raw_str
        raw_sess_part = raw_str[4:].strip() if raw_str.lower().startswith("gst_") else raw_str

        is_raw_mongo_uid = is_valid_object_id(raw_uid_part)
        is_raw_guest_sess = raw_str.lower().startswith("gst_") and len(raw_sess_part) > 16

        if is_raw_mongo_uid or is_raw_guest_sess:
            try:
                from bson import ObjectId
                from src.config import get_mongo_db
                db = get_mongo_db()

                query: Dict[str, Any] = {"isSynthetic": {"$ne": True}}
                if is_raw_mongo_uid:
                    query["userId"] = ObjectId(raw_uid_part)
                else:
                    query["sessionId"] = raw_sess_part

                live_docs = list(db["user_interactions"].find(query).limit(200))
                if live_docs:
                    live_rows = []
                    for d in live_docs:
                        pid = normalize_id(d.get("productId"))
                        if not pid:
                            continue
                        live_rows.append({
                            "user_key": u_key,
                            "is_guest": not is_raw_mongo_uid,
                            "clean_product_id": pid,
                            "product_id": pid,
                            "variant_id": d.get("variantId"),
                            "event_type": str(d.get("eventType", "VIEW")).strip().upper(),
                            "event_timestamp": pd.Timestamp(d.get("timestamp") or pd.Timestamp.now(tz="UTC")).isoformat(),
                            "is_linked_to_catalog": True,
                            "is_synthetic": False,
                        })
                    if live_rows:
                        live_df = pd.DataFrame(live_rows)
                        interactions_df = (
                            pd.concat([interactions_df, live_df], ignore_index=True)
                            if not interactions_df.empty
                            else live_df
                        )
            except Exception:
                pass

    return interactions_df, orders_df


def get_user_purchased_products(
    user_id: Optional[str],
    interactions_df: Optional[pd.DataFrame] = None,
    orders_df: Optional[pd.DataFrame] = None,
) -> Set[str]:
    """Returns the set of product_ids already purchased by the user."""
    if not user_id:
        return set()
    u_key = normalize_user_key(user_id)
    if not u_key:
        return set()

    purchased: Set[str] = set()
    if orders_df is not None and not orders_df.empty and "user_key" in orders_df.columns:
        u_ord = orders_df[orders_df["user_key"] == u_key]
        if "is_successful_conversion" in u_ord.columns:
            u_ord = u_ord[u_ord["is_successful_conversion"] == True]
        for candidate_col in ("clean_product_id", "product_id", "product_key"):
            if candidate_col in u_ord.columns:
                purchased.update(u_ord[candidate_col].dropna().astype(str).tolist())
                break

    if interactions_df is not None and not interactions_df.empty and "user_key" in interactions_df.columns:
        u_int = interactions_df[
            (interactions_df["user_key"] == u_key) &
            (interactions_df["event_type"].astype(str).str.upper() == "PURCHASE")
        ]
        for candidate_col in ("product_id", "clean_product_id", "product_key"):
            if candidate_col in u_int.columns:
                purchased.update(u_int[candidate_col].dropna().astype(str).tolist())
                break

    return purchased


def get_user_engaged_products(
    user_id: Optional[str],
    interactions_df: Optional[pd.DataFrame] = None,
) -> Set[str]:
    """
    Returns products that the user has actively clicked or added to cart ('CLICK', 'ADD_TO_CART').
    Products with positive engagement are not penalized like ignored impressions during Exposure Rotation.
    """
    if not user_id or interactions_df is None or interactions_df.empty:
        return set()
    u_key = normalize_user_key(user_id)
    if not u_key or "user_key" not in interactions_df.columns:
        return set()

    u_int = interactions_df[
        (interactions_df["user_key"] == u_key) &
        (interactions_df["event_type"].astype(str).str.upper().isin(["CLICK", "ADD_TO_CART"]))
    ]
    if u_int.empty:
        return set()

    for col in ("product_id", "clean_product_id", "product_key"):
        if col in u_int.columns:
            return set(u_int[col].dropna().astype(str).tolist())
    return set()


def load_exposure_history(
    raw_user_id: Optional[str],
    interactions_df: Optional[pd.DataFrame] = None,
    data_dir: Optional[Path] = None,
    lookback_days: int = IMPRESSION_LOOKBACK_DAYS,
    recommendation_context_id: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Retrieves recommendation impression history for the last 'lookback_days' (default 7 days)
    from the dedicated 'recommendation_impressions' MongoDB collection (or local CSV in test mode).
    When 'recommendation_context_id' is provided, isolates impression exposure strictly to the active context.
    Returns mapping:
      product_id -> {
        'impression_count': int,
        'last_shown_at': Optional[pd.Timestamp],
        'hours_since_last_shown': float,
        'has_positive_engagement': bool
      }
    """
    if not raw_user_id:
        return {}

    raw_str = str(raw_user_id).strip()
    if not raw_str:
        return {}

    u_key = normalize_user_key(raw_str)
    engaged_products = get_user_engaged_products(raw_user_id, interactions_df)
    now_utc = pd.Timestamp.now(tz="UTC")
    cutoff_utc = now_utc - pd.Timedelta(days=lookback_days)

    records: List[Dict[str, Any]] = []

    # 1. Check optional local file in data_dir (supports isolated unit tests)
    if data_dir is not None:
        local_imp_path = Path(data_dir) / "recommendation_impressions.csv"
        if local_imp_path.exists():
            try:
                imp_df = pd.read_csv(local_imp_path, dtype=str)
                for _, r in imp_df.iterrows():
                    if recommendation_context_id:
                        rec_ctx = r.get("recommendationContextId") or r.get("recommendation_context_id") or r.get("contextId")
                        if rec_ctx and str(rec_ctx).strip() != str(recommendation_context_id).strip():
                            continue
                    rec_ukey = normalize_user_key(r.get("userKey") or r.get("user_key") or r.get("sessionId"))
                    if rec_ukey == u_key or r.get("userKey") == raw_str or r.get("sessionId") == raw_str:
                        records.append({
                            "productId": normalize_id(r.get("productId") or r.get("product_id")),
                            "shownAt": r.get("shownAt") or r.get("shown_at"),
                        })
            except Exception as e:
                logger.warning(f"Failed to read local recommendation_impressions.csv: {e}")

    # 2. Query MongoDB 'recommendation_impressions' collection when in online mode
    if data_dir is None:
        try:
            from bson import ObjectId
            from src.config import get_mongo_db
            db = get_mongo_db()

            raw_uid_part = raw_str[4:].strip() if raw_str.lower().startswith("usr_") else raw_str
            raw_sess_part = raw_str[4:].strip() if raw_str.lower().startswith("gst_") else raw_str

            or_conditions: List[Dict[str, Any]] = [{"userKey": u_key}, {"userKey": raw_str}]
            if is_valid_object_id(raw_uid_part):
                or_conditions.append({"userId": ObjectId(raw_uid_part)})
            if raw_sess_part:
                or_conditions.append({"sessionId": raw_sess_part})

            cutoff_dt = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            query: Dict[str, Any] = {
                "$or": or_conditions,
                "shownAt": {"$gte": cutoff_dt},
            }
            if recommendation_context_id:
                query["recommendationContextId"] = str(recommendation_context_id).strip()

            mongo_docs = list(
                db[IMPRESSION_COLLECTION_NAME]
                .find(query, {"productId": 1, "shownAt": 1})
                .sort("shownAt", -1)
                .limit(500)
            )
            for d in mongo_docs:
                records.append({
                    "productId": normalize_id(d.get("productId")),
                    "shownAt": d.get("shownAt"),
                })
        except Exception:
            # Non-fatal: if collection is empty or unreachable, proceed without impression penalty
            pass
            pass

    exposure_map: Dict[str, Dict[str, Any]] = {}
    for rec in records:
        pid = rec.get("productId", "")
        if not pid:
            continue
        ts = pd.to_datetime(rec.get("shownAt"), utc=True, errors="coerce")
        if pd.isna(ts):
            ts = now_utc
        if ts < cutoff_utc:
            continue

        entry = exposure_map.get(pid)
        if entry is None:
            exposure_map[pid] = {
                "impression_count": 1,
                "last_shown_at": ts,
            }
        else:
            entry["impression_count"] += 1
            if ts > entry["last_shown_at"]:
                entry["last_shown_at"] = ts

    # Finalize hours_since_last_shown and positive engagement flag
    for pid, info in exposure_map.items():
        last_ts = info["last_shown_at"]
        hours_ago = max(0.0, (now_utc - last_ts).total_seconds() / 3600.0) if pd.notna(last_ts) else 168.0
        info["hours_since_last_shown"] = round(float(hours_ago), 2)
        info["has_positive_engagement"] = pid in engaged_products

    # Also mark engaged products that had 0 impressions in the map if needed
    for ep in engaged_products:
        if ep not in exposure_map:
            exposure_map[ep] = {
                "impression_count": 0,
                "last_shown_at": None,
                "hours_since_last_shown": 999.0,
                "has_positive_engagement": True,
            }

    return exposure_map


def compute_exposure_rotation_factors(
    product_id: str,
    exposure_map: Optional[Dict[str, Dict[str, Any]]] = None,
) -> Dict[str, float]:
    """
    Computes exposure rotation penalty & novelty multiplier for a candidate product:
    - Products unseen in the last 7 days get full priority (penalty_factor=1.0) and a novelty bonus (1.5) for exploration.
    - Products that the user clicked or added to cart ('has_positive_engagement'=True) are NOT penalized like ignored items.
    - Ignored products with repeated impressions decay smoothly in priority, but never to 0 (minimum floor = 0.25)
      so high-ML-score products are never permanently eliminated.
    """
    if not exposure_map or product_id not in exposure_map:
        return {
            "impression_count": 0,
            "priority_decay": 1.0,
            "exploration_novelty": 1.5,
        }

    info = exposure_map[product_id]
    imp_count = int(info.get("impression_count", 0))
    hours_ago = float(info.get("hours_since_last_shown", 168.0))
    engaged = bool(info.get("has_positive_engagement", False))

    if imp_count <= 0:
        return {
            "impression_count": 0,
            "priority_decay": 1.0,
            "exploration_novelty": 1.5 if not engaged else 1.25,
        }

    if engaged:
        # User interacted positively (CLICK / ADD_TO_CART): exempt from ignored-impression penalty
        return {
            "impression_count": imp_count,
            "priority_decay": 0.96,
            "exploration_novelty": 1.15,
        }

    # Ignored impression penalty: smooth decay by count and recency
    count_decay = 1.0 / (1.0 + 0.35 * imp_count)
    if hours_ago < 0.5:
        recency_factor = 0.55
    elif hours_ago < 6.0:
        recency_factor = 0.72
    elif hours_ago < 24.0:
        recency_factor = 0.85
    else:
        recency_factor = 0.95

    priority_decay = max(0.25, round(count_decay * recency_factor, 4))
    exploration_novelty = max(0.15, round((1.0 / (1.0 + 0.65 * imp_count)) * recency_factor, 4))

    return {
        "impression_count": imp_count,
        "priority_decay": priority_decay,
        "exploration_novelty": exploration_novelty,
    }


def select_priority_and_exploration(
    ranked_candidates: pd.DataFrame,
    top_n: int = RECOMMENDATION_DEFAULT_TOP_N,
    pool_size: int = RECOMMENDATION_CANDIDATE_POOL_SIZE,
    max_per_category: int = RECOMMENDATION_MAX_PER_CATEGORY,
    priority_ratio: float = RECOMMENDATION_PRIORITY_RATIO,
    exposure_map: Optional[Dict[str, Dict[str, Any]]] = None,
    rng_seed: Optional[int] = None,
    current_category: Optional[str] = None,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Executes Candidate Pool Expansion (Top-30) + Diversity Re-ranking (6 Priority + 4 Exploration)
    + Exposure Rotation while strictly preserving original 'base_score' ('score'/'_mlScore') and 'orig_rank' ('rank'/'_mlRank').

    Rules enforced:
    1. Top-30 Candidate Pool: Retains up to 'pool_size' (30) top candidates by initial strategy score.
    2. Split: 6 Priority (60%) + 4 Exploration (40%) when top_n=10 (or proportional for custom top_n).
    3. Category Cap: At most 'max_per_category' (3) items per category across ALL selected items.
    4. Group 1 (Priority): Top items ranked by exposure-rotated priority score, respecting category cap.
    5. Group 2 (Exploration): Selected from remaining Top-30 candidates via Random Weighted Sampling
       where weights combine suitability score, unseen/low-impression novelty, and under-represented category boost.
    6. Fallback backfill: If insufficient exploration candidates meet the strict quality floor, backfills
       from remaining valid candidates without ever injecting invalid items.
    """
    if ranked_candidates.empty:
        return ranked_candidates.copy(), {
            "pool_size": 0,
            "priority_count": 0,
            "exploration_count": 0,
            "note": "No valid candidates available.",
        }

    df = ranked_candidates.copy().reset_index(drop=True)

    # Preserve original rank and score prior to any rotation
    if "orig_rank" not in df.columns:
        df["orig_rank"] = np.arange(1, len(df) + 1, dtype=int)
    if "base_score" not in df.columns:
        if "ml_score" in df.columns:
            df["base_score"] = pd.to_numeric(df["ml_score"], errors="coerce").fillna(0.0)
        elif "score" in df.columns:
            df["base_score"] = pd.to_numeric(df["score"], errors="coerce").fillna(0.5)
        else:
            df["base_score"] = np.linspace(0.9, 0.3, num=len(df))

    # Step 1: Restrict to Top-30 intermediate candidate pool
    effective_pool_size = max(int(pool_size), int(top_n))
    pool_df = df.head(effective_pool_size).copy().reset_index(drop=True)

    # Step 2: Compute Exposure Rotation & Context Affinity factors for each candidate in Top-30
    imp_counts = []
    priority_decays = []
    exp_novelties = []
    context_affinities = []

    target_cat = str(current_category).strip().lower() if current_category else ""

    for _, row in pool_df.iterrows():
        pid = str(row.get("product_id", ""))
        factors = compute_exposure_rotation_factors(pid, exposure_map)
        imp_counts.append(factors["impression_count"])
        priority_decays.append(factors["priority_decay"])
        exp_novelties.append(factors["exploration_novelty"])

        cat_str = str(row.get("primary_category", "")).strip().lower()
        if target_cat and cat_str:
            if cat_str == target_cat:
                context_affinities.append(1.35)
            elif (
                ("váy" in target_cat and "váy" in cat_str)
                or ("áo" in target_cat and ("quần" in cat_str or "chân váy" in cat_str or "set" in cat_str))
                or ("đầm" in target_cat and ("váy" in cat_str or "set" in cat_str or "phụ kiện" in cat_str))
                or ("chân váy" in target_cat and ("áo" in cat_str or "set" in cat_str))
                or ("quần" in target_cat and ("áo" in cat_str or "set" in cat_str))
            ):
                context_affinities.append(1.15)
            else:
                context_affinities.append(1.0)
        else:
            context_affinities.append(1.0)

    pool_df["impression_count_7d"] = imp_counts
    pool_df["priority_decay"] = priority_decays
    pool_df["exploration_novelty"] = exp_novelties
    pool_df["context_affinity"] = context_affinities

    # Effective priority score balances original relevance (55%), exposure freshness (45%), context affinity,
    # plus dynamic jitter for organic rotation among similar-tier items
    rng = np.random.default_rng(rng_seed)
    dynamic_jitter = rng.uniform(-0.02, 0.02, size=len(pool_df))
    pool_df["rotated_priority_score"] = (
        pool_df["base_score"] * (0.55 + 0.45 * pool_df["priority_decay"]) * pool_df["context_affinity"]
    ) + (pool_df["base_score"] * dynamic_jitter)

    # Determine target counts (exact 6 + 4 when top_n == 10)
    if top_n == RECOMMENDATION_DEFAULT_TOP_N:
        target_priority = min(RECOMMENDATION_PRIORITY_COUNT, len(pool_df))
    else:
        target_priority = min(int(round(top_n * priority_ratio)), len(pool_df))
        if top_n > 1 and target_priority >= top_n:
            target_priority = top_n - 1
    target_exploration = max(0, top_n - target_priority)

    selected_indices: List[int] = []
    selection_groups: Dict[int, str] = {}
    category_counts: Dict[str, int] = {}

    # Step 3: Select Group 1 — Priority Products (60%)
    priority_sorted = pool_df.sort_values(
        by=["rotated_priority_score", "base_score", "orig_rank"],
        ascending=[False, False, True],
    )

    for idx, row in priority_sorted.iterrows():
        if len(selected_indices) >= target_priority:
            break
        cat = str(row.get("primary_category", "Khác"))
        if category_counts.get(cat, 0) < max_per_category:
            selected_indices.append(int(idx))
            selection_groups[int(idx)] = "priority"
            category_counts[cat] = category_counts.get(cat, 0) + 1

    # Step 4: Select Group 2 — Exploration Products (40%) via Random Weighted Sampling
    max_pool_score = float(pool_df["base_score"].max()) if not pool_df.empty else 1.0
    quality_floor = max(0.005, 0.18 * max_pool_score)

    remaining_indices = [i for i in pool_df.index if int(i) not in selection_groups]

    exploration_picked = 0
    while exploration_picked < target_exploration and remaining_indices:
        # Filter candidates that respect category cap and quality floor
        eligible_indices = []
        weights = []

        for idx in remaining_indices:
            row = pool_df.loc[idx]
            cat = str(row.get("primary_category", "Khác"))
            curr_cat_count = category_counts.get(cat, 0)
            if curr_cat_count >= max_per_category:
                continue

            b_score = float(row.get("base_score", 0.0))
            if b_score < quality_floor:
                continue

            # Suitability component: proportional to (base_score / max_score)^0.75
            rel_norm = max(b_score, 0.01) / max(max_pool_score, 0.01)
            suitability_weight = math.pow(rel_norm, 0.75)

            # Novelty & exposure rotation component
            novelty_weight = float(row.get("exploration_novelty", 1.0))

            # Category diversity boost: favor categories not yet heavily represented in Priority group
            if curr_cat_count == 0:
                cat_boost = 1.80
            elif curr_cat_count == 1:
                cat_boost = 1.30
            else:
                cat_boost = 0.75

            # Dynamic candidate entropy to ensure active variety across requests
            entropy = rng.uniform(0.9, 1.1)

            w = max(1e-6, suitability_weight * novelty_weight * cat_boost * entropy)
            eligible_indices.append(int(idx))
            weights.append(w)

        if not eligible_indices:
            break

        weights_arr = np.asarray(weights, dtype=float)
        probs = weights_arr / weights_arr.sum()
        chosen_idx = int(rng.choice(eligible_indices, p=probs))

        selected_indices.append(chosen_idx)
        selection_groups[chosen_idx] = "exploration"
        chosen_cat = str(pool_df.loc[chosen_idx].get("primary_category", "Khác"))
        category_counts[chosen_cat] = category_counts.get(chosen_cat, 0) + 1
        remaining_indices.remove(chosen_idx)
        exploration_picked += 1

    # Step 5: Backfill if needed from remaining candidates that still respect max_per_category
    diversification_note = "ok"
    if len(selected_indices) < top_n and remaining_indices:
        for idx in priority_sorted.index:
            i_int = int(idx)
            if i_int in selection_groups:
                continue
            cat = str(pool_df.loc[i_int].get("primary_category", "Khác"))
            if category_counts.get(cat, 0) < max_per_category:
                selected_indices.append(i_int)
                selection_groups[i_int] = "exploration_backfill" if len(selected_indices) > target_priority else "priority"
                category_counts[cat] = category_counts.get(cat, 0) + 1
                if len(selected_indices) >= top_n:
                    break

    # Step 6: If the entire catalog/pool has too few categories to reach top_n under strict cap,
    # record the reason and only relax category cap when the total pool itself is small.
    if len(selected_indices) < top_n and len(pool_df) > len(selected_indices):
        diversification_note = (
            f"Candidate pool had limited category diversity under max_per_category={max_per_category}; "
            f"backfilled remaining valid items."
        )
        for idx in priority_sorted.index:
            i_int = int(idx)
            if i_int not in selection_groups:
                selected_indices.append(i_int)
                selection_groups[i_int] = "backfill_relaxed"
                if len(selected_indices) >= top_n:
                    break
    elif len(selected_indices) < top_n:
        diversification_note = f"Only {len(selected_indices)} valid candidates available (requested {top_n})."

    result_df = pool_df.loc[selected_indices].copy().reset_index(drop=True)
    result_df["selection_group"] = [selection_groups[i] for i in selected_indices]
    result_df["display_rank"] = np.arange(1, len(result_df) + 1, dtype=int)

    actual_priority = sum(1 for g in result_df["selection_group"] if g == "priority")
    actual_exploration = len(result_df) - actual_priority

    summary = {
        "pool_size": len(pool_df),
        "priority_count": actual_priority,
        "exploration_count": actual_exploration,
        "note": diversification_note,
    }
    return result_df, summary


def load_model_and_metadata(
    model_dir: Optional[Path] = None,
    allow_sandbox: bool = False,
    allow_bootstrap: bool = False,
) -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """
    Loads trained model and verifies production readiness or bootstrap authorization.
    If model was trained on synthetic data, it is rejected unless allow_bootstrap or allow_sandbox is enabled.
    """
    import joblib

    base_dir = Path(model_dir) if model_dir else OUTPUT_MODEL_DIR
    meta_path = base_dir / "model_metadata.json"

    if not meta_path.exists():
        logger.info(f"Model metadata not found at {meta_path}. Falling back to rule-based.")
        return None, None

    try:
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
    except Exception as e:
        logger.warning(f"Error parsing model metadata: {e}")
        return None, None

    is_prod_ready = meta.get("is_production_ready", False)
    trained_on_synthetic = meta.get("trained_on_synthetic", False)
    is_bootstrap = meta.get("is_bootstrap", False)

    if not is_prod_ready:
        if is_bootstrap and allow_bootstrap:
            logger.info(
                f"Authorizing bootstrap model '{meta.get('model_name')}' "
                f"(trained_on_synthetic={trained_on_synthetic}, source={meta.get('dataset_source')}) "
                f"via server-side configuration."
            )
        elif allow_sandbox:
            logger.info(f"Authorizing model '{meta.get('model_name')}' under sandbox mode.")
        else:
            logger.info(
                f"Model '{meta.get('model_name')}' is not flagged as production-ready "
                f"(trained_on_synthetic={trained_on_synthetic}, is_bootstrap={is_bootstrap}). "
                f"Rejecting model for production inference without server authorization."
            )
            return None, meta

    model_features = meta.get("feature_columns", [])
    if model_features != FEATURE_COLUMNS:
        logger.warning(
            f"Feature contract mismatch between model metadata and current code. "
            f"Model: {model_features} vs Code: {FEATURE_COLUMNS}"
        )
        return None, meta

    model_file = meta.get("model_file")
    if not model_file:
        logger.warning("No model_file specified in metadata.")
        return None, meta

    model_path = base_dir / model_file
    if not model_path.exists():
        logger.warning(f"Model file not found at {model_path}.")
        return None, meta

    try:
        model = joblib.load(model_path)
        return model, meta
    except Exception as e:
        logger.error(f"Error loading model from {model_path}: {e}")
        return None, meta


def apply_diversity_filter(
    df_ranked: pd.DataFrame,
    top_n: int = 8,
    max_per_category: int = 3,
) -> pd.DataFrame:
    """
    Applies category diversity so a single category does not dominate the recommendations.
    If insufficient items after filtering, relaxes the constraint to ensure top_n items are returned.
    """
    if df_ranked.empty:
        return df_ranked

    selected_rows = []
    category_counts: Dict[str, int] = {}
    remaining_rows = []

    for _, row in df_ranked.iterrows():
        cat = str(row.get("primary_category", "Khác"))
        curr_count = category_counts.get(cat, 0)
        if curr_count < max_per_category:
            selected_rows.append(row)
            category_counts[cat] = curr_count + 1
            if len(selected_rows) >= top_n:
                break
        else:
            remaining_rows.append(row)

    if len(selected_rows) < top_n and remaining_rows:
        deficit = top_n - len(selected_rows)
        selected_rows.extend(remaining_rows[:deficit])

    return pd.DataFrame(selected_rows)


def fallback_by_category(
    catalog: pd.DataFrame,
    current_product_id: str,
    top_n: int = 8,
    max_per_category: int = 4,
    exposure_map: Optional[Dict[str, Dict[str, Any]]] = None,
    purchased_products: Optional[Set[str]] = None,
    enable_exploration: bool = False,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Fallback 1: Category-based recommendation.
    Finds products in the same category as current_product_id.
    When enable_exploration=True (used in recommend()), expands candidate pool up to Top-30
    and applies Exposure Rotation + Priority/Exploration re-ranking.
    """
    current_id_clean = normalize_id(current_product_id)
    curr_match = catalog[catalog["product_id"] == current_id_clean]

    if curr_match.empty:
        return [], "Không tìm thấy sản phẩm hiện tại trong catalog."

    target_category = curr_match.iloc[0]["primary_category"]
    excl_purchased = purchased_products or set()

    candidates = catalog[
        (catalog["product_id"] != current_id_clean) &
        (catalog["primary_category"] == target_category) &
        (catalog["visibility"] == True) &
        (~catalog["product_id"].isin(excl_purchased))
    ].copy()

    if enable_exploration and "is_in_stock" in candidates.columns:
        in_stock_cands = candidates[candidates["is_in_stock"] == True].copy()
        if not in_stock_cands.empty:
            candidates = in_stock_cands

    if candidates.empty:
        return [], f"Không có sản phẩm nào khác cùng danh mục '{target_category}'."

    candidates["sort_stock"] = candidates["is_in_stock"].astype(int)
    candidates["sort_pop"] = pd.to_numeric(candidates.get("popularity_views", 0), errors="coerce").fillna(0.0)
    candidates = candidates.sort_values(
        by=["sort_stock", "sort_pop", "regular_price"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

    candidates["orig_rank"] = np.arange(1, len(candidates) + 1, dtype=int)
    max_pop = max(float(candidates["sort_pop"].max()), 1.0)
    candidates["base_score"] = np.round(
        0.65 + 0.25 * (candidates["sort_pop"] / max_pop) - 0.005 * (candidates["orig_rank"] - 1),
        4,
    ).clip(0.30, 0.90)

    if enable_exploration:
        # Supplement Top-30 pool with popular products from other categories if same-category has < Top-30
        if len(candidates) < RECOMMENDATION_CANDIDATE_POOL_SIZE:
            other_cands = catalog[
                (catalog["product_id"] != current_id_clean) &
                (catalog["primary_category"] != target_category) &
                (catalog["visibility"] == True) &
                (catalog["is_in_stock"] == True) &
                (~catalog["product_id"].isin(excl_purchased))
            ].copy()
            if not other_cands.empty:
                other_cands["sort_stock"] = other_cands["is_in_stock"].astype(int)
                other_cands["sort_pop"] = pd.to_numeric(other_cands.get("popularity_views", 0), errors="coerce").fillna(0.0)
                other_cands = other_cands.sort_values(
                    by=["sort_stock", "sort_pop", "regular_price"],
                    ascending=[False, False, False],
                ).reset_index(drop=True)
                other_cands["orig_rank"] = np.arange(len(candidates) + 1, len(candidates) + len(other_cands) + 1, dtype=int)
                other_max_pop = max(float(other_cands["sort_pop"].max()), 1.0)
                other_cands["base_score"] = np.round(
                    0.45 + 0.20 * (other_cands["sort_pop"] / other_max_pop),
                    4,
                ).clip(0.25, 0.65)
                candidates = pd.concat([candidates, other_cands], ignore_index=True)

        filtered, _ = select_priority_and_exploration(
            candidates,
            top_n=top_n,
            pool_size=RECOMMENDATION_CANDIDATE_POOL_SIZE,
            max_per_category=RECOMMENDATION_MAX_PER_CATEGORY,
            exposure_map=exposure_map,
            current_category=target_category,
        )
    else:
        filtered = candidates.head(top_n).copy()
        filtered["selection_group"] = "priority"
        filtered["display_rank"] = np.arange(1, len(filtered) + 1, dtype=int)

    results = []
    for _, row in filtered.iterrows():
        orig_score = float(row.get("base_score", 0.80)) if enable_exploration else 0.80
        orig_rank = int(row.get("orig_rank", 1))
        results.append({
            "product_id": str(row["product_id"]),
            "title": str(row.get("title", "")),
            "category": str(row.get("primary_category", "")),
            "regular_price": float(row.get("regular_price", 0.0)),
            "sale_price": float(row.get("sale_price", 0.0)),
            "is_in_stock": bool(row.get("is_in_stock", True)),
            "score": round(orig_score, 4),
            "_mlScore": round(orig_score, 4),
            "rank": orig_rank,
            "_mlRank": orig_rank,
            "display_rank": int(row.get("display_rank", orig_rank)),
            "selection_group": str(row.get("selection_group", "priority")),
            "reason": f"Sản phẩm cùng danh mục '{target_category}' nổi bật",
        })

    return results, "Thành công"


def fallback_by_popularity(
    catalog: pd.DataFrame,
    current_product_id: Optional[str] = None,
    top_n: int = 8,
    max_per_category: int = 3,
    exposure_map: Optional[Dict[str, Dict[str, Any]]] = None,
    purchased_products: Optional[Set[str]] = None,
    enable_exploration: bool = False,
) -> List[Dict[str, Any]]:
    """
    Fallback 2: Popularity-based recommendation across all categories with diversity.
    When enable_exploration=True, expands candidate pool to Top-30 and applies
    6 Priority + 4 Exploration Diversity Re-ranking with Exposure Rotation.
    """
    current_id_clean = normalize_id(current_product_id) if current_product_id else ""
    excl_purchased = purchased_products or set()

    candidates = catalog[
        (catalog["product_id"] != current_id_clean) &
        (catalog["visibility"] == True) &
        (~catalog["product_id"].isin(excl_purchased))
    ].copy()

    if enable_exploration and "is_in_stock" in candidates.columns:
        in_stock_cands = candidates[candidates["is_in_stock"] == True].copy()
        if not in_stock_cands.empty:
            candidates = in_stock_cands

    if candidates.empty:
        candidates = catalog.copy()

    candidates["sort_stock"] = candidates["is_in_stock"].astype(int)
    candidates["sort_pop"] = pd.to_numeric(candidates.get("popularity_views", 0), errors="coerce").fillna(0.0)
    candidates = candidates.sort_values(
        by=["sort_stock", "sort_pop", "regular_price"],
        ascending=[False, False, False],
    ).reset_index(drop=True)

    candidates["orig_rank"] = np.arange(1, len(candidates) + 1, dtype=int)
    candidates["base_score"] = [
        round(max(0.20, 0.75 - (idx * 0.015)), 4) for idx in range(len(candidates))
    ]

    if enable_exploration:
        diverse, _ = select_priority_and_exploration(
            candidates,
            top_n=top_n,
            pool_size=RECOMMENDATION_CANDIDATE_POOL_SIZE,
            max_per_category=max_per_category,
            exposure_map=exposure_map,
        )
    else:
        diverse = apply_diversity_filter(candidates, top_n=top_n, max_per_category=max_per_category).reset_index(drop=True)
        diverse["selection_group"] = "priority"
        diverse["display_rank"] = np.arange(1, len(diverse) + 1, dtype=int)

    results = []
    for idx, (_, row) in enumerate(diverse.iterrows()):
        pseudo_score = float(row.get("base_score", round(0.75 - (idx * 0.02), 4))) if enable_exploration else round(0.75 - (idx * 0.02), 4)
        orig_rank = int(row.get("orig_rank", idx + 1))
        results.append({
            "product_id": str(row["product_id"]),
            "title": str(row.get("title", "")),
            "category": str(row.get("primary_category", "")),
            "regular_price": float(row.get("regular_price", 0.0)),
            "sale_price": float(row.get("sale_price", 0.0)),
            "is_in_stock": bool(row.get("is_in_stock", True)),
            "score": pseudo_score,
            "_mlScore": pseudo_score,
            "rank": orig_rank,
            "_mlRank": orig_rank,
            "display_rank": int(row.get("display_rank", idx + 1)),
            "selection_group": str(row.get("selection_group", "priority")),
            "reason": "Sản phẩm thời trang nổi bật và được quan tâm nhiều nhất trên Chéri",
        })

    return results


def build_candidate_features(
    candidates_df: pd.DataFrame,
    user_id: Optional[str] = None,
    current_product_id: Optional[str] = None,
    catalog: Optional[pd.DataFrame] = None,
    interactions_df: Optional[pd.DataFrame] = None,
    orders_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Builds the 12-feature matrix conforming identically to FEATURE_COLUMNS for candidate items.
    Computes genuine user-level, product-level, and user-product interaction features from
    the user's interaction and order history, matching Offline Training ('_snapshot_rows').
    """
    ref_catalog = catalog if (catalog is not None and not catalog.empty) else candidates_df
    cat_lookup: Dict[str, str] = {}
    id_lookup: Dict[str, str] = {}
    if ref_catalog is not None and not ref_catalog.empty:
        for _, r in ref_catalog.iterrows():
            pid = str(r["product_id"]).strip()
            cat = str(r.get("primary_category", "Khác")).strip()
            if pid:
                cat_lookup[pid] = cat
                id_lookup[pid] = pid
                cat_lookup[pid.lower()] = cat
                id_lookup[pid.lower()] = pid
            if "title_url" in r and pd.notna(r["title_url"]):
                t_slug = str(r["title_url"]).strip().lower()
                if t_slug:
                    cat_lookup[t_slug] = cat
                    id_lookup[t_slug] = pid
            if "sku" in r and pd.notna(r["sku"]):
                t_sku = str(r["sku"]).strip().lower()
                if t_sku:
                    cat_lookup[t_sku] = cat
                    id_lookup[t_sku] = pid

    curr_cat = None
    curr_id_clean = ""
    if current_product_id:
        raw_c = str(current_product_id).strip()
        raw_c_lower = raw_c.lower()
        curr_id_clean = id_lookup.get(raw_c, id_lookup.get(raw_c_lower, normalize_id(raw_c)))
        curr_cat = cat_lookup.get(raw_c, cat_lookup.get(raw_c_lower, cat_lookup.get(curr_id_clean)))

    u_key = normalize_user_key(user_id) if user_id else ""

    global_pop_map: Dict[str, int] = {}
    has_user_history = False
    u_total_views = 0
    u_distinct_products = 0
    up_views_map: Dict[str, int] = {}
    up_last_ts_map: Dict[str, pd.Timestamp] = {}
    u_cat_views_map: Dict[str, int] = {}
    u_cat_last_ts_map: Dict[str, pd.Timestamp] = {}
    u_total_orders = 0
    purchased_products: Set[str] = set()
    ref_ts = pd.Timestamp.now(tz="UTC")

    if interactions_df is not None and not interactions_df.empty:
        ev = interactions_df.copy()
        if "is_synthetic" in ev.columns:
            ev = ev[ev["is_synthetic"] != True]
        if "clean_product_id" in ev.columns and "product_id" not in ev.columns:
            ev["product_id"] = ev["clean_product_id"].astype(str)
        elif "product_key" in ev.columns and "product_id" not in ev.columns:
            ev["product_id"] = ev["product_key"].astype(str)
        elif "product_id" in ev.columns:
            ev["product_id"] = ev["product_id"].astype(str)

        ev["event_type"] = ev.get("event_type", "VIEW").astype(str).str.upper()
        if "event_timestamp" in ev.columns:
            ev["ts"] = pd.to_datetime(ev["event_timestamp"], utc=True, errors="coerce")
        elif "timestamp" in ev.columns:
            ev["ts"] = pd.to_datetime(ev["timestamp"], utc=True, errors="coerce")
        else:
            ev["ts"] = pd.NaT

        max_ev_ts = ev["ts"].max()
        if pd.notna(max_ev_ts) and max_ev_ts > ref_ts:
            ref_ts = max_ev_ts

        views_all = ev[ev["event_type"] == "VIEW"]
        if not views_all.empty and "product_id" in views_all.columns:
            global_pop_map = views_all.groupby("product_id").size().to_dict()

        if u_key and "user_key" in ev.columns:
            u_ev = ev[ev["user_key"] == u_key]
            u_views_df = u_ev[u_ev["event_type"].isin(["VIEW", "CLICK", "ADD_TO_CART"])].copy()
            if not u_views_df.empty:
                has_user_history = True
                u_views_df["category"] = u_views_df["product_id"].map(lambda pid: cat_lookup.get(str(pid), "Khác"))
                u_total_views = int(len(u_views_df))
                u_distinct_products = int(u_views_df["product_id"].nunique())
                up_views_map = u_views_df.groupby("product_id").size().to_dict()
                valid_ts_df = u_views_df.dropna(subset=["ts"])
                if not valid_ts_df.empty:
                    up_last_ts_map = valid_ts_df.groupby("product_id")["ts"].max().to_dict()
                    u_cat_last_ts_map = valid_ts_df.groupby("category")["ts"].max().to_dict()
                u_cat_views_map = u_views_df.groupby("category").size().to_dict()

            u_purchases_df = u_ev[u_ev["event_type"] == "PURCHASE"]
            if not u_purchases_df.empty:
                purchased_products.update(u_purchases_df["product_id"].dropna().astype(str).tolist())
                u_total_orders = max(u_total_orders, int(len(u_purchases_df)))

    if u_key and orders_df is not None and not orders_df.empty and "user_key" in orders_df.columns:
        u_ord = orders_df[orders_df["user_key"] == u_key]
        if "is_successful_conversion" in u_ord.columns:
            u_ord = u_ord[u_ord["is_successful_conversion"] == True]
        if not u_ord.empty:
            if "order_id" in u_ord.columns:
                u_total_orders = int(u_ord["order_id"].nunique())
            else:
                u_total_orders = max(u_total_orders, int(len(u_ord)))
            for p_col in ("clean_product_id", "product_id", "product_key"):
                if p_col in u_ord.columns:
                    purchased_products.update(u_ord[p_col].dropna().astype(str).tolist())
                    break

    features_list = []
    for _, row in candidates_df.iterrows():
        p_id = str(row.get("product_id", ""))
        p_cat = str(row.get("primary_category", "Khác"))
        p_price = float(row.get("sale_price", 0.0) or row.get("regular_price", 0.0))
        p_variants = int(row.get("variant_count", 1))
        if "in_stock" in row and not pd.isna(row.get("in_stock")):
            p_stock = 1.0 if float(row.get("in_stock", 0)) > 0 else 0.0
        elif "is_in_stock" in row and not pd.isna(row.get("is_in_stock")):
            p_stock = 1.0 if bool(row.get("is_in_stock")) else 0.0
        else:
            p_stock = 0.0
        p_visibility = 1.0 if row.get("visibility", True) else 0.0

        raw_pop = row.get("popularity_views", None)
        if raw_pop is not None and not pd.isna(raw_pop) and float(raw_pop) > 0:
            p_views = float(raw_pop)
        else:
            p_views = float(global_pop_map.get(p_id, 0))

        is_same_cat = 1.0 if (curr_cat and p_cat == curr_cat) else 0.0

        if has_user_history:
            feat_u_total_views = float(u_total_views) + (3.0 if curr_cat else 0.0)
            feat_u_distinct = float(u_distinct_products)
            feat_up_views = float(up_views_map.get(p_id, 0))
            feat_u_cat_views = float(u_cat_views_map.get(p_cat, 0)) + (3.5 if is_same_cat else 0.0)

            last_prod_ts = up_last_ts_map.get(p_id)
            if last_prod_ts is not None and pd.notna(last_prod_ts):
                recency = max(0.0, round((ref_ts - last_prod_ts).total_seconds() / 86400.0, 2))
            elif is_same_cat:
                recency = 0.05
            elif p_cat in u_cat_last_ts_map and pd.notna(u_cat_last_ts_map[p_cat]):
                recency = max(0.5, round((ref_ts - u_cat_last_ts_map[p_cat]).total_seconds() / 86400.0, 2))
            else:
                recency = 999.0

            feat_u_orders = float(u_total_orders)
            feat_prev_purchased = 1.0 if p_id in purchased_products else 0.0
        else:
            feat_u_total_views = 3.0 if curr_cat else 0.0
            feat_u_distinct = 1.0 if curr_cat else 0.0
            feat_up_views = 0.0
            feat_u_cat_views = 3.5 if is_same_cat else 0.0
            recency = 0.05 if is_same_cat else 999.0
            feat_u_orders = float(u_total_orders)
            feat_prev_purchased = 1.0 if p_id in purchased_products else 0.0

        feat_row = {
            "user_total_views": feat_u_total_views,
            "user_distinct_products_viewed": feat_u_distinct,
            "user_product_views": feat_up_views,
            "user_category_views": feat_u_cat_views,
            "days_since_last_view": float(recency),
            "user_total_orders_before": feat_u_orders,
            "user_previously_purchased": feat_prev_purchased,
            "product_price": p_price,
            "product_variant_count": float(p_variants),
            "product_in_stock": p_stock,
            "product_visibility": p_visibility,
            "product_popularity_views": p_views,
        }
        features_list.append(feat_row)

    df_feats = pd.DataFrame(features_list)
    return df_feats[FEATURE_COLUMNS].fillna(0.0)


def recommend(
    user_id: Optional[str] = None,
    current_product_id: Optional[str] = None,
    top_n: int = RECOMMENDATION_DEFAULT_TOP_N,
    model_dir: Optional[Path] = None,
    data_dir: Optional[Path] = None,
    allow_sandbox: bool = False,
    allow_bootstrap: bool = False,
    exposure_map: Optional[Dict[str, Dict[str, Any]]] = None,
    rng_seed: Optional[int] = None,
    recommendation_context_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main recommendation workflow:
    1. Loads product catalog, user interaction/order history, and 7-day exposure history ('recommendation_impressions').
    2. Checks model and metadata.
    3. If model valid and ready -> Filters out out-of-stock & already-purchased items,
       scores all valid candidates via 12-feature matrix, retains Top-30 candidate pool,
       and selects 6 Priority (60%) + 4 Exploration (40%) with Exposure Rotation and max 3 per category.
    4. If model not ready -> Activates Fallback 1 (Category) or Fallback 2 (Popularity) with Top-30 pool
       and synchronized Diversity Re-ranking + Exposure Rotation.
    """
    catalog = load_catalog(data_dir=data_dir)
    if catalog.empty:
        return {
            "status": "error",
            "message": "Product catalog is empty or unavailable.",
            "strategy": "none",
            "model_used": "None",
            "count": 0,
            "recommendations": [],
        }

    interactions_df, orders_df = load_user_history(data_dir=data_dir, raw_user_id=user_id)
    purchased_products = get_user_purchased_products(user_id, interactions_df, orders_df)
    if exposure_map is None:
        exposure_map = load_exposure_history(
            raw_user_id=user_id,
            interactions_df=interactions_df,
            data_dir=data_dir,
            recommendation_context_id=recommendation_context_id,
        )

    model, metadata = load_model_and_metadata(
        model_dir=model_dir,
        allow_sandbox=allow_sandbox,
        allow_bootstrap=allow_bootstrap,
    )

    # -------------------------------------------------------------
    # PATH A: Machine Learning Model Inference
    # -------------------------------------------------------------
    if model is not None and metadata is not None:
        try:
            curr_id_clean = ""
            curr_slug_clean = None
            curr_cat = None
            if current_product_id:
                raw_curr = str(current_product_id).strip()
                raw_lower = raw_curr.lower()
                for _, crow in catalog.iterrows():
                    c_pid = str(crow.get("product_id", "")).strip()
                    c_slug = str(crow.get("title_url", "")).strip().lower() if pd.notna(crow.get("title_url")) else ""
                    c_sku = str(crow.get("sku", "")).strip().lower() if pd.notna(crow.get("sku")) else ""
                    c_cat = str(crow.get("primary_category", "Khác")).strip()
                    if raw_curr == c_pid or raw_lower == c_pid.lower() or raw_lower == c_slug or raw_lower == c_sku:
                        curr_id_clean = c_pid
                        curr_slug_clean = c_slug if c_slug else None
                        curr_cat = c_cat
                        break
                if not curr_id_clean:
                    curr_id_clean = normalize_id(raw_curr)

            candidates = catalog[
                (catalog["product_id"] != curr_id_clean) &
                (catalog["visibility"] == True) &
                (catalog["is_in_stock"] == True) &
                (~catalog["product_id"].isin(purchased_products))
            ].copy()
            if curr_slug_clean and "title_url" in candidates.columns:
                candidates = candidates[candidates["title_url"].str.lower() != curr_slug_clean].copy()

            if candidates.empty:
                candidates = catalog[
                    (catalog["product_id"] != curr_id_clean) &
                    (catalog["visibility"] == True) &
                    (catalog["is_in_stock"] == True)
                ].copy()
                if curr_slug_clean and "title_url" in candidates.columns:
                    candidates = candidates[candidates["title_url"].str.lower() != curr_slug_clean].copy()
            if candidates.empty:
                candidates = catalog[
                    (catalog["product_id"] != curr_id_clean) &
                    (catalog["visibility"] == True)
                ].copy()
                if curr_slug_clean and "title_url" in candidates.columns:
                    candidates = candidates[candidates["title_url"].str.lower() != curr_slug_clean].copy()
            if candidates.empty:
                candidates = catalog.copy()

            X_cand = build_candidate_features(
                candidates,
                user_id=user_id,
                current_product_id=curr_id_clean or current_product_id,
                catalog=catalog,
                interactions_df=interactions_df,
                orders_df=orders_df,
            )

            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X_cand)
                pos_probs = probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
            else:
                pos_probs = model.predict(X_cand)

            candidates["ml_score"] = pos_probs
            candidates["base_score"] = pos_probs
            candidates["sort_pop"] = pd.to_numeric(candidates.get("popularity_views", 0), errors="coerce").fillna(0.0)
            candidates = candidates.sort_values(
                by=["ml_score", "sort_pop", "regular_price"],
                ascending=[False, False, False],
            ).reset_index(drop=True)

            # Record original ML rank before Diversity Re-ranking & Exposure Rotation
            candidates["orig_rank"] = np.arange(1, len(candidates) + 1, dtype=int)

            # Ensure Top-30 candidate pool contains balanced category representation (at most 10 per category in pool)
            pool_indices = []
            pool_cat_counts: Dict[str, int] = {}
            for idx, r in candidates.iterrows():
                p_cat = str(r.get("primary_category", "Khác"))
                if pool_cat_counts.get(p_cat, 0) < 10:
                    pool_indices.append(idx)
                    pool_cat_counts[p_cat] = pool_cat_counts.get(p_cat, 0) + 1
                    if len(pool_indices) >= RECOMMENDATION_CANDIDATE_POOL_SIZE:
                        break
            if len(pool_indices) < RECOMMENDATION_CANDIDATE_POOL_SIZE:
                for idx in candidates.index:
                    if idx not in pool_indices:
                        pool_indices.append(idx)
                        if len(pool_indices) >= RECOMMENDATION_CANDIDATE_POOL_SIZE:
                            break
            pool_candidates = candidates.loc[pool_indices].reset_index(drop=True)

            diverse_cands, div_summary = select_priority_and_exploration(
                pool_candidates,
                top_n=top_n,
                pool_size=RECOMMENDATION_CANDIDATE_POOL_SIZE,
                max_per_category=RECOMMENDATION_MAX_PER_CATEGORY,
                priority_ratio=RECOMMENDATION_PRIORITY_RATIO,
                exposure_map=exposure_map,
                rng_seed=rng_seed,
                current_category=curr_cat,
            )

            is_bootstrap = metadata.get("is_bootstrap", False)
            strategy = "ml_bootstrap_model" if is_bootstrap else "ml_model"
            data_source = metadata.get("dataset_source", "synthetic_bootstrap" if is_bootstrap else "real_data")

            recs = []
            for _, row in diverse_cands.iterrows():
                orig_ml_score = round(float(row["ml_score"]), 4)
                orig_ml_rank = int(row.get("orig_rank", 1))
                disp_rank = int(row.get("display_rank", orig_ml_rank))
                sel_group = str(row.get("selection_group", "priority"))
                recs.append({
                    "product_id": str(row["product_id"]),
                    "title": str(row.get("title", "")),
                    "category": str(row.get("primary_category", "")),
                    "regular_price": float(row.get("regular_price", 0.0)),
                    "sale_price": float(row.get("sale_price", 0.0)),
                    "is_in_stock": bool(row.get("is_in_stock", True)),
                    "score": orig_ml_score,
                    "_mlScore": orig_ml_score,
                    "rank": orig_ml_rank,
                    "_mlRank": orig_ml_rank,
                    "display_rank": disp_rank,
                    "selection_group": sel_group,
                    "reason": (
                        "Mô hình Random Forest bootstrap dự đoán mức độ quan tâm cao dựa trên đặc trưng tương tác và sản phẩm"
                        if is_bootstrap
                        else "Mô hình ML dự đoán khách hàng có xác suất quan tâm cao dựa trên đặc trưng tương tác"
                    ),
                })

            return {
                "status": "success",
                "strategy": strategy,
                "model_used": metadata.get("model_name", "TrainedModel"),
                "is_bootstrap": is_bootstrap,
                "data_source": data_source,
                "user_key": normalize_user_key(user_id) if user_id else None,
                "current_product_id": current_product_id,
                "recommendation_context_id": recommendation_context_id,
                "candidate_pool_size": div_summary["pool_size"],
                "priority_count": div_summary["priority_count"],
                "exploration_count": div_summary["exploration_count"],
                "diversification_note": div_summary["note"],
                "count": len(recs),
                "recommendations": recs,
            }
        except Exception as e:
            logger.error(f"Inference error during ML prediction: {e}. Falling back to rule-based.")

    # -------------------------------------------------------------
    # PATH B: Fallback 1 - Category-based (if current_product_id given)
    # -------------------------------------------------------------
    if current_product_id:
        cat_recs, msg = fallback_by_category(
            catalog,
            current_product_id,
            top_n=top_n,
            max_per_category=RECOMMENDATION_MAX_PER_CATEGORY,
            exposure_map=exposure_map,
            purchased_products=purchased_products,
            enable_exploration=True,
        )
        if len(cat_recs) >= top_n:
            return {
                "status": "success",
                "strategy": "fallback_category",
                "model_used": "None",
                "current_product_id": current_product_id,
                "recommendation_context_id": recommendation_context_id,
                "count": len(cat_recs),
                "recommendations": cat_recs[:top_n],
            }
        elif cat_recs:
            needed = top_n - len(cat_recs)
            existing_ids = {r["product_id"] for r in cat_recs}
            pop_recs = fallback_by_popularity(
                catalog,
                current_product_id,
                top_n=top_n * 2,
                max_per_category=RECOMMENDATION_MAX_PER_CATEGORY,
                exposure_map=exposure_map,
                purchased_products=purchased_products,
                enable_exploration=True,
            )
            padded = list(cat_recs)
            cat_counts: Dict[str, int] = {}
            for r in padded:
                c = r.get("category", "Khác")
                cat_counts[c] = cat_counts.get(c, 0) + 1

            for r in pop_recs:
                if len(padded) >= top_n:
                    break
                if r["product_id"] in existing_ids:
                    continue
                c = r.get("category", "Khác")
                if cat_counts.get(c, 0) < RECOMMENDATION_MAX_PER_CATEGORY:
                    r_copy = dict(r)
                    r_copy["display_rank"] = len(padded) + 1
                    padded.append(r_copy)
                    existing_ids.add(r["product_id"])
                    cat_counts[c] = cat_counts.get(c, 0) + 1

            # Final fallback if small catalog could not fill under strict category cap
            if len(padded) < top_n:
                for r in pop_recs:
                    if len(padded) >= top_n:
                        break
                    if r["product_id"] not in existing_ids:
                        r_copy = dict(r)
                        r_copy["display_rank"] = len(padded) + 1
                        padded.append(r_copy)
                        existing_ids.add(r["product_id"])

            return {
                "status": "success",
                "strategy": "fallback_category",
                "model_used": "None",
                "current_product_id": current_product_id,
                "recommendation_context_id": recommendation_context_id,
                "count": len(padded),
                "recommendations": padded,
            }

    # -------------------------------------------------------------
    # PATH C: Fallback 2 - Popularity-based
    # -------------------------------------------------------------
    pop_recs = fallback_by_popularity(
        catalog,
        current_product_id,
        top_n=top_n,
        max_per_category=RECOMMENDATION_MAX_PER_CATEGORY,
        exposure_map=exposure_map,
        purchased_products=purchased_products,
        enable_exploration=True,
    )
    return {
        "status": "success",
        "strategy": "fallback_popularity",
        "model_used": "None",
        "current_product_id": current_product_id,
        "recommendation_context_id": recommendation_context_id,
        "count": len(pop_recs),
        "recommendations": pop_recs,
    }


def main():
    parser = argparse.ArgumentParser(description="Cheri Machine Learning - Recommendation Inference Engine (Phase B2)")
    parser.add_argument("--user-id", type=str, default=None, help="User ID or guest session key")
    parser.add_argument("--product-id", type=str, default=None, help="Current product ID being viewed")
    parser.add_argument("--top-n", type=int, default=RECOMMENDATION_DEFAULT_TOP_N, help="Number of products to recommend (default: 10)")
    parser.add_argument("--model-dir", type=str, default=None, help="Path to models directory")
    parser.add_argument("--data-dir", type=str, default=None, help="Path to data directory")
    parser.add_argument("--allow-sandbox", action="store_true", help="Allow inference with sandbox model for technical testing")
    parser.add_argument("--allow-bootstrap", action="store_true", help="Allow inference with bootstrap model authorized server-side")
    parser.add_argument("--context-id", "--recommendation-context-id", dest="context_id", type=str, default=None, help="Recommendation Context ID for isolating impression exposure scope")
    args = parser.parse_args()

    result = recommend(
        user_id=args.user_id,
        current_product_id=args.product_id,
        top_n=args.top_n,
        model_dir=Path(args.model_dir) if args.model_dir else None,
        data_dir=Path(args.data_dir) if args.data_dir else None,
        allow_sandbox=args.allow_sandbox,
        allow_bootstrap=args.allow_bootstrap,
        recommendation_context_id=args.context_id,
    )

    # Print strict JSON to stdout so consumer (NestJS) can read safely
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
