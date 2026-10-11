import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';

export interface ProductVariant {
  key?: string;
  color?: string;
  size?: string;
  sku?: string;
  price?: number;
  discountPrice?: number;
  stock?: number;
  status?: string;
}

@Component({
  selector: 'app-product-detail',
  standalone: false,
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit {
  productId: string | null = null;
  product: any = null;
  rawProduct: any = null;
  isLoading = true;
  isNotFound = false;
  errorMessage = '';

  // Active gallery image
  activeImage = '';

  breadcrumbs = [
    { label: 'Quản lý sản phẩm', url: '/admin/products' },
    { label: 'Chi tiết' }
  ];

  // Delete confirm dialog
  confirmOpen = false;
  confirmMessage = '';
  isDeleting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id');
    if (this.productId) {
      this.loadProduct(this.productId);
    } else {
      this.isNotFound = true;
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  loadProduct(id: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getProductById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && res.raw) {
          this.rawProduct = res.raw;
          this.product = res.data;
          this.activeImage = this.rawProduct.mainImage?.url || this.product.image || '';
          this.breadcrumbs = [
            { label: 'Quản lý sản phẩm', url: '/admin/products' },
            { label: this.rawProduct?.vi?.title || 'Chi tiết sản phẩm' }
          ];
        } else {
          this.isNotFound = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404) {
          this.isNotFound = true;
        } else {
          this.errorMessage = 'Có lỗi khi kết nối máy chủ MongoDB: ' + (err.error?.message || err.message || 'Lỗi không xác định');
        }
        this.cdr.markForCheck();
      }
    });
  }

  onRetry(): void {
    if (this.productId) {
      this.loadProduct(this.productId);
    }
  }

  isIterable(val: any): boolean {
    return Array.isArray(val);
  }

  formatPrice(val: any): string {
    if (val === undefined || val === null || val === '') return '0 ₫';
    return Number(val).toLocaleString('vi-VN') + ' ₫';
  }

  // =========================================================================
  // Mô tả sản phẩm (Mô tả ngắn & Mô tả chi tiết)
  // =========================================================================

  get descriptionText(): string {
    return this.rawProduct?.vi?.description || this.rawProduct?.description || this.product?.description || '';
  }

  get descriptionFullList(): string[] {
    const val = this.rawProduct?.vi?.descriptionFull !== undefined ? this.rawProduct.vi.descriptionFull : (this.rawProduct?.descriptionFull || this.product?.descriptionFull);
    if (!val) return [];
    if (Array.isArray(val)) {
      return val
        .map((item: any) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
        .filter((item: string) => item.length > 0);
    }
    if (typeof val === 'string') {
      return val
        .split('\n')
        .map((item: string) => item.trim())
        .filter((item: string) => item.length > 0);
    }
    return [];
  }

  // =========================================================================
  // Phân loại & Thuộc tính (Classifications, Colors, Sizes)
  // =========================================================================

  get hasClassification(): boolean {
    if (this.rawProduct?.vi?.hasClassification !== undefined) {
      return Boolean(this.rawProduct.vi.hasClassification);
    }
    return this.classificationsList.length > 0;
  }

  get classificationsList(): string[] {
    const raw = this.rawProduct?.vi?.classifications || this.rawProduct?.attributes?.classifications || this.product?.classifications || [];
    if (Array.isArray(raw)) {
      return raw.map((c: any) => String(c || '').trim()).filter((c: string) => c.length > 0);
    }
    return [];
  }

  get hasColors(): boolean {
    if (this.rawProduct?.vi?.hasColors !== undefined) {
      return Boolean(this.rawProduct.vi.hasColors);
    }
    return this.colorsList.length > 0;
  }

  get colorsList(): { name: string; hex?: string }[] {
    const raw = this.rawProduct?.vi?.colors || this.rawProduct?.attributes?.colors || this.rawProduct?.colors || this.product?.colors || [];
    if (!Array.isArray(raw)) return [];
    return raw.map((c: any) => {
      if (typeof c === 'string') {
        return { name: c.trim(), hex: '#2563eb' };
      }
      return {
        name: c.name ? String(c.name).trim() : 'Màu chuẩn',
        hex: c.hex ? String(c.hex).trim() : undefined
      };
    }).filter((c: any) => c.name.length > 0);
  }

  get hasSizes(): boolean {
    if (this.rawProduct?.vi?.hasSizes !== undefined) {
      return Boolean(this.rawProduct.vi.hasSizes);
    }
    return this.sizesList.length > 0;
  }

  get sizesList(): string[] {
    const raw = this.rawProduct?.vi?.sizes || this.rawProduct?.attributes?.sizes || this.rawProduct?.sizes || this.product?.sizes || [];
    if (Array.isArray(raw)) {
      return raw.map((s: any) => String(s || '').trim()).filter((s: string) => s.length > 0);
    }
    return [];
  }

  setActiveImage(url: string): void {
    if (url) this.activeImage = url;
  }

  onBack(): void {
    this.router.navigate(['/admin/products']);
  }

  onEdit(): void {
    if (this.productId) {
      this.router.navigate(['/admin/products', this.productId, 'edit']);
    }
  }

  onDelete(): void {
    const name = this.rawProduct?.vi?.title || this.product?.name || 'sản phẩm này';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa sản phẩm "${name}" khỏi cơ sở dữ liệu MongoDB không? Thao tác này không thể hoàn tác.`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (!this.productId) return;
    this.isDeleting = true;

    this.apiService.deleteProduct(this.productId).subscribe({
      next: () => {
        this.isDeleting = false;
        this.confirmOpen = false;
        this.router.navigate(['/admin/products']);
      },
      error: (err) => {
        this.isDeleting = false;
        this.confirmOpen = false;
        this.errorMessage = 'Lỗi xóa sản phẩm: ' + (err.error?.message || err.message);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelDelete(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  // =========================================================================
  // 1. ĐIỀU KIỆN HIỂN THỊ: CÓ BIẾN THỂ vs KHÔNG CÓ BIẾN THỂ
  // =========================================================================

  /**
   * Điều kiện hiển thị cốt lõi:
   * - Không có biến thể: Hiển thị khối "Giá & Tồn kho chung"
   * - Có biến thể: Ẩn khối "Giá & Tồn kho chung", hiển thị bảng "Giá & Tồn kho theo biến thể"
   */
  get hasVariants(): boolean {
    return Array.isArray(this.rawProduct?.variants) && this.rawProduct.variants.length > 0;
  }

  get variantsCount(): number {
    return this.hasVariants ? this.rawProduct.variants.length : 0;
  }

  get isSingleVariant(): boolean {
    return this.hasVariants && this.rawProduct.variants.length === 1;
  }

  get isMultipleVariants(): boolean {
    return this.hasVariants && this.rawProduct.variants.length > 1;
  }

  get singleVariant(): any {
    return this.isSingleVariant ? this.rawProduct.variants[0] : null;
  }

  // =========================================================================
  // 2. QUY TẮC GIÁ & TỒN KHO CHUNG (CHỈ ÁP DỤNG KHI SẢN PHẨM KHÔNG CÓ BIẾN THỂ)
  // Các trường: vi.regularPrice, vi.salePrice, vi.onSale, vi.quantity, vi.stock, vi.stockDate
  // =========================================================================

  /** Giá niêm yết (vi.regularPrice) - Bắt buộc, >= 0, giá cơ sở */
  get noVariantRegularPrice(): number {
    return Number(this.rawProduct?.vi?.regularPrice) || 0;
  }

  /** Giá khuyến mãi (vi.salePrice) - Không bắt buộc */
  get noVariantSalePrice(): number {
    return Number(this.rawProduct?.vi?.salePrice) || 0;
  }

  /** Checkbox "Đang giảm giá" (vi.onSale) */
  get isOnSale(): boolean {
    return Boolean(this.rawProduct?.vi?.onSale);
  }

  /**
   * Giá bán thực tế theo quan hệ 3 trường:
   * - onSale = false -> Giá bán thực tế = regularPrice (salePrice không được sử dụng)
   * - onSale = true -> Giá bán thực tế = salePrice (bắt buộc: salePrice < regularPrice)
   */
  get actualSellingPrice(): number {
    if (this.isOnSale && this.noVariantSalePrice > 0 && this.noVariantSalePrice < this.noVariantRegularPrice) {
      return this.noVariantSalePrice;
    }
    return this.noVariantRegularPrice;
  }

  /** Khuyến mãi hợp lệ: onSale = true VÀ 0 < salePrice < regularPrice */
  get isNoVariantOnSaleValid(): boolean {
    if (this.hasVariants) return false;
    return this.isOnSale && this.noVariantSalePrice > 0 && this.noVariantSalePrice < this.noVariantRegularPrice;
  }

  /** Vi phạm quy tắc: onSale = true nhưng salePrice >= regularPrice */
  get isSaleErrorGte(): boolean {
    if (this.hasVariants) return false;
    return this.isOnSale && this.noVariantSalePrice >= this.noVariantRegularPrice;
  }

  /** Vi phạm quy tắc: onSale = true nhưng salePrice <= 0 */
  get isSaleErrorZero(): boolean {
    if (this.hasVariants) return false;
    return this.isOnSale && this.noVariantSalePrice <= 0;
  }

  /** Phần trăm giảm giá */
  get noVariantDiscountPercent(): number {
    const reg = this.noVariantRegularPrice;
    const sale = this.noVariantSalePrice;
    if (reg > 0 && sale > 0 && sale < reg) {
      return Math.round(((reg - sale) / reg) * 100);
    }
    return 0;
  }

  /** Số lượng kho (vi.quantity) - Bắt buộc, >= 0 */
  get quantity(): number {
    return Number(this.rawProduct?.vi?.quantity) || 0;
  }

  /**
   * Tình trạng kho theo quy tắc:
   * quantity > 0 -> onStock (Còn hàng)
   * quantity = 0 -> unavailable (Hết hàng)
   */
  get resolvedStockStatus(): { code: string; label: string; isAvailable: boolean } {
    if (this.quantity > 0) {
      return { code: 'onStock', label: 'Còn hàng', isAvailable: true };
    }
    return { code: 'unavailable', label: 'Hết hàng', isAvailable: false };
  }

  /**
   * Kiểm tra mâu thuẫn dữ liệu kho giữa vi.quantity và vi.stock lưu trong DB:
   * - quantity = 0 nhưng vi.stock lại là onStock
   * - quantity > 0 nhưng vi.stock lại là unavailable/outOfStock
   */
  get isStockConflict(): boolean {
    if (this.hasVariants) return false;
    const dbStock = String(this.rawProduct?.vi?.stock || '').toLowerCase();
    const qty = this.quantity;
    if (qty === 0 && (dbStock === 'onstock' || !dbStock)) {
      return true;
    }
    if (qty > 0 && (dbStock === 'unavailable' || dbStock === 'outofstock')) {
      return true;
    }
    return false;
  }

  // =========================================================================
  // 3. QUY TẮC GIÁ & TỒN KHO THEO BIẾN THỂ (KHI CÓ BIẾN THỂ)
  // Tổng tồn kho = Σ stock của tất cả biến thể (quantity = Σ stock_i)
  // =========================================================================

  get totalVariantStock(): number {
    if (!this.hasVariants) return 0;
    return this.rawProduct.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
  }

  get effectiveTotalStock(): number {
    if (this.hasVariants) {
      return this.totalVariantStock;
    }
    return this.quantity;
  }

  /** Tóm tắt dải giá biến thể */
  get variantPriceSummary(): {
    minPrice: number;
    maxPrice: number;
    isUniformPrice: boolean;
    hasSale: boolean;
    minDiscountPrice: number;
    maxDiscountPrice: number;
    isUniformDiscountPrice: boolean;
    hasInvalidSale: boolean;
  } {
    if (!this.hasVariants) {
      return {
        minPrice: 0,
        maxPrice: 0,
        isUniformPrice: true,
        hasSale: false,
        minDiscountPrice: 0,
        maxDiscountPrice: 0,
        isUniformDiscountPrice: true,
        hasInvalidSale: false
      };
    }

    const variants = this.rawProduct.variants;
    const prices = variants.map((v: any) => Number(v.price) || 0);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    const validSaleVariants = variants.filter((v: any) => {
      const p = Number(v.price) || 0;
      const d = Number(v.discountPrice) || 0;
      return d > 0 && d < p;
    });

    const hasInvalidSale = variants.some((v: any) => {
      const p = Number(v.price) || 0;
      const d = Number(v.discountPrice) || 0;
      return d > 0 && d >= p;
    });

    const hasSale = validSaleVariants.length > 0;
    let minDiscountPrice = 0;
    let maxDiscountPrice = 0;
    if (hasSale) {
      const discountPrices = validSaleVariants.map((v: any) => Number(v.discountPrice));
      minDiscountPrice = Math.min(...discountPrices);
      maxDiscountPrice = Math.max(...discountPrices);
    }

    return {
      minPrice,
      maxPrice,
      isUniformPrice: minPrice === maxPrice,
      hasSale,
      minDiscountPrice,
      maxDiscountPrice,
      isUniformDiscountPrice: minDiscountPrice === maxDiscountPrice,
      hasInvalidSale
    };
  }

  isVariantSaleValid(v: any): boolean {
    const p = Number(v?.price) || 0;
    const d = Number(v?.discountPrice) || 0;
    return d > 0 && d < p;
  }

  isVariantSaleInvalid(v: any): boolean {
    const p = Number(v?.price) || 0;
    const d = Number(v?.discountPrice) || 0;
    return d > 0 && d >= p;
  }

  getVariantDiscountPercent(v: any): number {
    const p = Number(v?.price) || 0;
    const d = Number(v?.discountPrice) || 0;
    if (p > 0 && d > 0 && d < p) {
      return Math.round(((p - d) / p) * 100);
    }
    return 0;
  }

  getVariantStatus(v: any): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
    if (v.status !== undefined && v.status !== null && String(v.status).trim() !== '') {
      const st = String(v.status).trim();
      const lower = st.toLowerCase();
      if (lower === 'active' || lower === 'đang bán' || lower === 'hoạt động' || lower === 'onstock' || lower === 'còn hàng') {
        return { label: st, variant: 'success' };
      }
      if (lower === 'inactive' || lower === 'tạm ngừng' || lower === 'tạm dừng' || lower === 'tạm ẩn' || lower === 'khóa') {
        return { label: st, variant: 'warning' };
      }
      if (lower === 'unavailable' || lower === 'outofstock' || lower === 'hết hàng') {
        return { label: st, variant: 'danger' };
      }
      return { label: st, variant: 'neutral' };
    }

    const stock = Number(v.stock) || 0;
    if (stock > 0) {
      return { label: 'Còn hàng', variant: 'success' };
    }
    return { label: 'Hết hàng', variant: 'danger' };
  }
}
