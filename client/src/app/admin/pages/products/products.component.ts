import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent, BadgeVariant } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý sản phẩm' }
  ];

  // ── Table Configuration ──────────────────────────────────────
  columns: TableColumn[] = [
    { key: 'image', label: '', type: 'image', width: '60px' },
    { key: 'name', label: 'Tên sản phẩm', type: 'text', sortable: true },
    { key: 'price', label: 'Giá', type: 'currency', sortable: true, align: 'right' },
    { key: 'category', label: 'Danh mục', type: 'text', sortable: true },
    { key: 'stock', label: 'Tồn kho', type: 'number', sortable: true, align: 'right' },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
  ];

  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    {
      key: 'toggle',
      label: 'Tắt',
      showWhen: (r: any) => this?.isProductActive ? this.isProductActive(r) : (r?.status !== 'Ẩn' && r?.status !== 'Tạm ẩn' && r?.visibility !== false)
    },
    {
      key: 'toggle',
      label: 'Bật',
      showWhen: (r: any) => this?.isProductActive ? !this.isProductActive(r) : (r?.status === 'Ẩn' || r?.status === 'Tạm ẩn' || r?.visibility === false)
    },
    { key: 'delete', label: 'Xóa', variant: 'danger' },
  ];

  filterFields: FilterField[] = [
    {
      key: 'category', label: 'Danh mục', type: 'select', options: [
        { value: 'Áo', label: 'Áo' },
        { value: 'Váy', label: 'Váy' },
        { value: 'Đầm & Váy', label: 'Đầm & Váy' },
        { value: 'Phụ kiện', label: 'Phụ kiện' },
      ]
    },
    {
      key: 'status', label: 'Trạng thái', type: 'select', options: [
        { value: 'active', label: 'Đang bán' },
        { value: 'inactive', label: 'Tạm ẩn' },
        { value: 'out', label: 'Hết hàng' },
      ]
    },
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
  errorMessage = '';

  // Search & Filter state
  searchQuery = '';
  selectedCategory = '';
  selectedStatus = '';

  // ── Category Filter Context (When navigated from Categories page) ──
  filteredCategoryId: string = '';
  filteredCategoryName: string = '';
  filteredCategorySlug: string = '';
  categoryNotFound: boolean = false;

  // ── Selection State ──────────────────────────────────────────
  selectedIds: Set<any> = new Set();

  get selectedCount(): number { return this.selectedIds.size; }

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every(r => this.selectedIds.has(r.id));
  }

  get isIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  get displayTotal(): number {
    return this.pagination?.total ?? this.data.length;
  }

  // ── CSV Import Modal State ──────────────────────────────────
  isCsvModalOpen = false;

  // ── Confirm Dialog State ─────────────────────────────────────
  confirmOpen = false;
  confirmTitle = 'Xác nhận';
  confirmMessage = '';
  confirmLabel = 'Xác nhận';
  confirmVariant: 'danger' | 'warning' | 'default' = 'danger';
  confirmActionType: 'delete' | 'toggle_on' | null = null;
  pendingRow: any = null;
  pendingDeleteId: string | null = null;
  pendingDeleteName: string = '';
  isBulkDelete = false;
  isProcessing = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const newCatId = params['categoryId']
        ? String(params['categoryId']).trim()
        : (params['category'] ? String(params['category']).trim() : '');
      if (newCatId !== this.filteredCategoryId) {
        this.filteredCategoryId = newCatId;
        this.pagination.page = 1;
      }
      if (params['status']) {
        const s = String(params['status']).trim();
        this.selectedStatus = s;
        const statusField = this.filterFields.find(f => f.key === 'status');
        if (statusField) statusField.value = s;
      }
      this.updateBreadcrumbs();
      this.loadProducts();
    });
    this.loadCategoriesForFilter();
  }

  updateBreadcrumbs(): void {
    if (this.filteredCategoryId && this.filteredCategoryName) {
      this.breadcrumbItems = [
        { label: 'Quản lý danh mục', url: '/admin/categories' },
        { label: this.filteredCategoryName },
        { label: 'Sản phẩm' }
      ];
    } else {
      this.breadcrumbItems = [
        { label: 'Quản lý sản phẩm' }
      ];
    }
  }

  clearCategoryFilter(): void {
    this.filteredCategoryId = '';
    this.filteredCategoryName = '';
    this.filteredCategorySlug = '';
    this.categoryNotFound = false;
    this.updateBreadcrumbs();
    this.router.navigate(['/admin/products'], {
      queryParams: { categoryId: null, category: null },
      queryParamsHandling: 'merge'
    });
  }

  goBackToCategories(): void {
    this.router.navigate(['/admin/categories']);
  }

  isProductActive(r: any): boolean {
    if (!r) return false;
    if (r.status === 'Hiện') return true;
    if (r.status === 'Ẩn') return false;
    if (r.status === 'Đang bán') return true;
    if (r.status === 'Tạm ẩn') return false;
    return r.visibility !== false && r.raw?.visibility !== false && r.raw?.vi?.visibility !== false;
  }

  loadCategoriesForFilter(): void {
    this.apiService.getCategories().subscribe({
      next: (res) => {
        if (res.success && res.data?.length > 0) {
          const categoryField = this.filterFields.find(f => f.key === 'category');
          if (categoryField) {
            categoryField.options = res.data.map((c: any) => ({
              value: c.name,
              label: c.name
            }));
          }
        }
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error fetching categories for filter:', err)
    });
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getProducts({
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      search: this.searchQuery,
      category: this.selectedCategory,
      categoryId: this.filteredCategoryId || undefined,
      status: this.selectedStatus
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          if (res.category) {
            this.filteredCategoryName = res.category.name || '';
            this.filteredCategorySlug = res.category.slug || '';
            this.categoryNotFound = false;
          } else if (res.categoryNotFound) {
            this.categoryNotFound = true;
            this.filteredCategoryName = '';
            this.filteredCategorySlug = '';
          } else if (!this.filteredCategoryId) {
            this.filteredCategoryName = '';
            this.filteredCategorySlug = '';
            this.categoryNotFound = false;
          }
          this.data = (res.data || []).map((p: any) => {
            const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
            const stock = hasVariants
              ? p.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0)
              : Number(p.quantity !== undefined ? p.quantity : (p.raw?.vi?.quantity ?? (typeof p.stock === 'number' ? p.stock : 0)));
            const isActive = this.isProductActive(p);
            const status = isActive ? 'Hiện' : 'Ẩn';
            const statusVariant: BadgeVariant = isActive ? 'success' : 'neutral';
            return {
              ...p,
              stock,
              status,
              statusVariant
            };
          });
          this.pagination = {
            ...this.pagination,
            total: res.pagination?.total ?? 0
          };
          this.selectedIds.clear();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Lỗi khi tải danh sách sản phẩm từ MongoDB: ' + (err.error?.message || err.message);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Navigation Handlers ──────────────────────────────────────
  onAddProduct(): void {
    this.router.navigate(['/admin/products/add']);
  }

  openCsvModal(): void {
    this.isCsvModalOpen = true;
    this.cdr.markForCheck();
  }

  onCsvImportSuccess(result: any): void {
    this.showSuccess(result?.message || 'Nhập sản phẩm từ file CSV thành công vào cơ sở dữ liệu MongoDB!');
    this.loadProducts();
  }

  // ── Selection Handlers ───────────────────────────────────────
  onSelectionChange(ids: Set<any>): void {
    this.selectedIds = new Set(ids);
    this.cdr.markForCheck();
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.data.map(r => r.id));
    }
    this.cdr.markForCheck();
  }

  onDeleteSelected(): void {
    const count = this.selectedCount;
    if (count === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.pendingRow = null;
    this.confirmActionType = 'delete';
    this.confirmTitle = 'Xác nhận xóa sản phẩm';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${count} sản phẩm đã chọn khỏi không? Hành động này không thể hoàn tác.`;
    this.confirmLabel = 'Xóa';
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  // ── Row Action Handler ───────────────────────────────────────
  onAction(event: ActionEvent): void {
    switch (event.action) {
      case 'view':
        // Navigate to /admin/products/:id
        this.router.navigate(['/admin/products', event.row.id]);
        break;

      case 'edit':
        // Navigate to /admin/products/:id/edit
        this.router.navigate(['/admin/products', event.row.id, 'edit']);
        break;

      case 'toggle':
      case 'toggle_on':
      case 'toggle_off':
        const targetActive = event.action === 'toggle_on' ? true : (event.action === 'toggle_off' ? false : !this.isProductActive(event.row));
        if (targetActive) {
          // BẬT SẢN PHẨM: Mở popup modal xác nhận giữa màn hình
          this.pendingRow = event.row;
          this.confirmActionType = 'toggle_on';
          this.confirmTitle = 'Bật sản phẩm';
          const productName = event.row.name || event.row.title || 'này';
          this.confirmMessage = `Bạn có muốn bật sản phẩm "${productName}" để sản phẩm có thể hiển thị trên cửa hàng không?`;
          this.confirmLabel = 'Bật sản phẩm';
          this.confirmVariant = 'default';
          this.confirmOpen = true;
          this.cdr.markForCheck();
        } else {
          // TẮT SẢN PHẨM: Giữ nguyên logic tắt sản phẩm hiện tại
          this.onToggleStatus(event.row, false);
        }
        break;

      case 'delete':
        this.isBulkDelete = false;
        this.pendingRow = null;
        this.pendingDeleteId = event.row.id;
        this.pendingDeleteName = event.row.name || '';
        this.confirmActionType = 'delete';
        this.confirmTitle = 'Xác nhận xóa sản phẩm';
        this.confirmMessage = `Bạn có chắc chắn muốn xóa sản phẩm "${this.pendingDeleteName}" không?`;
        this.confirmLabel = 'Xóa';
        this.confirmVariant = 'danger';
        this.confirmOpen = true;
        this.cdr.markForCheck();
        break;
    }
  }

  onToggleStatus(row: any, forceActive?: boolean): void {
    if (!row || this.isProcessing) return;

    const productId = row.id || row._id;
    if (!productId) return;

    const targetActive = forceActive !== undefined ? forceActive : !this.isProductActive(row);
    this.isProcessing = true;
    const raw = row.raw || {};
    const rawVi = raw.vi || {};

    const payload: any = {
      ...raw,
      visibility: targetActive,
      variants: row.variants || raw.variants || [],
      vi: {
        ...rawVi,
        title: rawVi.title || row.title || row.name || '',
        categoryLevel1: rawVi.categoryLevel1 || row.category || 'Thời trang',
        visibility: targetActive
      }
    };

    this.apiService.updateProduct(productId, payload).subscribe({
      next: (res) => {
        this.isProcessing = false;
        if (res && res.success) {
          const newStatus = targetActive ? 'Hiện' : 'Ẩn';
          const newStatusVariant: BadgeVariant = targetActive ? 'success' : 'neutral';

          // Update local row state without reload
          row.visibility = targetActive;
          row.status = newStatus;
          row.statusVariant = newStatusVariant;

          if (row.raw) {
            row.raw.visibility = targetActive;
            if (row.raw.vi) {
              row.raw.vi.visibility = targetActive;
            }
          }

          if (res.data) {
            const preservedStock = row.stock;
            Object.assign(row, res.data, {
              status: newStatus,
              statusVariant: newStatusVariant,
              visibility: targetActive,
              stock: preservedStock
            });
          }

          this.data = [...this.data];
          const successMsg = targetActive
            ? 'Đã bật sản phẩm thành công.'
            : 'Đã tắt sản phẩm thành công.';
          this.showSuccess(successMsg);
          this.cdr.markForCheck();
        } else {
          this.showError(res?.message || 'Không thể cập nhật trạng thái sản phẩm.');
        }
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('Lỗi khi cập nhật trạng thái sản phẩm:', err);
        const errMsg = err?.error?.message || err?.message || 'Lỗi khi cập nhật trạng thái sản phẩm.';
        this.showError(errMsg);
      }
    });
  }

  onConfirmDialog(): void {
    if (this.isProcessing) return;

    if (this.confirmActionType === 'toggle_on' && this.pendingRow) {
      const row = this.pendingRow;
      this.confirmOpen = false;
      this.pendingRow = null;
      this.confirmActionType = null;
      this.onToggleStatus(row, true);
      return;
    }

    if (this.confirmActionType === 'delete' || this.isBulkDelete || this.pendingDeleteId) {
      this.onConfirmDelete();
      return;
    }

    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  onCancelDialog(): void {
    this.confirmOpen = false;
    this.pendingRow = null;
    this.confirmActionType = null;
    this.pendingDeleteId = null;
    this.pendingDeleteName = '';
    this.isBulkDelete = false;
    this.isProcessing = false;
    this.cdr.markForCheck();
  }

  onConfirmDelete(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    if (this.isBulkDelete) {
      const idsToDelete = Array.from(this.selectedIds);
      this.apiService.bulkDeleteProducts(idsToDelete).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.confirmActionType = null;
          this.pendingDeleteId = null;
          this.isBulkDelete = false;
          this.showSuccess(res.message || `Đã xóa ${idsToDelete.length} sản phẩm thành công`);
          this.loadProducts();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.confirmActionType = null;
          this.isBulkDelete = false;
          this.showError('Lỗi xóa sản phẩm: ' + (err.error?.message || err.message));
          this.cdr.markForCheck();
        }
      });
    } else if (this.pendingDeleteId) {
      const id = this.pendingDeleteId;
      const name = this.pendingDeleteName;
      this.apiService.deleteProduct(id).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.confirmActionType = null;
          this.pendingDeleteId = null;
          this.pendingDeleteName = '';
          this.showSuccess(`Đã xóa sản phẩm "${name}" thành công khỏi MongoDB!`);
          this.loadProducts();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.confirmActionType = null;
          this.pendingDeleteId = null;
          this.pendingDeleteName = '';
          this.showError('Lỗi xóa sản phẩm: ' + (err.error?.message || err.message));
          this.cdr.markForCheck();
        }
      });
    } else {
      this.isProcessing = false;
      this.confirmOpen = false;
      this.confirmActionType = null;
    }
  }

  onCancelDelete(): void {
    this.onCancelDialog();
  }

  showSuccess(msg: string): void {
    this.notificationService.success(msg);
    this.cdr.markForCheck();
  }

  showError(msg: string): void {
    this.errorMessage = msg;
    this.notificationService.error(msg);
    this.cdr.markForCheck();
  }

  // ── Other Handlers ───────────────────────────────────────────
  onSearch(val: string): void {
    this.searchQuery = val ? val.trim() : '';
    this.pagination.page = 1;
    this.loadProducts();
  }

  onFilter(val: Record<string, any>): void {
    this.selectedCategory = val['category'] || '';
    this.selectedStatus = val['status'] || '';
    this.pagination.page = 1;
    this.loadProducts();
  }

  onRefresh(): void {
    this.searchQuery = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.loadProducts();
  }

  onPageChange(p: number): void {
    this.pagination = { ...this.pagination, page: p };
    this.loadProducts();
  }

  onPageSizeChange(s: number): void {
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.loadProducts();
  }
}
