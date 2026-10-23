"""
Pipeline Orchestration and Export Module for Cheri Machine Learning Pipeline.
Extracts, validates, engineers features, generates reports, and writes UTF-8 CSV datasets.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
import pandas as pd
from pymongo.database import Database

from .config import (
    get_mongo_db,
    OUTPUT_DATA_DIR,
    OUTPUT_REPORT_DIR,
    FUTURE_WINDOW_DAYS,
)
from .extract_data import (
    extract_interactions,
    extract_products,
    extract_orders,
)
from .validate_data import (
    validate_and_clean_interactions,
    compile_data_quality_report,
)
from .feature_engineering import build_user_product_feature_matrix
from .build_dataset import (
    build_snapshot_dataset,
    assign_snapshot_time_splits,
    summarize_snapshot_dataset,
)

DATASET_COLUMNS = [
    "snapshot_id", "user_key", "product_id", "cutoff_timestamp", "label_window_end",
    "user_total_views", "user_distinct_products_viewed", "user_product_views", "user_category_views",
    "days_since_last_view", "user_total_orders_before", "user_previously_purchased",
    "product_price", "product_variant_count", "product_in_stock", "product_visibility",
    "product_category", "product_popularity_views", "label", "split",
]


def render_dataset_section(ds: Dict[str, Any], title: str) -> list:
    """Markdown lines describing a labeled snapshot dataset."""
    return [
        f"## {title}",
        "",
        f"- **Nguồn dữ liệu**: `{ds.get('data_source')}` | **Synthetic**: `{ds.get('is_synthetic')}`",
        f"- **Định nghĩa nhãn**: {ds.get('label_definition')}",
        f"- **Chính sách trạng thái sản phẩm**: {ds.get('product_state_policy')}",
        f"- **Khoảng thời gian sự kiện**: `{ds.get('events_time_range')}` | **Observation end**: `{ds.get('observation_end')}`",
        f"- **Snapshot ứng viên**: {ds.get('candidate_snapshots_total')} (bước {ds.get('snapshot_step_days')} ngày, lookback {ds.get('candidate_lookback_days')} ngày)",
        f"- **Snapshot bị loại vì chưa đủ {ds.get('window_days')} ngày theo dõi**: {ds.get('snapshots_excluded_insufficient_followup')} ({ds.get('rows_excluded_insufficient_followup')} cặp user-product)",
        f"- **Snapshot/mẫu bị purge do embargo giữa các split**: {ds.get('snapshots_purged_by_embargo')} / {ds.get('rows_purged_by_embargo')}",
        f"- **Snapshot trong dataset**: {ds.get('snapshots_in_dataset')} | **Khoảng T**: `{ds.get('snapshot_time_range')}`",
        f"- **Số mẫu**: {ds.get('rows')} | **Users**: {ds.get('distinct_users')} | **Products**: {ds.get('distinct_products')}",
        f"- **Phân bố nhãn**: `{ds.get('label_distribution')}` | **Tỷ lệ dương**: `{ds.get('positive_rate')}`",
        f"- **Phân bố theo split**: `{ds.get('split_distribution')}`",
        f"- **Snapshot sớm nhất có thể đủ follow-up**: `{ds.get('earliest_snapshot_with_full_followup_possible')}`",
        "",
    ]


def generate_markdown_report(report_dict: Dict[str, Any]) -> str:
    """Renders human-readable Markdown summary from quality metrics dictionary."""
    readiness = report_dict["readiness_summary"]
    im = report_dict["interaction_metrics"]
    pm = report_dict["product_metrics"]
    om = report_dict["order_metrics"]

    lines = [
        "# BÁO CÁO CHẤT LƯỢNG DỮ LIỆU MACHINE LEARNING — CHÉRI E-COMMERCE",
        "",
        f"> **Thời điểm tạo báo cáo**: `{report_dict['generated_at']}`  ",
        f"> **Môi trường Database**: MongoDB Atlas (`cheri`)  ",
        "",
        "## 1. TỔNG QUAN MỨC ĐỘ SẴN SÀNG CHO MACHINE LEARNING",
        "",
        f"- **Đủ điều kiện huấn luyện ngay**: `{'CÓ' if readiness['is_training_ready'] else 'CHƯA ĐỦ ĐIỀU KIỆN (Cần tích lũy thêm dữ liệu tương tác thực tế)'}`",
        f"- **Chiến lược khuyến nghị**: `{readiness['recommended_strategy']}`",
        f"- **Dữ liệu sản phẩm**: `{pm['total_products']} sản phẩm` (Sẵn sàng 100%)",
        f"- **Dữ liệu đơn hàng**: `{om['total_orders']} đơn hàng` (Có {om['successful_conversion_orders']} đơn chuyển đổi thành công)",
        f"- **Dữ liệu tương tác**: `{im['total_raw_records']} lượt tương tác trong collection user_interactions`",
        "",
        "---",
        "",
        "## 2. CHI TIẾT KHẢO SÁT TỪNG NGUỒN DỮ LIỆU",
        "",
        "### 2.1. Danh mục Sản phẩm (Collection `products`)",
        f"- **Tổng số sản phẩm**: {pm['total_products']}",
        f"- **Sản phẩm có giá bán hợp lệ (> 0)**: {pm['products_with_valid_price']}/{pm['total_products']}",
        f"- **Sản phẩm có danh mục/phân loại**: {pm['products_with_category']}/{pm['total_products']}",
        f"- **Sản phẩm đang hiển thị (visibility=true)**: {pm['visible_products']}/{pm['total_products']}",
        f"- **Sản phẩm còn hàng (in_stock=true)**: {pm['in_stock_products']}/{pm['total_products']}",
        "",
        "### 2.2. Lịch sử Đơn hàng (Collection `orders`)",
        f"- **Tổng số đơn hàng**: {om['total_orders']}",
        f"- **Đơn hàng thành công (Verified Conversion)**: {om['successful_conversion_orders']}",
        f"- **Tổng số dòng sản phẩm trong đơn**: {om['total_order_lines']}",
        f"- **Dòng sản phẩm liên kết chính xác với Catalog**: {om['linked_order_lines']}/{om['total_order_lines']}",
        f"- **Dòng sản phẩm không thể liên kết**: {om['unlinked_order_lines']}",
        "",
        "### 2.3. Lịch sử Tương tác (Collection `user_interactions`)",
        f"- **Tổng số document**: {im['total_raw_records']}",
        f"- **Sự kiện thực tế từ người dùng (Real Events)**: {im.get('real_records_count', 0)}",
        f"- **Sự kiện giả lập kiểm thử (Synthetic Events)**: {im.get('synthetic_records_count', 0)}",
        f"- **Bao gồm sự kiện giả lập trong dataset**: `{'CÓ' if im.get('included_synthetic_in_clean') else 'KHÔNG (Chỉ giữ sự kiện thực tế)'}`",
        f"- **Số lượt xem sản phẩm (VIEW)**: {im['total_views']}",
        f"- **Số người dùng đăng nhập định danh**: {im['distinct_registered_users']}",
        f"- **Số phiên khách vãng lai định danh**: {im['distinct_guest_sessions']}",
        f"- **Lượt tương tác chứa Compound ID**: {im['compound_id_count']}",
        f"- **Lượt tương tác liên kết thành công với sản phẩm**: {im['linked_product_count']}",
        f"- **Lượt tương tác không tìm thấy sản phẩm**: {im['unlinked_product_count']}",
        f"- **Bản ghi thiếu hoặc sai timestamp**: {im['null_timestamp_count']}",
        f"- **Lặp kỹ thuật được lọc (< 2 giây)**: {im['technical_duplicate_count']}",
        f"- **Khoảng thời gian dữ liệu**: Từ `{im['time_range_start'] or 'N/A'}` đến `{im['time_range_end'] or 'N/A'}`",
        "",
        "---",
        "",
        "## 3. CƠ CHẾ BẢO MẬT VÀ PHÒNG CHỐNG RÒ RỈ DỮ LIỆU",
        "",
        "- **Bảo vệ PII (Thông tin cá nhân)**: Toàn bộ email, số điện thoại, họ tên và địa chỉ của khách hàng KHÔNG ĐƯỢC XUẤT ra file dataset. Định danh được chuyển đổi thành mã giả danh an toàn (`usr_...` hoặc `gst_...`) bằng SHA-256 có Salt.",
        "- **Chống rò rỉ dữ liệu (No Data Leakage)**: Mọi đặc trưng của cặp User-Product tại thời điểm $T$ chỉ được tính từ các sự kiện trước $T$. Nhãn chuyển đổi mua hàng được quan sát độc lập trong cửa sổ tương lai $[T, T + 14\\text{ ngày}]$.",
        "- **Chia tập dữ liệu (Time-based Split)**: Hỗ trợ phân chia Train / Validation / Test theo dòng thời gian thay vì chia ngẫu nhiên.",
        "",
        "---",
        "",
        *render_dataset_section(report_dict.get("purchase_dataset", {}), "3b. DATASET DỰ ĐOÁN MUA HÀNG 14 NGÀY (SNAPSHOT)"),
        "---",
        "",
        "## 4. KẾT LUẬN VÀ BƯỚC TIẾP THEO",
        "",
        "1. Pipeline chuẩn bị dữ liệu đã được hoàn thiện 100% và sẵn sàng hoạt động tự động.",
        f"2. Hiện có {im.get('real_records_count', 0)} sự kiện thực tế và {im.get('synthetic_records_count', 0)} sự kiện giả lập kiểm thử.",
        "3. **Hành động tiếp theo**: Kích hoạt bộ thu thập sự kiện tương tác (`user_interactions`) trên frontend Angular để ghi nhận lượt xem thực tế của người dùng trước khi tiến hành huấn luyện mô hình Random Forest và XGBoost.",
    ]

    return "\n".join(lines)


def run_pipeline(
    db: Optional[Database] = None,
    data_dir: Optional[Path] = None,
    report_dir: Optional[Path] = None,
    export_files: bool = True,
    include_synthetic: bool = False,
) -> Dict[str, Any]:
    """
    Main entry point for the Machine Learning Data Preparation Pipeline.
    """
    out_data = data_dir or OUTPUT_DATA_DIR
    out_report = report_dir or OUTPUT_REPORT_DIR
    out_data.mkdir(parents=True, exist_ok=True)
    out_report.mkdir(parents=True, exist_ok=True)

    if db is None:
        db = get_mongo_db()

    # Step 1: Extraction
    raw_interactions_df = extract_interactions(db)
    products_df = extract_products(db)
    orders_df = extract_orders(db)

    # Step 2: Validation and Cleaning
    valid_p_ids = set(products_df["product_id"].unique()) if not products_df.empty else set()
    clean_interactions_df, quality_metrics = validate_and_clean_interactions(
        raw_interactions_df,
        valid_product_ids=valid_p_ids,
        include_synthetic=include_synthetic,
    )

    # Step 3: Reporting
    report = compile_data_quality_report(quality_metrics, products_df, orders_df)

    # Step 4: Snapshot dataset. Old behaviour used ONE cutoff = latest interaction, so the
    # 14-day future window was never observed and every row became label=0. Now we build
    # historical snapshots and keep only those whose [T, T+14d] window is fully observed.
    observation_end = datetime.now(timezone.utc)  # orders are known up to extraction time
    labeled_df, build_stats = build_snapshot_dataset(
        clean_interactions_df=clean_interactions_df,
        orders_df=orders_df,
        products_df=products_df,
        observation_end=observation_end,
        window_days=FUTURE_WINDOW_DAYS,
        target="purchase",
    )
    user_product_dataset, split_info = assign_snapshot_time_splits(labeled_df)
    report["purchase_dataset"] = summarize_snapshot_dataset(
        user_product_dataset, build_stats, split_info,
        data_source="user_interactions + orders" + (" (+ synthetic user_interactions)" if include_synthetic else ""),
        is_synthetic=include_synthetic,
    )
    label_classes = len(report["purchase_dataset"]["label_distribution"])
    report["readiness_summary"]["is_training_ready"] = bool(
        report["readiness_summary"]["is_training_ready"] and label_classes >= 2 and not include_synthetic
    )

    # Step 5: Export Artifacts
    if export_files:
        # 1. Product features catalog
        products_file = out_data / "products_features.csv"
        products_df.to_csv(products_file, index=False, encoding="utf-8")

        # 2. Clean interactions
        interactions_file = out_data / "interactions_clean.csv"
        clean_interactions_df.to_csv(interactions_file, index=False, encoding="utf-8")

        # 3. User-Product Dataset (always write to reflect current state).
        # Synthetic-contaminated runs never overwrite the production dataset file.
        dataset_name = "user_product_dataset.with_synthetic.csv" if include_synthetic else "user_product_dataset.csv"
        dataset_file = out_data / dataset_name
        if not user_product_dataset.empty:
            user_product_dataset.to_csv(dataset_file, index=False, encoding="utf-8")
        else:
            pd.DataFrame(columns=DATASET_COLUMNS).to_csv(dataset_file, index=False, encoding="utf-8")


        # 4. JSON Quality Report
        report_json_file = out_report / "data_quality_report.json"
        with open(report_json_file, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # 5. Markdown Quality Report
        report_md_file = out_report / "data_quality_report.md"
        with open(report_md_file, "w", encoding="utf-8") as f:
            f.write(generate_markdown_report(report))

    return {
        "report": report,
        "products_count": len(products_df),
        "interactions_count": len(clean_interactions_df),
        "orders_count": len(orders_df["order_id"].unique()) if not orders_df.empty else 0,
        "dataset_rows": len(user_product_dataset),
    }
