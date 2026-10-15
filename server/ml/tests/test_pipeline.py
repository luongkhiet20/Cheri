import os
import sys
import unittest
from pathlib import Path

# Add server/ml root directory to sys.path
TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from datetime import datetime, timezone, timedelta
import pandas as pd

from src.config import (
    is_valid_object_id,
    normalize_product_key,
    anonymize_identifier,
)
from src.validate_data import (
    validate_and_clean_interactions,
    compile_data_quality_report,
)
from src.feature_engineering import (
    extract_user_product_features_at_cutoff,
    build_user_product_feature_matrix,
)
from src.build_dataset import (
    generate_future_purchase_labels,
    assign_time_based_splits,
)


class TestCheriMLPipeline(unittest.TestCase):

    def setUp(self):
        self.valid_product_id_1 = "6ab8f745547709e9279f68fc"
        self.valid_product_id_2 = "6ab8f746547709e9279f6903"
        self.catalog_ids = {self.valid_product_id_1, self.valid_product_id_2}

    # -------------------------------------------------------------------------
    # TEST 1: Lượt xem có productId hợp lệ (ObjectId chuẩn)
    # -------------------------------------------------------------------------
    def test_01_valid_object_id_product(self):
        norm = normalize_product_key(self.valid_product_id_1)
        self.assertTrue(norm["is_valid_object_id"])
        self.assertEqual(norm["clean_product_id"], self.valid_product_id_1)
        self.assertFalse(norm["is_compound"])
        self.assertIsNone(norm["variant_id"])

    # -------------------------------------------------------------------------
    # TEST 2: Lượt xem có productId không tồn tại trong DB
    # -------------------------------------------------------------------------
    def test_02_unlinked_product_id(self):
        unlinked_id = "507f1f77bcf86cd799439011"
        norm = normalize_product_key(unlinked_id)
        self.assertTrue(norm["is_valid_object_id"])
        
        raw_df = pd.DataFrame([{
            "raw_id": "ev_01",
            "user_id": "usr_001",
            "session_id": None,
            "raw_product_id": unlinked_id,
            "event_type": "VIEW",
            "timestamp": datetime.now(timezone.utc),
            "metadata": {}
        }])
        clean_df, metrics = validate_and_clean_interactions(raw_df, self.catalog_ids)
        self.assertEqual(metrics["unlinked_product_count"], 1)
        self.assertEqual(metrics["linked_product_count"], 0)
        self.assertFalse(clean_df.iloc[0]["is_linked_to_catalog"])

    # -------------------------------------------------------------------------
    # TEST 3: Khách vãng lai có sessionId
    # -------------------------------------------------------------------------
    def test_03_guest_session_pseudonymization(self):
        guest_session = "guest_sess_abc123_xyz"
        anon_key = anonymize_identifier(guest_session, prefix="gst")
        self.assertTrue(anon_key.startswith("gst_"))
        self.assertNotIn("guest_sess_abc123_xyz", anon_key)
        # Deterministic check
        self.assertEqual(anon_key, anonymize_identifier(guest_session, prefix="gst"))

    # -------------------------------------------------------------------------
    # TEST 4: Khách đăng nhập có định danh userId hợp lệ
    # -------------------------------------------------------------------------
    def test_04_registered_user_pseudonymization(self):
        user_id = "6aae973eb3b9af088bf88cbc"
        anon_key = anonymize_identifier(user_id, prefix="usr")
        self.assertTrue(anon_key.startswith("usr_"))
        self.assertNotIn("6aae973eb3b9af088bf88cbc", anon_key)

    # -------------------------------------------------------------------------
    # TEST 5: Thiếu timestamp hoặc timestamp không đúng định dạng
    # -------------------------------------------------------------------------
    def test_05_invalid_or_missing_timestamp(self):
        raw_df = pd.DataFrame([
            {
                "raw_id": "ev_null_ts",
                "user_id": "usr_001",
                "session_id": None,
                "raw_product_id": self.valid_product_id_1,
                "event_type": "VIEW",
                "timestamp": None,
                "metadata": {}
            },
            {
                "raw_id": "ev_bad_ts",
                "user_id": "usr_001",
                "session_id": None,
                "raw_product_id": self.valid_product_id_1,
                "event_type": "VIEW",
                "timestamp": "invalid_date_format",
                "metadata": {}
            }
        ])
        clean_df, metrics = validate_and_clean_interactions(raw_df, self.catalog_ids)
        self.assertEqual(metrics["null_timestamp_count"], 2)
        self.assertEqual(len(clean_df), 0)

    # -------------------------------------------------------------------------
    # TEST 6: Sản phẩm có biến thể nhúng
    # -------------------------------------------------------------------------
    def test_06_embedded_variants_feature_extraction(self):
        products_lookup = {
            self.valid_product_id_1: {
                "product_id": self.valid_product_id_1,
                "primary_category": "Đầm & Váy",
                "sale_price": 1814818.0,
                "variant_count": 5,
                "is_in_stock": True,
                "visibility": True,
            }
        }
        features = extract_user_product_features_at_cutoff(
            user_key="usr_test",
            product_id=self.valid_product_id_1,
            cutoff_time=datetime.now(timezone.utc),
            historical_interactions=pd.DataFrame(),
            historical_orders=pd.DataFrame(),
            products_lookup=products_lookup,
        )
        self.assertEqual(features["product_variant_count"], 5)
        self.assertEqual(features["product_category"], "Đầm & Váy")
        self.assertEqual(features["product_price"], 1814818.0)

    # -------------------------------------------------------------------------
    # TEST 7: Giá sản phẩm bị thiếu
    # -------------------------------------------------------------------------
    def test_07_missing_product_price(self):
        products_lookup = {
            self.valid_product_id_1: {
                "product_id": self.valid_product_id_1,
                "primary_category": "Khác",
                "sale_price": 0.0,
                "variant_count": 0,
            }
        }
        features = extract_user_product_features_at_cutoff(
            user_key="usr_test",
            product_id=self.valid_product_id_1,
            cutoff_time=datetime.now(timezone.utc),
            historical_interactions=pd.DataFrame(),
            historical_orders=pd.DataFrame(),
            products_lookup=products_lookup,
        )
        self.assertEqual(features["product_price"], 0.0)

    # -------------------------------------------------------------------------
    # TEST 8: Đơn hàng bị hủy hoặc thất bại (Không tính vào chuyển đổi)
    # -------------------------------------------------------------------------
    def test_08_cancelled_or_failed_orders(self):
        cutoff = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)
        candidate_df = pd.DataFrame([{
            "user_key": "usr_buyer",
            "product_id": self.valid_product_id_1,
            "cutoff_timestamp": cutoff.isoformat(),
        }])
        
        # Order is cancelled
        orders_df = pd.DataFrame([{
            "order_id": "ord_cancelled",
            "user_key": "usr_buyer",
            "clean_product_id": self.valid_product_id_1,
            "is_successful_conversion": False,
            "created_at": cutoff + timedelta(days=2),
        }])

        labeled_df = generate_future_purchase_labels(
            candidate_features_df=candidate_df,
            orders_df=orders_df,
            cutoff_time=cutoff,
            window_days=14,
        )
        self.assertEqual(labeled_df.iloc[0]["label"], 0)

    # -------------------------------------------------------------------------
    # TEST 9: Đơn hàng thành công có sản phẩm liên kết được
    # -------------------------------------------------------------------------
    def test_09_successful_order_linked_label_1(self):
        cutoff = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)
        candidate_df = pd.DataFrame([{
            "user_key": "usr_buyer",
            "product_id": self.valid_product_id_1,
            "cutoff_timestamp": cutoff.isoformat(),
        }])
        
        orders_df = pd.DataFrame([{
            "order_id": "ord_paid",
            "user_key": "usr_buyer",
            "clean_product_id": self.valid_product_id_1,
            "is_successful_conversion": True,
            "created_at": cutoff + timedelta(days=3),
        }])

        labeled_df = generate_future_purchase_labels(
            candidate_features_df=candidate_df,
            orders_df=orders_df,
            cutoff_time=cutoff,
            window_days=14,
        )
        self.assertEqual(labeled_df.iloc[0]["label"], 1)

    # -------------------------------------------------------------------------
    # TEST 10: Lượt xem lặp lại hợp lệ vs lặp lại kỹ thuật (<2s)
    # -------------------------------------------------------------------------
    def test_10_technical_duplicate_vs_genuine_views(self):
        t0 = datetime(2026, 10, 1, 10, 0, 0, tzinfo=timezone.utc)
        t_bounce = t0 + timedelta(seconds=1)       # Technical duplicate (<2s)
        t_genuine = t0 + timedelta(minutes=15)     # Genuine repeat view (>2s)

        raw_df = pd.DataFrame([
            {
                "raw_id": "ev_1",
                "user_id": "usr_001",
                "session_id": None,
                "raw_product_id": self.valid_product_id_1,
                "event_type": "VIEW",
                "timestamp": t0,
                "metadata": {}
            },
            {
                "raw_id": "ev_bounce",
                "user_id": "usr_001",
                "session_id": None,
                "raw_product_id": self.valid_product_id_1,
                "event_type": "VIEW",
                "timestamp": t_bounce,
                "metadata": {}
            },
            {
                "raw_id": "ev_genuine",
                "user_id": "usr_001",
                "session_id": None,
                "raw_product_id": self.valid_product_id_1,
                "event_type": "VIEW",
                "timestamp": t_genuine,
                "metadata": {}
            }
        ])
        clean_df, metrics = validate_and_clean_interactions(raw_df, self.catalog_ids)
        self.assertEqual(metrics["technical_duplicate_count"], 1)
        self.assertEqual(len(clean_df), 2)  # Initial view + genuine repeat view preserved

    # -------------------------------------------------------------------------
    # TEST 11: Không có dữ liệu tương tác
    # -------------------------------------------------------------------------
    def test_11_empty_interactions(self):
        clean_df, metrics = validate_and_clean_interactions(pd.DataFrame(), self.catalog_ids)
        self.assertEqual(len(clean_df), 0)
        self.assertEqual(metrics["total_raw_records"], 0)
        self.assertEqual(metrics["valid_clean_records"], 0)

    # -------------------------------------------------------------------------
    # TEST 12: Không có đơn hàng
    # -------------------------------------------------------------------------
    def test_12_empty_orders(self):
        cutoff = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)
        candidate_df = pd.DataFrame([{
            "user_key": "usr_buyer",
            "product_id": self.valid_product_id_1,
            "cutoff_timestamp": cutoff.isoformat(),
        }])
        labeled_df = generate_future_purchase_labels(
            candidate_features_df=candidate_df,
            orders_df=pd.DataFrame(),
            cutoff_time=cutoff,
            window_days=14,
        )
        self.assertEqual(labeled_df.iloc[0]["label"], 0)

    # -------------------------------------------------------------------------
    # TEST 13: Dataset không đủ điều kiện tạo nhãn
    # -------------------------------------------------------------------------
    def test_13_insufficient_data_report_status(self):
        im_metrics = {
            "total_raw_records": 0,
            "valid_clean_records": 0,
        }
        report = compile_data_quality_report(im_metrics, pd.DataFrame(), pd.DataFrame())
        self.assertFalse(report["readiness_summary"]["is_training_ready"])
        self.assertEqual(report["readiness_summary"]["recommended_strategy"], "DATASET_INITIALIZING")

    # -------------------------------------------------------------------------
    # TEST 14: Dữ liệu đầu ra tuyệt đối không chứa PII
    # -------------------------------------------------------------------------
    def test_14_zero_pii_leakage(self):
        raw_email = "customer.vip@gmail.com"
        raw_phone = "+84901234567"
        raw_address = "123 Đường Nguyễn Trãi, Quận 1"

        anon_email = anonymize_identifier(raw_email, prefix="gst")
        anon_phone = anonymize_identifier(raw_phone, prefix="gst")

        self.assertNotIn("gmail.com", anon_email)
        self.assertNotIn("customer.vip", anon_email)
        self.assertNotIn("0901234567", anon_phone)
        self.assertNotIn(raw_address, anon_phone)

    # -------------------------------------------------------------------------
    # TEST 15: Compound ID (productId_variantId)
    # -------------------------------------------------------------------------
    def test_15_compound_id_compatibility(self):
        compound_id = "6ab8f746547709e9279f6903_1780253976-10-AO-S"
        norm = normalize_product_key(compound_id)

        self.assertTrue(norm["is_compound"])
        self.assertTrue(norm["is_valid_object_id"])
        self.assertEqual(norm["clean_product_id"], "6ab8f746547709e9279f6903")
        self.assertEqual(norm["variant_id"], "1780253976-10-AO-S")

    # -------------------------------------------------------------------------
    # TEST 16: Chống rò rỉ dữ liệu (No Data Leakage from Future)
    # -------------------------------------------------------------------------
    def test_16_strict_no_data_leakage(self):
        cutoff = datetime(2026, 10, 5, 12, 0, 0, tzinfo=timezone.utc)
        
        # Interactions: 1 before cutoff, 2 AFTER cutoff
        interactions = pd.DataFrame([
            {
                "user_key": "usr_leak_test",
                "clean_product_id": self.valid_product_id_1,
                "event_timestamp": cutoff - timedelta(days=1),  # Before T
            },
            {
                "user_key": "usr_leak_test",
                "clean_product_id": self.valid_product_id_1,
                "event_timestamp": cutoff + timedelta(hours=2),  # AFTER T!
            },
            {
                "user_key": "usr_leak_test",
                "clean_product_id": self.valid_product_id_1,
                "event_timestamp": cutoff + timedelta(days=3),   # AFTER T!
            }
        ])

        features = extract_user_product_features_at_cutoff(
            user_key="usr_leak_test",
            product_id=self.valid_product_id_1,
            cutoff_time=cutoff,
            historical_interactions=interactions,
            historical_orders=pd.DataFrame(),
            products_lookup={self.valid_product_id_1: {}},
        )

        # Must strictly equal 1 (the event before cutoff), NOT 3!
        self.assertEqual(features["user_product_views"], 1)
        self.assertEqual(features["user_total_views"], 1)


if __name__ == "__main__":
    unittest.main()
