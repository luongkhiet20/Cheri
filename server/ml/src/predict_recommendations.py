"""
Online Inference and Recommendation Engine for Cheri Machine Learning System.
Phase B2: Implements Top-N recommendations, model validation gates, post-ranking diversity,
and robust 2-tier cold-start fallbacks (Category-based and Popularity-based).
"""

import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

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

from src.config import OUTPUT_DATA_DIR, OUTPUT_MODEL_DIR, normalize_product_key
from src.train_model import FEATURE_COLUMNS

def normalize_id(val: Any) -> str:
    if val is None:
        return ""
    return normalize_product_key(val)["clean_product_id"]

# Configure logging to stderr so stdout is reserved for pure JSON output
logger = logging.getLogger("cheri_inference")
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
        logger.warning(f"Catalog file not found at {catalog_path}.")
        return pd.DataFrame()

    try:
        df = pd.read_csv(catalog_path, dtype={"product_id": str})
        df["product_id"] = df["product_id"].astype(str).str.strip()
        df["primary_category"] = df["primary_category"].fillna("Khác").astype(str)
        df["regular_price"] = pd.to_numeric(df.get("regular_price", 0), errors="coerce").fillna(0.0)
        df["sale_price"] = pd.to_numeric(df.get("sale_price", 0), errors="coerce").fillna(0.0)
        df["is_in_stock"] = df.get("is_in_stock", True).astype(bool)
        df["visibility"] = df.get("visibility", True).astype(bool)
        df["variant_count"] = pd.to_numeric(df.get("variant_count", 1), errors="coerce").fillna(1).astype(int)
        return df
    except Exception as e:
        logger.error(f"Failed to load catalog: {e}")
        return pd.DataFrame()


def load_model_and_metadata(
    model_dir: Optional[Path] = None,
    allow_sandbox: bool = False,
) -> Tuple[Optional[Any], Optional[Dict[str, Any]]]:
    """
    Loads trained model and verifies production readiness.
    If model was trained on synthetic data and allow_sandbox is False,
    the model is strictly rejected for production inference.
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

    # Check production readiness guard
    is_prod_ready = meta.get("is_production_ready", False)
    trained_on_synthetic = meta.get("trained_on_synthetic", False)

    if not is_prod_ready and not allow_sandbox:
        logger.info(
            f"Model '{meta.get('model_name')}' is not flagged as production-ready "
            f"(trained_on_synthetic={trained_on_synthetic}). Rejecting model for production inference."
        )
        return None, meta

    # Check feature contract consistency
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

    # If diverse selection gave fewer than top_n, fill from remaining
    if len(selected_rows) < top_n and remaining_rows:
        deficit = top_n - len(selected_rows)
        selected_rows.extend(remaining_rows[:deficit])

    return pd.DataFrame(selected_rows)


def fallback_by_category(
    catalog: pd.DataFrame,
    current_product_id: str,
    top_n: int = 8,
    max_per_category: int = 4,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Fallback 1: Category-based recommendation.
    Finds products in the same category as current_product_id.
    """
    current_id_clean = normalize_id(current_product_id)
    curr_match = catalog[catalog["product_id"] == current_id_clean]

    if curr_match.empty:
        return [], "Không tìm thấy sản phẩm hiện tại trong catalog."

    target_category = curr_match.iloc[0]["primary_category"]

    # Filter by category and exclude current product
    candidates = catalog[
        (catalog["product_id"] != current_id_clean) &
        (catalog["primary_category"] == target_category) &
        (catalog["visibility"] == True)
    ].copy()

    if candidates.empty:
        return [], f"Không có sản phẩm nào khác cùng danh mục '{target_category}'."

    # Sort: in-stock first, then by price descending
    candidates["sort_stock"] = candidates["is_in_stock"].astype(int)
    candidates = candidates.sort_values(by=["sort_stock", "regular_price"], ascending=[False, False])

    filtered = candidates.head(top_n)

    results = []
    for _, row in filtered.iterrows():
        results.append({
            "product_id": str(row["product_id"]),
            "title": str(row.get("title", "")),
            "category": str(row.get("primary_category", "")),
            "regular_price": float(row.get("regular_price", 0.0)),
            "sale_price": float(row.get("sale_price", 0.0)),
            "is_in_stock": bool(row.get("is_in_stock", True)),
            "score": 0.80,
            "reason": f"Sản phẩm cùng danh mục '{target_category}' nổi bật",
        })

    return results, "Thành công"


def fallback_by_popularity(
    catalog: pd.DataFrame,
    current_product_id: Optional[str] = None,
    top_n: int = 8,
    max_per_category: int = 3,
) -> List[Dict[str, Any]]:
    """
    Fallback 2: Popularity-based recommendation across all categories with diversity.
    """
    current_id_clean = normalize_id(current_product_id) if current_product_id else ""

    candidates = catalog[
        (catalog["product_id"] != current_id_clean) &
        (catalog["visibility"] == True)
    ].copy()

    if candidates.empty:
        candidates = catalog.copy()

    # Prioritize in-stock items
    candidates["sort_stock"] = candidates["is_in_stock"].astype(int)
    candidates = candidates.sort_values(by=["sort_stock", "regular_price"], ascending=[False, False])

    # Apply diversity
    diverse = apply_diversity_filter(candidates, top_n=top_n, max_per_category=max_per_category)

    results = []
    for idx, (_, row) in enumerate(diverse.iterrows()):
        # Assigned score descending from 0.75
        pseudo_score = round(0.75 - (idx * 0.02), 4)
        results.append({
            "product_id": str(row["product_id"]),
            "title": str(row.get("title", "")),
            "category": str(row.get("primary_category", "")),
            "regular_price": float(row.get("regular_price", 0.0)),
            "sale_price": float(row.get("sale_price", 0.0)),
            "is_in_stock": bool(row.get("is_in_stock", True)),
            "score": pseudo_score,
            "reason": "Sản phẩm thời trang nổi bật và được quan tâm nhiều nhất trên Chéri",
        })

    return results


def build_candidate_features(
    candidates_df: pd.DataFrame,
    user_id: Optional[str] = None,
    interactions_df: Optional[pd.DataFrame] = None,
) -> pd.DataFrame:
    """
    Builds the 12-feature matrix conforming identically to FEATURE_COLUMNS for candidate items.
    """
    features_list = []

    # Calculate user-level summary if user_id provided
    u_views = 0
    u_distinct = 0
    u_orders = 0
    days_since = 999.0

    if user_id and interactions_df is not None and not interactions_df.empty:
        u_clean = normalize_id(user_id)
        u_records = interactions_df[interactions_df["user_key"] == u_clean]
        if not u_records.empty:
            u_views = len(u_records)
            u_distinct = u_records["product_id"].nunique()
            days_since = 1.0

    for _, row in candidates_df.iterrows():
        p_price = float(row.get("sale_price", 0.0) or row.get("regular_price", 0.0))
        p_variants = int(row.get("variant_count", 1))
        p_stock = 1.0 if row.get("is_in_stock", True) else 0.0
        p_visibility = 1.0 if row.get("visibility", True) else 0.0
        p_views = 1.0  # neutral popularity default

        feat_row = {
            "user_total_views": float(u_views),
            "user_distinct_products_viewed": float(u_distinct),
            "user_product_views": 0.0,
            "user_category_views": float(u_views),
            "days_since_last_view": float(days_since),
            "user_total_orders_before": float(u_orders),
            "user_previously_purchased": 0.0,
            "product_price": p_price,
            "product_variant_count": float(p_variants),
            "product_in_stock": p_stock,
            "product_visibility": p_visibility,
            "product_popularity_views": p_views,
        }
        features_list.append(feat_row)

    df_feats = pd.DataFrame(features_list)
    # Ensure exact column ordering matching FEATURE_COLUMNS contract
    return df_feats[FEATURE_COLUMNS].fillna(0.0)


def recommend(
    user_id: Optional[str] = None,
    current_product_id: Optional[str] = None,
    top_n: int = 8,
    model_dir: Optional[Path] = None,
    data_dir: Optional[Path] = None,
    allow_sandbox: bool = False,
) -> Dict[str, Any]:
    """
    Main recommendation workflow:
    1. Loads product catalog.
    2. Checks model and metadata.
    3. If model valid and ready -> Generates candidate features and predicts Top-N.
    4. If model not ready -> Activates Fallback 1 (Category) or Fallback 2 (Popularity).
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

    # Attempt to load ML model
    model, metadata = load_model_and_metadata(model_dir=model_dir, allow_sandbox=allow_sandbox)

    # -------------------------------------------------------------
    # PATH A: Machine Learning Model Inference
    # -------------------------------------------------------------
    if model is not None and metadata is not None:
        try:
            curr_id_clean = normalize_id(current_product_id) if current_product_id else ""
            candidates = catalog[
                (catalog["product_id"] != curr_id_clean) &
                (catalog["visibility"] == True)
            ].copy()

            if candidates.empty:
                candidates = catalog.copy()

            # Build feature matrix
            X_cand = build_candidate_features(candidates, user_id=user_id)

            # Predict probabilities
            if hasattr(model, "predict_proba"):
                probs = model.predict_proba(X_cand)
                pos_probs = probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
            else:
                pos_probs = model.predict(X_cand)

            candidates["ml_score"] = pos_probs
            candidates = candidates.sort_values(by="ml_score", ascending=False)

            diverse_cands = apply_diversity_filter(candidates, top_n=top_n, max_per_category=3)

            recs = []
            for _, row in diverse_cands.iterrows():
                recs.append({
                    "product_id": str(row["product_id"]),
                    "title": str(row.get("title", "")),
                    "category": str(row.get("primary_category", "")),
                    "regular_price": float(row.get("regular_price", 0.0)),
                    "sale_price": float(row.get("sale_price", 0.0)),
                    "is_in_stock": bool(row.get("is_in_stock", True)),
                    "score": round(float(row["ml_score"]), 4),
                    "reason": "Mô hình ML dự đoán khách hàng có xác suất quan tâm cao dựa trên đặc trưng tương tác",
                })

            return {
                "status": "success",
                "strategy": "ml_model",
                "model_used": metadata.get("model_name", "TrainedModel"),
                "current_product_id": current_product_id,
                "count": len(recs),
                "recommendations": recs,
            }
        except Exception as e:
            logger.error(f"Inference error during ML prediction: {e}. Falling back to rule-based.")

    # -------------------------------------------------------------
    # PATH B: Fallback 1 - Category-based (if current_product_id given)
    # -------------------------------------------------------------
    if current_product_id:
        cat_recs, msg = fallback_by_category(catalog, current_product_id, top_n=top_n)
        if len(cat_recs) >= top_n:
            return {
                "status": "success",
                "strategy": "fallback_category",
                "model_used": "None",
                "current_product_id": current_product_id,
                "count": len(cat_recs),
                "recommendations": cat_recs,
            }
        elif cat_recs:
            # Partially matched, pad with Popularity fallback
            needed = top_n - len(cat_recs)
            existing_ids = {r["product_id"] for r in cat_recs}
            pop_recs = fallback_by_popularity(catalog, current_product_id, top_n=top_n)
            padded = cat_recs + [r for r in pop_recs if r["product_id"] not in existing_ids][:needed]
            return {
                "status": "success",
                "strategy": "fallback_category",
                "model_used": "None",
                "current_product_id": current_product_id,
                "count": len(padded),
                "recommendations": padded,
            }

    # -------------------------------------------------------------
    # PATH C: Fallback 2 - Popularity-based
    # -------------------------------------------------------------
    pop_recs = fallback_by_popularity(catalog, current_product_id, top_n=top_n)
    return {
        "status": "success",
        "strategy": "fallback_popularity",
        "model_used": "None",
        "current_product_id": current_product_id,
        "count": len(pop_recs),
        "recommendations": pop_recs,
    }


def main():
    parser = argparse.ArgumentParser(description="Cheri Machine Learning - Recommendation Inference Engine (Phase B2)")
    parser.add_argument("--user-id", type=str, default=None, help="User ID or guest session key")
    parser.add_argument("--product-id", type=str, default=None, help="Current product ID being viewed")
    parser.add_argument("--top-n", type=int, default=8, help="Number of products to recommend (default: 8)")
    parser.add_argument("--model-dir", type=str, default=None, help="Path to models directory")
    parser.add_argument("--data-dir", type=str, default=None, help="Path to data directory")
    parser.add_argument("--allow-sandbox", action="store_true", help="Allow inference with sandbox model for technical testing")
    args = parser.parse_args()

    result = recommend(
        user_id=args.user_id,
        current_product_id=args.product_id,
        top_n=args.top_n,
        model_dir=Path(args.model_dir) if args.model_dir else None,
        data_dir=Path(args.data_dir) if args.data_dir else None,
        allow_sandbox=args.allow_sandbox,
    )

    # Print strict JSON to stdout so consumer (NestJS) can read safely
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
