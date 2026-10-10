import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

export interface ProductVariantItem {
  id: string;
  _id?: string;
  sku: string;
  color?: string;
  size?: string;
  classification?: string;
  stock: number;
}

export interface ProductOption {
  id: string;
  _id: string;
  name: string;
  sku: string;
  stock: number;
  hasVariants: boolean;
  variants: ProductVariantItem[];
}

@Component({
  selector: 'app-inventory-import',
  standalone: false,
  templateUrl: './inventory-import.component.html',
  styleUrls: ['./inventory-import.component.css']
})
export class InventoryImportComponent implements OnInit {
  isEditMode: boolean = false;

  products: ProductOption[] = [];
  filteredProducts: ProductOption[] = [];
  selectedProductId: string = '';
  selectedProduct: ProductOption | null = null;

  hasVariants: boolean = false;
  selectedVariantId: string = '';
  selectedVariant: ProductVariantItem | null = null;

  currentStock: number = 0;
  sku: string = '';
  importQuantity: number | null = null;
  note: string = '';

  productSearchQuery: string = '';
  isProductDropdownOpen = false;

  isLoadingProducts = false;
  isLoadingProductDetail = false;
  isSubmitting = false;

  errors: Record<string, string> = {};
  errorMessage = '';

  get previewStock(): number | null {
    if (this.importQuantity === null || isNaN(this.importQuantity) || !Number.isInteger(Number(this.importQuantity))) {
      return null;
    }
    if (this.isEditMode) {
      if (this.importQuantity < 0) return null;
      if (this.hasVariants && !this.selectedVariant) return null;
      if (!this.selectedProduct) return null;
      return Number(this.importQuantity);
    } else {
      if (this.importQuantity <= 0) return null;
      if (this.hasVariants && !this.selectedVariant) return null;
      if (!this.selectedProduct) return null;
      return this.currentStock + Number(this.importQuantity);
    }
  }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.isEditMode = true;
        this.selectedProductId = id;
        this.fetchAndSelectProduct(id);
      }
    });

    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.apiService.getProducts({ pageSize: 100 }).subscribe({
      next: (res) => {
        this.isLoadingProducts = false;
        if (res.success && res.data) {
          this.products = (res.data || []).map((p: any) => {
            const rawVariants = Array.isArray(p.variants) ? p.variants : (Array.isArray(p.raw?.variants) ? p.raw.variants : []);
            const hasVariants = rawVariants.length > 0;
            const mappedVariants: ProductVariantItem[] = rawVariants.map((v: any, idx: number) => ({
              id: v.id || v._id || v.sku || String(idx),
              _id: v._id || v.id,
              sku: (v.sku || '').trim(),
              color: v.color || '',
              size: v.size || '',
              classification: v.classification || '',
              stock: Math.max(0, Number(v.stock) || 0)
            }));

            const totalStock = hasVariants
              ? mappedVariants.reduce((sum, v) => sum + v.stock, 0)
              : Math.max(0, Number(p.stock !== undefined ? p.stock : (p.raw?.vi?.stock ?? (p.quantity ?? 0))));

            return {
              id: p.id || p._id,
              _id: p._id || p.id,
              name: p.name || p.title || 'Sản phẩm chưa đặt tên',
              sku: (p.sku || p.raw?.sku || p.raw?.vi?.sku || '').trim(),
              stock: totalStock,
              hasVariants,
              variants: mappedVariants
            };
          });
          this.filteredProducts = [...this.products];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingProducts = false;
        console.error('Lỗi khi tải danh sách sản phẩm:', err);
        this.errorMessage = 'Không thể tải danh sách sản phẩm từ hệ thống.';
        this.cdr.markForCheck();
      }
    });
  }

  fetchAndSelectProduct(id: string): void {
    this.isLoadingProductDetail = true;
    this.cdr.markForCheck();

    this.apiService.getProductById(id).subscribe({
      next: (res) => {
        this.isLoadingProductDetail = false;
        const p = res.data || res.raw || res;
        if (!p) {
          this.errorMessage = 'Không tìm thấy thông tin sản phẩm trong cơ sở dữ liệu.';
          this.cdr.markForCheck();
          return;
        }

        const rawVariants = Array.isArray(p.variants) ? p.variants : (Array.isArray(p.raw?.variants) ? p.raw.variants : []);
        const hasVariants = rawVariants && rawVariants.length > 0;

        const mappedVariants: ProductVariantItem[] = (rawVariants || []).map((v: any, idx: number) => ({
          id: v.id || v._id || v.sku || String(idx),
          _id: v._id || v.id,
          sku: (v.sku || '').trim(),
          color: v.color || '',
          size: v.size || '',
          classification: v.classification || '',
          stock: Math.max(0, Number(v.stock) || 0)
        }));

        this.hasVariants = hasVariants;
        this.selectedProduct = {
          id: p.id || p._id || id,
          _id: p._id || p.id || id,
          name: p.name || p.title || p.vi?.title || 'Sản phẩm',
          sku: (p.sku || p.vi?.sku || '').trim(),
          stock: hasVariants
            ? mappedVariants.reduce((sum, v) => sum + v.stock, 0)
            : Math.max(0, Number(p.stock !== undefined ? p.stock : (p.vi?.stock ?? (p.quantity ?? 0)))),
          hasVariants,
          variants: mappedVariants
        };

        this.productSearchQuery = this.selectedProduct.name;

        if (!hasVariants) {
          this.sku = this.selectedProduct.sku;
          this.currentStock = this.selectedProduct.stock;
          if (this.isEditMode) {
            this.importQuantity = this.selectedProduct.stock;
          }
        } else {
          // If query param specifies a variant, auto-select it
          const queryVariantSku = this.route.snapshot.queryParamMap.get('sku');
          const queryVariantId = this.route.snapshot.queryParamMap.get('variantId');
          const targetVariant = mappedVariants.find(
            v => (queryVariantSku && v.sku === queryVariantSku) || (queryVariantId && (v.id === queryVariantId || v._id === queryVariantId))
          ) || mappedVariants[0];

          if (targetVariant) {
            this.onSelectVariant(targetVariant.sku || targetVariant.id);
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingProductDetail = false;
        console.error('Lỗi khi tải chi tiết sản phẩm để sửa:', err);
        this.errorMessage = 'Không thể tải dữ liệu chi tiết sản phẩm từ máy chủ.';
        this.cdr.markForCheck();
      }
    });
  }

  onSearchProduct(query: string): void {
    if (this.isEditMode) return; // In edit mode, product is locked
    this.productSearchQuery = query;
    if (!query || !query.trim()) {
      this.filteredProducts = [...this.products];
    } else {
      const q = query.toLowerCase().trim();
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.variants.some(v => v.sku.toLowerCase().includes(q))
      );
    }
    this.cdr.markForCheck();
  }

  selectProduct(prod: ProductOption): void {
    if (this.isEditMode) return; // In edit mode, product is locked
    this.selectedProductId = prod.id || prod._id;
    this.isProductDropdownOpen = false;
    this.productSearchQuery = prod.name;
    this.selectedVariantId = '';
    this.selectedVariant = null;
    this.sku = '';
    this.currentStock = 0;
    this.importQuantity = null;
    delete this.errors['product'];
    delete this.errors['variant'];

    this.isLoadingProductDetail = true;
    this.cdr.markForCheck();
    this.apiService.getProductById(this.selectedProductId).subscribe({
      next: (res) => {
        this.isLoadingProductDetail = false;
        const p = res.data || res.raw || prod;
        const rawVariants = Array.isArray(p.variants) ? p.variants : (Array.isArray(res.raw?.variants) ? res.raw.variants : prod.variants);
        const hasVariants = rawVariants && rawVariants.length > 0;

        const mappedVariants: ProductVariantItem[] = (rawVariants || []).map((v: any, idx: number) => ({
          id: v.id || v._id || v.sku || String(idx),
          _id: v._id || v.id,
          sku: (v.sku || '').trim(),
          color: v.color || '',
          size: v.size || '',
          classification: v.classification || '',
          stock: Math.max(0, Number(v.stock) || 0)
        }));

        this.hasVariants = hasVariants;
        this.selectedProduct = {
          id: p.id || p._id || prod.id,
          _id: p._id || p.id || prod._id,
          name: p.name || p.title || prod.name,
          sku: (p.sku || p.vi?.sku || prod.sku || '').trim(),
          stock: hasVariants
            ? mappedVariants.reduce((sum, v) => sum + v.stock, 0)
            : Math.max(0, Number(p.stock !== undefined ? p.stock : (p.vi?.stock ?? (p.quantity ?? prod.stock)))),
          hasVariants,
          variants: mappedVariants
        };

        if (!hasVariants) {
          this.sku = this.selectedProduct.sku;
          this.currentStock = this.selectedProduct.stock;
        } else {
          this.sku = '';
          this.currentStock = 0;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingProductDetail = false;
        console.error('Lỗi khi lấy chi tiết tồn kho sản phẩm:', err);
        this.selectedProduct = prod;
        this.hasVariants = prod.hasVariants;
        if (!prod.hasVariants) {
          this.sku = prod.sku;
          this.currentStock = prod.stock;
        }
        this.cdr.markForCheck();
      }
    });
  }

  onSelectVariant(targetVal: string): void {
    this.selectedVariantId = targetVal;
    this.clearFieldError('variant');

    if (!this.selectedProduct || !this.selectedProduct.variants) {
      return;
    }

    const found = this.selectedProduct.variants.find(
      v => (v.sku && v.sku === targetVal) || (v.id && v.id === targetVal) || (v._id && v._id === targetVal)
    );

    if (found) {
      this.selectedVariant = found;
      this.sku = found.sku;
      this.currentStock = found.stock;
      if (this.isEditMode) {
        this.importQuantity = found.stock;
      }
    } else {
      this.selectedVariant = null;
      this.sku = '';
      this.currentStock = 0;
      if (this.isEditMode) {
        this.importQuantity = null;
      }
    }
    this.cdr.markForCheck();
  }

  getVariantLabel(v: ProductVariantItem): string {
    const parts = [v.color, v.size, v.classification].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Biến thể mặc định';
  }

  onQuantityChange(): void {
    this.clearFieldError('quantity');
  }

  clearFieldError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
      if (Object.keys(this.errors).length === 0) {
        this.errorMessage = '';
      }
      this.cdr.markForCheck();
    }
  }

  scrollToFirstError(key: string): void {
    setTimeout(() => {
      let el: HTMLElement | null = null;

      el = document.getElementById(key === 'product' ? 'product-select' : (key === 'variant' ? 'variant-select' : 'import-quantity'))
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      if (!el && key === 'product') {
        el = document.querySelector<HTMLElement>('.product-picker-wrapper') || document.getElementById('product-select');
      }

      if (!el) {
        el = document.querySelector<HTMLElement>('.is-invalid');
      }

      if (el) {
        let parent: HTMLElement | null = el.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
            (parent as HTMLDetailsElement).open = true;
          }
          if (parent.hidden) {
            parent.hidden = false;
          }
          parent = parent.parentElement;
        }

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        if (key === 'product' && !this.isEditMode) {
          this.isProductDropdownOpen = true;
          this.cdr.markForCheck();
        }

        let focusTarget: HTMLElement | null = null;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          focusTarget = el;
        } else {
          focusTarget = el.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button');
        }

        if (focusTarget && typeof focusTarget.focus === 'function') {
          setTimeout(() => {
            focusTarget?.focus({ preventScroll: true });
          }, 200);
        }
      }
    }, 50);
  }

  validate(): boolean {
    this.errors = {};

    if (!this.selectedProductId || !this.selectedProduct) {
      this.errors['product'] = 'Vui lòng chọn sản phẩm cần xử lý tồn kho';
    }

    if (this.hasVariants && (!this.selectedVariant || !this.selectedVariantId)) {
      this.errors['variant'] = 'Sản phẩm có biến thể, bắt buộc chọn một biến thể cụ thể';
    }

    if (this.importQuantity === null || this.importQuantity === undefined || this.importQuantity === ('' as any)) {
      this.errors['quantity'] = this.isEditMode ? 'Số lượng tồn kho không được để trống' : 'Số lượng nhập không được để trống';
    } else {
      const num = Number(this.importQuantity);
      if (isNaN(num)) {
        this.errors['quantity'] = 'Số lượng phải là số hợp lệ';
      } else if (!Number.isInteger(num)) {
        this.errors['quantity'] = 'Số lượng phải là số nguyên (không được là số thập phân)';
      } else if (this.isEditMode && num < 0) {
        this.errors['quantity'] = 'Số lượng tồn kho không được là số âm (cho phép từ 0 trở lên)';
      } else if (!this.isEditMode && num <= 0) {
        this.errors['quantity'] = 'Số lượng nhập phải lớn hơn 0 (không cho phép số 0 hoặc số âm)';
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.validate()) {
      const orderedCandidates: string[] = ['product', 'variant', 'quantity'];
      const firstKey = orderedCandidates.find(k => this.errors[k]) || Object.keys(this.errors)[0];
      if (firstKey) {
        this.scrollToFirstError(firstKey);
      }
      this.cdr.markForCheck();
      return;
    }

    const qty = Number(this.importQuantity);
    this.isSubmitting = true;

    const variantId = this.hasVariants ? (this.selectedVariant?.id || this.selectedVariantId) : undefined;
    const variantSku = this.hasVariants ? this.selectedVariant?.sku : undefined;

    this.apiService.importInventory(
      this.selectedProductId,
      qty,
      this.note ? this.note.trim() : undefined,
      variantId,
      variantSku,
      this.isEditMode
    ).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          const finalStock = res.stock != null ? res.stock : (this.isEditMode ? qty : (this.currentStock + qty));
          const targetName = this.hasVariants
            ? `biến thể SKU ${this.selectedVariant?.sku || ''}`
            : `sản phẩm ${this.selectedProduct?.name}`;

          const msg = res.message || (
            this.isEditMode
              ? `Đã cập nhật tồn kho ${targetName} thành công. Tồn kho mới: ${finalStock}.`
              : `Đã nhập thêm ${qty} vào ${targetName}. Tồn kho hiện tại: ${finalStock}.`
          );
          this.notificationService.success(msg);
          this.cdr.markForCheck();
          setTimeout(() => {
            this.router.navigate(['/admin/inventory']);
          }, 900);
        } else {
          this.errorMessage = res.message || 'Không thể lưu thay đổi tồn kho. Vui lòng thử lại.';
          this.notificationService.error(this.errorMessage);
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Lỗi khi gửi API cập nhật tồn kho:', err);
        if (err.status === 404) {
          this.errorMessage = err.error?.message || 'Không tìm thấy sản phẩm hoặc biến thể.';
        } else if (err.status === 400) {
          this.errorMessage = err.error?.message || 'Thông tin tồn kho không hợp lệ.';
        } else {
          this.errorMessage = err.error?.message || 'Không thể lưu tồn kho. Vui lòng thử lại.';
        }
        this.notificationService.error(this.errorMessage);
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/admin/inventory']);
  }
}
