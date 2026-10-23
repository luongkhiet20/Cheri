"""
Training and Evaluation Pipeline for the Cheri ML Bootstrap Recommender Model (v2).

- Data: ONLY synthetic docs in 'ml_bootstrap_interactions' (generator v2 by default).
- Target: the SAME purchase definition as production (successful synthetic order of the same
  user-product in [T, T+14d]); snapshots without full follow-up are excluded.
- Features: the 12-feature contract (FEATURE_COLUMNS), computed strictly before T.
- Split: chronological by snapshot with embargo (no random shuffle).
- Artifacts: randomforest.bootstrap.joblib + metadata with trained_on_synthetic=true,
  is_production_ready=false. Metrics are SYNTHETIC sanity checks, NOT production results.

Usage (from server/ml):
  python -m src.train_bootstrap_model                       # read v2 bootstrap docs from MongoDB
  python -m src.train_bootstrap_model --batch-id <id>       # restrict to one seeded batch
  python -m src.train_bootstrap_model --include-legacy      # also include legacy v1 docs (not recommended)
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, average_precision_score,
)

CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.config import (
    get_mongo_db, OUTPUT_DATA_DIR, OUTPUT_MODEL_DIR, OUTPUT_REPORT_DIR, FUTURE_WINDOW_DAYS,
    BOOTSTRAP_COLLECTION_NAME, BOOTSTRAP_GENERATOR_NAME, BOOTSTRAP_GENERATOR_VERSION,
)
from src.extract_data import extract_products, fetch_bootstrap_docs, bootstrap_docs_to_interactions_df, bootstrap_docs_to_orders_df
from src.validate_data import validate_and_clean_interactions
from src.build_dataset import build_snapshot_dataset, assign_snapshot_time_splits, summarize_snapshot_dataset
from src.train_model import FEATURE_COLUMNS, TARGET_COLUMN

SYNTHETIC_DISCLAIMER = (
    "Các chỉ số dưới đây được đo trên dữ liệu SYNTHETIC bootstrap, chỉ để kiểm tra kỹ thuật pipeline; "
    "KHÔNG phải kết quả đánh giá production và không được trích dẫn như hiệu năng thực tế."
)


def _observation_end(docs) -> Optional[datetime]:
    """Synthetic world ends at the generator windowEnd (latest across batches)."""
    ends = [d.get("metadata", {}).get("windowEnd") for d in docs if d.get("metadata", {}).get("windowEnd")]
    if ends:
        return max(pd.Timestamp(e) for e in ends).to_pydatetime()
    ts = [d.get("timestamp") for d in docs if d.get("timestamp")]
    return max(pd.to_datetime(ts, utc=True)).to_pydatetime() if ts else None


def build_bootstrap_purchase_dataset(docs, products_df: pd.DataFrame):
    raw = bootstrap_docs_to_interactions_df(docs)
    orders = bootstrap_docs_to_orders_df(docs)
    clean, _ = validate_and_clean_interactions(raw, set(products_df["product_id"]), include_synthetic=True)
    obs_end = _observation_end(docs)
    ds, stats = build_snapshot_dataset(clean, orders, products_df, observation_end=obs_end, target="purchase")
    ds, split = assign_snapshot_time_splits(ds)
    summary = summarize_snapshot_dataset(ds, stats, split, f"{BOOTSTRAP_COLLECTION_NAME} (synthetic)", True)
    interest, istats = build_snapshot_dataset(clean, orders, products_df, observation_end=obs_end, target="interest")
    interest, isplit = assign_snapshot_time_splits(interest)
    isummary = summarize_snapshot_dataset(interest, istats, isplit, f"{BOOTSTRAP_COLLECTION_NAME} (synthetic)", True, "interest_label")
    return ds, summary, interest, isummary


def _evaluate_split_with_baselines(model, split_df: pd.DataFrame, target_col: str = TARGET_COLUMN) -> Dict[str, Any]:
    if split_df.empty:
        return {"samples": 0, "status": "empty_split"}

    X = split_df[FEATURE_COLUMNS]
    y = split_df[target_col]
    samples = int(len(y))
    positives = int(y.sum())
    negatives = samples - positives
    base_rate = round(float(y.mean()), 4)

    preds = model.predict(X)
    probs = model.predict_proba(X)[:, 1] if len(model.classes_) > 1 else np.zeros(samples)
    has_two_classes = y.nunique() > 1

    clf_metrics = {
        "samples": samples,
        "positives": positives,
        "negatives": negatives,
        "base_rate": base_rate,
        "accuracy": round(float(accuracy_score(y, preds)), 4),
        "precision": round(float(precision_score(y, preds, zero_division=0)), 4),
        "recall": round(float(recall_score(y, preds, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y, preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y, probs)), 4) if has_two_classes else "N/A (1 class)",
        "pr_auc": round(float(average_precision_score(y, probs)), 4) if has_two_classes else "N/A (1 class)",
    }

    # Recommender ranking metrics (Precision@K and Recall@K grouped by snapshot and user)
    def calc_ranking(score_series, k_list=(5, 10)):
        temp_df = split_df.copy()
        temp_df["_score"] = score_series
        precisions = {k: [] for k in k_list}
        recalls = {k: [] for k in k_list}
        for (_, _), group in temp_df.groupby(["cutoff_timestamp", "user_key"]):
            n_pos = (group[target_col] == 1).sum()
            sorted_group = group.sort_values(by="_score", ascending=False)
            for k in k_list:
                top_k = sorted_group.iloc[:k]
                hits = (top_k[target_col] == 1).sum()
                precisions[k].append(hits / min(k, len(sorted_group)))
                if n_pos > 0:
                    recalls[k].append(hits / n_pos)
        res = {}
        for k in k_list:
            res[f"precision@{k}"] = round(float(np.mean(precisions[k])), 4) if precisions[k] else 0.0
            res[f"recall@{k}"] = round(float(np.mean(recalls[k])), 4) if recalls[k] else 0.0
        return res

    clf_metrics.update(calc_ranking(probs))

    # Baseline 1: Popularity Ranking (ranking candidates by product_popularity_views)
    pop_scores = split_df["product_popularity_views"].values
    pop_ranking = calc_ranking(pop_scores)
    popularity_baseline = {
        "baseline_name": "PopularityRanking",
        "description": "Rank candidates by historical product popularity views strictly before T",
        "roc_auc": round(float(roc_auc_score(y, pop_scores)), 4) if has_two_classes else "N/A (1 class)",
        "pr_auc": round(float(average_precision_score(y, pop_scores)), 4) if has_two_classes else "N/A (1 class)",
        **pop_ranking,
    }

    # Baseline 2: Prior Base Rate Predictor (predicting class prior)
    prior_baseline = {
        "baseline_name": "PriorPositiveRate",
        "description": "Predict constant prior probability equal to positive rate",
        "roc_auc": 0.5000,
        "pr_auc": base_rate,
    }

    # Statistical significance / sample size assessment
    is_sufficient = positives >= 30
    reliability_assessment = {
        "status": "ĐỦ DỮ LIỆU ĐÁNH GIÁ KỸ THUẬT" if is_sufficient else "CHƯA ĐỦ DỮ LIỆU ĐỂ KẾT LUẬN HIỆU NĂNG",
        "is_statistically_reliable": is_sufficient,
        "sample_size_warning": None if is_sufficient else (
            f"Số mẫu positive ({positives}) < ngưỡng tối thiểu (30 mẫu). "
            "Cỡ mẫu quá nhỏ để kết luận hiệu năng mô hình một cách đáng tin cậy. "
            "Kết quả chỉ dùng để kiểm tra kỹ thuật (sanity check) của pipeline, không thể hiện hiệu năng production."
        ),
    }

    return {
        "model_performance": clf_metrics,
        "baselines": {
            "popularity": popularity_baseline,
            "prior": prior_baseline,
        },
        "reliability_assessment": reliability_assessment,
    }



def train_and_evaluate_bootstrap_model(generator: Optional[str] = BOOTSTRAP_GENERATOR_NAME, batch_id: Optional[str] = None):
    print("=" * 70)
    print("CHERI MACHINE LEARNING - BOOTSTRAP MODEL TRAINING (SYNTHETIC, v2)")
    print("=" * 70)
    db = get_mongo_db()
    print(f"Database: '{db.name}' | collection: '{BOOTSTRAP_COLLECTION_NAME}' | generator filter: {generator or 'ALL (incl. legacy)'}")

    docs = fetch_bootstrap_docs(db, generator=generator, batch_id=batch_id)
    if not docs:
        raise SystemExit("No bootstrap docs found. Run: python -m src.seed_bootstrap_data (dry-run) then --commit.")
    products_df = extract_products(db)

    df, summary, interest_df, interest_summary = build_bootstrap_purchase_dataset(docs, products_df)
    print(f"Docs: {len(docs)} | rows: {summary['rows']} | snapshots: {summary['snapshots_in_dataset']} | "
          f"labels: {summary['label_distribution']} | splits: {summary['split_distribution']}")

    train = df[df["split"] == "train"]
    val = df[df["split"] == "val"]
    test = df[df["split"] == "test"]
    if train.empty or train[TARGET_COLUMN].nunique() < 2:
        raise SystemExit("Train split lacks both classes; increase --users/--days in the seeder.")

    model = RandomForestClassifier(n_estimators=100, max_depth=6, class_weight="balanced", random_state=42)
    model.fit(train[FEATURE_COLUMNS], train[TARGET_COLUMN])

    val_eval = _evaluate_split_with_baselines(model, val)
    test_eval = _evaluate_split_with_baselines(model, test)

    metrics = {
        "evaluation_scope": "synthetic_bootstrap_only",
        "disclaimer": SYNTHETIC_DISCLAIMER,
        "validation": val_eval,
        "test": test_eval,
    }
    importances = sorted(zip(FEATURE_COLUMNS, model.feature_importances_), key=lambda x: -x[1])

    print(f"\n[SYNTHETIC] {SYNTHETIC_DISCLAIMER}")
    print("\n--- VALIDATION SPLIT ---")
    print(f"  Model       : {val_eval.get('model_performance')}")
    print(f"  Reliability : {val_eval.get('reliability_assessment', {}).get('status')}")
    if val_eval.get("reliability_assessment", {}).get("sample_size_warning"):
        print(f"  Warning     : {val_eval['reliability_assessment']['sample_size_warning']}")

    print("\n--- TEST SPLIT ---")
    print(f"  Model       : {test_eval.get('model_performance')}")
    print(f"  Popularity  : {test_eval.get('baselines', {}).get('popularity')}")
    print(f"  Prior       : {test_eval.get('baselines', {}).get('prior')}")
    print(f"  Reliability : {test_eval.get('reliability_assessment', {}).get('status')}")
    if test_eval.get("reliability_assessment", {}).get("sample_size_warning"):
        print(f"  Warning     : {test_eval['reliability_assessment']['sample_size_warning']}")

    print("\n  Top features: " + ", ".join(f"{n}={v:.3f}" for n, v in importances[:5]))


    model_filename = "randomforest.bootstrap.joblib"
    joblib.dump(model, OUTPUT_MODEL_DIR / model_filename)
    metadata = {
        "model_name": "RandomForestBootstrap",
        "model_file": model_filename,
        "version": f"rf_bootstrap_v2_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_production_ready": False,
        "is_bootstrap": True,
        "trained_on_synthetic": True,
        "dataset_source": BOOTSTRAP_COLLECTION_NAME,
        "generator": generator,
        "generator_version": BOOTSTRAP_GENERATOR_VERSION if generator else "mixed",
        "batch_ids": sorted({d["metadata"].get("batchId") for d in docs if d.get("metadata", {}).get("batchId")}),
        "target": "purchase_within_14_days",
        "label_definition": summary["label_definition"],
        "window_days": FUTURE_WINDOW_DAYS,
        "split_strategy": summary.get("split_strategy"),
        "description": "Trained on SYNTHETIC bootstrap timelines anchored to real product catalog. Not production evidence.",
        "feature_columns": FEATURE_COLUMNS,
        "feature_importances": {n: round(float(v), 4) for n, v in importances},
        "dataset_summary": summary,
        "metrics": metrics,
    }
    for name in ("model_metadata.bootstrap.json", "model_metadata.json"):
        with open(OUTPUT_MODEL_DIR / name, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False, default=str)

    df.to_csv(OUTPUT_DATA_DIR / "user_product_bootstrap_dataset.csv", index=False, encoding="utf-8")
    # Interest dataset is exported separately for analysis only; it is NOT used as a purchase label.
    interest_df.to_csv(OUTPUT_DATA_DIR / "user_product_bootstrap_interest_dataset.csv", index=False, encoding="utf-8")
    with open(OUTPUT_REPORT_DIR / "bootstrap_dataset_report.json", "w", encoding="utf-8") as f:
        json.dump({"purchase": summary, "interest": interest_summary, "disclaimer": SYNTHETIC_DISCLAIMER},
                  f, indent=2, ensure_ascii=False, default=str)
    print(f"\nSaved model + metadata to {OUTPUT_MODEL_DIR} (trained_on_synthetic=true, is_production_ready=false)")
    return model, metadata


def main(argv=None):
    p = argparse.ArgumentParser(description="Train the synthetic bootstrap model (purchase target, snapshot split)")
    p.add_argument("--batch-id", type=str, default=None)
    p.add_argument("--include-legacy", action="store_true", help="Include legacy v1 bootstrap docs (no generator tag)")
    a = p.parse_args(argv)
    train_and_evaluate_bootstrap_model(generator=None if a.include_legacy else BOOTSTRAP_GENERATOR_NAME, batch_id=a.batch_id)


if __name__ == "__main__":
    main()
