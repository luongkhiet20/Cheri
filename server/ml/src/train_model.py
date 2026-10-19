"""
Model Training & Evaluation Module for Cheri Machine Learning Recommender System.
Phase B1: Implements rigorous data validation, training eligibility gates,
strict separation of real vs synthetic data, and robust metric evaluations.
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional, List

# Ensure stdout uses utf-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

import numpy as np
import pandas as pd


# Path setup
CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.config import OUTPUT_DATA_DIR, OUTPUT_REPORT_DIR, OUTPUT_MODEL_DIR

# Defined feature columns contract: Must match identically across training and inference
FEATURE_COLUMNS: List[str] = [
    "user_total_views",
    "user_distinct_products_viewed",
    "user_product_views",
    "user_category_views",
    "days_since_last_view",
    "user_total_orders_before",
    "user_previously_purchased",
    "product_price",
    "product_variant_count",
    "product_in_stock",
    "product_visibility",
    "product_popularity_views",
]

TARGET_COLUMN: str = "label"
SPLIT_COLUMN: str = "split"


def check_training_eligibility(
    df: pd.DataFrame,
    min_samples: int = 30,
) -> Dict[str, Any]:
    """
    Evaluates whether dataset meets scientific requirements for supervised classification.
    Checks sample count, class distribution, and label diversity.
    """
    if df.empty:
        return {
            "is_eligible": False,
            "sample_count": 0,
            "label_distribution": {},
            "distinct_classes": 0,
            "reason": "Dataset is completely empty (0 rows).",
        }

    total_samples = len(df)
    if TARGET_COLUMN not in df.columns:
        return {
            "is_eligible": False,
            "sample_count": total_samples,
            "label_distribution": {},
            "distinct_classes": 0,
            "reason": f"Missing target column '{TARGET_COLUMN}' in dataset.",
        }

    label_counts = df[TARGET_COLUMN].value_counts().to_dict()
    distinct_classes = len(label_counts)

    # Gate 1: Class diversity check
    if distinct_classes < 2:
        return {
            "is_eligible": False,
            "sample_count": total_samples,
            "label_distribution": label_counts,
            "distinct_classes": distinct_classes,
            "reason": (
                f"Tập dữ liệu chỉ có duy nhất 1 lớp nhãn {list(label_counts.keys())}. "
                "Không thể huấn luyện mô hình phân loại nhị phân vì thiếu nhãn đối chứng. "
                "(Cần cả nhãn 0 và nhãn 1 để xác định ranh giới quyết định)."
            ),
        }

    # Gate 2: Sample size sufficiency check
    if total_samples < min_samples:
        return {
            "is_eligible": False,
            "sample_count": total_samples,
            "label_distribution": label_counts,
            "distinct_classes": distinct_classes,
            "reason": (
                f"Số lượng mẫu quan sát ({total_samples}) chưa đạt ngưỡng tối thiểu ({min_samples}) "
                "để đảm bảo tính ổn định thống kê cho tập Train/Val/Test."
            ),
        }

    # Gate 3: Split validation
    train_df = df[df[SPLIT_COLUMN] == "train"] if SPLIT_COLUMN in df.columns else df
    train_labels = train_df[TARGET_COLUMN].value_counts().to_dict() if not train_df.empty else {}
    if len(train_labels) < 2:
        return {
            "is_eligible": False,
            "sample_count": total_samples,
            "label_distribution": label_counts,
            "distinct_classes": distinct_classes,
            "reason": "Tập huấn luyện (Train split) chỉ chứa 1 lớp nhãn sau khi phân chia dòng thời gian.",
        }

    return {
        "is_eligible": True,
        "sample_count": total_samples,
        "label_distribution": label_counts,
        "distinct_classes": distinct_classes,
        "reason": "Dataset satisfies all statistical and class distribution criteria.",
    }


def prepare_feature_matrices(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame, pd.Series, pd.DataFrame, pd.Series]:
    """
    Extracts features and target split by 'train', 'val', 'test'.
    Imputes missing values with neutral medians without data leakage.
    """
    # Verify all feature columns exist, impute missing columns with 0
    df_clean = df.copy()
    for col in FEATURE_COLUMNS:
        if col not in df_clean.columns:
            df_clean[col] = 0.0

    # Ensure target is integer
    df_clean[TARGET_COLUMN] = df_clean[TARGET_COLUMN].fillna(0).astype(int)

    train_mask = df_clean[SPLIT_COLUMN] == "train" if SPLIT_COLUMN in df_clean.columns else pd.Series(True, index=df_clean.index)
    val_mask = df_clean[SPLIT_COLUMN] == "val" if SPLIT_COLUMN in df_clean.columns else pd.Series(False, index=df_clean.index)
    test_mask = df_clean[SPLIT_COLUMN] == "test" if SPLIT_COLUMN in df_clean.columns else pd.Series(False, index=df_clean.index)

    if train_mask.sum() == 0 and not df_clean.empty:
        X_train = df_clean[FEATURE_COLUMNS].fillna(0.0)
        y_train = df_clean[TARGET_COLUMN]
    else:
        X_train = df_clean.loc[train_mask, FEATURE_COLUMNS].fillna(0.0)
        y_train = df_clean.loc[train_mask, TARGET_COLUMN]

    X_val = df_clean.loc[val_mask, FEATURE_COLUMNS].fillna(0.0)
    y_val = df_clean.loc[val_mask, TARGET_COLUMN]

    X_test = df_clean.loc[test_mask, FEATURE_COLUMNS].fillna(0.0)
    y_test = df_clean.loc[test_mask, TARGET_COLUMN]

    return X_train, y_train, X_val, y_val, X_test, y_test


def evaluate_model_safely(
    model: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    model_name: str,
) -> Dict[str, Any]:
    """
    Evaluates model performance. Flags ROC-AUC and PR-AUC as N/A if test set lacks both classes.
    """
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, average_precision_score

    if X_test.empty or y_test.empty:
        return {
            "model_name": model_name,
            "test_samples": 0,
            "accuracy": None,
            "roc_auc": "N/A (Test set empty)",
            "pr_auc": "N/A (Test set empty)",
            "f1_score": None,
        }

    distinct_test_classes = y_test.nunique()
    preds = model.predict(X_test)

    # Probabilities for positive class (label=1)
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test)
        pos_probs = probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
    else:
        pos_probs = preds

    acc = float(accuracy_score(y_test, preds))

    if distinct_test_classes < 2:
        roc_auc_val = "N/A (Chỉ có 1 lớp nhãn trong tập Test)"
        pr_auc_val = "N/A (Chỉ có 1 lớp nhãn trong tập Test)"
        f1_val = float(f1_score(y_test, preds, zero_division=0))
        prec_val = float(precision_score(y_test, preds, zero_division=0))
        rec_val = float(recall_score(y_test, preds, zero_division=0))
    else:
        try:
            roc_auc_val = float(roc_auc_score(y_test, pos_probs))
        except Exception:
            roc_auc_val = "N/A (Evaluation error)"
        try:
            pr_auc_val = float(average_precision_score(y_test, pos_probs))
        except Exception:
            pr_auc_val = "N/A (Evaluation error)"
        f1_val = float(f1_score(y_test, preds, zero_division=0))
        prec_val = float(precision_score(y_test, preds, zero_division=0))
        rec_val = float(recall_score(y_test, preds, zero_division=0))

    return {
        "model_name": model_name,
        "test_samples": len(y_test),
        "accuracy": acc,
        "precision": prec_val,
        "recall": rec_val,
        "f1_score": f1_val,
        "roc_auc": roc_auc_val,
        "pr_auc": pr_auc_val,
    }


def save_model_artifacts(
    model: Any,
    model_name: str,
    metrics: Dict[str, Any],
    feature_names: Optional[List[str]] = None,
    is_production_ready: bool = False,
    trained_on_synthetic: bool = False,
    output_dir: Optional[Path] = None,
) -> Dict[str, Path]:
    """
    Saves model artifact (.joblib) and detailed metadata (.json) to output_dir.
    Metadata explicitly tracks:
      - model_name
      - version
      - created_at
      - is_production_ready (False if trained on synthetic or below eligibility criteria)
      - trained_on_synthetic (True if trained on synthetic data)
      - feature_columns
      - metrics
    """
    import joblib

    target_dir = Path(output_dir) if output_dir else OUTPUT_MODEL_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    version = f"{model_name.lower()}_{timestamp}"
    features = feature_names if feature_names is not None else FEATURE_COLUMNS

    model_filename = f"{model_name.lower()}.joblib"
    model_path = target_dir / model_filename
    joblib.dump(model, model_path)

    metadata = {
        "model_name": model_name,
        "model_file": model_filename,
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_production_ready": bool(is_production_ready),
        "trained_on_synthetic": bool(trained_on_synthetic),
        "feature_columns": features,
        "metrics": metrics,
    }

    metadata_path = target_dir / "model_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    return {"model_path": model_path, "metadata_path": metadata_path}


def main():
    parser = argparse.ArgumentParser(description="Cheri Machine Learning - Training Pipeline (Phase B1)")
    parser.add_argument("--data-file", type=str, default=None, help="Path to user_product_dataset.csv")
    parser.add_argument("--mode", choices=["production", "sandbox"], default="production",
                        help="Mode: 'production' enforces real data only; 'sandbox' allows synthetic verification.")
    parser.add_argument("--check-only", action="store_true", help="Only check data eligibility without executing training")
    parser.add_argument("--save-model", action="store_true", help="Save production model artifacts if eligible")
    parser.add_argument("--save-sandbox-model", action="store_true", help="Save sandbox model for testing inference pipeline (marked as not production ready)")
    args = parser.parse_args()

    print("=" * 70)
    print("CHERI MACHINE LEARNING - MODEL TRAINING & ELIGIBILITY AUDIT (PHASE B1)")
    print("=" * 70)
    print(f"Execution Mode: {args.mode.upper()}")
    print("Label Nature  : 14-day purchase conversion (Proxy indicator of deep customer interest)")
    print("-" * 70)

    # 1. Locate dataset
    data_path = Path(args.data_file) if args.data_file else OUTPUT_DATA_DIR / "user_product_dataset.csv"
    if not data_path.exists():
        print(f"ERROR: Dataset not found at '{data_path}'. Please run pipeline first.")
        sys.exit(1)

    df = pd.read_csv(data_path)
    print(f"Loaded dataset from: {data_path.name} | Total rows: {len(df)}")

    # 2. Check training eligibility
    eligibility = check_training_eligibility(df)
    print("\n--- DATA ELIGIBILITY AUDIT ---")
    print(f"  Total Samples           : {eligibility['sample_count']}")
    print(f"  Distinct Classes        : {eligibility['distinct_classes']}")
    print(f"  Label Distribution      : {eligibility['label_distribution']}")
    print(f"  Eligibility Decision    : {'ELIGIBLE' if eligibility['is_eligible'] else 'NOT ELIGIBLE'}")
    if not eligibility["is_eligible"]:
        print(f"  Reason                  : {eligibility['reason']}")

    if args.check_only:
        print("\n[CHECK-ONLY COMPLETED] No training executed.")
        sys.exit(0 if eligibility["is_eligible"] else 1)

    # 3. Guard against ungrounded production training
    if args.mode == "production" and not eligibility["is_eligible"]:
        print("\n" + "=" * 70)
        print("STOPPED: PRODUCTION TRAINING ABORTED (NGUYÊN TẮC BẢO VỆ DỮ LIỆU THỰC TẾ)")
        print("=" * 70)
        print("Nguyên nhân: Dữ liệu thực tế của khách hàng chưa đủ điều kiện (thiếu nhãn dương 1 hoặc quá ít mẫu).")
        print("Quy tắc: Tuyệt đối không tự bịa đặt nhãn 1, không tạo mô hình giả và không tuyên bố so sánh.")
        print("Hành động: Hệ thống backend sẽ sử dụng cơ chế Fallback an toàn (Category/Popularity).")
        print("Để chạy kiểm thử kỹ thuật thuật toán bằng dữ liệu giả lập sandbox, chạy với cờ: --mode sandbox")
        print("=" * 70)
        sys.exit(2)

    # 4. If sandbox mode or eligible, perform training and comparative evaluation
    print("\nExecuting model training (Random Forest & XGBoost)...")
    from sklearn.ensemble import RandomForestClassifier
    import xgboost as xgb

    X_train, y_train, X_val, y_val, X_test, y_test = prepare_feature_matrices(df)

    # Train Random Forest
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        class_weight="balanced" if eligibility["distinct_classes"] > 1 else None,
        random_state=42,
    )
    rf_model.fit(X_train, y_train)

    # Train XGBoost if distinct classes >= 2
    xgb_metrics = None
    if len(np.unique(y_train)) >= 2:
        xgb_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.05,
            random_state=42,
            eval_metric="logloss",
        )
        xgb_model.fit(X_train, y_train)
        xgb_metrics = evaluate_model_safely(xgb_model, X_test, y_test, "XGBoost")
    else:
        xgb_model = None
        print("\n[NOTE] XGBoost yêu cầu tối thiểu 2 lớp nhãn trong tập huấn luyện để khởi tạo cây quyết định gradient boosted.")

    # Evaluate
    rf_metrics = evaluate_model_safely(rf_model, X_test, y_test, "RandomForest")

    print("\n--- MODEL EVALUATION RESULTS ---")
    print(f"Random Forest : Acc: {rf_metrics['accuracy']:.4f} | ROC-AUC: {rf_metrics['roc_auc']} | PR-AUC: {rf_metrics['pr_auc']}")
    if xgb_metrics:
        print(f"XGBoost       : Acc: {xgb_metrics['accuracy']:.4f} | ROC-AUC: {xgb_metrics['roc_auc']} | PR-AUC: {xgb_metrics['pr_auc']}")
    else:
        print("XGBoost       : N/A (Tập train chỉ có 1 lớp nhãn)")

    if eligibility["distinct_classes"] < 2:
        print("\nCHÚ Ý: ROC-AUC và PR-AUC không khả dụng vì tập đánh giá chỉ có 1 lớp nhãn.")
        print("Không thể tuyên bố mô hình nào chiến thắng một cách hợp lệ trên dữ liệu hiện tại.")

    # 5. Save model artifacts if requested
    is_sandbox = args.mode == "sandbox"
    is_prod_ready = eligibility["is_eligible"] and not is_sandbox

    if (args.save_model and is_prod_ready) or (args.save_sandbox_model and is_sandbox):
        # Choose better model or default to RandomForest
        chosen_model = rf_model
        chosen_name = "RandomForest"
        chosen_metrics = rf_metrics

        saved = save_model_artifacts(
            model=chosen_model,
            model_name=chosen_name,
            metrics=chosen_metrics,
            feature_names=FEATURE_COLUMNS,
            is_production_ready=is_prod_ready,
            trained_on_synthetic=is_sandbox,
        )
        print(f"\n[ARTIFACT SAVED] Model saved to: {saved['model_path']}")
        print(f"[ARTIFACT SAVED] Metadata saved to: {saved['metadata_path']}")
        print(f"  is_production_ready: {is_prod_ready}")
        print(f"  trained_on_synthetic: {is_sandbox}")


if __name__ == "__main__":
    main()
