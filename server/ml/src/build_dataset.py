"""
Dataset Construction Module for Cheri Machine Learning Pipeline.
Generates binary conversion labels over future observation windows and creates time-based train/test splits.

PRODUCTION TARGET (purchase, never altered):
    label = 1  <=> a SUCCESSFUL order of the SAME user and SAME product exists in [T, T + W]
    label = 0  <=> the full window [T, T + W] has been observed and no such order exists
    (W = FUTURE_WINDOW_DAYS = 14 by default)

Snapshots whose follow-up window is not fully observed yet (T + W > observation_end) are
EXCLUDED from the labeled dataset (they are not silently treated as label = 0).

SEPARATE INTEREST TARGET (optional, never mixed with purchase):
    interest_label = 1 <=> within [T, T + W] the user adds the product to cart, purchases it,
                           or views it at least twice.
"""

from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, timedelta, timezone
import pandas as pd
from .config import FUTURE_WINDOW_DAYS, SNAPSHOT_STEP_DAYS, CANDIDATE_LOOKBACK_DAYS
from .feature_engineering import build_user_product_feature_matrix

PURCHASE_LABEL_DEFINITION = (
    "label=1 nếu tồn tại đơn hàng THÀNH CÔNG của cùng user và cùng product trong [T, T+{w} ngày]; "
    "label=0 nếu đã quan sát đủ {w} ngày sau T mà không có đơn như vậy. "
    "Snapshot chưa đủ {w} ngày theo dõi bị loại, không gán 0."
)
INTEREST_LABEL_DEFINITION = (
    "interest_label=1 nếu trong [T, T+{w} ngày] user thêm sản phẩm vào giỏ, mua, hoặc xem lại sản phẩm >= 2 lần; "
    "0 nếu không. Đây là target RIÊNG, không dùng làm nhãn mua hàng."
)
PRODUCT_STATE_POLICY = (
    "Không có lịch sử tồn kho/hiển thị theo thời điểm trong DB, nên tại snapshot lịch sử "
    "product_in_stock và product_visibility được đặt = 1 (sản phẩm đã được xem trước T nên đang hiển thị); "
    "không dùng trạng thái hiện tại để tránh leakage. product_price/product_variant_count lấy từ catalog hiện tại "
    "(không có lịch sử giá) — đây là giới hạn đã biết."
)


def generate_future_purchase_labels(
    candidate_features_df: pd.DataFrame,
    orders_df: pd.DataFrame,
    cutoff_time: datetime,
    window_days: int = FUTURE_WINDOW_DAYS,
) -> pd.DataFrame:
    """
    Labels each (user_key, product_id) pair based on verified purchase in future window [T, T + W].
    label = 1 if verified order exists for this product within [T, T + W].
    label = 0 otherwise.

    NOTE: single-cutoff helper kept for backward compatibility. It does NOT check whether the
    window has been fully observed; use build_snapshot_dataset() for training datasets.
    """
    if candidate_features_df.empty:
        labeled_df = candidate_features_df.copy()
        labeled_df["label"] = 0
        labeled_df["split"] = "train"
        return labeled_df

    labeled_df = candidate_features_df.copy()
    cutoff_ts = pd.to_datetime(cutoff_time, utc=True)
    window_end = cutoff_ts + timedelta(days=window_days)

    future_successful_orders = pd.DataFrame()
    if not orders_df.empty and "created_at" in orders_df.columns:
        orders_df = orders_df.copy()
        orders_df["parsed_created_at"] = pd.to_datetime(orders_df["created_at"], utc=True, errors="coerce")
        future_successful_orders = orders_df[
            (orders_df["is_successful_conversion"] == True) &
            (orders_df["parsed_created_at"] >= cutoff_ts) &
            (orders_df["parsed_created_at"] <= window_end)
        ]

    labels = []
    for _, row in labeled_df.iterrows():
        u_key = row["user_key"]
        p_id = row["product_id"]

        converted = False
        if not future_successful_orders.empty:
            matches = future_successful_orders[
                (future_successful_orders["user_key"] == u_key) &
                (future_successful_orders["clean_product_id"] == p_id)
            ]
            if not matches.empty:
                converted = True

        labels.append(1 if converted else 0)

    labeled_df["label"] = labels
    return labeled_df


def assign_time_based_splits(
    dataset_df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> pd.DataFrame:
    """
    Splits dataset chronologically based on cutoff_timestamp into Train, Validation, and Test sets.
    Prevents leakage by keeping future evaluations strictly downstream in time.
    """
    if dataset_df.empty or "cutoff_timestamp" not in dataset_df.columns:
        dataset_df["split"] = "train"
        return dataset_df

    df = dataset_df.copy()
    df = df.sort_values(by=["cutoff_timestamp"]).reset_index(drop=True)

    total_rows = len(df)
    train_end = int(total_rows * train_ratio)
    val_end = int(total_rows * (train_ratio + val_ratio))

    splits = []
    for i in range(total_rows):
        if i < train_end:
            splits.append("train")
        elif i < val_end:
            splits.append("val")
        else:
            splits.append("test")

    df["split"] = splits
    return df


# =============================================================================
# SNAPSHOT-BASED DATASET (point-in-time features, fully observed label windows)
# =============================================================================

def _to_utc(series: pd.Series) -> pd.Series:
    return pd.to_datetime(series, utc=True, errors="coerce")


def _floor_day(ts: pd.Timestamp) -> pd.Timestamp:
    return pd.Timestamp(ts).tz_convert("UTC").normalize()


def generate_snapshot_times(
    events_start: pd.Timestamp,
    events_end: pd.Timestamp,
    step_days: int = SNAPSHOT_STEP_DAYS,
    warmup_days: int = 1,
) -> List[pd.Timestamp]:
    """All candidate snapshot times T (UTC midnight) from first event + warmup up to end."""
    if pd.isna(events_start) or pd.isna(events_end):
        return []
    t = _floor_day(events_start) + pd.Timedelta(days=warmup_days)
    end = pd.Timestamp(events_end)
    times = []
    while t <= end:
        times.append(t)
        t += pd.Timedelta(days=step_days)
    if not times and end >= _floor_day(events_start):
        times.append(t)
    return times


def _product_lookup(products_df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    if products_df is None or products_df.empty:
        return lookup
    for _, r in products_df.iterrows():
        lookup[str(r["product_id"])] = r.to_dict()
    return lookup


def _snapshot_rows(
    T: pd.Timestamp,
    events: pd.DataFrame,
    succ_orders: pd.DataFrame,
    products: Dict[str, Dict[str, Any]],
    window_days: int,
    lookback_days: int,
    target: str,
) -> pd.DataFrame:
    """Builds candidate rows + features (strictly < T) + label (in [T, T+W]) for one snapshot."""
    hist = events[events["ts"] < T]
    views = hist[hist["event_type"] == "VIEW"]
    recent = views[views["ts"] >= T - pd.Timedelta(days=lookback_days)]
    if recent.empty:
        return pd.DataFrame()

    cands = recent[["user_key", "clean_product_id"]].drop_duplicates().rename(columns={"clean_product_id": "product_id"})

    # ---- User / pair / product features from history strictly before T ----
    u_total = views.groupby("user_key").size()
    u_distinct = views.groupby("user_key")["clean_product_id"].nunique()
    up_grp = views.groupby(["user_key", "clean_product_id"])
    up_views = up_grp.size()
    up_last = up_grp["ts"].max()
    u_cat = views.groupby(["user_key", "category"]).size()
    p_pop = views.groupby("clean_product_id").size()

    past_orders = succ_orders[succ_orders["ts"] < T]
    u_orders = past_orders.groupby("user_key")["order_id"].nunique()
    bought_before = set(zip(past_orders["user_key"], past_orders["clean_product_id"]))

    # ---- Label window [T, T+W] ----
    w_end = T + pd.Timedelta(days=window_days)
    if target == "purchase":
        fut = succ_orders[(succ_orders["ts"] >= T) & (succ_orders["ts"] <= w_end)]
        positive_pairs = set(zip(fut["user_key"], fut["clean_product_id"]))
    else:  # interest
        fut_ev = events[(events["ts"] >= T) & (events["ts"] <= w_end)]
        strong = fut_ev[fut_ev["event_type"].isin(["ADD_TO_CART", "PURCHASE"])]
        positive_pairs = set(zip(strong["user_key"], strong["clean_product_id"]))
        fv = fut_ev[fut_ev["event_type"] == "VIEW"].groupby(["user_key", "clean_product_id"]).size()
        positive_pairs |= set(fv[fv >= 2].index)

    rows = []
    for u, p in cands.itertuples(index=False):
        info = products.get(p, {})
        cat = info.get("primary_category", "Khác")
        last = up_last.get((u, p))
        days_since = 999.0 if last is None or pd.isna(last) else max(0.0, round((T - last).total_seconds() / 86400.0, 2))
        price = float(info.get("sale_price", 0) or info.get("regular_price", 0) or 0)
        rows.append({
            "snapshot_id": T.strftime("%Y%m%d"),
            "user_key": u,
            "product_id": p,
            "cutoff_timestamp": T.isoformat(),
            "label_window_end": w_end.isoformat(),
            "user_total_views": int(u_total.get(u, 0)),
            "user_distinct_products_viewed": int(u_distinct.get(u, 0)),
            "user_product_views": int(up_views.get((u, p), 0)),
            "user_category_views": int(u_cat.get((u, cat), 0)),
            "days_since_last_view": days_since,
            "user_total_orders_before": int(u_orders.get(u, 0)),
            "user_previously_purchased": 1 if (u, p) in bought_before else 0,
            "product_price": price,
            "product_variant_count": int(info.get("variant_count", 0) or 0),
            # Point-in-time product state is unknown -> neutral, documented policy (no leakage)
            "product_in_stock": 1,
            "product_visibility": 1,
            "product_category": cat,
            "product_popularity_views": int(p_pop.get(p, 0)),
            ("label" if target == "purchase" else "interest_label"): 1 if (u, p) in positive_pairs else 0,
        })
    return pd.DataFrame(rows)


def build_snapshot_dataset(
    clean_interactions_df: pd.DataFrame,
    orders_df: pd.DataFrame,
    products_df: pd.DataFrame,
    observation_end: Optional[datetime] = None,
    window_days: int = FUTURE_WINDOW_DAYS,
    step_days: int = SNAPSHOT_STEP_DAYS,
    lookback_days: int = CANDIDATE_LOOKBACK_DAYS,
    target: str = "purchase",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Builds a multi-snapshot user-product dataset.

    - Candidates at T: (user, product) pairs the user VIEWED within `lookback_days` before T.
    - Features use only events/orders with timestamp < T.
    - Label uses only successful orders (purchase) or events (interest) in [T, T + W].
    - Snapshots with T + W > observation_end are excluded and counted in the stats.

    observation_end: last moment up to which orders/events are known to be complete
                     (production: extraction time; bootstrap: generator window end).
    """
    if target not in ("purchase", "interest"):
        raise ValueError("target must be 'purchase' or 'interest'")

    stats: Dict[str, Any] = {
        "target": target,
        "label_definition": (PURCHASE_LABEL_DEFINITION if target == "purchase" else INTEREST_LABEL_DEFINITION).format(w=window_days),
        "product_state_policy": PRODUCT_STATE_POLICY,
        "window_days": window_days,
        "snapshot_step_days": step_days,
        "candidate_lookback_days": lookback_days,
        "observation_end": None,
        "events_time_range": [None, None],
        "candidate_snapshots_total": 0,
        "snapshots_labeled": 0,
        "snapshots_excluded_insufficient_followup": 0,
        "rows_excluded_insufficient_followup": 0,
        "earliest_snapshot_with_full_followup_possible": None,
    }

    if clean_interactions_df is None or clean_interactions_df.empty:
        return pd.DataFrame(), stats

    ev = clean_interactions_df.copy()
    if "is_linked_to_catalog" in ev.columns:
        ev = ev[ev["is_linked_to_catalog"] == True]
    ev["ts"] = _to_utc(ev["event_timestamp"])
    ev = ev.dropna(subset=["ts"])
    ev["event_type"] = ev["event_type"].astype(str).str.upper()
    products = _product_lookup(products_df)
    ev["category"] = ev["clean_product_id"].map(lambda p: products.get(p, {}).get("primary_category", "Khác"))

    if orders_df is not None and not orders_df.empty:
        so = orders_df[orders_df["is_successful_conversion"] == True].copy()
        so["ts"] = _to_utc(so["created_at"])
        so = so.dropna(subset=["ts"])
    else:
        so = pd.DataFrame(columns=["order_id", "user_key", "clean_product_id", "ts"])

    obs_end = pd.Timestamp(observation_end) if observation_end is not None else pd.Timestamp(datetime.now(timezone.utc))
    obs_end = obs_end.tz_localize("UTC") if obs_end.tzinfo is None else obs_end.tz_convert("UTC")
    stats["observation_end"] = obs_end.isoformat()
    stats["events_time_range"] = [ev["ts"].min().isoformat(), ev["ts"].max().isoformat()]

    times = generate_snapshot_times(ev["ts"].min(), obs_end, step_days)
    stats["candidate_snapshots_total"] = len(times)
    first_possible = _floor_day(ev["ts"].min()) + pd.Timedelta(days=1)
    stats["earliest_snapshot_with_full_followup_possible"] = (first_possible + pd.Timedelta(days=window_days)).isoformat()

    frames = []
    for T in times:
        if T + pd.Timedelta(days=window_days) > obs_end:
            stats["snapshots_excluded_insufficient_followup"] += 1
            recent = ev[(ev["ts"] < T) & (ev["ts"] >= T - pd.Timedelta(days=lookback_days)) & (ev["event_type"] == "VIEW")]
            stats["rows_excluded_insufficient_followup"] += int(recent[["user_key", "clean_product_id"]].drop_duplicates().shape[0])
            continue
        snap = _snapshot_rows(T, ev, so, products, window_days, lookback_days, target)
        if not snap.empty:
            frames.append(snap)
            stats["snapshots_labeled"] += 1

    dataset = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    return dataset, stats


def assign_snapshot_time_splits(
    dataset_df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    embargo_days: int = FUTURE_WINDOW_DAYS,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Chronological split by WHOLE snapshots (no shuffle; a snapshot never straddles two splits).
    An embargo of `embargo_days` is enforced between splits:
      - T_val_first >= T_train_last + embargo_days
      - T_test_first >= T_val_last + embargo_days
    so train labels (in [T, T+W]) can never observe the time period used as features (< T)
    for evaluation snapshots.
    If observation span is insufficient to support 3 splits with 2 full embargoes,
    it falls back cleanly to Train / Embargo / Test (2 splits) and logs the reason.
    """
    info = {
        "split_strategy": "chronological_by_snapshot_with_embargo",
        "embargo_days": embargo_days,
        "rows_purged_by_embargo": 0,
        "snapshots_purged_by_embargo": 0,
        "split_counts": {},
        "split_time_ranges": {},
        "split_mode": "none",
    }
    if dataset_df.empty:
        return dataset_df, info

    df = dataset_df.copy()
    df["_T"] = pd.to_datetime(df["cutoff_timestamp"], utc=True)
    snaps = sorted(df["_T"].unique())
    emb = pd.Timedelta(days=embargo_days)

    if len(snaps) < 2:
        df["split"] = "train"
        df = df.drop(columns=["_T"])
        info["split_mode"] = "all_train_single_snapshot"
        info["split_counts"] = {"train": len(df)}
        return df, info

    sizes = df.groupby("_T").size()
    assignment: Dict[Any, str] = {}
    best_config = None

    # 1. Search for 3-way split (Train, Val, Test) if val_ratio > 0 and len(snaps) >= 3
    if val_ratio > 0 and len(snaps) >= 3:
        target_train = train_ratio
        target_val = val_ratio
        target_test = max(0.05, 1.0 - train_ratio - val_ratio)
        best_loss = float("inf")

        for i in range(len(snaps)):
            T_train_last = snaps[i]
            val_indices = [k for k in range(i + 1, len(snaps)) if snaps[k] >= T_train_last + emb]
            if not val_indices:
                continue
            for j in val_indices:
                T_val_last = snaps[j]
                test_indices = [m for m in range(j + 1, len(snaps)) if snaps[m] >= T_val_last + emb]
                if not test_indices:
                    continue

                tr_snaps = snaps[:i + 1]
                v_snaps = snaps[val_indices[0] : j + 1]
                te_snaps = snaps[test_indices[0] :]

                n_tr = sum(sizes[t] for t in tr_snaps)
                n_v = sum(sizes[t] for t in v_snaps)
                n_te = sum(sizes[t] for t in te_snaps)
                unpurged = n_tr + n_v + n_te
                if unpurged == 0:
                    continue

                loss = (n_tr / unpurged - target_train) ** 2 + (n_v / unpurged - target_val) ** 2 + (n_te / unpurged - target_test) ** 2
                if loss < best_loss:
                    best_loss = loss
                    best_config = (tr_snaps, v_snaps, te_snaps)

    if best_config is not None:
        tr_snaps, v_snaps, te_snaps = best_config
        for t in snaps:
            if t in tr_snaps:
                assignment[t] = "train"
            elif t in v_snaps:
                assignment[t] = "val"
            elif t in te_snaps:
                assignment[t] = "test"
            else:
                assignment[t] = "purged"
        info["split_mode"] = "train_val_test"
    else:
        # 2. Fall back to 2-way split (Train / Embargo / Test)
        target_train = train_ratio / (train_ratio + (val_ratio if val_ratio > 0 else 0.3))
        best_loss = float("inf")
        best_2way = None
        for i in range(len(snaps)):
            T_train_last = snaps[i]
            test_indices = [m for m in range(i + 1, len(snaps)) if snaps[m] >= T_train_last + emb]
            if not test_indices:
                continue
            tr_snaps = snaps[:i + 1]
            te_snaps = snaps[test_indices[0] :]
            n_tr = sum(sizes[t] for t in tr_snaps)
            n_te = sum(sizes[t] for t in te_snaps)
            unpurged = n_tr + n_te
            if unpurged == 0:
                continue
            loss = (n_tr / unpurged - target_train) ** 2
            if loss < best_loss:
                best_loss = loss
                best_2way = (tr_snaps, te_snaps)

        if best_2way is not None:
            tr_snaps, te_snaps = best_2way
            for t in snaps:
                if t in tr_snaps:
                    assignment[t] = "train"
                elif t in te_snaps:
                    assignment[t] = "test"
                else:
                    assignment[t] = "purged"
            info["split_mode"] = "train_test_fallback_insufficient_span_for_2_embargoes"
        else:
            # 3. Cannot fit any embargo: keep all in train
            for t in snaps:
                assignment[t] = "train"
            info["split_mode"] = "all_train_insufficient_span_for_embargo"

    df["split"] = df["_T"].map(assignment)
    purged_mask = df["split"] == "purged"
    info["rows_purged_by_embargo"] = int(purged_mask.sum())
    info["snapshots_purged_by_embargo"] = int(df.loc[purged_mask, "_T"].nunique())

    clean_df = df[~purged_mask].copy()
    for s, g in clean_df.groupby("split"):
        info["split_counts"][s] = int(len(g))
        info["split_time_ranges"][s] = [g["cutoff_timestamp"].min(), g["cutoff_timestamp"].max()]

    clean_df = clean_df.drop(columns=["_T"]).sort_values(["cutoff_timestamp", "user_key", "product_id"]).reset_index(drop=True)
    return clean_df, info



def summarize_snapshot_dataset(
    df: pd.DataFrame,
    build_stats: Dict[str, Any],
    split_info: Dict[str, Any],
    data_source: str,
    is_synthetic: bool,
    label_col: str = "label",
) -> Dict[str, Any]:
    """Quality report for a labeled snapshot dataset."""
    summary: Dict[str, Any] = {
        "data_source": data_source,
        "is_synthetic": bool(is_synthetic),
        **build_stats,
        **split_info,
        "rows": int(len(df)),
        "snapshots_in_dataset": 0,
        "snapshot_time_range": [None, None],
        "distinct_users": 0,
        "distinct_products": 0,
        "label_distribution": {},
        "positive_rate": None,
        "split_distribution": {},
    }
    if df.empty:
        return summary
    summary["snapshots_in_dataset"] = int(df["cutoff_timestamp"].nunique())
    summary["snapshot_time_range"] = [str(df["cutoff_timestamp"].min()), str(df["cutoff_timestamp"].max())]
    summary["distinct_users"] = int(df["user_key"].nunique())
    summary["distinct_products"] = int(df["product_id"].nunique())
    vc = df[label_col].value_counts().to_dict()
    summary["label_distribution"] = {str(k): int(v) for k, v in sorted(vc.items())}
    summary["positive_rate"] = round(float(df[label_col].mean()), 4)
    if "split" in df.columns:
        summary["split_distribution"] = {
            s: {str(k): int(v) for k, v in g[label_col].value_counts().sort_index().items()}
            for s, g in df.groupby("split")
        }
    return summary
