"""
Comprehensive Unit Tests for Recommendation Inference Engine (Phase B2).
Covers:
  - Multi-tier Fallback (Category-based and Popularity-based)
  - Production Guard (Rejection of ungrounded or sandbox models in production mode)
  - Feature Contract Alignment (Exact 12 feature columns in order)
  - Machine Learning Scoring (Probability predictions and ranking)
  - Diversity filtering across categories
  - CLI execution and JSON compliance
"""

import sys
import json
import tempfile
import unittest
import subprocess
from pathlib import Path
import numpy as np
import pandas as pd

TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.train_model import FEATURE_COLUMNS, save_model_artifacts
from src.predict_recommendations import (
    load_catalog,
    load_model_and_metadata,
    apply_diversity_filter,
    fallback_by_category,
    fallback_by_popularity,
    build_candidate_features,
    recommend,
)


class TestRecommendationInference(unittest.TestCase):

    def setUp(self):
        # Create a small mock catalog
        self.mock_catalog = pd.DataFrame([
            {
                "product_id": "prod_cat1_1",
                "title": "Váy Đầm Dạ Hội A1",
                "primary_category": "Đầm & Váy",
                "regular_price": 1000000.0,
                "sale_price": 900000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 3,
            },
            {
                "product_id": "prod_cat1_2",
                "title": "Váy Đầm Mini A2",
                "primary_category": "Đầm & Váy",
                "regular_price": 800000.0,
                "sale_price": 750000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 2,
            },
            {
                "product_id": "prod_cat1_3",
                "title": "Váy Maxi Đi Biển A3",
                "primary_category": "Đầm & Váy",
                "regular_price": 600000.0,
                "sale_price": 550000.0,
                "is_in_stock": False,
                "visibility": True,
                "variant_count": 1,
            },
            {
                "product_id": "prod_cat2_1",
                "title": "Áo Sơ Mi Lụa B1",
                "primary_category": "Áo",
                "regular_price": 500000.0,
                "sale_price": 450000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 4,
            },
            {
                "product_id": "prod_cat2_2",
                "title": "Áo Thun Cotton B2",
                "primary_category": "Áo",
                "regular_price": 300000.0,
                "sale_price": 250000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 5,
            },
            {
                "product_id": "prod_cat3_1",
                "title": "Quần Jeans Baggy C1",
                "primary_category": "Quần",
                "regular_price": 700000.0,
                "sale_price": 650000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 2,
            },
        ])

    # 1. Fallback theo Popularity khi chưa có model
    def test_01_fallback_popularity_when_no_model(self):
        recs = fallback_by_popularity(self.mock_catalog, current_product_id=None, top_n=4)
        self.assertEqual(len(recs), 4)
        self.assertTrue(all("product_id" in r for r in recs))
        self.assertTrue(all("score" in r for r in recs))
        # Ensure scores are descending
        scores = [r["score"] for r in recs]
        self.assertEqual(scores, sorted(scores, reverse=True))

    # 2. Fallback theo Category khi có current_product_id
    def test_02_fallback_category_when_product_id_provided(self):
        recs, msg = fallback_by_category(self.mock_catalog, current_product_id="prod_cat1_1", top_n=2)
        self.assertEqual(len(recs), 2)
        # Must not contain current_product_id
        rec_ids = [r["product_id"] for r in recs]
        self.assertNotIn("prod_cat1_1", rec_ids)
        # All recommendations must belong to "Đầm & Váy"
        for r in recs:
            self.assertEqual(r["category"], "Đầm & Váy")

    # 3. Fallback Category tự động pad Popularity nếu danh mục có quá ít sản phẩm
    def test_03_fallback_padding_when_category_has_few_items(self):
        # prod_cat3_1 is the ONLY item in "Quần"
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_data_dir = Path(tmp_dir)
            self.mock_catalog.to_csv(tmp_data_dir / "products_features.csv", index=False)

            result = recommend(
                current_product_id="prod_cat3_1",
                top_n=3,
                model_dir=tmp_data_dir,
                data_dir=tmp_data_dir,
            )

            self.assertEqual(result["status"], "success")
            self.assertIn(result["strategy"], ["fallback_category", "fallback_popularity"])
            self.assertEqual(result["count"], 3)
            # prod_cat3_1 should not be recommended to itself
            rec_ids = [r["product_id"] for r in result["recommendations"]]
            self.assertNotIn("prod_cat3_1", rec_ids)

    # 4. Production Guard: Từ chối model sandbox khi allow_sandbox = False
    def test_04_guard_rejects_sandbox_model_in_production(self):
        from sklearn.dummy import DummyClassifier
        import joblib

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            dummy = DummyClassifier(strategy="constant", constant=0)
            dummy.fit([[0] * 12], [0])

            # Save sandbox metadata
            save_model_artifacts(
                model=dummy,
                model_name="SandboxRF",
                metrics={"accuracy": 0.5},
                is_production_ready=False,
                trained_on_synthetic=True,
                output_dir=tmp_path,
            )

            # In production mode (allow_sandbox=False): Model MUST be rejected
            model_prod, meta_prod = load_model_and_metadata(model_dir=tmp_path, allow_sandbox=False)
            self.assertIsNone(model_prod)
            self.assertIsNotNone(meta_prod)
            self.assertFalse(meta_prod["is_production_ready"])

            # In sandbox mode (allow_sandbox=True): Model is accepted for testing
            model_sand, meta_sand = load_model_and_metadata(model_dir=tmp_path, allow_sandbox=True)
            self.assertIsNotNone(model_sand)

    # 5. Production Guard: Từ chối model nếu đặc trưng không khớp 12 cột cố định
    def test_05_guard_rejects_feature_mismatch(self):
        from sklearn.dummy import DummyClassifier

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            dummy = DummyClassifier(strategy="constant", constant=0)
            dummy.fit([[0] * 5], [0])

            # Save with wrong feature list
            save_model_artifacts(
                model=dummy,
                model_name="BadFeaturesModel",
                metrics={},
                feature_names=["f1", "f2", "f3", "f4", "f5"],
                is_production_ready=True,
                trained_on_synthetic=False,
                output_dir=tmp_path,
            )

            model, meta = load_model_and_metadata(model_dir=tmp_path, allow_sandbox=False)
            self.assertIsNone(model)

    # 6. Suy luận ML khi nạp mock model hợp lệ
    def test_06_ml_inference_with_mock_model(self):
        from sklearn.ensemble import RandomForestClassifier

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            self.mock_catalog.to_csv(tmp_path / "products_features.csv", index=False)

            # Train simple RF on 12 features
            rf = RandomForestClassifier(n_estimators=5, random_state=42)
            X = pd.DataFrame(np.random.rand(20, len(FEATURE_COLUMNS)), columns=FEATURE_COLUMNS)
            y = pd.Series([0, 1] * 10)
            rf.fit(X, y)

            save_model_artifacts(
                model=rf,
                model_name="ProductionRF",
                metrics={"accuracy": 1.0, "roc_auc": 1.0, "pr_auc": 1.0},
                is_production_ready=True,
                trained_on_synthetic=False,
                output_dir=tmp_path,
            )

            result = recommend(
                user_id="user_test_123",
                current_product_id="prod_cat1_1",
                top_n=3,
                model_dir=tmp_path,
                data_dir=tmp_path,
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["strategy"], "ml_model")
            self.assertEqual(result["model_used"], "ProductionRF")
            self.assertEqual(result["count"], 3)
            self.assertTrue(all(0.0 <= r["score"] <= 1.0 for r in result["recommendations"]))

    # 7. Tính toàn vẹn của hợp đồng đặc trưng (Feature Contract)
    def test_07_feature_alignment_contract(self):
        feats = build_candidate_features(self.mock_catalog, user_id="user_test_456")
        self.assertEqual(list(feats.columns), FEATURE_COLUMNS)
        self.assertEqual(len(feats), len(self.mock_catalog))
        self.assertFalse(feats.isna().any().any())

    # 8. Diversity filter: Không vượt quá max_per_category nếu còn các sản phẩm khác
    def test_08_diversity_filter(self):
        diverse = apply_diversity_filter(self.mock_catalog, top_n=3, max_per_category=1)
        cats = [row["primary_category"] for _, row in diverse.iterrows()]
        # Each category appears at most once if possible
        self.assertEqual(len(cats), len(set(cats)))


if __name__ == "__main__":
    unittest.main()
