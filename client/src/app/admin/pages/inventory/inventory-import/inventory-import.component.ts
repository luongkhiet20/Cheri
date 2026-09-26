import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

interface ProductOption {
  id: string;
  _id: string;
  name: string;
  sku: string;
  stock: number;
}

@Component({
  selector: 'app-inventory-import',
  standalone: false,
  templateUrl: './inventory-import.component.html',
  styleUrls: ['./inventory-import.component.css']
})
export class InventoryImportComponent implements OnInit {
  products: ProductOption[] = [];
  filteredProducts: ProductOption[] = [];
  selectedProductId: string = '';
  selectedProduct: ProductOption | null = null;

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
  successMessage = '';

  get previewStock(): number | null {
    if (!this.selectedProduct || this.importQuantity === null || isNaN(this.importQuantity) || this.importQuantity <= 0 || !Number.isInteger(Number(this.importQuantity))) {
      return null;
    }
    return this.currentStock + Number(this.importQuantity);
  }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.apiService.getProducts({ pageSize: 100 }).subscribe({
      next: (res) => {
        this.isLoadingProducts = false;
        if (res.success && res.data) {
          this.products = (res.data || []).map((p: any) => ({
            id: p.id || p._id,
            _id: p._id || p.id,
            name: p.name || 'Sản phẩm chưa đặt tên',
            sku: p.sku || ('SP-' + (p._id || p.id).slice(-6).toUpperCase()),
            stock: typeof p.stock === 'number' ? p.stock : 0
          }));
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

  onSearchProduct(query: string): void {
    this.productSearchQuery = query;
    if (!query || !query.trim()) {
      this.filteredProducts = [...this.products];
    } else {
      const q = query.toLowerCase().trim();
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    this.cdr.markForCheck();
  }

  selectProduct(prod: ProductOption): void {
    this.selectedProductId = prod.id || prod._id;
    this.isProductDropdownOpen = false;
    this.productSearchQuery = prod.name;
    delete this.errors['product'];

    // Call API getProductById to fetch latest actual stock from MongoDB
    this.isLoadingProductDetail = true;
    this.cdr.markForCheck();
    this.apiService.getProductById(this.selectedProductId).subscribe({
      next: (res) => {
        this.isLoadingProductDetail = false;
        if (res.success && res.data) {
          const p = res.data;
          this.selectedProduct = {
            id: p.id || p._id,
            _id: p._id || p.id,
            name: p.name || prod.name,
            sku: p.sku || prod.sku,
            stock: typeof p.stock === 'number' ? p.stock : 0
          };
          this.currentStock = this.selectedProduct.stock;
          this.sku = this.selectedProduct.sku;
        } else {
          this.selectedProduct = prod;
          this.currentStock = prod.stock;
          this.sku = prod.sku;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoadingProductDetail = false;
        console.error('Lỗi khi lấy chi tiết tồn kho sản phẩm:', err);
        this.selectedProduct = prod;
        this.currentStock = prod.stock;
        this.sku = prod.sku;
        this.cdr.markForCheck();
      }
    });
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

      // 1. Direct query by id, name, or field wrapper
      el = document.getElementById(key === 'product' ? 'product-select' : 'import-quantity')
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      // 2. Specific key targets
      if (!el && key === 'product') {
        el = document.querySelector<HTMLElement>('.product-picker-wrapper') || document.getElementById('product-select');
      }

      // 3. Fallback to first .is-invalid element
      if (!el) {
        el = document.querySelector<HTMLElement>('.is-invalid');
      }

      if (el) {
        // Expand any collapsed ancestor details or hidden containers
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

        // Smooth scroll to the target element, centered in viewport
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // If product error, open dropdown or focus input
        if (key === 'product') {
          this.isProductDropdownOpen = true;
          this.cdr.markForCheck();
        }

        // Find focusable interactive element
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
      this.errors['product'] = 'Vui lòng chọn sản phẩm cần nhập kho';
    }

    if (this.importQuantity === null || this.importQuantity === undefined || this.importQuantity === ('' as any)) {
      this.errors['quantity'] = 'Số lượng nhập không được để trống';
    } else {
      const num = Number(this.importQuantity);
      if (isNaN(num)) {
        this.errors['quantity'] = 'Số lượng nhập phải là số hợp lệ';
      } else if (!Number.isInteger(num)) {
        this.errors['quantity'] = 'Số lượng nhập phải là số nguyên (không được là số thập phân)';
      } else if (num <= 0) {
        this.errors['quantity'] = 'Số lượng nhập phải lớn hơn 0 (không cho phép số 0 hoặc số âm)';
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.validate()) {
      const orderedCandidates: string[] = ['product', 'quantity'];
      const firstKey = orderedCandidates.find(k => this.errors[k]) || Object.keys(this.errors)[0];
      if (firstKey) {
        this.scrollToFirstError(firstKey);
      }
      this.cdr.markForCheck();
      return;
    }

    const qty = Number(this.importQuantity);
    this.isSubmitting = true;

    // Send API PATCH /api/products/:id/inventory
    this.apiService.importInventory(this.selectedProductId, qty, this.note ? this.note.trim() : undefined).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          const finalStock = res.stock != null ? res.stock : (this.currentStock + qty);
          this.successMessage = res.message || `Đã nhập thêm ${qty} sản phẩm. Tồn kho hiện tại: ${finalStock}.`;
          this.cdr.markForCheck();
          setTimeout(() => {
            this.router.navigate(['/admin/inventory']);
          }, 900);
        } else {
          this.errorMessage = res.message || 'Không thể nhập kho. Vui lòng thử lại.';
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Lỗi khi gửi API nhập kho:', err);
        if (err.status === 404) {
          this.errorMessage = 'Không tìm thấy sản phẩm.';
        } else if (err.status === 400) {
          this.errorMessage = err.error?.message || 'Số lượng nhập không hợp lệ.';
        } else {
          this.errorMessage = err.error?.message || 'Không thể nhập kho. Vui lòng thử lại.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/admin/inventory']);
  }
}
