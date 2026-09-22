import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectorRef, Optional } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Product } from '../../shared/models';
import { ApiService } from '../../services/api.service';
import { TranslateService } from '../../services/translate.service';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';

@Component({
  selector: 'app-all-products',
  templateUrl: './all-products.component.html',
  styleUrls: ['./all-products.component.css'],
  standalone: false
})
export class AllProductsComponent implements OnInit, OnChanges {
  @Input() allProducts: Product[] = [];
  @Input() lang: string = 'vi';
  @Input() currency: string = 'đ';
  @Input() loading: boolean = false;
  @Input() hasError: boolean = false;

  @Output() getAllProducts = new EventEmitter<void>();
  @Output() editProduct = new EventEmitter<string>();
  @Output() deleteProduct = new EventEmitter<string>();

  refreshRotation: number = 0;
  isRefreshing: boolean = false;
  isLoading: boolean = false;
  loadError: boolean = false;

  get effectiveLoading(): boolean {
    return this.loading || this.isLoading || this.isRefreshing;
  }

  get effectiveError(): boolean {
    return this.hasError || this.loadError;
  }

  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'table';
  filteredProducts: Product[] = [];

  // Checkbox selection state
  selectedProductKeys: Set<string> = new Set<string>();
  isDeleting: boolean = false;
  deletingProductKey: string | null = null;
  togglingProductKey: string | null = null;

  // Filter state
  isFilterOpen: boolean = false;
  filterVisibility: 'all' | 'visible' | 'hidden' = 'all';
  filterSale: 'all' | 'sale' | 'regular' = 'all';
  filterStock: 'all' | 'inStock' | 'outOfStock' = 'all';
  sortBy: 'default' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' = 'default';

  // View Product Modal state
  isViewModalOpen: boolean = false;
  viewingProduct: Product | null = null;
  viewRawJson: boolean = false;
  copySuccess: boolean = false;

  constructor(
    private apiService: ApiService,
    @Optional() private snackBar?: MatSnackBar,
    @Optional() private translate?: TranslateService,
    @Optional() private router?: Router,
    @Optional() private selectors?: SignalStoreSelectors,
    @Optional() private cdr?: ChangeDetectorRef
  ) {}

  showToast(message: string, isError: boolean = false): void {
    if (this.snackBar) {
      this.snackBar.open(message, 'Đóng', {
        duration: isError ? 4000 : 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
      });
    }
  }

  openViewModal(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.viewingProduct = product;
    this.viewRawJson = false;
    this.copySuccess = false;
    this.isViewModalOpen = true;
  }

  closeViewModal(): void {
    this.isViewModalOpen = false;
    this.viewingProduct = null;
    this.viewRawJson = false;
    this.copySuccess = false;
  }

  copyProductJson(): void {
    if (!this.viewingProduct) return;
    const jsonStr = JSON.stringify(this.viewingProduct, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.copySuccess = true;
        this.showToast('Đã sao chép dữ liệu JSON vào clipboard!');
        this.cdr?.detectChanges();
        setTimeout(() => {
          this.copySuccess = false;
          this.cdr?.detectChanges();
        }, 2500);
      }).catch((err) => {
        console.error('Không thể sao chép JSON:', err);
        this.showToast('Không thể sao chép JSON vào clipboard!', true);
      });
    }
  }

  getProductDesc(product: any): string {
    if (!product) return '';
    return product[this.lang]?.description || product['vi']?.description || product.description || '';
  }

  getProductCategory(product: any): string {
    if (!product) return '—';
    if (typeof product.category === 'object' && product.category?.name) return product.category.name;
    return product.category || '—';
  }

  getProductSizes(product: any): string[] {
    if (!product) return [];
    return product[this.lang]?.sizes || product['vi']?.sizes || product.sizes || [];
  }

  formatDate(val: any): string {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return String(val);
    }
  }

  ngOnInit(): void {
    if (this.translate && this.translate.lang) {
      this.lang = this.translate.lang;
    }
    if (this.selectors && this.selectors.currency) {
      this.currency = this.selectors.currency() || 'đ';
    }

    if (!this.allProducts || this.allProducts.length === 0) {
      this.loadProducts();
    } else {
      this.filterProducts();
    }
  }

  loadProducts(isManual: boolean = false): void {
    this.isLoading = true;
    this.loadError = false;
    if (isManual) {
      this.isRefreshing = true;
    }

    this.apiService.getAllProducts().subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.isRefreshing = false;
        if (response && !response.error && Array.isArray(response)) {
          this.allProducts = response;
        } else if (response && Array.isArray(response.products)) {
          this.allProducts = response.products;
        } else {
          this.allProducts = [];
        }
        this.filterProducts();
        if (isManual) {
          this.showToast('Đã làm mới danh sách sản phẩm thành công!');
        }
        this.cdr?.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi tải danh sách sản phẩm:', err);
        this.isLoading = false;
        this.isRefreshing = false;
        this.loadError = true;
        if (isManual) {
          this.showToast('Không thể làm mới danh sách sản phẩm. Vui lòng thử lại!', true);
        }
        this.cdr?.detectChanges();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allProducts']) {
      if (this.allProducts && Array.isArray(this.allProducts)) {
        this.isLoading = false;
        this.loadError = false;
      }
      // Clean up selected keys that no longer exist
      if (this.allProducts) {
        const currentKeys = new Set(this.allProducts.map(p => this.getProductKey(p)));
        for (const k of Array.from(this.selectedProductKeys)) {
          if (!currentKeys.has(k)) {
            this.selectedProductKeys.delete(k);
          }
        }
      }
      this.filterProducts();
    }
    if (changes['loading']) {
      if (!this.loading) {
        this.isLoading = false;
      }
    }
    if (changes['hasError']) {
      if (this.hasError) {
        this.isLoading = false;
      }
    }
  }

  onSearchChange(): void {
    this.filterProducts();
  }

  onSearchEnter(): void {
    this.filterProducts();
    this.loadProducts(true);
  }

  removeVietnameseTones(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .trim();
  }

  getProductKey(product: Product): string {
    return (product.titleUrl || product.id || product._id || '').toString();
  }

  // --- Checkbox Selection Methods ---
  isSelected(product: Product): boolean {
    const key = this.getProductKey(product);
    return !!key && this.selectedProductKeys.has(key);
  }

  toggleSelect(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const key = this.getProductKey(product);
    if (!key) return;
    if (this.selectedProductKeys.has(key)) {
      this.selectedProductKeys.delete(key);
    } else {
      this.selectedProductKeys.add(key);
    }
  }

  isAllSelected(): boolean {
    if (!this.filteredProducts || this.filteredProducts.length === 0) return false;
    return this.filteredProducts.every(p => this.isSelected(p));
  }

  isPartiallySelected(): boolean {
    const count = this.selectedProductKeys.size;
    return count > 0 && !this.isAllSelected();
  }

  toggleSelectAll(event: any): void {
    const checked = event && event.target ? event.target.checked : !this.isAllSelected();
    if (checked) {
      this.filteredProducts.forEach(p => {
        const key = this.getProductKey(p);
        if (key) this.selectedProductKeys.add(key);
      });
    } else {
      this.filteredProducts.forEach(p => {
        const key = this.getProductKey(p);
        if (key) this.selectedProductKeys.delete(key);
      });
    }
  }

  // --- Filter Methods ---
  toggleFilterMenu(): void {
    this.isFilterOpen = !this.isFilterOpen;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterVisibility !== 'all') count++;
    if (this.filterSale !== 'all') count++;
    if (this.filterStock !== 'all') count++;
    if (this.sortBy !== 'default') count++;
    return count;
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  resetFilters(): void {
    this.filterVisibility = 'all';
    this.filterSale = 'all';
    this.filterStock = 'all';
    this.sortBy = 'default';
    this.filterProducts();
  }

  onFilterChange(): void {
    this.filterProducts();
  }

  filterProducts(): void {
    let list = [...(this.allProducts || [])];

    // 1. Text search
    if (this.searchQuery && this.searchQuery.trim()) {
      const rawQ = this.searchQuery.trim().toLowerCase();
      const normQ = this.removeVietnameseTones(rawQ);
      const terms = normQ.split(/\s+/).filter(t => t.length > 0);

      list = list.filter((p) => {
        const title = (p.title || p[this.lang]?.title || p['vi']?.title || '').toLowerCase();
        const normTitle = this.removeVietnameseTones(title);

        const titleUrl = (p.titleUrl || '').toLowerCase();
        const idStr = (p.id || p._id || '').toString().toLowerCase();

        const category = this.getProductCategory(p).toLowerCase();
        const normCategory = this.removeVietnameseTones(category);

        const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
        const normTags = this.removeVietnameseTones(tags);

        const desc = this.getProductDesc(p).toLowerCase();
        const normDesc = this.removeVietnameseTones(desc);

        const matchesField =
          title.includes(rawQ) || normTitle.includes(normQ) ||
          titleUrl.includes(rawQ) ||
          idStr.includes(rawQ) ||
          category.includes(rawQ) || normCategory.includes(normQ) ||
          tags.includes(rawQ) || normTags.includes(normQ) ||
          desc.includes(rawQ) || normDesc.includes(normQ);

        if (matchesField) return true;

        if (terms.length > 1) {
          const combinedNorm = `${normTitle} ${titleUrl} ${idStr} ${normCategory} ${normTags} ${normDesc}`;
          return terms.every(t => combinedNorm.includes(t));
        }

        return false;
      });
    }

    // 2. Visibility filter
    if (this.filterVisibility === 'visible') {
      list = list.filter(p => this.isProductVisible(p));
    } else if (this.filterVisibility === 'hidden') {
      list = list.filter(p => !this.isProductVisible(p));
    }

    // 3. Sale filter
    if (this.filterSale === 'sale') {
      list = list.filter(p => !!(p[this.lang]?.onSale || p['vi']?.onSale || p.onSale));
    } else if (this.filterSale === 'regular') {
      list = list.filter(p => !(p[this.lang]?.onSale || p['vi']?.onSale || p.onSale));
    }

    // 4. Stock filter
    if (this.filterStock === 'inStock') {
      list = list.filter(p => {
        const s = (this.getProductStock(p) || '').toLowerCase();
        return !s.includes('hết') && !s.includes('out');
      });
    } else if (this.filterStock === 'outOfStock') {
      list = list.filter(p => {
        const s = (this.getProductStock(p) || '').toLowerCase();
        return s.includes('hết') || s.includes('out');
      });
    }

    // 5. Sorting
    if (this.sortBy === 'name-asc') {
      list.sort((a, b) => this.getProductTitle(a).localeCompare(this.getProductTitle(b), 'vi'));
    } else if (this.sortBy === 'name-desc') {
      list.sort((a, b) => this.getProductTitle(b).localeCompare(this.getProductTitle(a), 'vi'));
    } else if (this.sortBy === 'price-asc') {
      list.sort((a, b) => this.getProductPrice(a) - this.getProductPrice(b));
    } else if (this.sortBy === 'price-desc') {
      list.sort((a, b) => this.getProductPrice(b) - this.getProductPrice(a));
    }

    this.filteredProducts = list;
  }

  onRefresh(): void {
    this.refreshRotation += 180;
    this.selectedProductKeys.clear();
    this.getAllProducts.emit();
    this.loadProducts(true);
  }

  onAddNewProduct(): void {
    const currentLang = this.lang || 'vi';
    if (this.router) {
      this.router.navigate([`/${currentLang}/dashboard/products/edit/new`]);
    }
  }

  onEdit(titleUrl: string): void {
    this.editProduct.emit(titleUrl);
    const currentLang = this.lang || 'vi';
    if (this.router && titleUrl) {
      this.router.navigate([`/${currentLang}/dashboard/products/edit/${titleUrl}`]);
    }
  }

  onDelete(product: Product, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const title = this.getProductTitle(product);
    const target = this.getProductKey(product);
    if (!target) return;

    if (this.deletingProductKey) {
      return; // Một thao tác xóa khác đang diễn ra
    }

    if (confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${title}" không? Thao tác này không thể hoàn tác.`)) {
      this.deletingProductKey = target;
      this.cdr?.detectChanges();

      this.apiService.removeProduct(target).subscribe({
        next: (res: any) => {
          this.deletingProductKey = null;
          if (res && res.error) {
            console.error('Lỗi khi xóa sản phẩm:', res.error);
            this.showToast(`Xóa sản phẩm "${title}" thất bại! Vui lòng thử lại.`, true);
          } else {
            this.selectedProductKeys.delete(target);
            this.allProducts = (this.allProducts || []).filter(
              (p) => this.getProductKey(p) !== target
            );
            this.filterProducts();
            this.deleteProduct.emit(target);
            this.showToast(`Đã xóa sản phẩm "${title}" thành công!`);
          }
          this.cdr?.detectChanges();
        },
        error: (err) => {
          console.error('Lỗi kết nối khi xóa sản phẩm:', err);
          this.deletingProductKey = null;
          this.showToast(`Xóa sản phẩm "${title}" thất bại! Vui lòng thử lại.`, true);
          this.cdr?.detectChanges();
        }
      });
    }
  }

  // --- Bulk Delete Methods ---
  deleteSelectedProducts(): void {
    const count = this.selectedProductKeys.size;
    if (count === 0 || this.isDeleting) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa ${count} sản phẩm đã chọn không? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    this.isDeleting = true;
    const targets = Array.from(this.selectedProductKeys);

    forkJoin(
      targets.map(target =>
        this.apiService.removeProduct(target).pipe(
          map((res: any) => ({ target, success: !res?.error })),
          catchError(err => of({ target, success: false, error: err }))
        )
      )
    ).subscribe({
      next: (results) => {
        this.isDeleting = false;
        const successfulDeletes = results.filter(r => r.success).map(r => r.target);
        const failedDeletes = results.filter(r => !r.success);

        if (successfulDeletes.length > 0) {
          successfulDeletes.forEach(t => {
            this.selectedProductKeys.delete(t);
            this.deleteProduct.emit(t);
          });
          this.allProducts = (this.allProducts || []).filter(
            (p) => !successfulDeletes.includes(this.getProductKey(p))
          );
          this.filterProducts();
          this.getAllProducts.emit();
        }

        if (failedDeletes.length === 0) {
          this.showToast(`Đã xóa thành công tất cả ${successfulDeletes.length} sản phẩm đã chọn!`);
        } else if (successfulDeletes.length > 0) {
          this.showToast(`Đã xóa ${successfulDeletes.length} sản phẩm. Thất bại ${failedDeletes.length} sản phẩm!`, true);
        } else {
          this.showToast(`Xóa ${count} sản phẩm thất bại. Vui lòng kiểm tra lại kết nối!`, true);
        }
        this.cdr?.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi xóa nhiều sản phẩm:', err);
        this.isDeleting = false;
        this.showToast('Đã xảy ra lỗi khi thực hiện xóa hàng loạt!', true);
        this.cdr?.detectChanges();
      }
    });
  }

  getProductTitle(product: Product): string {
    return product[this.lang]?.title || product['vi']?.title || product.title || product.titleUrl || 'Chưa đặt tên';
  }

  getProductPrice(product: Product): number {
    return product[this.lang]?.salePrice || product[this.lang]?.regularPrice || product['vi']?.salePrice || product['vi']?.regularPrice || product.salePrice || product.regularPrice || 0;
  }

  getOriginalPrice(product: Product): number | null {
    const langObj = product[this.lang] || product['vi'] || {};
    if (langObj.salePrice && langObj.regularPrice && langObj.regularPrice > langObj.salePrice) {
      return langObj.regularPrice;
    }
    if (product.salePrice && product.regularPrice && product.regularPrice > product.salePrice) {
      return product.regularPrice;
    }
    return null;
  }

  getProductStock(product: Product): string {
    return product[this.lang]?.stock || product.stock || 'Còn hàng';
  }

  isProductVisible(product: any): boolean {
    if (!product) return false;
    const langData = product[this.lang] || product['vi'] || {};
    if (langData.visibility !== undefined) {
      return !!langData.visibility;
    }
    if (product.visibility !== undefined) {
      return !!product.visibility;
    }
    return true;
  }

  toggleProductVisibility(product: any, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const targetKey = this.getProductKey(product);
    if (!targetKey || this.togglingProductKey === targetKey) {
      return; // Thao tác đang được xử lý cho sản phẩm này
    }

    const current = this.isProductVisible(product);
    const newVal = !current;
    const title = this.getProductTitle(product);

    this.togglingProductKey = targetKey;

    // Cập nhật UI ngay lập tức (Optimistic Update)
    product.visibility = newVal;
    if (product[this.lang]) {
      product[this.lang].visibility = newVal;
    }
    if (product['vi']) {
      product['vi'].visibility = newVal;
    }
    this.cdr?.detectChanges();

    // Gửi payload cập nhật đến server
    const languages = ['vi', 'en', 'sk', 'cs'];
    const updatePayload: any = {
      titleUrl: product.titleUrl,
      visibility: newVal,
    };
    for (const l of languages) {
      updatePayload[l] = {
        ...(product[l] || {}),
        visibility: newVal,
      };
    }

    this.apiService.editProduct(updatePayload).subscribe({
      next: (res: any) => {
        this.togglingProductKey = null;
        if (res && res.error) {
          // Lỗi từ backend: Rollback
          product.visibility = current;
          if (product[this.lang]) product[this.lang].visibility = current;
          if (product['vi']) product['vi'].visibility = current;
          this.showToast(`Cập nhật trạng thái của "${title}" thất bại!`, true);
        } else {
          this.showToast(`Đã ${newVal ? 'bật hiển thị' : 'ẩn'} sản phẩm "${title}"!`);
        }
        this.cdr?.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi khi cập nhật trạng thái hiển thị sản phẩm:', err);
        this.togglingProductKey = null;
        // Khôi phục lại trạng thái cũ nếu lỗi mạng
        product.visibility = current;
        if (product[this.lang]) product[this.lang].visibility = current;
        if (product['vi']) product['vi'].visibility = current;
        this.showToast(`Cập nhật trạng thái hiển thị thất bại!`, true);
        this.cdr?.detectChanges();
      }
    });
  }
}
