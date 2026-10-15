"""
Feature Engineering Module for Cheri Machine Learning Pipeline.
Constructs User-Product tabular features with strict temporal cutoff to prevent Data Leakage.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime, timezone


def extract_user_product_features_at_cutoff(
    user_key: str,
    product_id: str,
    cutoff_time: datetime,
    historical_interactions: pd.DataFrame,
    historical_orders: pd.DataFrame,
    products_lookup: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Computes User-Product interaction and context features strictly BEFORE cutoff_time (T).
    Guarantees zero data leakage from the future.
    """
    # 1. Product static and catalog properties
    p_info = products_lookup.get(product_id, {})
    p_cat = p_info.get("primary_category", "Khác")
    p_price = float(p_info.get("sale_price", 0))
    p_var_count = int(p_info.get("variant_count", 0))
    p_in_stock = 1 if p_info.get("is_in_stock", True) else 0
    p_visible = 1 if p_info.get("visibility", True) else 0

    # Normalize cutoff_time to UTC Timestamp
    cutoff_ts = pd.to_datetime(cutoff_time, utc=True)

    # 2. Filter historical interactions STRICTLY prior to cutoff_time
    if not historical_interactions.empty and "event_timestamp" in historical_interactions.columns:
        interactions_ts = pd.to_datetime(historical_interactions["event_timestamp"], utc=True, errors="coerce")
        user_history = historical_interactions[
            (historical_interactions["user_key"] == user_key) &
            (interactions_ts < cutoff_ts)
        ]
        all_product_history = historical_interactions[
            (historical_interactions["clean_product_id"] == product_id) &
            (interactions_ts < cutoff_ts)
        ]
    else:
        user_history = pd.DataFrame()
        all_product_history = pd.DataFrame()

    # User overall historical behavior
    user_total_views = len(user_history)
    user_distinct_products = len(user_history["clean_product_id"].unique()) if not user_history.empty else 0

    # User interactions specific to this product
    this_prod_history = user_history[user_history["clean_product_id"] == product_id] if not user_history.empty else pd.DataFrame()
    user_product_views = len(this_prod_history)

    # Days since last view
    days_since_last_view = 999.0
    if not this_prod_history.empty:
        last_view_raw = this_prod_history["event_timestamp"].max()
        last_view_ts = pd.to_datetime(last_view_raw, utc=True)
        days_diff = (cutoff_ts - last_view_ts).total_seconds() / 86400.0
        days_since_last_view = max(0.0, round(days_diff, 2))

    # User interactions with the same category
    user_category_views = 0
    if not user_history.empty:
        for viewed_pid in user_history["clean_product_id"]:
            if products_lookup.get(viewed_pid, {}).get("primary_category") == p_cat:
                user_category_views += 1

    # Product overall popularity prior to cutoff_time
    product_historical_views = len(all_product_history)

    # 3. Filter historical orders STRICTLY prior to cutoff_time
    user_total_orders = 0
    user_previously_purchased = 0
    if not historical_orders.empty and "created_at" in historical_orders.columns:
        orders_ts = pd.to_datetime(historical_orders["created_at"], utc=True, errors="coerce")
        user_order_history = historical_orders[
            (historical_orders["user_key"] == user_key) &
            (historical_orders["is_successful_conversion"] == True) &
            (orders_ts < cutoff_ts)
        ]
        user_total_orders = len(user_order_history["order_id"].unique()) if not user_order_history.empty else 0
        if not user_order_history.empty:
            this_prod_orders = user_order_history[user_order_history["clean_product_id"] == product_id]
            if not this_prod_orders.empty:
                user_previously_purchased = 1

    return {
        "user_key": user_key,
        "product_id": product_id,
        "cutoff_timestamp": cutoff_time.isoformat(),
        # User behavioral features
        "user_total_views": user_total_views,
        "user_distinct_products_viewed": user_distinct_products,
        "user_product_views": user_product_views,
        "user_category_views": user_category_views,
        "days_since_last_view": days_since_last_view,
        "user_total_orders_before": user_total_orders,
        "user_previously_purchased": user_previously_purchased,
        # Product catalog & popularity features
        "product_price": p_price,
        "product_variant_count": p_var_count,
        "product_in_stock": p_in_stock,
        "product_visibility": p_visible,
        "product_category": p_cat,
        "product_popularity_views": product_historical_views,
    }


def build_user_product_feature_matrix(
    clean_interactions_df: pd.DataFrame,
    orders_df: pd.DataFrame,
    products_df: pd.DataFrame,
    cutoff_time: Optional[datetime] = None,
) -> pd.DataFrame:
    """
    Constructs a tabular DataFrame of User-Product features for all candidate pairs.
    """
    if clean_interactions_df.empty:
        return pd.DataFrame(columns=[
            "user_key", "product_id", "cutoff_timestamp",
            "user_total_views", "user_distinct_products_viewed",
            "user_product_views", "user_category_views", "days_since_last_view",
            "user_total_orders_before", "user_previously_purchased",
            "product_price", "product_variant_count", "product_in_stock",
            "product_visibility", "product_category", "product_popularity_views"
        ])

    products_lookup: Dict[str, Dict[str, Any]] = {}
    if not products_df.empty:
        for _, r in products_df.iterrows():
            products_lookup[r["product_id"]] = r.to_dict()

    if cutoff_time is None:
        cutoff_time = clean_interactions_df["event_timestamp"].max()

    rows: List[Dict[str, Any]] = []
    
    # Generate candidate pairs from clean interactions
    candidate_pairs = clean_interactions_df[["user_key", "clean_product_id"]].drop_duplicates()

    for _, pair in candidate_pairs.iterrows():
        u_key = pair["user_key"]
        p_id = pair["clean_product_id"]
        features = extract_user_product_features_at_cutoff(
            user_key=u_key,
            product_id=p_id,
            cutoff_time=cutoff_time,
            historical_interactions=clean_interactions_df,
            historical_orders=orders_df,
            products_lookup=products_lookup,
        )
        rows.append(features)

    return pd.DataFrame(rows)
