"""
Synthetic Bootstrap Seeder for the Cheri ML pipeline (generator v2).

Writes ONLY to the dedicated synthetic collection 'ml_bootstrap_interactions'.
Never reads or writes customer PII, never writes to 'user_interactions' or 'orders'.

Safety model
------------
- DRY-RUN by default: generates in memory, prints statistics, preview docs and the
  labeled snapshot dataset that WOULD result. Nothing is written.
- Writing requires ALL of: --commit, --confirm-env development|test, --confirm-db <db name>
  matching the connected database, and no ML_ENV/APP_ENV/NODE_ENV=production.
- Idempotent: every document has a deterministic metadata.eventKey; writes are
  UpdateOne(filter={eventKey, generator, isSynthetic:true}, $setOnInsert, upsert=True)
  so re-running the same configuration inserts 0 and skips everything.
- Cleanup only targets docs with metadata.generator == this generator AND isSynthetic == true.

Usage (from server/ml):
  python -m src.seed_bootstrap_data                                   # dry-run
  python -m src.seed_bootstrap_data --commit --confirm-env development --confirm-db <db>
  python -m src.seed_bootstrap_data --cleanup                         # dry-run cleanup
  python -m src.seed_bootstrap_data --cleanup --commit --confirm-env development --confirm-db <db>
"""

import os
import sys
import json
import math
import random
import hashlib
import argparse
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except AttributeError:
        pass

CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT = CURRENT_DIR.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

import pandas as pd
from bson import ObjectId

from src.config import (
    get_mongo_db,
    anonymize_identifier,
    OUTPUT_REPORT_DIR,
    FUTURE_WINDOW_DAYS,
    BOOTSTRAP_COLLECTION_NAME,
    BOOTSTRAP_GENERATOR_NAME,
    BOOTSTRAP_GENERATOR_VERSION,
    SYNTHETIC_ID_PREFIX,
    SYNTHETIC_SESSION_PREFIX,
    SYNTHETIC_ORDER_PREFIX,
)

PROTECTED_COLLECTIONS = {"user_interactions", "orders", "users", "products"}
MIN_VALID_PRODUCTS = 10
MIN_CATEGORIES = 2

# Persona behaviour parameters (deliberately heterogeneous, not balanced)
PERSONAS: Dict[str, Dict[str, Any]] = {
    #               share  sessions   views/session  repeat  p_cart  p_buy|cart  cats  price_center
    "window_shopper": dict(share=0.34, sessions=(1, 3), views=(1, 3), repeat=0.15, p_cart=0.03, p_buy=0.25, cats=(1, 3), price=None),
    "explorer":       dict(share=0.22, sessions=(3, 8), views=(2, 6), repeat=0.25, p_cart=0.06, p_buy=0.35, cats=(2, 4), price=None),
    "focused":        dict(share=0.20, sessions=(2, 6), views=(1, 4), repeat=0.45, p_cart=0.12, p_buy=0.50, cats=(1, 2), price=None),
    "bargain_hunter": dict(share=0.14, sessions=(2, 6), views=(2, 5), repeat=0.35, p_cart=0.10, p_buy=0.40, cats=(1, 3), price=0.25),
    "loyal_buyer":    dict(share=0.10, sessions=(3, 7), views=(1, 4), repeat=0.40, p_cart=0.20, p_buy=0.65, cats=(1, 2), price=None),
}


# -----------------------------------------------------------------------------
# Catalog
# -----------------------------------------------------------------------------

def load_catalog(db) -> Tuple[pd.DataFrame, Dict[str, List[str]]]:
    """Reads products (id, category, price, variant SKUs) from the real catalog — nothing hardcoded."""
    from src.extract_data import extract_products
    products = extract_products(db)
    skus: Dict[str, List[str]] = {}
    for doc in db.products.find({}, {"variants.sku": 1}):
        skus[str(doc["_id"])] = [v.get("sku") for v in (doc.get("variants") or []) if v.get("sku")]
    return products, skus


def select_valid_products(products: pd.DataFrame) -> pd.DataFrame:
    """Visible products with a positive price and a known category."""
    if products is None or products.empty:
        return pd.DataFrame()
    df = products.copy()
    df["price"] = df["sale_price"].where(df["sale_price"] > 0, df["regular_price"])
    df = df[(df["visibility"] == True) & (df["price"] > 0) & df["primary_category"].notna()]
    return df.sort_values("product_id").reset_index(drop=True)


def validate_catalog(valid: pd.DataFrame) -> None:
    if len(valid) < MIN_VALID_PRODUCTS:
        raise SystemExit(f"ABORT: only {len(valid)} valid products (visible, price>0); need >= {MIN_VALID_PRODUCTS}.")
    if valid["primary_category"].nunique() < MIN_CATEGORIES:
        raise SystemExit(f"ABORT: need >= {MIN_CATEGORIES} product categories, found {valid['primary_category'].nunique()}.")


# -----------------------------------------------------------------------------
# Generation (pure, deterministic)
# -----------------------------------------------------------------------------

def compute_batch_id(seed: int, n_users: int, start: datetime, end: datetime, product_ids: List[str]) -> str:
    cat_hash = hashlib.sha1("|".join(sorted(product_ids)).encode()).hexdigest()[:8]
    raw = f"{BOOTSTRAP_GENERATOR_NAME}|{BOOTSTRAP_GENERATOR_VERSION}|{seed}|{n_users}|{start.isoformat()}|{end.isoformat()}|{cat_hash}"
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


def _pick_persona(rng: random.Random) -> str:
    names = list(PERSONAS.keys())
    return rng.choices(names, weights=[PERSONAS[n]["share"] for n in names], k=1)[0]


def generate_bootstrap_documents(
    valid_products: pd.DataFrame,
    variant_skus: Dict[str, List[str]],
    seed: int,
    n_users: int,
    window_start: datetime,
    window_end: datetime,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Simulates browsing timelines: VIEW -> (re)VIEW -> ADD_TO_CART -> PURCHASE (synthetic order).
    Purchases always follow a cart of the same user-product; events after window_end are censored.
    Returns (documents sorted by time, batch_id).
    """
    rng = random.Random(seed)
    pids = valid_products["product_id"].astype(str).tolist()
    cats = valid_products["primary_category"].astype(str).tolist()
    prices = valid_products["price"].astype(float).tolist()
    price_q = valid_products["price"].rank(pct=True).tolist()
    batch_id = compute_batch_id(seed, n_users, window_start, window_end, pids)

    # Global popularity: power law over a seeded ranking of real products
    ranking = list(range(len(pids)))
    rng.shuffle(ranking)
    popularity = [0.0] * len(pids)
    for rank, idx in enumerate(ranking):
        popularity[idx] = 1.0 / ((rank + 1) ** 0.85)

    cat_names = sorted(set(cats))
    cat_sizes = {c: cats.count(c) for c in cat_names}
    total_seconds = int((window_end - window_start).total_seconds())

    docs: List[Dict[str, Any]] = []
    order_seq = 0

    def make_doc(u_idx, uid, sid, persona, seq, pid_idx, etype, ts, extra_meta=None):
        key = hashlib.sha1(f"{batch_id}|{u_idx}|{seq}".encode()).hexdigest()
        skus = variant_skus.get(pids[pid_idx]) or []
        meta = {
            "isSynthetic": True,
            "datasetType": "bootstrap",
            "source": "synthetic_bootstrap",
            "generator": BOOTSTRAP_GENERATOR_NAME,
            "generatorVersion": BOOTSTRAP_GENERATOR_VERSION,
            "seed": seed,
            "batchId": batch_id,
            "eventKey": key,
            "persona": persona,
            "windowStart": window_start.isoformat(),
            "windowEnd": window_end.isoformat(),
        }
        if extra_meta:
            meta.update(extra_meta)
        return {
            "userId": uid,
            "sessionId": sid,
            "productId": ObjectId(pids[pid_idx]),
            "variantId": rng.choice(skus) if (skus and etype != "VIEW") else None,
            "eventType": etype,
            "timestamp": ts,
            "isSynthetic": True,
            "is_synthetic": True,
            "datasetType": "bootstrap",
            "metadata": meta,
        }

    for u_idx in range(n_users):
        persona = _pick_persona(rng)
        cfg = PERSONAS[persona]
        uid = f"{SYNTHETIC_ID_PREFIX}{seed}_{u_idx:04d}"
        n_pref = rng.randint(*cfg["cats"])
        pref = set(rng.choices(cat_names, weights=[cat_sizes[c] for c in cat_names], k=n_pref))
        center = cfg["price"] if cfg["price"] is not None else rng.uniform(0.2, 0.9)
        weights = [
            popularity[i] * (3.0 if cats[i] in pref else 0.35) * math.exp(-((price_q[i] - center) ** 2) / (2 * 0.3 ** 2))
            for i in range(len(pids))
        ]

        n_sessions = rng.randint(*cfg["sessions"])
        # Users join at different times -> realistic staggered activity
        join = rng.randint(0, int(total_seconds * 0.8))
        starts = sorted(window_start + timedelta(seconds=rng.randint(join, total_seconds)) for _ in range(n_sessions))

        seq = 0
        viewed: Dict[int, int] = {}
        carted: set = set()
        purchased: set = set()
        for s_idx, s_start in enumerate(starts):
            sid = f"{SYNTHETIC_SESSION_PREFIX}{seed}_{u_idx:04d}_{s_idx:03d}"
            t = s_start
            for _ in range(rng.randint(*cfg["views"])):
                revisit = [p for p in viewed if p not in purchased]
                if revisit and rng.random() < cfg["repeat"]:
                    p = rng.choice(revisit)
                else:
                    p = rng.choices(range(len(pids)), weights=weights, k=1)[0]
                t = t + timedelta(seconds=rng.randint(40, 600))
                if t > window_end:
                    break
                docs.append(make_doc(u_idx, uid, sid, persona, seq, p, "VIEW", t)); seq += 1
                viewed[p] = viewed.get(p, 0) + 1
                if p in carted or p in purchased:
                    continue
                p_cart = min(0.6, cfg["p_cart"] * (1 + 0.7 * (viewed[p] - 1)))
                if rng.random() >= p_cart:
                    continue
                t_cart = t + timedelta(seconds=rng.randint(30, 900))
                if t_cart > window_end:
                    continue
                docs.append(make_doc(u_idx, uid, sid, persona, seq, p, "ADD_TO_CART", t_cart)); seq += 1
                carted.add(p)
                if rng.random() >= cfg["p_buy"]:
                    continue  # abandoned cart
                # Checkout: same session (~40%) or a later return visit (0.5–13 days)
                if rng.random() < 0.4:
                    t_buy = t_cart + timedelta(minutes=rng.randint(5, 60))
                    buy_sid = sid
                else:
                    t_buy = t_cart + timedelta(hours=rng.uniform(12, 13 * 24))
                    buy_sid = f"{sid}_r"
                    t_revisit = t_buy - timedelta(minutes=rng.randint(3, 30))
                    if t_revisit <= window_end:
                        docs.append(make_doc(u_idx, uid, buy_sid, persona, seq, p, "VIEW", t_revisit)); seq += 1
                if t_buy > window_end:
                    continue  # censored: happens after the observed window
                qty = 2 if rng.random() < 0.1 else 1
                order_seq += 1
                docs.append(make_doc(
                    u_idx, uid, buy_sid, persona, seq, p, "PURCHASE", t_buy,
                    {"orderId": f"{SYNTHETIC_ORDER_PREFIX}{batch_id}-{order_seq:05d}", "quantity": qty,
                     "unitPrice": prices[p], "subtotal": round(prices[p] * qty, 2)},
                )); seq += 1
                purchased.add(p)

    docs.sort(key=lambda d: (d["timestamp"], d["metadata"]["eventKey"]))
    return docs, batch_id


# -----------------------------------------------------------------------------
# Statistics & preview
# -----------------------------------------------------------------------------

def summarize_documents(docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not docs:
        return {"documents": 0}
    df = pd.DataFrame([{"u": d["userId"], "p": str(d["productId"]), "e": d["eventType"],
                        "persona": d["metadata"]["persona"], "ts": d["timestamp"]} for d in docs])
    pair = df.groupby(["u", "p"]).agg(
        views=("e", lambda s: int((s == "VIEW").sum())),
        cart=("e", lambda s: bool((s == "ADD_TO_CART").any())),
        buy=("e", lambda s: bool((s == "PURCHASE").any())),
    )
    groups = {
        "single_view_only": int(((pair.views == 1) & ~pair.cart & ~pair.buy).sum()),
        "repeat_view_no_cart": int(((pair.views >= 2) & ~pair.cart & ~pair.buy).sum()),
        "cart_no_purchase": int((pair.cart & ~pair.buy).sum()),
        "purchased": int(pair.buy.sum()),
    }
    return {
        "documents": len(docs),
        "by_event_type": {k: int(v) for k, v in df["e"].value_counts().items()},
        "synthetic_users": int(df["u"].nunique()),
        "products_touched": int(df["p"].nunique()),
        "user_product_pairs": int(len(pair)),
        "pair_behaviour_groups": groups,
        "personas_users": {k: int(v) for k, v in df.drop_duplicates("u")["persona"].value_counts().items()},
        "time_range": [df["ts"].min().isoformat(), df["ts"].max().isoformat()],
    }


def anonymized_preview(docs: List[Dict[str, Any]], n: int = 5) -> List[Dict[str, Any]]:
    """Picks a few docs of different event types and masks identities for review."""
    picked, seen = [], set()
    for et in ("VIEW", "ADD_TO_CART", "PURCHASE"):
        for d in docs:
            if d["eventType"] == et and d["metadata"]["eventKey"] not in seen:
                picked.append(d); seen.add(d["metadata"]["eventKey"]); break
    for d in docs:
        if len(picked) >= n:
            break
        if d["metadata"]["eventKey"] not in seen:
            picked.append(d); seen.add(d["metadata"]["eventKey"])
    out = []
    for d in picked[:n]:
        m = d["metadata"]
        out.append({
            "userKey": anonymize_identifier(d["userId"], prefix="usr"),
            "userIdPrefix": SYNTHETIC_ID_PREFIX,
            "productId": str(d["productId"])[:8] + "…",
            "eventType": d["eventType"],
            "timestamp": d["timestamp"].isoformat(),
            "isSynthetic": d["isSynthetic"],
            "datasetType": d["datasetType"],
            "metadata": {k: m[k] for k in ("source", "generator", "generatorVersion", "batchId", "persona", "seed") if k in m}
                        | ({"orderId": m["orderId"], "unitPrice": m["unitPrice"]} if "orderId" in m else {}),
        })
    return out


def build_labeled_preview(docs: List[Dict[str, Any]], products: pd.DataFrame, window_end: datetime) -> Dict[str, Any]:
    """Runs the real snapshot pipeline on the generated docs (in memory) to report label distribution."""
    from src.extract_data import bootstrap_docs_to_interactions_df, bootstrap_docs_to_orders_df
    from src.validate_data import validate_and_clean_interactions
    from src.build_dataset import build_snapshot_dataset, assign_snapshot_time_splits, summarize_snapshot_dataset

    raw = bootstrap_docs_to_interactions_df(docs)
    orders = bootstrap_docs_to_orders_df(docs)
    clean, _ = validate_and_clean_interactions(raw, set(products["product_id"]), include_synthetic=True)
    out = {}
    for target, col in (("purchase", "label"), ("interest", "interest_label")):
        ds, stats = build_snapshot_dataset(clean, orders, products, observation_end=window_end, target=target)
        ds, split = assign_snapshot_time_splits(ds)
        out[target] = summarize_snapshot_dataset(ds, stats, split, f"{BOOTSTRAP_COLLECTION_NAME} (synthetic)", True, col)
    return out


# -----------------------------------------------------------------------------
# Guards & writes
# -----------------------------------------------------------------------------

def assert_write_allowed(db, args) -> None:
    for var in ("ML_ENV", "APP_ENV", "NODE_ENV"):
        if str(os.getenv(var, "")).strip().lower() in ("production", "prod"):
            raise SystemExit(f"ABORT: environment variable {var}=production. Synthetic seeding is refused.")
    if args.confirm_env not in ("development", "test"):
        raise SystemExit("ABORT: writing requires --confirm-env development|test.")
    if not args.confirm_db or args.confirm_db != db.name:
        raise SystemExit(f"ABORT: --confirm-db must equal the connected database name ('{db.name}').")
    if BOOTSTRAP_COLLECTION_NAME in PROTECTED_COLLECTIONS:
        raise SystemExit(f"ABORT: refusing to write synthetic data into protected collection '{BOOTSTRAP_COLLECTION_NAME}'.")


def generator_filter(batch_id: Optional[str] = None) -> Dict[str, Any]:
    q = {"metadata.generator": BOOTSTRAP_GENERATOR_NAME, "isSynthetic": True, "datasetType": "bootstrap"}
    if batch_id:
        q["metadata.batchId"] = batch_id
    return q


LEGACY_FILTER = {
    "isSynthetic": True,
    "datasetType": "bootstrap",
    "metadata.generator": {"$exists": False},
    "userId": {"$regex": "^usr_bootstrap_"},
}


def write_documents(db, docs: List[Dict[str, Any]], chunk: int = 500) -> Dict[str, int]:
    from pymongo import UpdateOne
    col = db[BOOTSTRAP_COLLECTION_NAME]
    col.create_index("metadata.eventKey", name="bootstrap_eventKey", sparse=True)
    inserted = skipped = 0
    seeded_at = datetime.now(timezone.utc).isoformat()
    for i in range(0, len(docs), chunk):
        ops = []
        for d in docs[i:i + chunk]:
            doc = dict(d)
            doc["metadata"] = dict(d["metadata"], seededAt=seeded_at)
            ops.append(UpdateOne(
                {"metadata.eventKey": d["metadata"]["eventKey"], "metadata.generator": BOOTSTRAP_GENERATOR_NAME, "isSynthetic": True},
                {"$setOnInsert": doc},
                upsert=True,
            ))
        res = col.bulk_write(ops, ordered=False)
        inserted += res.upserted_count
        skipped += res.matched_count
    return {"inserted": inserted, "skipped_existing": skipped, "updated": 0}


# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------

def parse_args(argv=None):
    p = argparse.ArgumentParser(description="Cheri ML — synthetic bootstrap seeder (dry-run by default)")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--users", type=int, default=120, help="Number of synthetic users")
    p.add_argument("--days", type=int, default=90, help="Length of the simulated window in days")
    p.add_argument("--end-date", type=str, default=None, help="Window end (YYYY-MM-DD, UTC). Default: today 00:00 UTC")
    p.add_argument("--max-docs", type=int, default=8000, help="Abort if generation exceeds this many documents")
    p.add_argument("--preview", type=int, default=5, help="Number of anonymized preview documents")
    p.add_argument("--commit", action="store_true", help="Actually write (requires --confirm-env and --confirm-db)")
    p.add_argument("--confirm-env", choices=["development", "test"], default=None)
    p.add_argument("--confirm-db", type=str, default=None)
    p.add_argument("--cleanup", action="store_true", help="Delete docs created by THIS generator (dry-run unless --commit)")
    p.add_argument("--cleanup-legacy", action="store_true", help="Delete legacy v1 bootstrap docs (usr_bootstrap_*, no generator tag)")
    p.add_argument("--batch-id", type=str, default=None, help="Restrict cleanup to one batch")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    print("=" * 72)
    print(f"CHERI ML — SYNTHETIC BOOTSTRAP SEEDER ({BOOTSTRAP_GENERATOR_NAME} v{BOOTSTRAP_GENERATOR_VERSION})")
    print("=" * 72)
    db = get_mongo_db()
    col = db[BOOTSTRAP_COLLECTION_NAME]
    print(f"Database   : {db.name}")
    print(f"Collection : {BOOTSTRAP_COLLECTION_NAME} (synthetic only)")
    print(f"Mode       : {'COMMIT' if args.commit else 'DRY-RUN (no writes)'}")

    # ---------------- Cleanup ----------------
    if args.cleanup or args.cleanup_legacy:
        q = LEGACY_FILTER if args.cleanup_legacy else generator_filter(args.batch_id)
        n = col.count_documents(q)
        print(f"Cleanup filter : {q}")
        print(f"Matching docs  : {n}")
        if not args.commit:
            print("[DRY-RUN] Nothing deleted. Re-run with --commit --confirm-env ... --confirm-db ... to delete.")
            return 0
        assert_write_allowed(db, args)
        res = col.delete_many(q)
        print(f"Deleted {res.deleted_count} synthetic documents (collection itself untouched).")
        return 0

    # ---------------- Generate ----------------
    end = (datetime.strptime(args.end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) if args.end_date
           else datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0))
    start = end - timedelta(days=args.days)
    if args.days < FUTURE_WINDOW_DAYS * 3:
        print(f"WARNING: --days < {FUTURE_WINDOW_DAYS * 3}; few snapshots will have full {FUTURE_WINDOW_DAYS}-day follow-up.")

    products, skus = load_catalog(db)
    valid = select_valid_products(products)
    validate_catalog(valid)
    print(f"Catalog    : {len(products)} products, {len(valid)} valid (visible & price>0), "
          f"{valid['primary_category'].nunique()} categories")
    print(f"Window     : {start.isoformat()} -> {end.isoformat()} | seed={args.seed} users={args.users}")

    docs, batch_id = generate_bootstrap_documents(valid, skus, args.seed, args.users, start, end)
    if len(docs) > args.max_docs:
        raise SystemExit(f"ABORT: generated {len(docs)} docs > --max-docs {args.max_docs}.")

    summary = summarize_documents(docs)
    labeled = build_labeled_preview(docs, products, end)
    existing_batch = col.count_documents(generator_filter(batch_id))
    other_batches = [b for b in col.distinct("metadata.batchId", generator_filter()) if b != batch_id]
    legacy = col.count_documents(LEGACY_FILTER)

    print("-" * 72)
    print(f"Batch id               : {batch_id}")
    print(f"Generated documents    : {summary['documents']}  {summary['by_event_type']}")
    print(f"Synthetic users        : {summary['synthetic_users']} | products touched: {summary['products_touched']}")
    print(f"User-product groups    : {summary['pair_behaviour_groups']}")
    print(f"Personas (users)       : {summary['personas_users']}")
    print(f"Already in DB (batch)  : {existing_batch} -> would insert ~{max(0, len(docs) - existing_batch)}, skip {existing_batch}")
    if other_batches:
        print(f"NOTE: other batches of this generator exist: {other_batches} (training reads all of them unless --batch-id).")
    if legacy:
        print(f"NOTE: {legacy} legacy v1 bootstrap docs exist; they are IGNORED by the v2 training flow.")
    for target in ("purchase", "interest"):
        s = labeled[target]
        print(f"[{target}] snapshots={s['snapshots_in_dataset']} rows={s['rows']} users={s['distinct_users']} "
              f"products={s['distinct_products']} labels={s['label_distribution']} pos_rate={s['positive_rate']} "
              f"excluded_snapshots(no follow-up)={s['snapshots_excluded_insufficient_followup']} "
              f"purged_rows(embargo)={s['rows_purged_by_embargo']}")
        print(f"[{target}] split distribution: {s['split_distribution']}")
    print("-" * 72)
    print("Anonymized preview documents:")
    for d in anonymized_preview(docs, args.preview):
        print("  " + json.dumps(d, ensure_ascii=False, default=str))

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "database": db.name, "collection": BOOTSTRAP_COLLECTION_NAME, "mode": "commit" if args.commit else "dry-run",
        "generator": BOOTSTRAP_GENERATOR_NAME, "generator_version": BOOTSTRAP_GENERATOR_VERSION, "batch_id": batch_id,
        "config": {"seed": args.seed, "users": args.users, "days": args.days, "window_start": start.isoformat(), "window_end": end.isoformat()},
        "documents": summary, "labeled_datasets": labeled,
        "disclaimer": "SYNTHETIC data — not production evidence. Metrics derived from it are not production metrics.",
    }
    OUTPUT_REPORT_DIR.mkdir(parents=True, exist_ok=True)
    rpath = OUTPUT_REPORT_DIR / f"bootstrap_seed_{'commit' if args.commit else 'dryrun'}.json"
    rpath.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"Report written: {rpath}")

    if not args.commit:
        print("[DRY-RUN] No documents written. To write (development/test DB only):")
        print(f"  python -m src.seed_bootstrap_data --seed {args.seed} --users {args.users} --days {args.days} "
              f"--end-date {end.date()} --commit --confirm-env development --confirm-db {db.name}")
        return 0

    assert_write_allowed(db, args)
    print(f"WRITING {len(docs)} docs into '{db.name}.{BOOTSTRAP_COLLECTION_NAME}' (upsert, $setOnInsert)...")
    stats = write_documents(db, docs)
    print(f"Result: {stats}")
    print(f"Total generator docs now: {col.count_documents(generator_filter())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
