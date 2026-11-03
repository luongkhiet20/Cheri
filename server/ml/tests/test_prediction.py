"""
Comprehensive Unit Tests for Recommendation Inference Engine (Phase B2 & Remediation).
Covers:
  - Multi-tier Fallback (Category-based and Popularity-based)
  - Production Guard (Rejection of ungrounded or sandbox models in production mode)
  - Feature Contract Alignment (Exact 12 feature columns in order)
  - Machine Learning Scoring (Probability predictions and ranking)
  - Diversity filtering across categories
  - User key normalization & pseudonymization alignment (Priority 1)
  - Real user interaction/order history personalization & purchased/out-of-stock filtering (Priority 1)
"""

import sys
import json
import tempfile
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.config import pseudonymize_user_key
from src.train_model import FEATURE_COLUMNS, save_model_artifacts
from src.predict_recommendations import (
    normalize_user_key,
    load_catalog,
    load_model_and_metadata,
    load_exposure_history,
    compute_exposure_rotation_factors,
    select_priority_and_exploration,
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
                "popularity_views": 25,
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
                "popularity_views": 18,
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
                "popularity_views": 40,
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
                "popularity_views": 12,
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
                "popularity_views": 30,
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
                "popularity_views": 10,
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

    # 9. Đồng bộ user_key giữa NestJS (usr_<24_hex> / gst_<session>) và Offline Hash (usr_<16_hex>)
    def test_09_user_key_pseudonymization_alignment(self):
        from src.config import anonymize_identifier
        raw_mongo_id = "65f1a2b3c4d5e6f7a8b9c0d1"
        nestjs_usr = f"usr_{raw_mongo_id}"
        hashed_usr = normalize_user_key(nestjs_usr)
        # Must match direct hash of raw_mongo_id with prefix usr_
        self.assertEqual(hashed_usr, anonymize_identifier(raw_mongo_id, prefix="usr"))
        self.assertTrue(hashed_usr.startswith("usr_"))
        self.assertEqual(len(hashed_usr), 20)  # usr_ + 16 hex

        # Calling normalize_user_key again on already-hashed key must be idempotent
        self.assertEqual(normalize_user_key(hashed_usr), hashed_usr)

        # Guest session ID alignment
        raw_session = "guest_cart_xyz_987654"
        nestjs_gst = f"gst_{raw_session}"
        hashed_gst = normalize_user_key(nestjs_gst)
        self.assertEqual(hashed_gst, anonymize_identifier(raw_session, prefix="gst"))
        self.assertEqual(normalize_user_key(hashed_gst), hashed_gst)

    # 10. Cá nhân hóa thực tế theo lịch sử tương tác & loại bỏ sản phẩm hết hàng / đã mua
    def test_10_personalized_features_and_purchased_out_of_stock_filtering(self):
        from sklearn.ensemble import RandomForestClassifier

        user_a = "usr_acfd1665bd524739"
        user_b = "usr_a8e2bc4854475ace"

        mock_interactions = pd.DataFrame([
            {"user_key": user_a, "product_key": "prod_cat2_1", "event_type": "VIEW", "timestamp": "2026-10-25T10:00:00Z"},
            {"user_key": user_a, "product_key": "prod_cat2_1", "event_type": "VIEW", "timestamp": "2026-10-26T10:00:00Z"},
            {"user_key": user_a, "product_key": "prod_cat2_2", "event_type": "VIEW", "timestamp": "2026-10-27T10:00:00Z"},
            {"user_key": user_b, "product_key": "prod_cat1_2", "event_type": "VIEW", "timestamp": "2026-10-20T10:00:00Z"},
        ])
        mock_orders = pd.DataFrame([
            {"order_id": "ord_1", "user_key": user_a, "product_key": "prod_cat1_2", "quantity": 1, "item_price": 750000.0, "timestamp": "2026-10-28T12:00:00Z"},
        ])

        feats_a = build_candidate_features(
            self.mock_catalog,
            user_id=user_a,
            interactions_df=mock_interactions,
            orders_df=mock_orders,
        )
        feats_b = build_candidate_features(
            self.mock_catalog,
            user_id=user_b,
            interactions_df=mock_interactions,
            orders_df=mock_orders,
        )

        # User A has 3 total views, 2 distinct products viewed, 1 prior order
        self.assertTrue((feats_a["user_total_views"] == 3.0).all())
        self.assertTrue((feats_a["user_distinct_products_viewed"] == 2.0).all())
        self.assertTrue((feats_a["user_total_orders_before"] == 1.0).all())

        # User B has 1 total view, 1 distinct product viewed, 0 prior orders
        self.assertTrue((feats_b["user_total_views"] == 1.0).all())
        self.assertTrue((feats_b["user_distinct_products_viewed"] == 1.0).all())
        self.assertTrue((feats_b["user_total_orders_before"] == 0.0).all())

        # Product popularity views comes from catalog's popularity_views column (not constant 1.0)
        self.assertEqual(list(feats_a["product_popularity_views"]), [25.0, 18.0, 40.0, 12.0, 30.0, 10.0])

        # Verify recommend() filters out out-of-stock (prod_cat1_3) and purchased by user_a (prod_cat1_2)
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            self.mock_catalog.to_csv(tmp_path / "products_features.csv", index=False)
            mock_interactions.to_csv(tmp_path / "interactions_clean.csv", index=False)
            mock_orders.to_csv(tmp_path / "orders_clean.csv", index=False)

            rf = RandomForestClassifier(n_estimators=10, random_state=42)
            X = pd.DataFrame(np.random.rand(30, len(FEATURE_COLUMNS)), columns=FEATURE_COLUMNS)
            y = pd.Series([0, 1] * 15)
            rf.fit(X, y)

            save_model_artifacts(
                model=rf,
                model_name="PersonalizedRF",
                metrics={"accuracy": 0.9, "roc_auc": 0.9, "pr_auc": 0.85, "brier_score": 0.08},
                is_production_ready=True,
                trained_on_synthetic=False,
                output_dir=tmp_path,
            )

            res_a = recommend(
                user_id=user_a,
                current_product_id="prod_cat1_1",
                top_n=5,
                model_dir=tmp_path,
                data_dir=tmp_path,
            )
            rec_ids_a = [r["product_id"] for r in res_a["recommendations"]]
            self.assertNotIn("prod_cat1_3", rec_ids_a)  # Out of stock excluded
            self.assertNotIn("prod_cat1_2", rec_ids_a)  # Already purchased by user_a excluded

    # 11. Top-30 Candidate Pool + 6 Priority (60%) & 4 Exploration (40%) + Max 3/Category + Score/Rank preservation
    def test_11_top30_pool_and_6_priority_4_exploration_split(self):
        categories = ["Đầm & Váy", "Áo", "Quần", "Chân Váy", "Áo Khoác"]
        large_rows = []
        for idx in range(36):
            large_rows.append({
                "product_id": f"prod_{idx + 1:02d}",
                "title": f"Sản phẩm {idx + 1}",
                "primary_category": categories[idx % len(categories)],
                "regular_price": 500000.0 + idx * 10000.0,
                "sale_price": 450000.0 + idx * 10000.0,
                "is_in_stock": True,
                "visibility": True,
                "variant_count": 3,
                "popularity_views": 100 - idx,
                "ml_score": round(0.95 - idx * 0.02, 4),
                "base_score": round(0.95 - idx * 0.02, 4),
                "orig_rank": idx + 1,
            })
        large_df = pd.DataFrame(large_rows)

        selected_df, summary = select_priority_and_exploration(
            large_df,
            top_n=10,
            pool_size=30,
            max_per_category=3,
            priority_ratio=0.6,
            exposure_map={},
            rng_seed=101,
        )

        # Pool size capped at 30, final list has 10 items (6 priority + 4 exploration)
        self.assertEqual(summary["pool_size"], 30)
        self.assertEqual(len(selected_df), 10)
        self.assertEqual(summary["priority_count"], 6)
        self.assertEqual(summary["exploration_count"], 4)

        # No duplicate products
        self.assertEqual(selected_df["product_id"].nunique(), 10)

        # Max 3 products per category across all 10 items
        cat_counts = selected_df["primary_category"].value_counts().to_dict()
        self.assertTrue(all(c <= 3 for c in cat_counts.values()))

        # Original ml_score and orig_rank preserved untouched
        for _, row in selected_df.iterrows():
            orig_row = large_df[large_df["product_id"] == row["product_id"]].iloc[0]
            self.assertEqual(float(row["ml_score"]), float(orig_row["ml_score"]))
            self.assertEqual(int(row["orig_rank"]), int(orig_row["orig_rank"]))

    # 12. Exposure Rotation & Positive Engagement Exemption (CLICK / ADD_TO_CART not penalized like ignored items)
    def test_12_exposure_rotation_and_positive_engagement_exemption(self):
        # Product unseen vs Product seen 5 times & ignored vs Product seen 5 times & clicked
        exposure_map = {
            "prod_ignored": {
                "impression_count": 5,
                "hours_since_last_shown": 0.2,
                "has_positive_engagement": False,
            },
            "prod_engaged": {
                "impression_count": 5,
                "hours_since_last_shown": 0.2,
                "has_positive_engagement": True,
            },
        }
        f_unseen = compute_exposure_rotation_factors("prod_unseen", exposure_map)
        f_ignored = compute_exposure_rotation_factors("prod_ignored", exposure_map)
        f_engaged = compute_exposure_rotation_factors("prod_engaged", exposure_map)

        # Unseen has highest exploration novelty (1.5) and full priority (1.0)
        self.assertEqual(f_unseen["priority_decay"], 1.0)
        self.assertGreater(f_unseen["exploration_novelty"], f_ignored["exploration_novelty"])

        # Engaged item is exempted from heavy ignored penalty
        self.assertGreater(f_engaged["priority_decay"], f_ignored["priority_decay"])
        self.assertGreater(f_engaged["exploration_novelty"], f_ignored["exploration_novelty"])

        # Ignored item is decayed but never permanently zeroed out (>= 0.25)
        self.assertGreaterEqual(f_ignored["priority_decay"], 0.25)


if __name__ == "__main__":
    unittest.main()
