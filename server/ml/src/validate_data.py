"""
Data Validation and Quality Assurance Module for Cheri Machine Learning Pipeline.
Analyzes timestamps, identifier linkage, compound IDs, and technical deduplication.
"""

from typing import Dict, Any, Tuple, Set
import pandas as pd
from datetime import datetime, timezone
from .config import (
    is_valid_object_id,
    normalize_product_key,
    anonymize_identifier,
)


def validate_and_clean_interactions(
    interactions_df: pd.DataFrame,
    valid_product_ids: Set[str],
    include_synthetic: bool = False,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Cleans and standardizes raw user interactions.
    Applies strict data quality filters:
    1. Timestamp standardization to UTC.
    2. User/Session pseudonymous key generation.
    3. Product ID normalization (pure ObjectId vs compound ID vs SKU) and linkage check.
    4. Distinguishes technical duplicates (<2s) from natural re-views (>2s).
    5. Isolates synthetic test events from real customer events.
    """
    quality_metrics: Dict[str, Any] = {
        "total_raw_records": len(interactions_df),
        "real_records_count": 0,
        "synthetic_records_count": 0,
        "included_synthetic_in_clean": include_synthetic,
        "total_views": 0,
        "valid_clean_records": 0,
        "null_timestamp_count": 0,
        "invalid_identifier_count": 0,
        "compound_id_count": 0,
        "linked_product_count": 0,
        "unlinked_product_count": 0,
        "technical_duplicate_count": 0,
        "distinct_registered_users": 0,
        "distinct_guest_sessions": 0,
        "time_range_start": None,
        "time_range_end": None,
    }

    if interactions_df.empty:
        clean_df = pd.DataFrame(columns=[
            "user_key",
            "is_guest",
            "clean_product_id",
            "variant_id",
            "event_type",
            "event_timestamp",
            "is_linked_to_catalog",
            "is_synthetic",
        ])
        return clean_df, quality_metrics

    clean_records = []
    registered_keys = set()
    guest_keys = set()

    # Pre-sort to analyze technical duplicates
    df = interactions_df.copy()
    
    # 1. Parse timestamps
    df["parsed_timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    null_ts = df["parsed_timestamp"].isna().sum()
    quality_metrics["null_timestamp_count"] = int(null_ts)
    
    # Drop rows without valid timestamps
    df = df.dropna(subset=["parsed_timestamp"])

    # Sort chronologically
    df = df.sort_values(by=["parsed_timestamp"])

    # 2. Iterate and process records
    last_event_tracker: Dict[Tuple[str, str], datetime] = {}

    for _, row in df.iterrows():
        is_synthetic = bool(row.get("is_synthetic", False))
        if is_synthetic:
            quality_metrics["synthetic_records_count"] += 1
            if not include_synthetic:
                # Strictly isolate synthetic test data in production evaluation
                continue
        else:
            quality_metrics["real_records_count"] += 1

        event_type = str(row.get("event_type", "VIEW")).strip().upper()
        if event_type == "VIEW":
            quality_metrics["total_views"] += 1

        user_id = row.get("user_id")
        session_id = row.get("session_id")

        if user_id:
            user_key = anonymize_identifier(user_id, prefix="usr")
            is_guest = False
            registered_keys.add(user_key)
        elif session_id:
            user_key = anonymize_identifier(session_id, prefix="gst")
            is_guest = True
            guest_keys.add(user_key)
        else:
            quality_metrics["invalid_identifier_count"] += 1
            continue

        raw_prod = row.get("raw_product_id")
        key_meta = normalize_product_key(raw_prod)
        clean_prod_id = key_meta["clean_product_id"]

        if key_meta["is_compound"]:
            quality_metrics["compound_id_count"] += 1

        is_linked = clean_prod_id in valid_product_ids
        if is_linked:
            quality_metrics["linked_product_count"] += 1
        else:
            quality_metrics["unlinked_product_count"] += 1

        ts = row["parsed_timestamp"].to_pydatetime()

        # 3. Technical Bounce/Duplicate Check (< 2 seconds for identical user & product)
        tracker_key = (user_key, clean_prod_id)
        if tracker_key in last_event_tracker:
            prev_ts = last_event_tracker[tracker_key]
            time_diff_sec = abs((ts - prev_ts).total_seconds())
            if time_diff_sec < 2.0:
                quality_metrics["technical_duplicate_count"] += 1
                last_event_tracker[tracker_key] = ts
                continue

        last_event_tracker[tracker_key] = ts

        clean_records.append({
            "user_key": user_key,
            "is_guest": is_guest,
            "clean_product_id": clean_prod_id,
            "variant_id": key_meta["variant_id"],
            "event_type": event_type,
            "event_timestamp": ts,
            "is_linked_to_catalog": is_linked,
            "is_synthetic": is_synthetic,
        })

    clean_df = pd.DataFrame(clean_records)
    quality_metrics["valid_clean_records"] = len(clean_df)
    quality_metrics["distinct_registered_users"] = len(registered_keys)
    quality_metrics["distinct_guest_sessions"] = len(guest_keys)

    if not clean_df.empty and "event_timestamp" in clean_df.columns:
        quality_metrics["time_range_start"] = clean_df["event_timestamp"].min().isoformat()
        quality_metrics["time_range_end"] = clean_df["event_timestamp"].max().isoformat()

    return clean_df, quality_metrics


def compile_data_quality_report(
    interactions_metrics: Dict[str, Any],
    products_df: pd.DataFrame,
    orders_df: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Compiles a comprehensive Data Quality & Health Audit Report across all datasets.
    """
    total_products = len(products_df)
    valid_prices = 0
    with_categories = 0
    if not products_df.empty:
        valid_prices = int((products_df["sale_price"] > 0).sum())
        with_categories = int((products_df["primary_category"].notna() & (products_df["primary_category"] != "Khác")).sum())

    total_orders = len(orders_df["order_id"].unique()) if not orders_df.empty else 0
    conversion_orders = 0
    linked_order_items = 0
    unlinked_order_items = 0

    if not orders_df.empty:
        successful_orders = orders_df[orders_df["is_successful_conversion"] == True]
        conversion_orders = len(successful_orders["order_id"].unique())
        
        valid_p_ids = set(products_df["product_id"].unique()) if not products_df.empty else set()
        linked_order_items = int(orders_df["clean_product_id"].isin(valid_p_ids).sum())
        unlinked_order_items = len(orders_df) - linked_order_items

    has_sufficient_interactions = interactions_metrics["valid_clean_records"] >= 20
    has_sufficient_conversions = conversion_orders >= 5

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "readiness_summary": {
            "has_interactions": interactions_metrics["total_raw_records"] > 0,
            "has_products": total_products > 0,
            "has_orders": total_orders > 0,
            "is_training_ready": bool(has_sufficient_interactions and has_sufficient_conversions),
            "recommended_strategy": (
                "PURCHASE_PREDICTION" if (has_sufficient_interactions and has_sufficient_conversions)
                else ("NEXT_ITEM_PREDICTION" if has_sufficient_interactions else "DATASET_INITIALIZING")
            ),
        },
        "interaction_metrics": interactions_metrics,
        "product_metrics": {
            "total_products": total_products,
            "products_with_valid_price": valid_prices,
            "products_with_category": with_categories,
            "visible_products": int((products_df["visibility"] == True).sum()) if not products_df.empty else 0,
            "in_stock_products": int((products_df["is_in_stock"] == True).sum()) if not products_df.empty else 0,
        },
        "order_metrics": {
            "total_orders": total_orders,
            "successful_conversion_orders": conversion_orders,
            "total_order_lines": len(orders_df),
            "linked_order_lines": linked_order_items,
            "unlinked_order_lines": unlinked_order_items,
        },
    }

    return report
