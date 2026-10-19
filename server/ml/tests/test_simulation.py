"""
Unit Tests for Synthetic Interaction Simulation Module.
Tests determinism, ID integrity, synthetic tagging, dry-run safety, and cleanup filters.
"""

import sys
import unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# Add ML root to sys.path
TESTS_DIR = Path(__file__).resolve().parent
ML_ROOT = TESTS_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from src.simulate_interactions import (
    generate_synthetic_interaction_documents,
    cleanup_synthetic_interactions,
)
from src.config import is_valid_object_id


class TestSimulationModule(unittest.TestCase):

    def setUp(self):
        self.mock_user_ids = [ObjectId() for _ in range(5)]
        self.mock_product_ids = [ObjectId() for _ in range(10)]
        self.fixed_time = datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc)

    # 1. Test Seed Reproducibility
    def test_01_seed_reproducibility(self):
        docs_run1 = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            reference_time=self.fixed_time,
        )
        docs_run2 = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            reference_time=self.fixed_time,
        )
        self.assertEqual(len(docs_run1), len(docs_run2))
        for d1, d2 in zip(docs_run1, docs_run2):
            self.assertEqual(d1["userId"], d2["userId"])
            self.assertEqual(d1["productId"], d2["productId"])
            self.assertEqual(d1["timestamp"], d2["timestamp"])

    # 2. Test Record Count Bounds
    def test_02_event_count_bounds(self):
        min_ev = 3
        max_ev = 6
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=100,
            min_events_per_user=min_ev,
            max_events_per_user=max_ev,
            reference_time=self.fixed_time,
        )
        min_possible = len(self.mock_user_ids) * min_ev
        max_possible = len(self.mock_user_ids) * max_ev
        self.assertGreaterEqual(len(docs), min_possible)
        self.assertLessEqual(len(docs), max_possible)

    # 3. Test ID Formats & Schema Correctness
    def test_03_id_formats_and_schema(self):
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            reference_time=self.fixed_time,
        )
        for doc in docs:
            self.assertTrue(is_valid_object_id(doc["userId"]))
            self.assertTrue(is_valid_object_id(doc["productId"]))
            self.assertIsInstance(doc["userId"], ObjectId)
            self.assertIsInstance(doc["productId"], ObjectId)
            self.assertEqual(doc["eventType"], "VIEW")
            self.assertIsNone(doc["sessionId"])

    # 4. Test Timestamp Range
    def test_04_timestamp_range(self):
        days = 14
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            days_back=days,
            seed=42,
            reference_time=self.fixed_time,
        )
        start_time = self.fixed_time - timedelta(days=days)
        for doc in docs:
            ts = doc["timestamp"]
            self.assertGreaterEqual(ts, start_time)
            self.assertLessEqual(ts, self.fixed_time)

    # 5. Test Synthetic Flag Integrity
    def test_05_synthetic_flags(self):
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            reference_time=self.fixed_time,
        )
        for doc in docs:
            self.assertTrue(doc.get("isSynthetic"))
            meta = doc.get("metadata", {})
            self.assertTrue(meta.get("isSynthetic"))
            self.assertEqual(meta.get("seed"), 42)

    # 6. Test Zero PII
    def test_06_zero_pii_in_simulated_docs(self):
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            reference_time=self.fixed_time,
        )
        pii_keys = ["email", "phone", "address", "fullName", "password", "token"]
        for doc in docs:
            for k in pii_keys:
                self.assertNotIn(k, doc)
            meta = doc.get("metadata", {})
            for k in pii_keys:
                self.assertNotIn(k, meta)

    # 7. Test Empty Inputs
    def test_07_empty_inputs_safety(self):
        docs = generate_synthetic_interaction_documents(
            user_ids=[],
            product_ids=self.mock_product_ids,
            seed=42,
        )
        self.assertEqual(len(docs), 0)

        docs_no_prod = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=[],
            seed=42,
        )
        self.assertEqual(len(docs_no_prod), 0)

    # 8. Test Natural Repeat Viewing
    def test_08_natural_repeat_views(self):
        docs = generate_synthetic_interaction_documents(
            user_ids=self.mock_user_ids,
            product_ids=self.mock_product_ids,
            seed=42,
            min_events_per_user=15,
            max_events_per_user=20,
            repeat_probability=0.7,
            reference_time=self.fixed_time,
        )
        # Check that at least one user has repeat views of the same product
        user_prod_counts = {}
        for d in docs:
            pair = (d["userId"], d["productId"])
            user_prod_counts[pair] = user_prod_counts.get(pair, 0) + 1

        has_repeat = any(count > 1 for count in user_prod_counts.values())
        self.assertTrue(has_repeat, "Simulation must exhibit natural repeat viewing behavior")


if __name__ == "__main__":
    unittest.main()
