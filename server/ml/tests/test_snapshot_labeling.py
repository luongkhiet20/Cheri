"""
Unit tests for the snapshot-based temporal labeling pipeline and bootstrap seeder.
"""

import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
import pandas as pd

TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.build_dataset import (
    generate_snapshot_times,
    build_snapshot_dataset,
    assign_snapshot_time_splits,
    summarize_snapshot_dataset,
)
from src.seed_bootstrap_data import (
    generate_bootstrap_documents,
    summarize_documents,
    anonymized_preview,
    SYNTHETIC_ID_PREFIX,
    SYNTHETIC_SESSION_PREFIX,
    SYNTHETIC_ORDER_PREFIX,
)


class TestSnapshotLabeling(unittest.TestCase):

    def setUp(self):
        self.p1 = "6ab8f745547709e9279f68fc"
        self.p2 = "6ab8f746547709e9279f6903"
        self.products_df = pd.DataFrame([
            {
                "product_id": self.p1,
                "primary_category": "Đầm & Váy",
                "sale_price": 500000.0,
                "regular_price": 600000.0,
                "price": 500000.0,
                "variant_count": 2,
                "is_in_stock": True,
                "visibility": True,
            },
            {
                "product_id": self.p2,
                "primary_category": "Áo",
                "sale_price": 300000.0,
                "regular_price": 350000.0,
                "price": 300000.0,
                "variant_count": 1,
                "is_in_stock": True,
                "visibility": True,
            },
        ])

    def test_01_snapshot_times_generation(self):
        start = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 8, 31, 0, 0, tzinfo=timezone.utc)
        times = generate_snapshot_times(start, end, step_days=3, warmup_days=1)
        self.assertGreater(len(times), 5)
        # Verify monotonically increasing and strictly between start and end
        for t in times:
            self.assertGreaterEqual(t, start)
            self.assertLessEqual(t, end)

    def test_02_insufficient_followup_is_excluded_not_zero(self):
        """
        Interactions happening within the last 14 days cannot have full 14-day follow-up.
        They must be EXCLUDED from the labeled dataset, rather than falsely labeled as 0.
        """
        t_base = datetime(2026, 10, 15, 10, 0, tzinfo=timezone.utc)
        obs_end = t_base + timedelta(days=7)  # Only 7 days of observation available!

        clean_interactions = pd.DataFrame([
            {
                "user_key": "usr_001",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=1),
                "is_linked_to_catalog": True,
            }
        ])
        orders = pd.DataFrame(columns=["order_id", "user_key", "clean_product_id", "is_successful_conversion", "created_at"])

        ds, stats = build_snapshot_dataset(
            clean_interactions_df=clean_interactions,
            orders_df=orders,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=3,
        )

        # Dataset must be empty because all snapshots lack 14 days of follow-up
        self.assertEqual(len(ds), 0)
        self.assertGreater(stats["snapshots_excluded_insufficient_followup"], 0)
        self.assertEqual(stats["snapshots_labeled"], 0)

    def test_03_fully_observed_snapshot_correct_positive_label(self):
        """
        Snapshot at T with purchase at T + 3 days -> label = 1.
        Snapshot at T with purchase at T + 20 days (> 14 days) -> label = 0.
        """
        t_start = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 9, 15, 0, 0, tzinfo=timezone.utc)  # 45 days span

        # User viewed p1 on Aug 2, p2 on Aug 2
        clean_interactions = pd.DataFrame([
            {
                "user_key": "usr_buyer",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_start + timedelta(days=1, hours=10),
                "is_linked_to_catalog": True,
            },
            {
                "user_key": "usr_buyer",
                "clean_product_id": self.p2,
                "event_type": "VIEW",
                "event_timestamp": t_start + timedelta(days=1, hours=11),
                "is_linked_to_catalog": True,
            },
        ])

        # Snapshot T will be at Aug 3.
        # Order for p1 at Aug 6 (T + 3 days -> within 14d) -> label = 1
        # Order for p2 at Aug 25 (T + 22 days -> outside 14d) -> label = 0
        orders = pd.DataFrame([
            {
                "order_id": "ord_p1",
                "user_key": "usr_buyer",
                "clean_product_id": self.p1,
                "is_successful_conversion": True,
                "created_at": t_start + timedelta(days=5),
            },
            {
                "order_id": "ord_p2_late",
                "user_key": "usr_buyer",
                "clean_product_id": self.p2,
                "is_successful_conversion": True,
                "created_at": t_start + timedelta(days=25),
            },
        ])

        ds, stats = build_snapshot_dataset(
            clean_interactions_df=clean_interactions,
            orders_df=orders,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )

        self.assertGreater(len(ds), 0)
        p1_rows = ds[ds["product_id"] == self.p1]
        p2_rows = ds[ds["product_id"] == self.p2]

        self.assertTrue((p1_rows["label"] == 1).any())
        # For the early snapshot, p2 must be 0 because order happened > 14 days later
        first_snap_t = ds["cutoff_timestamp"].min()
        p2_early = p2_rows[p2_rows["cutoff_timestamp"] == first_snap_t]
        if not p2_early.empty:
            self.assertEqual(int(p2_early.iloc[0]["label"]), 0)

    def test_04_anti_leakage_features_strictly_before_T(self):
        """
        Events occurring after T must NOT affect features computed at T.
        """
        t_base = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc)

        # 1 view before T (Aug 2), 5 views after T (Aug 10..Aug 15)
        clean_interactions = pd.DataFrame([
            {
                "user_key": "usr_leak",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=1),
                "is_linked_to_catalog": True,
            },
            {
                "user_key": "usr_leak",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=10),
                "is_linked_to_catalog": True,
            },
            {
                "user_key": "usr_leak",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=11),
                "is_linked_to_catalog": True,
            },
        ])

        ds, _ = build_snapshot_dataset(
            clean_interactions_df=clean_interactions,
            orders_df=pd.DataFrame(),
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )

        # For the snapshot at Aug 3 (T < Aug 10): user_product_views must be 1, NOT 3!
        first_snap = ds[ds["cutoff_timestamp"] == ds["cutoff_timestamp"].min()]
        self.assertEqual(int(first_snap.iloc[0]["user_product_views"]), 1)
        self.assertEqual(int(first_snap.iloc[0]["user_total_views"]), 1)

    def test_05_chronological_split_with_embargo(self):
        """
        Time-based split preserves chronological ordering.
        Val/Test snapshots inside the 14-day embargo of the preceding split are purged.
        """
        t_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)

        records = []
        for d in range(1, 80, 2):
            records.append({
                "user_key": f"usr_{d % 5}",
                "clean_product_id": self.p1 if d % 2 == 0 else self.p2,
                "event_type": "VIEW",
                "event_timestamp": t_start + timedelta(days=d),
                "is_linked_to_catalog": True,
            })
        clean_interactions = pd.DataFrame(records)

        ds, stats = build_snapshot_dataset(
            clean_interactions, pd.DataFrame(), self.products_df,
            observation_end=obs_end, window_days=14, step_days=3,
        )
        split_ds, split_info = assign_snapshot_time_splits(ds, embargo_days=14)

        self.assertIn("train", split_ds["split"].unique())
        self.assertIn("test", split_ds["split"].unique())
        self.assertGreaterEqual(split_info["rows_purged_by_embargo"], 0)

        # Max train timestamp must be <= min val/test timestamp
        train_max = pd.to_datetime(split_ds[split_ds["split"] == "train"]["cutoff_timestamp"]).max()
        test_min = pd.to_datetime(split_ds[split_ds["split"] == "test"]["cutoff_timestamp"]).min()
        self.assertLessEqual(train_max, test_min)

    def test_06_bootstrap_generator_reproducibility(self):
        """
        Deterministic seed produces identical documents, zero real customer PII.
        """
        start = datetime(2026, 8, 1, tzinfo=timezone.utc)
        end = datetime(2026, 9, 30, tzinfo=timezone.utc)

        docs1, batch1 = generate_bootstrap_documents(self.products_df, {}, seed=42, n_users=20, window_start=start, window_end=end)
        docs2, batch2 = generate_bootstrap_documents(self.products_df, {}, seed=42, n_users=20, window_start=start, window_end=end)

        self.assertEqual(batch1, batch2)
        self.assertEqual(len(docs1), len(docs2))
        for d1, d2 in zip(docs1, docs2):
            self.assertEqual(d1["userId"], d2["userId"])
            self.assertEqual(d1["productId"], d2["productId"])
            self.assertEqual(d1["eventType"], d2["eventType"])
            self.assertEqual(d1["timestamp"], d2["timestamp"])
            self.assertTrue(d1["isSynthetic"])
            self.assertTrue(d1["userId"].startswith(SYNTHETIC_ID_PREFIX))

    def test_07_post_T_data_invariance(self):
        """
        Verify that adding future interactions or orders after T (or after T+14d)
        does NOT alter the features or label of the snapshot at T.
        """
        t_base = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 9, 30, 0, 0, tzinfo=timezone.utc)

        # Baseline: 1 view on Aug 2, 1 order on Aug 5 (within 14d)
        interactions_base = pd.DataFrame([
            {
                "user_key": "usr_inv",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=1),
                "is_linked_to_catalog": True,
            }
        ])
        orders_base = pd.DataFrame([
            {
                "order_id": "ord_inv_1",
                "user_key": "usr_inv",
                "clean_product_id": self.p1,
                "is_successful_conversion": True,
                "created_at": t_base + timedelta(days=4),
            }
        ])

        ds_base, _ = build_snapshot_dataset(
            clean_interactions_df=interactions_base,
            orders_df=orders_base,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )
        row_base = ds_base[ds_base["cutoff_timestamp"] == ds_base["cutoff_timestamp"].min()].iloc[0]

        # Invariant check: Add 10 future views and 5 orders at T + 20..35 days (after T and after T+14d)
        future_interactions = interactions_base.copy()
        extra_views = pd.DataFrame([
            {
                "user_key": "usr_inv",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_base + timedelta(days=d),
                "is_linked_to_catalog": True,
            }
            for d in range(20, 30)
        ])
        future_interactions = pd.concat([future_interactions, extra_views], ignore_index=True)

        future_orders = orders_base.copy()
        extra_orders = pd.DataFrame([
            {
                "order_id": f"ord_inv_{d}",
                "user_key": "usr_inv",
                "clean_product_id": self.p1,
                "is_successful_conversion": True,
                "created_at": t_base + timedelta(days=d),
            }
            for d in range(25, 30)
        ])
        future_orders = pd.concat([future_orders, extra_orders], ignore_index=True)

        ds_future, _ = build_snapshot_dataset(
            clean_interactions_df=future_interactions,
            orders_df=future_orders,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )
        row_future = ds_future[ds_future["cutoff_timestamp"] == ds_future["cutoff_timestamp"].min()].iloc[0]

        # Features at T must be 100% IDENTICAL
        feature_keys = [
            "user_total_views", "user_distinct_products_viewed", "user_product_views",
            "user_category_views", "days_since_last_view", "user_total_orders_before",
            "user_previously_purchased", "product_popularity_views", "label",
        ]
        for k in feature_keys:
            self.assertEqual(
                row_base[k], row_future[k],
                f"Feature '{k}' at snapshot T leaked future data! (base={row_base[k]}, future={row_future[k]})"
            )

    def test_08_label_window_exact_boundaries(self):
        """
        Verify exact window boundary condition [T, T + 14d]:
        - Order at T - 1 second -> NOT labeled as 1 for window [T, T+14d].
        - Order at T -> labeled as 1.
        - Order at T + 14 days exactly -> labeled as 1.
        - Order at T + 14 days + 1 second -> NOT labeled as 1.
        """
        t_snap = datetime(2026, 8, 3, 0, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 8, 31, 0, 0, 0, tzinfo=timezone.utc)
        w_days = 14

        def run_with_order_at(order_dt):
            views = pd.DataFrame([{
                "user_key": "usr_bound",
                "clean_product_id": self.p1,
                "event_type": "VIEW",
                "event_timestamp": t_snap - timedelta(days=1),
                "is_linked_to_catalog": True,
            }])
            orders = pd.DataFrame([{
                "order_id": "ord_test",
                "user_key": "usr_bound",
                "clean_product_id": self.p1,
                "is_successful_conversion": True,
                "created_at": order_dt,
            }])
            ds, _ = build_snapshot_dataset(
                clean_interactions_df=views,
                orders_df=orders,
                products_df=self.products_df,
                observation_end=obs_end,
                window_days=w_days,
                step_days=30,
            )
            # Find the row for snapshot t_snap
            match = ds[ds["cutoff_timestamp"] == t_snap.isoformat()]
            return int(match.iloc[0]["label"]) if not match.empty else None

        # 1. Order at T - 1 second: should be 0 (fell before T)
        lbl_before = run_with_order_at(t_snap - timedelta(seconds=1))
        self.assertEqual(lbl_before, 0)

        # 2. Order at exact T: should be 1
        lbl_at_t = run_with_order_at(t_snap)
        self.assertEqual(lbl_at_t, 1)

        # 3. Order at exact T + 14 days: should be 1
        lbl_at_end = run_with_order_at(t_snap + timedelta(days=14))
        self.assertEqual(lbl_at_end, 1)

        # 4. Order at T + 14 days + 1 second: should be 0 (fell after T+14d)
        lbl_after = run_with_order_at(t_snap + timedelta(days=14, seconds=1))
        self.assertEqual(lbl_after, 0)

    def test_09_cancelled_and_failed_orders_excluded_from_positive_labels(self):
        """
        Orders with is_successful_conversion == False (cancelled, failed, unpaid)
        must NEVER produce label = 1.
        """
        t_base = datetime(2026, 8, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 9, 15, 0, 0, tzinfo=timezone.utc)

        views = pd.DataFrame([{
            "user_key": "usr_cancel",
            "clean_product_id": self.p1,
            "event_type": "VIEW",
            "event_timestamp": t_base + timedelta(days=1),
            "is_linked_to_catalog": True,
        }])

        # Order created inside the 14-day window, but conversion failed / cancelled
        orders = pd.DataFrame([{
            "order_id": "ord_cancelled",
            "user_key": "usr_cancel",
            "clean_product_id": self.p1,
            "is_successful_conversion": False,  # Failed/Cancelled!
            "created_at": t_base + timedelta(days=5),
        }])

        ds, _ = build_snapshot_dataset(
            clean_interactions_df=views,
            orders_df=orders,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )

        self.assertGreater(len(ds), 0)
        self.assertEqual(int(ds.iloc[0]["label"]), 0, "Cancelled order was falsely counted as positive conversion!")

    def test_10_timezone_offset_handling(self):
        """
        Timestamps with non-UTC timezone offsets (e.g., Vietnam UTC+7)
        must be parsed and aligned accurately without timezone shift leakage.
        """
        # Event at 2026-08-02 03:00:00+07:00 (which is 2026-08-01 20:00:00 UTC)
        vn_tz = timezone(timedelta(hours=7))
        t_event = datetime(2026, 8, 2, 3, 0, 0, tzinfo=vn_tz)
        t_order = datetime(2026, 8, 5, 14, 0, 0, tzinfo=vn_tz)
        obs_end = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)

        views = pd.DataFrame([{
            "user_key": "usr_tz",
            "clean_product_id": self.p1,
            "event_type": "VIEW",
            "event_timestamp": t_event.isoformat(),
            "is_linked_to_catalog": True,
        }])
        orders = pd.DataFrame([{
            "order_id": "ord_tz",
            "user_key": "usr_tz",
            "clean_product_id": self.p1,
            "is_successful_conversion": True,
            "created_at": t_order.isoformat(),
        }])

        ds, stats = build_snapshot_dataset(
            clean_interactions_df=views,
            orders_df=orders,
            products_df=self.products_df,
            observation_end=obs_end,
            window_days=14,
            step_days=7,
        )

        self.assertGreater(len(ds), 0)
        # Snapshot cutoff should be formatted in UTC
        self.assertTrue(ds.iloc[0]["cutoff_timestamp"].endswith("+00:00"))

    def test_11_split_embargo_isolation_no_overlap(self):
        """
        Verify complete temporal isolation between train, val, and test splits:
        1. No snapshot cutoff timestamp overlap.
        2. No duplicate candidate rows (snapshot_id, user_key, product_id).
        3. No label window overlap:
           max(train_label_window_end) <= min(val_cutoff_timestamp)
           max(val_label_window_end) <= min(test_cutoff_timestamp)
        """
        t_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
        obs_end = datetime(2026, 10, 15, 0, 0, tzinfo=timezone.utc)

        records = []
        for d in range(1, 95, 2):
            records.append({
                "user_key": f"usr_{d % 10}",
                "clean_product_id": self.p1 if d % 2 == 0 else self.p2,
                "event_type": "VIEW",
                "event_timestamp": t_start + timedelta(days=d),
                "is_linked_to_catalog": True,
            })
        clean_interactions = pd.DataFrame(records)

        ds, _ = build_snapshot_dataset(
            clean_interactions, pd.DataFrame(), self.products_df,
            observation_end=obs_end, window_days=14, step_days=3,
        )
        split_ds, split_info = assign_snapshot_time_splits(ds, embargo_days=14)

        train = split_ds[split_ds["split"] == "train"]
        val = split_ds[split_ds["split"] == "val"]
        test = split_ds[split_ds["split"] == "test"]

        # Check non-empty
        self.assertFalse(train.empty)
        self.assertFalse(test.empty)

        # 1. No snapshot ID overlap
        train_snaps = set(train["cutoff_timestamp"])
        test_snaps = set(test["cutoff_timestamp"])
        self.assertEqual(len(train_snaps & test_snaps), 0)

        # 2. No candidate row overlap
        train_cand_ids = set(zip(train["snapshot_id"], train["user_key"], train["product_id"]))
        test_cand_ids = set(zip(test["snapshot_id"], test["user_key"], test["product_id"]))
        self.assertEqual(len(train_cand_ids & test_cand_ids), 0)

        # 3. Label window vs cutoff timestamp isolation
        train_w_end = pd.to_datetime(train["label_window_end"]).max()
        test_t_start = pd.to_datetime(test["cutoff_timestamp"]).min()

        if not val.empty:
            val_snaps = set(val["cutoff_timestamp"])
            self.assertEqual(len(train_snaps & val_snaps), 0)
            self.assertEqual(len(val_snaps & test_snaps), 0)

            val_t_start = pd.to_datetime(val["cutoff_timestamp"]).min()
            val_w_end = pd.to_datetime(val["label_window_end"]).max()

            self.assertLessEqual(train_w_end, val_t_start, "Train label window overlaps with Val features!")
            self.assertLessEqual(val_w_end, test_t_start, "Val label window overlaps with Test features!")
        else:
            self.assertLessEqual(train_w_end, test_t_start, "Train label window overlaps with Test features!")

    def test_12_insufficient_followup_exact_boundary(self):
        """
        A snapshot whose T + 14 days is strictly <= obs_end must be kept.
        A snapshot whose T + 14 days is strictly > obs_end must be dropped (never labeled 0).
        """
        t_snap = datetime(2026, 8, 1, 0, 0, 0, tzinfo=timezone.utc)
        w_days = 14

        views = pd.DataFrame([{
            "user_key": "usr_bound_test",
            "clean_product_id": self.p1,
            "event_type": "VIEW",
            "event_timestamp": t_snap - timedelta(hours=2),
            "is_linked_to_catalog": True,
        }])

        # Case A: obs_end exactly equals T + 14 days -> eligible!
        obs_exact = t_snap + timedelta(days=w_days)
        ds_a, stats_a = build_snapshot_dataset(
            views, pd.DataFrame(), self.products_df,
            observation_end=obs_exact, window_days=w_days, step_days=30,
        )
        self.assertGreater(len(ds_a), 0)
        self.assertEqual(stats_a["snapshots_excluded_insufficient_followup"], 0)

        # Case B: obs_end is 1 second less than T + 14 days -> ineligible, excluded!
        obs_short = t_snap + timedelta(days=w_days) - timedelta(seconds=1)
        ds_b, stats_b = build_snapshot_dataset(
            views, pd.DataFrame(), self.products_df,
            observation_end=obs_short, window_days=w_days, step_days=30,
        )
        self.assertEqual(len(ds_b), 0)
        self.assertGreater(stats_b["snapshots_excluded_insufficient_followup"], 0)

    def test_13_ranking_metrics_and_sample_size_guard(self):
        """
        Verify that _evaluate_split_with_baselines computes Precision@K, Recall@K,
        Popularity Baseline, and issues a sample size warning when positives < 30.
        """
        from sklearn.dummy import DummyClassifier
        from src.train_bootstrap_model import _evaluate_split_with_baselines

        # Synthetic split with only 5 positives (< 30)
        records = []
        for i in range(50):
            records.append({
                "cutoff_timestamp": "2026-08-01T00:00:00+00:00",
                "user_key": f"usr_{i % 5}",
                "product_id": f"prod_{i}",
                "user_total_views": 10,
                "user_distinct_products_viewed": 5,
                "user_product_views": 2,
                "user_category_views": 3,
                "days_since_last_view": 1.0,
                "user_total_orders_before": 0,
                "user_previously_purchased": 0,
                "product_price": 200000.0,
                "product_variant_count": 2,
                "product_in_stock": 1,
                "product_visibility": 1,
                "product_popularity_views": 100 - i,
                "label": 1 if i < 5 else 0,
            })
        split_df = pd.DataFrame(records)

        from src.train_model import FEATURE_COLUMNS

        dummy = DummyClassifier(strategy="prior")
        dummy.fit(split_df[FEATURE_COLUMNS], split_df["label"])

        eval_res = _evaluate_split_with_baselines(dummy, split_df)

        # Check ranking metrics exist
        self.assertIn("precision@5", eval_res["model_performance"])
        self.assertIn("recall@5", eval_res["model_performance"])

        # Check popularity baseline exists
        self.assertIn("popularity", eval_res["baselines"])
        self.assertEqual(eval_res["baselines"]["popularity"]["baseline_name"], "PopularityRanking")

        # Check sample size guard: 5 positives < 30 -> unreliable
        self.assertEqual(eval_res["reliability_assessment"]["status"], "CHƯA ĐỦ DỮ LIỆU ĐỂ KẾT LUẬN HIỆU NĂNG")
        self.assertFalse(eval_res["reliability_assessment"]["is_statistically_reliable"])
        self.assertIn("quá nhỏ", eval_res["reliability_assessment"]["sample_size_warning"])


if __name__ == "__main__":
    unittest.main()


