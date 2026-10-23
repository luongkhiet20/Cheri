"""
Data Extraction Module for Cheri Machine Learning Pipeline.
Safely extracts interaction logs, product catalog, customer orders, and categories from MongoDB.
"""

from typing import Dict, Any, List, Optional
import pandas as pd
from pymongo.database import Database
from .config import (
    get_mongo_db,
    is_valid_object_id,
    normalize_product_key,
    anonymize_identifier,
    SUCCESSFUL_PAYMENT_STATUSES,
    SUCCESSFUL_ORDER_STATUSES,
    EXCLUDED_ORDER_STATUSES,
    BOOTSTRAP_COLLECTION_NAME,
    BOOTSTRAP_GENERATOR_NAME,
)


def extract_interactions(db: Optional[Database] = None) -> pd.DataFrame:
    """
    Extracts raw interaction records from the 'user_interactions' collection.
    If the collection does not exist or has 0 documents, returns an empty DataFrame with schema.
    """
    if db is None:
        db = get_mongo_db()

    expected_columns = [
        "raw_id",
        "user_id",
        "session_id",
        "raw_product_id",
        "event_type",
        "timestamp",
        "metadata",
        "is_synthetic",
    ]

    col_names = db.list_collection_names()
    if "user_interactions" not in col_names:
        return pd.DataFrame(columns=expected_columns)

    cursor = db["user_interactions"].find({})
    records: List[Dict[str, Any]] = []

    for doc in cursor:
        meta = doc.get("metadata") or {}
        is_syn = bool(meta.get("isSynthetic", False) or doc.get("isSynthetic", False))
        records.append({
            "raw_id": str(doc.get("_id")),
            "user_id": str(doc.get("userId")) if doc.get("userId") else None,
            "session_id": str(doc.get("sessionId")) if doc.get("sessionId") else None,
            "raw_product_id": str(doc.get("productId")) if doc.get("productId") else None,
            "event_type": str(doc.get("eventType", "VIEW")).strip().upper(),
            "timestamp": doc.get("timestamp") or doc.get("createdAt") or doc.get("dateAdded"),
            "metadata": meta,
            "is_synthetic": is_syn,
        })

    if not records:
        return pd.DataFrame(columns=expected_columns)

    return pd.DataFrame(records)


def _bootstrap_query(generator: Optional[str], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Builds the Mongo filter for synthetic bootstrap documents.
    - Always requires the synthetic flag (never touches non-synthetic docs).
    - generator=None  -> every synthetic bootstrap doc (including legacy, pre-v2 docs).
    - generator=<str> -> only docs produced by that generator (default: current seeder).
    """
    query: Dict[str, Any] = {
        "$or": [{"isSynthetic": True}, {"is_synthetic": True}, {"metadata.isSynthetic": True}],
        "datasetType": "bootstrap",
    }
    if generator:
        query["metadata.generator"] = generator
    if extra:
        query.update(extra)
    return query


def bootstrap_docs_to_interactions_df(docs: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Converts bootstrap documents (from MongoDB or an in-memory dry-run) into the same
    raw interaction schema produced by extract_interactions(). PURCHASE docs are kept as
    events here but are ALSO exposed as synthetic orders via bootstrap_docs_to_orders_df().
    """
    expected_columns = [
        "raw_id", "user_id", "session_id", "raw_product_id",
        "event_type", "timestamp", "metadata", "is_synthetic",
    ]
    records: List[Dict[str, Any]] = []
    for doc in docs:
        meta = doc.get("metadata") or {}
        records.append({
            "raw_id": str(doc.get("_id") or meta.get("eventKey")),
            "user_id": str(doc.get("userId")) if doc.get("userId") else None,
            "session_id": str(doc.get("sessionId")) if doc.get("sessionId") else None,
            "raw_product_id": str(doc.get("productId")) if doc.get("productId") else None,
            "event_type": str(doc.get("eventType", "VIEW")).strip().upper(),
            "timestamp": doc.get("timestamp") or doc.get("createdAt"),
            "metadata": meta,
            "is_synthetic": True,
        })
    if not records:
        return pd.DataFrame(columns=expected_columns)
    return pd.DataFrame(records)


def bootstrap_docs_to_orders_df(docs: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Converts bootstrap PURCHASE events into the order-line schema of extract_orders().
    These synthetic orders exist ONLY in 'ml_bootstrap_interactions'; nothing is written to 'orders'.
    """
    expected_cols = [
        "order_id", "user_key", "is_guest", "product_id", "clean_product_id", "variant_id",
        "quantity", "unit_price", "subtotal", "status", "payment_status",
        "is_successful_conversion", "created_at",
    ]
    rows: List[Dict[str, Any]] = []
    for doc in docs:
        if str(doc.get("eventType", "")).upper() != "PURCHASE":
            continue
        meta = doc.get("metadata") or {}
        raw_pid = doc.get("productId")
        norm_key = normalize_product_key(raw_pid)
        rows.append({
            "order_id": str(meta.get("orderId") or f"syn_ord_{doc.get('_id')}"),
            # Same hashing as validate_and_clean_interactions -> user keys line up
            "user_key": anonymize_identifier(doc.get("userId"), prefix="usr"),
            "is_guest": False,
            "product_id": str(raw_pid) if raw_pid else "",
            "clean_product_id": norm_key["clean_product_id"],
            "variant_id": doc.get("variantId") or norm_key["variant_id"],
            "quantity": int(meta.get("quantity", 1) or 1),
            "unit_price": float(meta.get("unitPrice", 0) or 0),
            "subtotal": float(meta.get("subtotal", 0) or 0),
            "status": "SYNTHETIC_COMPLETED",
            "payment_status": "SYNTHETIC_PAID",
            "is_successful_conversion": True,
            "created_at": doc.get("timestamp") or doc.get("createdAt"),
        })
    if not rows:
        return pd.DataFrame(columns=expected_cols)
    return pd.DataFrame(rows)


def fetch_bootstrap_docs(
    db: Optional[Database] = None,
    generator: Optional[str] = BOOTSTRAP_GENERATOR_NAME,
    batch_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Reads synthetic bootstrap docs from the dedicated bootstrap collection only."""
    if db is None:
        db = get_mongo_db()
    if BOOTSTRAP_COLLECTION_NAME not in db.list_collection_names():
        return []
    extra = {"metadata.batchId": batch_id} if batch_id else None
    return list(db[BOOTSTRAP_COLLECTION_NAME].find(_bootstrap_query(generator, extra)))


def extract_bootstrap_interactions(
    db: Optional[Database] = None,
    generator: Optional[str] = BOOTSTRAP_GENERATOR_NAME,
    batch_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Extracts synthetic interactions exclusively from 'ml_bootstrap_interactions'.
    Never reads 'user_interactions' -> bootstrap data can only enter the bootstrap flow.
    """
    return bootstrap_docs_to_interactions_df(fetch_bootstrap_docs(db, generator, batch_id))


def extract_bootstrap_orders(
    db: Optional[Database] = None,
    generator: Optional[str] = BOOTSTRAP_GENERATOR_NAME,
    batch_id: Optional[str] = None,
) -> pd.DataFrame:
    """Extracts synthetic PURCHASE events from the bootstrap collection as order lines."""
    return bootstrap_docs_to_orders_df(fetch_bootstrap_docs(db, generator, batch_id))



def extract_products(db: Optional[Database] = None) -> pd.DataFrame:
    """
    Extracts product catalog from MongoDB 'products' collection.
    Parses multi-lingual fields (vi/en), embedded variants, pricing, and inventory.
    """
    if db is None:
        db = get_mongo_db()

    cursor = db["products"].find({})
    records: List[Dict[str, Any]] = []

    for doc in cursor:
        p_id = str(doc.get("_id"))
        vi_data = doc.get("vi") or {}

        # Product Title
        title = vi_data.get("title") or doc.get("title") or doc.get("titleUrl") or "Sản phẩm Chéri"

        # Pricing Resolution
        regular_price = (
            doc.get("regularPrice")
            or vi_data.get("regularPrice")
            or doc.get("price")
            or 0
        )
        sale_price = (
            doc.get("salePrice")
            or vi_data.get("salePrice")
            or regular_price
        )

        variants = doc.get("variants") or []
        variant_count = len(variants) if isinstance(variants, list) else 0

        # Classification / Category from variants or attributes
        primary_category = "Khác"
        if variants and isinstance(variants, list) and len(variants) > 0:
            first_v = variants[0]
            if first_v.get("classification"):
                primary_category = str(first_v["classification"]).strip()
            # If variant has discounted price, fallback to it
            v_price = first_v.get("discountPrice") or first_v.get("price")
            if (not sale_price or sale_price == 0) and v_price:
                sale_price = v_price
                regular_price = first_v.get("price") or v_price

        if primary_category == "Khác" and doc.get("tags"):
            tags = doc.get("tags")
            if isinstance(tags, list) and len(tags) > 0:
                primary_category = str(tags[0]).strip()

        # Stock status
        quantity = doc.get("quantity", 0)
        stock_status = doc.get("stock", "inStock")
        is_in_stock = (
            stock_status not in ["out", "outOfStock", "unavailable"]
            and (quantity is None or quantity > 0)
        )

        records.append({
            "product_id": p_id,
            "sku": doc.get("sku") or vi_data.get("sku") or f"SKU-{p_id[:8]}",
            "title": title,
            "title_url": doc.get("titleUrl", ""),
            "primary_category": primary_category,
            "regular_price": float(regular_price or 0),
            "sale_price": float(sale_price or 0),
            "visibility": bool(doc.get("visibility", True)),
            "quantity": int(quantity or 0),
            "is_in_stock": bool(is_in_stock),
            "variant_count": variant_count,
            "date_added": doc.get("dateAdded") or doc.get("createdAt"),
        })

    expected_cols = [
        "product_id", "sku", "title", "title_url", "primary_category",
        "regular_price", "sale_price", "visibility", "quantity",
        "is_in_stock", "variant_count", "date_added"
    ]
    if not records:
        return pd.DataFrame(columns=expected_cols)

    return pd.DataFrame(records)


def extract_orders(db: Optional[Database] = None) -> pd.DataFrame:
    """
    Extracts orders from MongoDB 'orders' collection.
    Flattens order lines to associate purchased products with customer identifiers.
    Applies strict business logic to distinguish verified conversions from cancelled orders.
    """
    if db is None:
        db = get_mongo_db()

    expected_cols = [
        "order_id",
        "user_key",
        "is_guest",
        "product_id",
        "clean_product_id",
        "variant_id",
        "quantity",
        "unit_price",
        "subtotal",
        "status",
        "payment_status",
        "is_successful_conversion",
        "created_at",
    ]

    col_names = db.list_collection_names()
    if "orders" not in col_names:
        return pd.DataFrame(columns=expected_cols)

    cursor = db["orders"].find({})
    flat_rows: List[Dict[str, Any]] = []

    for doc in cursor:
        order_code = doc.get("orderId") or str(doc.get("_id"))
        raw_user_id = doc.get("userId")
        is_guest = raw_user_id is None

        # Pseudonymized user key (never exposes raw user_id, phone, or email)
        if raw_user_id:
            user_key = anonymize_identifier(raw_user_id, prefix="usr")
        else:
            # For guests, combine order phone/email hash to associate return visits safely
            contact = (
                doc.get("customerPhone")
                or doc.get("customerEmail")
                or (doc.get("shippingAddress") or {}).get("phone")
                or (doc.get("shippingAddress") or {}).get("email")
                or order_code
            )
            user_key = anonymize_identifier(contact, prefix="gst")

        status = str(doc.get("status", "PENDING")).strip().upper()
        payment_status = str(doc.get("paymentStatus", "PENDING")).strip().upper() if doc.get("paymentStatus") else "PENDING"

        # Determine valid conversion
        # An order is a confirmed conversion if payment is verified or delivered successfully,
        # and NOT cancelled, returned, or failed.
        is_excluded = status in EXCLUDED_ORDER_STATUSES or payment_status in ["FAILED", "REFUNDED"]
        is_successful = (
            not is_excluded
            and (
                payment_status in SUCCESSFUL_PAYMENT_STATUSES
                or status in SUCCESSFUL_ORDER_STATUSES
            )
        )

        created_at = doc.get("createdAt") or doc.get("dateAdded")

        items = doc.get("items") or (doc.get("cart") or {}).get("items") or []
        for it in items:
            raw_p_id = it.get("productId") or (it.get("item") or {}).get("_id") or it.get("id")
            norm_key = normalize_product_key(raw_p_id)

            flat_rows.append({
                "order_id": order_code,
                "user_key": user_key,
                "is_guest": is_guest,
                "product_id": str(raw_p_id) if raw_p_id else "",
                "clean_product_id": norm_key["clean_product_id"],
                "variant_id": it.get("variantId") or norm_key["variant_id"],
                "quantity": int(it.get("quantity") or it.get("qty") or 1),
                "unit_price": float(it.get("unitPrice") or it.get("price") or 0),
                "subtotal": float(it.get("subtotal") or 0),
                "status": status,
                "payment_status": payment_status,
                "is_successful_conversion": bool(is_successful),
                "created_at": created_at,
            })

    if not flat_rows:
        return pd.DataFrame(columns=expected_cols)

    return pd.DataFrame(flat_rows)
