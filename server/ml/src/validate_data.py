"""
Data Validation and Quality Assurance Module for Cheri Machine Learning Pipeline.
Analyzes timestamps, identifier linkage, compound IDs, and technical deduplication.
"""

from typing import Dict, Any, Tuple, Set, List, Optional
import logging
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from .config import (
    is_valid_object_id,
    normalize_product_key,
    anonymize_identifier,
)

logger = logging.getLogger("cheri_ml.validate_data")

KNOWN_IN_STOCK_TOKENS = {
    "instock", "onstock", "in_stock", "on_stock", "available", "còn hàng", "con hang",
}
KNOWN_OUT_OF_STOCK_TOKENS = {
    "out", "outofstock", "out_of_stock", "unavailable", "soldout", "sold_out", "hết hàng", "het hang",
}
DIRECT_STOCK_KEYS = ("stock", "quantity", "inventory", "qty")
NESTED_STOCK_CONTAINER_KEYS = (
    "variants", "sizes", "options", "inventory", "warehouses",
    "children", "items", "stock_by_size", "stockBySize", "locations",
)


def _coerce_stock_scalar(
    val: Any,
    field_path: str,
    product_id: str,
    allow_status_token: bool = True,
) -> Dict[str, Any]:
    """
    Safely coerces a single stock/quantity scalar value using pd.to_numeric(errors='coerce').
    Never silently converts invalid strings to 0 without flagging a coercion error.
    """
    if val is None:
        return {
            "value": 0.0,
            "is_present": False,
            "is_coercion_error": False,
            "is_status_token": False,
            "status_positive": False,
        }

    if isinstance(val, (float, np.floating)) and np.isnan(val):
        return {
            "value": 0.0,
            "is_present": False,
            "is_coercion_error": False,
            "is_status_token": False,
            "status_positive": False,
        }

    if isinstance(val, bool):
        logger.warning(
            f"[Stock Validation] Product '{product_id}': Boolean value {val!r} at '{field_path}' "
            f"is not a valid numeric stock count."
        )
        return {
            "value": 0.0,
            "is_present": True,
            "is_coercion_error": True,
            "is_status_token": False,
            "status_positive": False,
        }

    if isinstance(val, str):
        s = val.strip()
        if s == "":
            return {
                "value": 0.0,
                "is_present": False,
                "is_coercion_error": False,
                "is_status_token": False,
                "status_positive": False,
            }
        s_lower = s.lower()
        if allow_status_token and (s_lower in KNOWN_IN_STOCK_TOKENS or s_lower in KNOWN_OUT_OF_STOCK_TOKENS):
            return {
                "value": 0.0,
                "is_present": False,
                "is_coercion_error": False,
                "is_status_token": True,
                "status_positive": s_lower in KNOWN_IN_STOCK_TOKENS,
            }
        coerced = pd.to_numeric(s, errors="coerce")
        if pd.isna(coerced):
            logger.warning(
                f"[Stock Validation] Product '{product_id}': Failed to coerce '{field_path}'={val!r} to numeric."
            )
            return {
                "value": 0.0,
                "is_present": True,
                "is_coercion_error": True,
                "is_status_token": False,
                "status_positive": False,
            }
        return {
            "value": float(coerced),
            "is_present": True,
            "is_coercion_error": False,
            "is_status_token": False,
            "status_positive": False,
        }

    # Handle BSON Decimal128 or other numeric-like objects
    raw_for_num = str(val) if type(val).__name__ == "Decimal128" else val
    coerced = pd.to_numeric(raw_for_num, errors="coerce")
    if pd.isna(coerced):
        logger.warning(
            f"[Stock Validation] Product '{product_id}': Failed to coerce '{field_path}'={val!r} "
            f"(type={type(val).__name__}) to numeric."
        )
        return {
            "value": 0.0,
            "is_present": True,
            "is_coercion_error": True,
            "is_status_token": False,
            "status_positive": False,
        }

    return {
        "value": float(coerced),
        "is_present": True,
        "is_coercion_error": False,
        "is_status_token": False,
        "status_positive": False,
    }


def _extract_nested_stock(
    node: Any,
    path: str,
    product_id: str,
) -> Tuple[float, bool, List[str]]:
    """
    Recursively extracts and sums non-negative stock across variants, nested sizes, or warehouse dicts.
    Returns (total_nested_stock, has_any_numeric_stock_field, coercion_error_paths).
    """
    total_stock = 0.0
    has_numeric = False
    error_paths: List[str] = []

    if isinstance(node, (list, tuple)):
        for idx, item in enumerate(node):
            if isinstance(item, dict):
                sub_stock, sub_has, sub_errs = _extract_nested_stock(
                    item, f"{path}[{idx}]", product_id
                )
                total_stock += sub_stock
                has_numeric = has_numeric or sub_has
                error_paths.extend(sub_errs)
        return total_stock, has_numeric, error_paths

    if not isinstance(node, dict):
        return 0.0, False, []

    # Skip inactive variants/items (matching NestJS prepareProduct: v.isActive !== false)
    if node.get("isActive") is False or node.get("active") is False:
        return 0.0, False, []

    direct_sum = 0.0
    direct_found = False
    direct_candidates: List[float] = []
    for k in DIRECT_STOCK_KEYS:
        if k in node and not isinstance(node[k], (dict, list, tuple)):
            res = _coerce_stock_scalar(
                node[k],
                f"{path}.{k}",
                product_id,
                allow_status_token=(k == "stock"),
            )
            if res["is_coercion_error"]:
                error_paths.append(f"{path}.{k}")
            elif res["is_present"]:
                direct_found = True
                direct_candidates.append(max(0.0, res["value"]))

    if direct_candidates:
        direct_sum = max(direct_candidates)
        has_numeric = True

    nested_sum = 0.0
    nested_found = False
    for k, v in node.items():
        if k in ("vi", "en", "sk", "cs", "mainImage", "attributes"):
            continue
        if isinstance(v, (dict, list, tuple)) and (
            k in NESTED_STOCK_CONTAINER_KEYS or k not in DIRECT_STOCK_KEYS
        ):
            # Only recurse into lists if they contain dicts (skip e.g. sizes=['S', 'M'] string lists)
            if isinstance(v, (list, tuple)) and not any(isinstance(x, dict) for x in v):
                continue
            sub_stock, sub_has, sub_errs = _extract_nested_stock(
                v, f"{path}.{k}", product_id
            )
            nested_sum += sub_stock
            nested_found = nested_found or sub_has
            error_paths.extend(sub_errs)

    has_numeric = has_numeric or nested_found
    if direct_found and nested_found:
        combined = direct_sum if direct_sum == nested_sum else (direct_sum + nested_sum)
    elif nested_found:
        combined = nested_sum
    else:
        combined = direct_sum

    return combined, has_numeric, error_paths


def parse_product_inventory(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses product-level, language-level (vi/en), variant-level, and deeply nested stock fields.
    Rule:
      - Coerces all candidate stock fields via pd.to_numeric(errors="coerce").
      - Total stock = product_level_stock + variant_level_stock.
      - in_stock = 1 if total_stock > 0 else 0 (is_in_stock = bool(in_stock == 1)).
      - Logs warnings and tracks flags when stock fields are missing or fail type coercion.
    """
    p_id = str(record.get("product_id") or record.get("_id") or "unknown")
    vi_data = record.get("vi") if isinstance(record.get("vi"), dict) else {}
    en_data = record.get("en") if isinstance(record.get("en"), dict) else {}

    error_paths: List[str] = []
    has_numeric_stock = False
    has_raw_fields = any(
        k in record for k in ("raw_root_quantity", "raw_root_stock", "raw_vi_quantity", "raw_vi_stock")
    )

    # 1. Product-level numeric stock (root + language subdocuments)
    root_candidates: List[float] = []
    for k in DIRECT_STOCK_KEYS:
        raw_key = f"raw_root_{k}"
        if has_raw_fields:
            if raw_key not in record:
                continue
            val_to_check = record.get(raw_key)
        else:
            if k not in record:
                continue
            val_to_check = record.get(k)

        if not isinstance(val_to_check, (dict, list, tuple)):
            res = _coerce_stock_scalar(
                val_to_check,
                k,
                p_id,
                allow_status_token=(k == "stock"),
            )
            if res["is_coercion_error"]:
                error_paths.append(k)
            elif res["is_present"]:
                has_numeric_stock = True
                root_candidates.append(max(0.0, res["value"]))

    lang_candidates: List[float] = []
    for lang_name, lang_dict in (("vi", vi_data), ("en", en_data)):
        for k in DIRECT_STOCK_KEYS:
            raw_lang_key = f"raw_{lang_name}_{k}"
            if raw_lang_key in record:
                val_to_check = record.get(raw_lang_key)
            elif isinstance(lang_dict, dict) and k in lang_dict:
                val_to_check = lang_dict.get(k)
            else:
                continue

            if not isinstance(val_to_check, (dict, list, tuple)):
                res = _coerce_stock_scalar(
                    val_to_check,
                    f"{lang_name}.{k}",
                    p_id,
                    allow_status_token=(k == "stock"),
                )
                if res["is_coercion_error"]:
                    error_paths.append(f"{lang_name}.{k}")
                elif res["is_present"]:
                    has_numeric_stock = True
                    lang_candidates.append(max(0.0, res["value"]))

    root_stock = max(root_candidates) if root_candidates else 0.0
    lang_stock = max(lang_candidates) if lang_candidates else 0.0
    product_level_stock = max(root_stock, lang_stock)

    # 2. Check product-level nested stock containers (e.g. inventory dict or sizes list of dicts)
    for k in ("inventory", "sizes", "warehouses", "stock_by_size", "stockBySize"):
        val = record.get(k)
        if val is None and isinstance(vi_data, dict):
            val = vi_data.get(k)
        if isinstance(val, (dict, list, tuple)):
            if isinstance(val, (list, tuple)) and not any(isinstance(x, dict) for x in val):
                continue
            n_stock, n_has, n_errs = _extract_nested_stock(val, k, p_id)
            product_level_stock += n_stock
            has_numeric_stock = has_numeric_stock or n_has
            error_paths.extend(n_errs)

    # 3. Variant-level & deeply nested variant stock
    variants_obj = (
        record.get("raw_variants")
        if "raw_variants" in record
        else (
            record.get("variants")
            if record.get("variants") is not None
            else (vi_data.get("variants") if isinstance(vi_data, dict) else None)
        )
    )
    variant_level_stock = 0.0
    if isinstance(variants_obj, (list, tuple)) and len(variants_obj) > 0:
        v_stock, v_has, v_errs = _extract_nested_stock(variants_obj, "variants", p_id)
        variant_level_stock += v_stock
        has_numeric_stock = has_numeric_stock or v_has
        error_paths.extend(v_errs)

    total_combined_stock = product_level_stock + variant_level_stock

    # Effective quantity: avoid double-counting when vi.quantity mirrors sum(variants[].stock)
    if variant_level_stock > 0 and (
        product_level_stock == variant_level_stock
        or ("raw_vi_quantity" in record and (record.get("raw_root_quantity") is None or (isinstance(record.get("raw_root_quantity"), (int, float)) and record.get("raw_root_quantity", 0) <= 0)))
    ):
        effective_quantity = int(round(variant_level_stock))
    else:
        effective_quantity = int(round(total_combined_stock))

    has_coercion_error = len(error_paths) > 0
    is_missing_stock = (not has_numeric_stock) and (not has_coercion_error)

    if is_missing_stock:
        logger.warning(
            f"[Stock Validation] Product '{p_id}': Missing numeric stock field across product and variants; "
            f"setting in_stock=0."
        )

    in_stock = 1 if total_combined_stock > 0 else 0

    return {
        "quantity": max(0, effective_quantity),
        "total_stock": float(total_combined_stock),
        "in_stock": int(in_stock),
        "is_in_stock": bool(in_stock == 1),
        "missing_stock_field": bool(is_missing_stock),
        "stock_coercion_error": bool(has_coercion_error),
        "stock_error_paths": error_paths,
    }


def validate_and_clean_products(
    products_input: Any,
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Validates and cleans product catalog records (accepts a DataFrame or list of product dicts).
    Safely coerces stock/quantity across product, language subdocs, variants, and deeply nested structures.
    Computes in_stock = 1 if total stock (product + all variants) > 0 else 0.
    Logs warnings and returns quality metrics for missing stock fields and coercion errors.
    """
    expected_cols = [
        "product_id", "sku", "title", "title_url", "primary_category",
        "regular_price", "sale_price", "visibility", "quantity",
        "in_stock", "is_in_stock", "variant_count", "popularity_views", "date_added",
    ]
    metrics: Dict[str, Any] = {
        "total_products": 0,
        "in_stock_products": 0,
        "out_of_stock_products": 0,
        "missing_stock_field_count": 0,
        "stock_coercion_error_count": 0,
    }

    if products_input is None:
        return pd.DataFrame(columns=expected_cols), metrics

    if isinstance(products_input, pd.DataFrame):
        if "product_quality_metrics" in getattr(products_input, "attrs", {}):
            return products_input, products_input.attrs["product_quality_metrics"]
        if products_input.empty:
            return pd.DataFrame(columns=expected_cols), metrics
        records = products_input.to_dict(orient="records")
    elif isinstance(products_input, list):
        if len(products_input) == 0:
            return pd.DataFrame(columns=expected_cols), metrics
        records = products_input
    else:
        raise TypeError("products_input must be a pandas DataFrame or list of dicts")

    cleaned_rows: List[Dict[str, Any]] = []
    missing_stock_count = 0
    coercion_error_count = 0

    for rec in records:
        p_id = str(rec.get("product_id") or rec.get("_id") or "").strip()
        vi_data = rec.get("vi") if isinstance(rec.get("vi"), dict) else {}

        # Title
        title = (
            rec.get("title")
            or vi_data.get("title")
            or rec.get("name")
            or rec.get("title_url")
            or rec.get("titleUrl")
            or "Sản phẩm Chéri"
        )
        title_url = str(rec.get("title_url") or rec.get("titleUrl") or "")

        # Variants count
        variants_list = (
            rec.get("raw_variants")
            if "raw_variants" in rec
            else (rec.get("variants") if isinstance(rec.get("variants"), list) else vi_data.get("variants"))
        )
        if isinstance(variants_list, list):
            active_vars = [v for v in variants_list if isinstance(v, dict) and v.get("isActive") is not False]
            variant_count = len(active_vars)
        else:
            vc_num = pd.to_numeric(rec.get("variant_count", 0), errors="coerce")
            variant_count = int(0 if pd.isna(vc_num) else max(0, vc_num))

        # Pricing
        reg_raw = (
            rec.get("regular_price")
            if rec.get("regular_price") is not None
            else (rec.get("regularPrice") or vi_data.get("regularPrice") or rec.get("price") or 0)
        )
        sale_raw = (
            rec.get("sale_price")
            if rec.get("sale_price") is not None
            else (rec.get("salePrice") or vi_data.get("salePrice") or reg_raw)
        )
        reg_num = pd.to_numeric(reg_raw, errors="coerce")
        sale_num = pd.to_numeric(sale_raw, errors="coerce")
        regular_price = float(0.0 if pd.isna(reg_num) else max(0.0, reg_num))
        sale_price = float(0.0 if pd.isna(sale_num) else max(0.0, sale_num))
        if sale_price == 0.0 and regular_price > 0.0:
            sale_price = regular_price

        # Category
        primary_category = str(rec.get("primary_category") or "").strip()
        if not primary_category or primary_category == "nan":
            primary_category = "Khác"
            if isinstance(variants_list, list) and len(variants_list) > 0 and isinstance(variants_list[0], dict):
                if variants_list[0].get("classification"):
                    primary_category = str(variants_list[0]["classification"]).strip()
            if primary_category == "Khác" and isinstance(rec.get("tags"), list) and len(rec["tags"]) > 0:
                primary_category = str(rec["tags"][0]).strip()

        # Visibility (matching NestJS prepareProduct: root.visibility !== false and vi.visibility !== false)
        raw_vis = rec.get("visibility")
        vi_vis = vi_data.get("visibility") if isinstance(vi_data, dict) else None
        if raw_vis is None or (isinstance(raw_vis, float) and np.isnan(raw_vis)):
            is_globally_visible = True
        else:
            is_globally_visible = bool(raw_vis) is not False
        is_vi_visible = (vi_vis is not False)
        visibility = bool(is_globally_visible and is_vi_visible)

        # Stock calculation & validation
        stock_info = parse_product_inventory(rec)
        if stock_info["missing_stock_field"]:
            missing_stock_count += 1
        if stock_info["stock_coercion_error"]:
            coercion_error_count += 1

        pop_num = pd.to_numeric(rec.get("popularity_views", 0), errors="coerce")
        popularity_views = int(0 if pd.isna(pop_num) else max(0, pop_num))

        cleaned_rows.append({
            "product_id": p_id,
            "sku": str(rec.get("sku") or vi_data.get("sku") or f"SKU-{p_id[:8]}"),
            "title": str(title),
            "title_url": title_url,
            "primary_category": primary_category,
            "regular_price": regular_price,
            "sale_price": sale_price,
            "visibility": visibility,
            "quantity": stock_info["quantity"],
            "in_stock": stock_info["in_stock"],
            "is_in_stock": stock_info["is_in_stock"],
            "variant_count": variant_count,
            "popularity_views": popularity_views,
            "date_added": rec.get("date_added") or rec.get("dateAdded") or rec.get("createdAt"),
        })

    clean_df = pd.DataFrame(cleaned_rows, columns=expected_cols)
    in_stock_cnt = int((clean_df["in_stock"] == 1).sum())
    metrics = {
        "total_products": len(clean_df),
        "in_stock_products": in_stock_cnt,
        "out_of_stock_products": len(clean_df) - in_stock_cnt,
        "missing_stock_field_count": missing_stock_count,
        "stock_coercion_error_count": coercion_error_count,
    }
    clean_df.attrs["product_quality_metrics"] = metrics
    return clean_df, metrics


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
    product_quality_metrics: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compiles a comprehensive Data Quality & Health Audit Report across all datasets.
    """
    total_products = len(products_df)
    valid_prices = 0
    with_categories = 0
    in_stock_count = 0
    if not products_df.empty:
        valid_prices = int((products_df["sale_price"] > 0).sum())
        with_categories = int((products_df["primary_category"].notna() & (products_df["primary_category"] != "Khác")).sum())
        if "in_stock" in products_df.columns:
            in_stock_count = int((products_df["in_stock"] == 1).sum())
        elif "is_in_stock" in products_df.columns:
            in_stock_count = int((products_df["is_in_stock"] == True).sum())

    missing_stock_count = 0
    coercion_error_count = 0
    if product_quality_metrics:
        missing_stock_count = int(product_quality_metrics.get("missing_stock_field_count", 0))
        coercion_error_count = int(product_quality_metrics.get("stock_coercion_error_count", 0))

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
            "in_stock_products": in_stock_count,
            "out_of_stock_products": total_products - in_stock_count,
            "missing_stock_field_count": missing_stock_count,
            "stock_coercion_error_count": coercion_error_count,
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
