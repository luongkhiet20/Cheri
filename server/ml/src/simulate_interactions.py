"""
Synthetic Interaction Simulation Module for Cheri Machine Learning Pipeline.
Generates realistic VIEW interactions exclusively using existing accounts and products in MongoDB.
Features deterministic seeds, natural repeat viewing behaviors, dry-run safety by default,
and complete PII protection.
"""

import sys
import random
import argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
from bson import ObjectId

# Ensure ML root is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

# Ensure stdout uses utf-8 on Windows
if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

from src.config import get_mongo_db, is_valid_object_id


def generate_synthetic_interaction_documents(
    user_ids: List[ObjectId],
    product_ids: List[ObjectId],
    seed: int = 42,
    days_back: int = 14,
    min_events_per_user: int = 4,
    max_events_per_user: int = 10,
    repeat_probability: float = 0.35,
    unviewed_ratio: float = 0.15,
    reference_time: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Generates deterministic synthetic VIEW events for real MongoDB user and product IDs.
    Simulates diverse realistic behavior:
      - Hot products (frequently viewed via Power-law weights)
      - Long-tail products (rarely viewed)
      - Completely unviewed products (realistic catalog cold items)
      - Natural repeat views per user (loyal favorites)
    Strictly uses pure ObjectId without any PII.
    """
    if not user_ids or not product_ids:
        return []

    rng = random.Random(seed)
    now = reference_time or datetime.now(timezone.utc)
    start_time = now - timedelta(days=days_back)
    total_seconds_window = int((now - start_time).total_seconds())

    # 1. Split products into viewable catalog and unviewed cold catalog
    shuffled_prods = list(product_ids)
    rng.shuffle(shuffled_prods)
    num_unviewed = int(len(shuffled_prods) * unviewed_ratio)
    if num_unviewed > 0 and len(shuffled_prods) > num_unviewed + 2:
        viewable_products = shuffled_prods[:-num_unviewed]
    else:
        viewable_products = shuffled_prods

    # 2. Assign popularity weights to viewable products (Power law: 1 / (rank ^ 0.8))
    # This creates hot items (front of list) and low-view items (tail)
    weights = [1.0 / ((i + 1) ** 0.8) for i in range(len(viewable_products))]

    documents: List[Dict[str, Any]] = []

    for u_id in user_ids:
        num_events = rng.randint(min_events_per_user, max_events_per_user)
        # Select 2-4 favorite products from viewable catalog for repeat views
        favorite_count = min(len(viewable_products), rng.randint(2, 4))
        user_favorites = rng.choices(viewable_products, weights=weights, k=favorite_count)

        for _ in range(num_events):
            # Decide whether to view a favorite (repeat view) or a weighted catalog choice
            if rng.random() < repeat_probability:
                chosen_product = rng.choice(user_favorites)
            else:
                chosen_product = rng.choices(viewable_products, weights=weights, k=1)[0]

            # Random timestamp within window
            random_offset = rng.randint(0, max(1, total_seconds_window))
            event_timestamp = start_time + timedelta(seconds=random_offset)

            doc = {
                "userId": u_id,
                "sessionId": None,
                "productId": chosen_product,
                "eventType": "VIEW",
                "timestamp": event_timestamp,
                "isSynthetic": True,
                "metadata": {
                    "isSynthetic": True,
                    "generator": "Cheri-ML-Simulator",
                    "seed": seed,
                    "simulatedAt": now.isoformat(),
                },
            }
            documents.append(doc)

    # Sort chronologically by timestamp
    documents.sort(key=lambda d: d["timestamp"])
    return documents


def cleanup_synthetic_interactions(db, confirmed: bool = False) -> int:
    """
    Safely deletes ONLY synthetic interaction documents marked with isSynthetic=True.
    Zero impact on real user interactions or customer records.
    """
    query = {
        "$or": [
            {"metadata.isSynthetic": True},
            {"isSynthetic": True},
        ]
    }
    count = db.user_interactions.count_documents(query)

    if not confirmed:
        print(f"[DRY-RUN] Found {count} synthetic records that WOULD be deleted.")
        print("To execute deletion, provide the '--commit' flag.")
        return count

    if count > 0:
        result = db.user_interactions.delete_many(query)
        print(f"SUCCESS: Deleted {result.deleted_count} synthetic interaction records from MongoDB.")
        return result.deleted_count
    else:
        print("No synthetic interaction records found to delete.")
        return 0


def verify_inserted_interactions(db, inserted_ids: List[Any]) -> Dict[str, Any]:
    """
    Post-insert verification: Reads MongoDB directly and verifies required fields,
    timestamps, and successful linking between productId and products collection.
    """
    query = {"_id": {"$in": inserted_ids}}
    cursor = list(db.user_interactions.find(query))
    total_found = len(cursor)

    valid_fields_count = 0
    valid_timestamps_count = 0
    pids_to_check = set()

    for doc in cursor:
        has_req = (
            "userId" in doc and doc["userId"] is not None and
            "productId" in doc and doc["productId"] is not None and
            doc.get("eventType") == "VIEW" and
            (doc.get("isSynthetic") is True or doc.get("metadata", {}).get("isSynthetic") is True)
        )
        if has_req:
            valid_fields_count += 1

        ts = doc.get("timestamp")
        if isinstance(ts, datetime):
            valid_timestamps_count += 1

        pid = doc.get("productId")
        if is_valid_object_id(pid):
            pids_to_check.add(ObjectId(str(pid)))

    # Verify link with products catalog
    existing_prods_count = db.products.count_documents({"_id": {"$in": list(pids_to_check)}})
    linked_ratio = (existing_prods_count / len(pids_to_check)) if pids_to_check else 0.0

    return {
        "verified_count": total_found,
        "valid_fields_count": valid_fields_count,
        "valid_timestamps_count": valid_timestamps_count,
        "unique_product_ids_referenced": len(pids_to_check),
        "linked_product_ids_in_catalog": existing_prods_count,
        "linking_success_rate": linked_ratio,
    }


def main():
    parser = argparse.ArgumentParser(description="Simulate realistic product views for existing accounts in Cheri")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed (Default: 42)")
    parser.add_argument("--users", "--max-users", dest="max_users", type=int, default=20, help="Existing users to sample (Default: 20)")
    parser.add_argument("--products", "--max-products", dest="max_products", type=int, default=30, help="Existing products to sample (Default: 30)")
    parser.add_argument("--min-events", type=int, default=4, help="Min views per user (Default: 4)")
    parser.add_argument("--max-events", type=int, default=10, help="Max views per user (Default: 10)")
    parser.add_argument("--days", type=int, default=14, help="Days of history to simulate (Default: 14)")
    parser.add_argument("--commit", action="store_true", help="Explicitly confirm writing synthetic records to MongoDB")
    parser.add_argument("--cleanup-synthetic", action="store_true", help="Delete all existing synthetic records from MongoDB")
    args = parser.parse_args()

    print("=" * 70)
    print("CHERI MACHINE LEARNING - INTERACTION SIMULATOR")
    print("=" * 70)

    db = get_mongo_db()

    # Case 1: Cleanup mode
    if args.cleanup_synthetic:
        print("Mode: CLEANUP SYNTHETIC INTERACTIONS")
        cleanup_synthetic_interactions(db, confirmed=args.commit)
        sys.exit(0)

    # Case 2: Simulation mode
    is_dry_run = not args.commit
    print(f"Mode: {'DRY-RUN (Preview only, no database write)' if is_dry_run else 'LIVE COMMIT (Writing to MongoDB)'}")
    print(f"Configuration: Users: {args.max_users} | Products: {args.max_products} | Days: {args.days} | Seed: {args.seed}")

    # Fetch real user IDs
    user_cursor = db.users.find({}, {"_id": 1}).limit(args.max_users)
    real_user_ids = [doc["_id"] for doc in user_cursor if is_valid_object_id(doc["_id"])]

    # Fetch real product IDs (visible products first)
    prod_cursor = db.products.find({"visibility": {"$ne": False}}, {"_id": 1}).limit(args.max_products)
    real_product_ids = [doc["_id"] for doc in prod_cursor if is_valid_object_id(doc["_id"])]

    if not real_product_ids:
        # Fallback to any products
        prod_cursor = db.products.find({}, {"_id": 1}).limit(args.max_products)
        real_product_ids = [doc["_id"] for doc in prod_cursor if is_valid_object_id(doc["_id"])]

    print(f"Sampled real accounts from MongoDB: {len(real_user_ids)}")
    print(f"Sampled real products from MongoDB: {len(real_product_ids)}")

    if not real_user_ids or not real_product_ids:
        print("ERROR: Cannot simulate because no real users or products were found in database.")
        sys.exit(1)

    # Generate documents
    generated_docs = generate_synthetic_interaction_documents(
        user_ids=real_user_ids,
        product_ids=real_product_ids,
        seed=args.seed,
        days_back=args.days,
        min_events_per_user=args.min_events,
        max_events_per_user=args.max_events,
    )

    print(f"Total simulated interaction events generated: {len(generated_docs)}")
    print("-" * 70)
    print("Sample generated document preview (Document #1):")
    if generated_docs:
        s = generated_docs[0]
        print(f"  userId    : {s['userId']} (type: {type(s['userId']).__name__})")
        print(f"  productId : {s['productId']} (type: {type(s['productId']).__name__})")
        print(f"  eventType : {s['eventType']}")
        print(f"  timestamp : {s['timestamp']}")
        print(f"  isSynthetic: {s['isSynthetic']}")
        print(f"  metadata  : {s['metadata']}")
    print("-" * 70)

    if is_dry_run:
        print("[DRY-RUN NOTICE]: Mode is dry-run. No changes were written to MongoDB.")
        print("To write these simulated records into MongoDB Atlas, re-run with:")
        print("  python server/ml/src/simulate_interactions.py --commit")
    else:
        # Commit to MongoDB
        print(f"Writing {len(generated_docs)} synthetic records to 'user_interactions'...")
        result = db.user_interactions.insert_many(generated_docs)
        inserted_count = len(result.inserted_ids)
        print(f"SUCCESS: Inserted {inserted_count} records into MongoDB 'user_interactions'.")

        # Post-insert verification
        print("Performing post-insert verification directly on MongoDB...")
        veri = verify_inserted_interactions(db, result.inserted_ids)
        print("-" * 70)
        print("MONGODB VERIFICATION REPORT:")
        print(f"  Documents confirmed in DB        : {veri['verified_count']}/{inserted_count}")
        print(f"  Documents with all valid fields   : {veri['valid_fields_count']}/{veri['verified_count']}")
        print(f"  Documents with valid timestamps   : {veri['valid_timestamps_count']}/{veri['verified_count']}")
        print(f"  Unique products referenced       : {veri['unique_product_ids_referenced']}")
        print(f"  Products verified in Catalog      : {veri['linked_product_ids_in_catalog']}")
        print(f"  Catalog Linking Success Rate      : {veri['linking_success_rate'] * 100:.1f}%")
        print("-" * 70)

        print("Note: All simulated records are tagged with 'isSynthetic: True' and can be safely purged at any time with:")
        print("  python server/ml/src/simulate_interactions.py --cleanup-synthetic --commit")


if __name__ == "__main__":
    main()
