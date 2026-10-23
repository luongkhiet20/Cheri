"""
Configuration and Utilities Module for Cheri Machine Learning Pipeline.
Handles environment variables, MongoDB connections, ID normalization, and PII anonymization.
"""

import os
import re
import hashlib
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Path resolution
ML_ROOT_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT_DIR = ML_ROOT_DIR.parent.parent

# Attempt to load dotenv, with pure Python fallback
def load_environment() -> None:
    """Load environment variables from server/ml/.env or fallback to project root .env"""
    env_paths = [
        ML_ROOT_DIR / ".env",
        PROJECT_ROOT_DIR / ".env",
        ML_ROOT_DIR.parent / ".env",
    ]
    
    loaded = False
    try:
        from dotenv import load_dotenv
        for p in env_paths:
            if p.exists():
                load_dotenv(p)
                loaded = True
                break
    except ImportError:
        pass

    if not loaded:
        for p in env_paths:
            if p.exists():
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k not in os.environ:
                                os.environ[k] = v
                break

load_environment()

# Environment settings
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/cheri")
MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "cheri")

OUTPUT_DATA_DIR: Path = Path(os.getenv("OUTPUT_DATA_DIR", str(ML_ROOT_DIR / "data")))
OUTPUT_REPORT_DIR: Path = Path(os.getenv("OUTPUT_REPORT_DIR", str(ML_ROOT_DIR / "reports")))
OUTPUT_MODEL_DIR: Path = Path(os.getenv("OUTPUT_MODEL_DIR", str(ML_ROOT_DIR / "models")))

FUTURE_WINDOW_DAYS: int = int(os.getenv("FUTURE_WINDOW_DAYS", "14"))
MIN_INTERACTIONS: int = int(os.getenv("MIN_INTERACTIONS", "1"))

# Ensure output directories exist
OUTPUT_DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_REPORT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_MODEL_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_REPORT_DIR.mkdir(parents=True, exist_ok=True)

# Business Logic Statuses
SUCCESSFUL_PAYMENT_STATUSES = {"PAID"}
SUCCESSFUL_ORDER_STATUSES = {"DELIVERED", "CONFIRMED", "PROCESSING", "SHIPPING"}
EXCLUDED_ORDER_STATUSES = {"CANCELLED", "RETURNED", "DELIVERY_FAILED"}

# MongoDB ObjectId Regex (24 hex characters)
OBJECT_ID_REGEX = re.compile(r"^[0-9a-fA-F]{24}$")

# Anonymization Salt (stable per environment, never committed)
ANONYMIZATION_SALT = os.getenv("ML_SALT", "cheri_ml_salt_2026_secured")


# Bootstrap (synthetic) settings — synthetic data lives ONLY in this collection
BOOTSTRAP_COLLECTION_NAME: str = os.getenv("BOOTSTRAP_COLLECTION_NAME", "ml_bootstrap_interactions")
BOOTSTRAP_GENERATOR_NAME: str = "cheri-bootstrap-seeder"
BOOTSTRAP_GENERATOR_VERSION: str = "2.0.0"
SYNTHETIC_ID_PREFIX: str = "syn_bs_usr_"        # synthetic user identities (never real customers)
SYNTHETIC_SESSION_PREFIX: str = "syn_bs_sess_"  # synthetic session identities
SYNTHETIC_ORDER_PREFIX: str = "SYN-BS-ORD-"     # synthetic order ids (never written to 'orders')

# Snapshot labeling defaults
SNAPSHOT_STEP_DAYS: int = int(os.getenv("SNAPSHOT_STEP_DAYS", "3"))
CANDIDATE_LOOKBACK_DAYS: int = int(os.getenv("CANDIDATE_LOOKBACK_DAYS", "30"))

def get_mongo_client(uri: Optional[str] = None, timeout_ms: int = 15000) -> MongoClient:
    """Creates an authenticated MongoClient with timeout and ping verification."""
    conn_uri = uri or MONGO_URI
    client = MongoClient(conn_uri, serverSelectionTimeoutMS=timeout_ms)
    try:
        client.admin.command("ping")
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        raise ConnectionError(f"Failed to connect to MongoDB: {str(e)}") from e
    return client


def get_mongo_db(uri: Optional[str] = None, db_name: Optional[str] = None):
    """Returns database instance from MongoClient."""
    client = get_mongo_client(uri)
    target_name = db_name or MONGO_DB_NAME
    # If URI specifies database name, default to it
    try:
        default_db = client.get_default_database()
        if default_db is not None:
            return default_db
    except Exception:
        pass
    return client[target_name]


def is_valid_object_id(val: Any) -> bool:
    """Checks whether a value is a valid 24-character hexadecimal ObjectId string or BSON ObjectId."""
    if val is None:
        return False
    val_str = str(val).strip()
    return bool(OBJECT_ID_REGEX.match(val_str))


def normalize_product_key(raw_id: Any) -> Dict[str, Any]:
    """
    Safely inspects and normalizes product identifier.
    Differentiates between:
    - Pure ObjectId (24 hex chars)
    - Compound ID (e.g., '6ab8f746547709e9279f6903_1780253976-10-AO-S' -> prod_id + variant_id)
    - Custom SKU or non-ObjectId string
    Returns dict:
      {
        'clean_product_id': str,
        'variant_id': Optional[str],
        'is_compound': bool,
        'is_valid_object_id': bool,
        'raw_id': str
      }
    """
    if raw_id is None:
        return {
            "clean_product_id": "",
            "variant_id": None,
            "is_compound": False,
            "is_valid_object_id": False,
            "raw_id": "",
        }

    raw_str = str(raw_id).strip()
    if not raw_str:
        return {
            "clean_product_id": "",
            "variant_id": None,
            "is_compound": False,
            "is_valid_object_id": False,
            "raw_id": "",
        }

    # Case 1: Compound ID with delimiter '_'
    if "_" in raw_str:
        parts = raw_str.split("_")
        first_part = parts[0].strip()
        second_part = "_".join(parts[1:]).strip() if len(parts) > 1 else None

        # Check if the prefix is indeed a valid ObjectId
        if is_valid_object_id(first_part):
            return {
                "clean_product_id": first_part,
                "variant_id": second_part,
                "is_compound": True,
                "is_valid_object_id": True,
                "raw_id": raw_str,
            }
        else:
            # Not a standard compound ID, treat as non-compound SKU/string
            return {
                "clean_product_id": raw_str,
                "variant_id": None,
                "is_compound": False,
                "is_valid_object_id": False,
                "raw_id": raw_str,
            }

    # Case 2: Pure standard ObjectId
    if is_valid_object_id(raw_str):
        return {
            "clean_product_id": raw_str,
            "variant_id": None,
            "is_compound": False,
            "is_valid_object_id": True,
            "raw_id": raw_str,
        }

    # Case 3: SKU or alphanumeric string (e.g., 'SKU-AO-01')
    return {
        "clean_product_id": raw_str,
        "variant_id": None,
        "is_compound": False,
        "is_valid_object_id": False,
        "raw_id": raw_str,
    }


def anonymize_identifier(raw_id: Any, prefix: str = "usr") -> str:
    """
    Converts a raw user ID, session ID, or customer contact to a secure, stable pseudonym.
    Guarantees no raw PII (email, phone, name) is exposed in machine learning datasets.
    """
    if not raw_id:
        return f"{prefix}_unknown"
    
    clean_val = str(raw_id).strip().lower()
    payload = f"{clean_val}:{ANONYMIZATION_SALT}".encode("utf-8")
    hashed = hashlib.sha256(payload).hexdigest()[:16]
    return f"{prefix}_{hashed}"
