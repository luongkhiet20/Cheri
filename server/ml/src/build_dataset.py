"""
Dataset Construction Module for Cheri Machine Learning Pipeline.
Generates binary conversion labels over future observation windows and creates time-based train/test splits.
"""

from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone
import pandas as pd
from .config import FUTURE_WINDOW_DAYS
from .feature_engineering import build_user_product_feature_matrix


def generate_future_purchase_labels(
    candidate_features_df: pd.DataFrame,
    orders_df: pd.DataFrame,
    cutoff_time: datetime,
    window_days: int = FUTURE_WINDOW_DAYS,
) -> pd.DataFrame:
    """
    Labels each (user_key, product_id) pair based on verified purchase in future window [T, T + W].
    label = 1 if verified order exists for this product within [T, T + W].
    label = 0 otherwise.
    """
    if candidate_features_df.empty:
        labeled_df = candidate_features_df.copy()
        labeled_df["label"] = 0
        labeled_df["split"] = "train"
        return labeled_df

    labeled_df = candidate_features_df.copy()
    cutoff_ts = pd.to_datetime(cutoff_time, utc=True)
    window_end = cutoff_ts + timedelta(days=window_days)

    future_successful_orders = pd.DataFrame()
    if not orders_df.empty and "created_at" in orders_df.columns:
        orders_df["parsed_created_at"] = pd.to_datetime(orders_df["created_at"], utc=True, errors="coerce")
        future_successful_orders = orders_df[
            (orders_df["is_successful_conversion"] == True) &
            (orders_df["parsed_created_at"] >= cutoff_ts) &
            (orders_df["parsed_created_at"] <= window_end)
        ]

    labels = []
    for _, row in labeled_df.iterrows():
        u_key = row["user_key"]
        p_id = row["product_id"]

        converted = False
        if not future_successful_orders.empty:
            matches = future_successful_orders[
                (future_successful_orders["user_key"] == u_key) &
                (future_successful_orders["clean_product_id"] == p_id)
            ]
            if not matches.empty:
                converted = True

        labels.append(1 if converted else 0)

    labeled_df["label"] = labels
    return labeled_df


def assign_time_based_splits(
    dataset_df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
) -> pd.DataFrame:
    """
    Splits dataset chronologically based on cutoff_timestamp into Train, Validation, and Test sets.
    Prevents leakage by keeping future evaluations strictly downstream in time.
    """
    if dataset_df.empty or "cutoff_timestamp" not in dataset_df.columns:
        dataset_df["split"] = "train"
        return dataset_df

    df = dataset_df.copy()
    df = df.sort_values(by=["cutoff_timestamp"]).reset_index(drop=True)

    total_rows = len(df)
    train_end = int(total_rows * train_ratio)
    val_end = int(total_rows * (train_ratio + val_ratio))

    splits = []
    for i in range(total_rows):
        if i < train_end:
            splits.append("train")
        elif i < val_end:
            splits.append("val")
        else:
            splits.append("test")

    df["split"] = splits
    return df
