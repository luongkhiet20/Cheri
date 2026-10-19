"""
CLI Entrypoint for Cheri Machine Learning Data Preparation Pipeline.
Usage:
  python server/ml/main.py                 # Runs full pipeline and exports datasets & reports
  python server/ml/main.py --check-only    # Checks data health without writing datasets
  python server/ml/main.py --test-conn     # Tests MongoDB connection
"""

import sys
import argparse
from pathlib import Path

# Ensure package root is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Ensure stdout uses utf-8 on Windows
if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

from src.config import get_mongo_client, get_mongo_db, MONGO_URI, MONGO_DB_NAME
from src.export_dataset import run_pipeline


def main():
    parser = argparse.ArgumentParser(description="Cheri E-commerce ML Data Preparation Pipeline")
    parser.add_argument("--check-only", action="store_true", help="Audit database and print report without writing datasets")
    parser.add_argument("--include-synthetic", action="store_true", help="Include synthetic test interactions in output datasets (Default: False, isolates synthetic events)")
    parser.add_argument("--test-conn", action="store_true", help="Test MongoDB connection and exit")
    parser.add_argument("--data-dir", type=str, default=None, help="Custom output directory for data CSVs")
    parser.add_argument("--report-dir", type=str, default=None, help="Custom output directory for reports")
    args = parser.parse_args()

    print("=" * 70)
    print("CHERI MACHINE LEARNING DATA PREPARATION PIPELINE")
    print("=" * 70)

    # 1. Connection check
    if args.test_conn:
        print("[1/1] Testing MongoDB Atlas connection...")
        try:
            client = get_mongo_client()
            db = client[MONGO_DB_NAME]
            cols = db.list_collection_names()
            print(f"SUCCESS: Connected to database '{MONGO_DB_NAME}'. Collections found: {len(cols)}")
            client.close()
            sys.exit(0)
        except Exception as e:
            print(f"ERROR: Could not connect to MongoDB: {e}")
            sys.exit(1)

    # 2. Pipeline execution
    is_check_only = args.check_only
    inc_syn = args.include_synthetic
    print(f"Mode: {'CHECK-ONLY (No file write)' if is_check_only else 'FULL PIPELINE & EXPORT'}")
    print(f"Synthetic Data Filter: {'INCLUDED for testing' if inc_syn else 'ISOLATED (Only real events in clean dataset)'}")
    print("Connecting to MongoDB and processing collections...")

    try:
        db = get_mongo_db()
        custom_data = Path(args.data_dir) if args.data_dir else None
        custom_report = Path(args.report_dir) if args.report_dir else None

        result = run_pipeline(
            db=db,
            data_dir=custom_data,
            report_dir=custom_report,
            export_files=not is_check_only,
            include_synthetic=inc_syn,
        )

        rep = result["report"]
        im = rep["interaction_metrics"]
        pm = rep["product_metrics"]
        om = rep["order_metrics"]
        rs = rep["readiness_summary"]

        print("-" * 70)
        print("PIPELINE EXECUTION SUMMARY")
        print("-" * 70)
        print(f"  Products Catalog     : {pm['total_products']} products (Valid price: {pm['products_with_valid_price']})")
        print(f"  Orders History       : {om['total_orders']} orders (Verified conversions: {om['successful_conversion_orders']})")
        print(f"  Interactions Raw     : {im['total_raw_records']} events (Clean views: {im['total_views']})")
        print(f"  Compound IDs Detected: {im['compound_id_count']}")
        print(f"  Unlinked Events      : {im['unlinked_product_count']}")
        print(f"  Technical Bounces    : {im['technical_duplicate_count']}")
        print(f"  ML Training Ready    : {'YES' if rs['is_training_ready'] else 'NO (Awaiting real user interaction events)'}")
        print(f"  Recommended Next Step: {rs['recommended_strategy']}")
        print("-" * 70)

        if not is_check_only:
            print(f"SUCCESS: Datasets and reports exported to 'server/ml/data/' and 'server/ml/reports/'.")

    except Exception as e:
        print(f"FATAL ERROR during pipeline execution: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
