"""
Pipeline Orchestration and Export Module for Cheri Machine Learning Pipeline.
Extracts, validates, engineers features, generates reports, and writes UTF-8 CSV datasets.
"""

import json
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
    generate_future_purchase_labels,
    assign_time_based_splits,
)


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

    # Step 4: Feature Engineering and Dataset Construction (if interactions exist)
    if not clean_interactions_df.empty:
        feature_matrix = build_user_product_feature_matrix(
            clean_interactions_df=clean_interactions_df,
            orders_df=orders_df,
            products_df=products_df,
        )
        cutoff_now = clean_interactions_df["event_timestamp"].max()
        labeled_df = generate_future_purchase_labels(
            candidate_features_df=feature_matrix,
            orders_df=orders_df,
            cutoff_time=cutoff_now,
            window_days=FUTURE_WINDOW_DAYS,
        )
        user_product_dataset = assign_time_based_splits(labeled_df)
    else:
        user_product_dataset = pd.DataFrame()

    # Step 5: Export Artifacts
    if export_files:
        # 1. Product features catalog
        products_file = out_data / "products_features.csv"
        products_df.to_csv(products_file, index=False, encoding="utf-8")

        # 2. Clean interactions
        interactions_file = out_data / "interactions_clean.csv"
        clean_interactions_df.to_csv(interactions_file, index=False, encoding="utf-8")

        # 3. User-Product Dataset (always write to reflect current state)
        dataset_file = out_data / "user_product_dataset.csv"
        if not user_product_dataset.empty:
            user_product_dataset.to_csv(dataset_file, index=False, encoding="utf-8")
        else:
            empty_cols = [
                "user_key", "product_id", "cutoff_timestamp",
                "user_total_views", "user_distinct_products_viewed", "user_product_views", "user_category_views",
                "days_since_last_view", "user_total_orders_before", "user_previously_purchased",
                "product_price", "product_variant_count", "product_in_stock", "product_visibility",
                "product_category", "product_popularity_views", "label", "split"
            ]
            pd.DataFrame(columns=empty_cols).to_csv(dataset_file, index=False, encoding="utf-8")


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
