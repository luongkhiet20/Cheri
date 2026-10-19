"""
Training and Evaluation Pipeline for Cheri ML Bootstrap Recommender Model.
Reads bootstrap interaction data from MongoDB 'ml_bootstrap_interactions',
engineers the strict 12-feature matrix, trains Random Forest Classifier with balanced weights,
truthfully evaluates metrics on Test split, saves 'randomforest.bootstrap.joblib',
and writes metadata tracking synthetic bootstrap lineage.
"""

import sys
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
)

# Setup paths
CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.config import get_mongo_db, OUTPUT_DATA_DIR, OUTPUT_MODEL_DIR
from src.extract_data import extract_products
from src.train_model import FEATURE_COLUMNS, TARGET_COLUMN


def build_bootstrap_feature_dataset(db) -> pd.DataFrame:
    """
    Constructs the 12-feature training matrix directly from MongoDB:
    - Products from 'products' collection
    - Behavioral events from 'ml_bootstrap_interactions'
    """
    products_df = extract_products(db)
    prod_map = {str(row["product_id"]): row for _, row in products_df.iterrows()}

    interactions_cursor = db.ml_bootstrap_interactions.find({"datasetType": "bootstrap"})
    events = list(interactions_cursor)

    if not events:
        raise ValueError("No bootstrap records found in collection 'ml_bootstrap_interactions'.")

    # Aggregate user stats
    user_events: Dict[str, list] = {}
    prod_view_counts: Dict[str, int] = {}

    for ev in events:
        uid = ev["userId"]
        pid = str(ev["productId"])
        etype = ev.get("eventType", "VIEW")

        if uid not in user_events:
            user_events[uid] = []
        user_events[uid].append(ev)

        if etype == "VIEW":
            prod_view_counts[pid] = prod_view_counts.get(pid, 0) + 1

    # Build dataset rows
    rows = []

    for uid, u_evs in user_events.items():
        total_views = sum(1 for e in u_evs if e.get("eventType") == "VIEW")
        viewed_pids = {str(e["productId"]) for e in u_evs if e.get("eventType") == "VIEW"}
        cart_pids = {str(e["productId"]) for e in u_evs if e.get("eventType") == "ADD_TO_CART"}
        bought_pids = {str(e["productId"]) for e in u_evs if e.get("eventType") == "PURCHASE"}
        total_orders = len(bought_pids)

        # Count views per product for this user
        u_p_views: Dict[str, int] = {}
        u_cat_views: Dict[str, int] = {}
        for e in u_evs:
            if e.get("eventType") == "VIEW":
                p = str(e["productId"])
                u_p_views[p] = u_p_views.get(p, 0) + 1
                cat = prod_map.get(p, {}).get("primary_category", "Khác")
                u_cat_views[cat] = u_cat_views.get(cat, 0) + 1

        # Evaluate candidate items for this user:
        # 1. Products user interacted with
        for pid in (viewed_pids | cart_pids | bought_pids):
            p_data = prod_map.get(pid)
            if p_data is None:
                continue

            views = u_p_views.get(pid, 0)
            in_cart = pid in cart_pids
            in_bought = pid in bought_pids
            cat = p_data.get("primary_category", "Khác")

            # Label logic: Positive interest if repeat views (>= 2), added to cart, or purchased
            label = 1 if (views >= 2 or in_cart or in_bought) else 0

            p_price = float(p_data.get("sale_price", 0) or p_data.get("regular_price", 0))
            rows.append({
                "user_key": uid,
                "product_id": pid,
                "user_total_views": float(total_views),
                "user_distinct_products_viewed": float(len(viewed_pids)),
                "user_product_views": float(views),
                "user_category_views": float(u_cat_views.get(cat, 0)),
                "days_since_last_view": 1.0,
                "user_total_orders_before": float(total_orders),
                "user_previously_purchased": 1.0 if in_bought else 0.0,
                "product_price": p_price,
                "product_variant_count": float(p_data.get("variant_count", 1)),
                "product_in_stock": 1.0 if p_data.get("is_in_stock", True) else 0.0,
                "product_visibility": 1.0 if p_data.get("visibility", True) else 0.0,
                "product_popularity_views": float(prod_view_counts.get(pid, 1)),
                "label": int(label),
            })

        # 2. Add unviewed negative controls (label = 0)
        unviewed = [p for p in prod_map.keys() if p not in viewed_pids]
        import random
        rng = random.Random(hash(uid) % 100000)
        sample_unviewed = rng.sample(unviewed, min(len(unviewed), 5))

        for pid in sample_unviewed:
            p_data = prod_map.get(pid)
            if p_data is None:
                continue
            cat = p_data.get("primary_category", "Khác")
            p_price = float(p_data.get("sale_price", 0) or p_data.get("regular_price", 0))
            rows.append({
                "user_key": uid,
                "product_id": pid,
                "user_total_views": float(total_views),
                "user_distinct_products_viewed": float(len(viewed_pids)),
                "user_product_views": 0.0,
                "user_category_views": float(u_cat_views.get(cat, 0)),
                "days_since_last_view": 999.0,
                "user_total_orders_before": float(total_orders),
                "user_previously_purchased": 0.0,
                "product_price": p_price,
                "product_variant_count": float(p_data.get("variant_count", 1)),
                "product_in_stock": 1.0 if p_data.get("is_in_stock", True) else 0.0,
                "product_visibility": 1.0 if p_data.get("visibility", True) else 0.0,
                "product_popularity_views": float(prod_view_counts.get(pid, 0)),
                "label": 0,
            })

    df = pd.DataFrame(rows)
    return df


def train_and_evaluate_bootstrap_model():
    print("=" * 70)
    print("CHERI MACHINE LEARNING - BOOTSTRAP MODEL TRAINING")
    print("=" * 70)

    db = get_mongo_db()
    print(f"Connected to database: '{db.name}'")

    print("\n1. Constructing 12-feature matrix from bootstrap collection...")
    df = build_bootstrap_feature_dataset(db)
    print(f"   Total observation pairs: {len(df)}")
    label_counts = df["label"].value_counts().to_dict()
    print(f"   Label distribution     : 0={label_counts.get(0, 0)}, 1={label_counts.get(1, 0)}")

    # Stratified Train/Val/Test split (70 / 15 / 15)
    train_val_df, test_df = train_test_split(
        df, test_size=0.15, random_state=42, stratify=df["label"]
    )
    train_df, val_df = train_test_split(
        train_val_df, test_size=0.1765, random_state=42, stratify=train_val_df["label"]
    )

    print(f"\n2. Data Partitioning:")
    print(f"   Train set : {len(train_df)} samples")
    print(f"   Val set   : {len(val_df)} samples")
    print(f"   Test set  : {len(test_df)} samples")

    X_train = train_df[FEATURE_COLUMNS]
    y_train = train_df["label"]
    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df["label"]

    print("\n3. Training Random Forest Classifier...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        class_weight="balanced",
        random_state=42,
    )
    rf_model.fit(X_train, y_train)

    print("\n4. Evaluating Model on Held-out Test Set...")
    preds = rf_model.predict(X_test)
    probs = rf_model.predict_proba(X_test)[:, 1]

    acc = float(accuracy_score(y_test, preds))
    prec = float(precision_score(y_test, preds, zero_division=0))
    rec = float(recall_score(y_test, preds, zero_division=0))
    f1 = float(f1_score(y_test, preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, probs))
    pr_auc = float(average_precision_score(y_test, probs))

    metrics = {
        "test_samples": len(test_df),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
    }

    print("\n--- MODEL PERFORMANCE METRICS ---")
    for k, v in metrics.items():
        print(f"   {k.ljust(15)}: {v}")

    # Feature Importance
    importances = rf_model.feature_importances_
    sorted_idx = np.argsort(importances)[::-1]
    print("\n--- TOP FEATURE IMPORTANCE ---")
    for i in range(min(5, len(FEATURE_COLUMNS))):
        idx = sorted_idx[i]
        print(f"   {FEATURE_COLUMNS[idx].ljust(30)}: {importances[idx]:.4f}")

    print("\n5. Saving Artifacts and Lineage Metadata...")
    model_filename = "randomforest.bootstrap.joblib"
    model_path = OUTPUT_MODEL_DIR / model_filename
    joblib.dump(rf_model, model_path)
    print(f"   Saved model artifact to: {model_path}")

    metadata = {
        "model_name": "RandomForestBootstrap",
        "model_file": model_filename,
        "version": "rf_bootstrap_v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_production_ready": False,
        "is_bootstrap": True,
        "trained_on_synthetic": True,
        "dataset_source": "ml_bootstrap_interactions",
        "description": "Trained on synthetic bootstrap interaction profiles anchored to real MongoDB products",
        "feature_columns": FEATURE_COLUMNS,
        "metrics": metrics,
    }

    # Save dedicated bootstrap metadata
    bootstrap_meta_path = OUTPUT_MODEL_DIR / "model_metadata.bootstrap.json"
    with open(bootstrap_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"   Saved bootstrap metadata to: {bootstrap_meta_path}")

    # Also update model_metadata.json pointing to this bootstrap model
    main_meta_path = OUTPUT_MODEL_DIR / "model_metadata.json"
    with open(main_meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"   Updated active model_metadata.json: {main_meta_path}")

    # Save dataset CSV
    dataset_csv = OUTPUT_DATA_DIR / "user_product_bootstrap_dataset.csv"
    df.to_csv(dataset_csv, index=False, encoding="utf-8")
    print(f"   Saved dataset CSV to: {dataset_csv}")

    print("\n[SUCCESS] Model training and artifact persistence complete.")
    return rf_model, metadata


if __name__ == "__main__":
    train_and_evaluate_bootstrap_model()
