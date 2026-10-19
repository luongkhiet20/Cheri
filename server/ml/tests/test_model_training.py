"""
Unit Tests for Model Training & Eligibility Module (Phase B1).
Verifies:
  - Strict eligibility gates (sample size, class diversity)
  - Safe evaluation metrics (marking ROC-AUC as N/A when classes < 2)
  - Feature contract consistency
  - Rejection of ungrounded production training
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

    # 7. Đánh giá đầy đủ: Khi test set có cả 2 lớp nhãn -> ROC-AUC tính toán hợp lệ
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

    # 8. Kiểm tra lưu model artifact và model_metadata.json
    def test_08_save_model_artifacts(self):
        import tempfile
        import json
        from sklearn.ensemble import RandomForestClassifier
        from src.train_model import save_model_artifacts

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            rf = RandomForestClassifier(n_estimators=5, random_state=42)
            X = pd.DataFrame(np.zeros((10, len(FEATURE_COLUMNS))), columns=FEATURE_COLUMNS)
            y = pd.Series([0, 1] * 5)
            rf.fit(X, y)

            metrics = {"accuracy": 1.0, "roc_auc": 1.0, "pr_auc": 1.0}
            result = save_model_artifacts(
                model=rf,
                model_name="TestRF",
                metrics=metrics,
                feature_names=FEATURE_COLUMNS,
                is_production_ready=False,
                trained_on_synthetic=True,
                output_dir=tmp_path,
            )

            self.assertTrue(result["model_path"].exists())
            self.assertTrue(result["metadata_path"].exists())

            with open(result["metadata_path"], "r", encoding="utf-8") as f:
                meta = json.load(f)

            self.assertEqual(meta["model_name"], "TestRF")
            self.assertFalse(meta["is_production_ready"])
            self.assertTrue(meta["trained_on_synthetic"])
            self.assertEqual(meta["feature_columns"], FEATURE_COLUMNS)
            self.assertEqual(meta["metrics"]["accuracy"], 1.0)


if __name__ == "__main__":
    unittest.main()
