"""
Unit Tests for Model Training & Eligibility Module (Phase B1 & Priority 3 Remediation).
Verifies:
  - Strict eligibility gates (sample size, class diversity)
  - Safe evaluation metrics (marking ROC-AUC as N/A when classes < 2, plus Brier Score)
  - Feature contract consistency
  - Automatic best model selection (PR-AUC / ROC-AUC) and .bak artifact backup
"""

import sys
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

# Add ML root to sys.path
TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.train_model import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    SPLIT_COLUMN,
    check_training_eligibility,
    prepare_feature_matrices,
    evaluate_model_safely,
    select_best_model,
    save_model_artifacts,
)


class TestModelTrainingPhaseB1(unittest.TestCase):

    def setUp(self):
        # Synthetic mock dataset with two balanced classes
        np.random.seed(42)
        n = 100
        data = {col: np.random.rand(n) for col in FEATURE_COLUMNS}
        data[TARGET_COLUMN] = np.random.choice([0, 1], size=n, p=[0.7, 0.3])
        data[SPLIT_COLUMN] = ["train"] * 70 + ["val"] * 15 + ["test"] * 15
        self.healthy_df = pd.DataFrame(data)

    # 1. Dataset rỗng bị từ chối
    def test_01_empty_dataset_rejected(self):
        empty_df = pd.DataFrame()
        res = check_training_eligibility(empty_df)
        self.assertFalse(res["is_eligible"])
        self.assertIn("empty", res["reason"].lower())

    # 2. Dataset chỉ có 1 lớp nhãn bị từ chối (class imbalance tuyệt đối)
    def test_02_single_class_rejected(self):
        single_class_df = self.healthy_df.copy()
        single_class_df[TARGET_COLUMN] = 0  # Tất cả nhãn là 0
        res = check_training_eligibility(single_class_df)
        self.assertFalse(res["is_eligible"])
        self.assertEqual(res["distinct_classes"], 1)
        self.assertIn("1 lớp nhãn", res["reason"])

    # 3. Số lượng mẫu quan sát quá ít bị từ chối
    def test_03_too_few_samples_rejected(self):
        tiny_df = self.healthy_df.iloc[:5].copy()  # Chỉ có 5 dòng
        res = check_training_eligibility(tiny_df, min_samples=30)
        self.assertFalse(res["is_eligible"])
        self.assertIn("ngưỡng tối thiểu", res["reason"])

    # 4. Dataset đầy đủ điều kiện được chấp nhận
    def test_04_healthy_dataset_accepted(self):
        res = check_training_eligibility(self.healthy_df, min_samples=30)
        self.assertTrue(res["is_eligible"])
        self.assertEqual(res["distinct_classes"], 2)

    # 5. Hợp đồng Feature Matrix: Thứ tự và tên cột khớp 100%
    def test_05_feature_matrices_consistency(self):
        X_train, y_train, X_val, y_val, X_test, y_test = prepare_feature_matrices(self.healthy_df)
        self.assertEqual(list(X_train.columns), FEATURE_COLUMNS)
        self.assertEqual(list(X_test.columns), FEATURE_COLUMNS)
        self.assertEqual(len(X_train), 70)
        self.assertEqual(len(X_val), 15)
        self.assertEqual(len(X_test), 15)

    # 6. Đánh giá an toàn: Khi test set chỉ có 1 lớp nhãn -> ROC-AUC trả về N/A
    def test_06_safe_evaluation_single_class_test_set(self):
        from sklearn.dummy import DummyClassifier

        model = DummyClassifier(strategy="constant", constant=0)
        X_dummy = pd.DataFrame(np.zeros((10, len(FEATURE_COLUMNS))), columns=FEATURE_COLUMNS)
        y_dummy = pd.Series([0] * 10)  # Chỉ có nhãn 0

        model.fit(X_dummy, y_dummy)
        metrics = evaluate_model_safely(model, X_dummy, y_dummy, "Dummy")

        self.assertIsInstance(metrics["roc_auc"], str)
        self.assertIn("N/A", metrics["roc_auc"])
        self.assertIn("N/A", metrics["pr_auc"])
        self.assertIn("brier_score", metrics)

    # 7. Đánh giá đầy đủ: Khi test set có cả 2 lớp nhãn -> ROC-AUC & Brier Score tính toán hợp lệ
    def test_07_safe_evaluation_multi_class_test_set(self):
        from sklearn.ensemble import RandomForestClassifier

        X_train, y_train, _, _, X_test, y_test = prepare_feature_matrices(self.healthy_df)
        rf = RandomForestClassifier(n_estimators=10, random_state=42)
        rf.fit(X_train, y_train)

        metrics = evaluate_model_safely(rf, X_test, y_test, "RandomForest")
        if y_test.nunique() >= 2:
            self.assertIsInstance(metrics["roc_auc"], float)
            self.assertGreaterEqual(metrics["roc_auc"], 0.0)
            self.assertLessEqual(metrics["roc_auc"], 1.0)
            self.assertIsInstance(metrics["brier_score"], float)
            self.assertGreaterEqual(metrics["brier_score"], 0.0)
            self.assertLessEqual(metrics["brier_score"], 1.0)

    # 8. Kiểm tra lưu model artifact, model_metadata.json và sao lưu tự động (.bak)
    def test_08_save_model_artifacts_and_backup(self):
        import tempfile
        import json
        from sklearn.ensemble import RandomForestClassifier

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            rf = RandomForestClassifier(n_estimators=5, random_state=42)
            X = pd.DataFrame(np.zeros((10, len(FEATURE_COLUMNS))), columns=FEATURE_COLUMNS)
            y = pd.Series([0, 1] * 5)
            rf.fit(X, y)

            metrics_v1 = {"accuracy": 0.8, "roc_auc": 0.75, "pr_auc": 0.6, "brier_score": 0.15}
            result_v1 = save_model_artifacts(
                model=rf,
                model_name="TestRF_v1",
                metrics=metrics_v1,
                feature_names=FEATURE_COLUMNS,
                is_production_ready=False,
                trained_on_synthetic=True,
                output_dir=tmp_path,
            )

            self.assertTrue(result_v1["model_path"].exists())
            self.assertTrue(result_v1["metadata_path"].exists())
            self.assertNotIn("metadata_backup_path", result_v1)

            # Save second time to verify .bak creation
            metrics_v2 = {"accuracy": 0.9, "roc_auc": 0.85, "pr_auc": 0.75, "brier_score": 0.10}
            result_v2 = save_model_artifacts(
                model=rf,
                model_name="TestRF_v1",
                metrics=metrics_v2,
                feature_names=FEATURE_COLUMNS,
                is_production_ready=True,
                trained_on_synthetic=False,
                output_dir=tmp_path,
            )

            self.assertIn("model_backup_path", result_v2)
            self.assertTrue(result_v2["model_backup_path"].exists())
            self.assertTrue(result_v2["metadata_backup_path"].exists())

            with open(result_v2["metadata_backup_path"], "r", encoding="utf-8") as f:
                bak_meta = json.load(f)
            self.assertEqual(bak_meta["metrics"]["accuracy"], 0.8)

            with open(result_v2["metadata_path"], "r", encoding="utf-8") as f:
                new_meta = json.load(f)
            self.assertEqual(new_meta["metrics"]["accuracy"], 0.9)

    # 9. Kiểm tra tự động chọn model tốt nhất theo PR-AUC / ROC-AUC / Brier Score
    def test_09_select_best_model(self):
        rf_metrics = {"pr_auc": 0.42, "roc_auc": 0.78, "f1_score": 0.50, "brier_score": 0.12}
        xgb_metrics = {"pr_auc": 0.51, "roc_auc": 0.81, "f1_score": 0.55, "brier_score": 0.09}
        best_model, best_name, best_metrics = select_best_model(
            rf_model="rf_obj",
            rf_metrics=rf_metrics,
            xgb_model="xgb_obj",
            xgb_metrics=xgb_metrics,
        )
        self.assertEqual(best_name, "XGBoost")
        self.assertEqual(best_model, "xgb_obj")
        self.assertEqual(best_metrics["pr_auc"], 0.51)


if __name__ == "__main__":
    unittest.main()
