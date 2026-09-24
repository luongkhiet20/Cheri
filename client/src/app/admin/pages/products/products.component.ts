import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-products',
  standalone: false,
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css']
})
export class ProductsComponent implements OnInit {

  // ── Table Configuration ──────────────────────────────────────
  columns: TableColumn[] = [
    { key: 'image',    label: '',              type: 'image',    width: '60px' },
    { key: 'name',     label: 'Tên sản phẩm',  type: 'text',     sortable: true },
    { key: 'price',    label: 'Giá',           type: 'currency', sortable: true, align: 'right' },
    { key: 'category', label: 'Danh mục',      type: 'text' },
    { key: 'stock',    label: 'Tồn kho',       type: 'number',   sortable: true, align: 'right' },
    { key: 'status',   label: 'Trạng thái',    type: 'status' },
  ];

  actions: RowAction[] = [
    { key: 'view',   label: 'Xem' },
    { key: 'edit',   label: 'Sửa' },
    { key: 'delete', label: 'Xóa', variant: 'danger' },
  ];

  filterFields: FilterField[] = [
    { key: 'category', label: 'Danh mục', type: 'select', options: [
      { value: 'Áo',       label: 'Áo' },
      { value: 'Váy',      label: 'Váy' },
      { value: 'Đầm & Váy',label: 'Đầm & Váy' },
      { value: 'Phụ kiện', label: 'Phụ kiện' },
    ]},
    { key: 'status', label: 'Trạng thái', type: 'select', options: [
      { value: 'active',   label: 'Đang bán' },
      { value: 'inactive', label: 'Tạm ẩn' },
      { value: 'out',      label: 'Hết hàng' },
    ]},
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Search & Filter state
  searchQuery = '';
  selectedCategory = '';
  selectedStatus = '';

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
  confirmMessage = '';
  pendingDeleteId: string | null = null;
  pendingDeleteName: string = '';
  isBulkDelete = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategoriesForFilter();
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
      status: this.selectedStatus
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.data = res.data || [];
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
  }

  onCsvImportSuccess(result: any): void {
    this.showSuccess(result?.message || 'Nhập sản phẩm từ file CSV thành công vào cơ sở dữ liệu MongoDB!');
    this.loadProducts();
  }

  // ── Selection Handlers ───────────────────────────────────────
  onSelectionChange(ids: Set<any>): void {
    this.selectedIds = new Set(ids);
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.data.map(r => r.id));
    }
  }

  onDeleteSelected(): void {
    const count = this.selectedCount;
    if (count === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${count} sản phẩm đã chọn khỏi cơ sở dữ liệu MongoDB không? Hành động này không thể hoàn tác.`;
    this.confirmOpen = true;
  }

  // ── Row Action Handler ───────────────────────────────────────
  onAction(event: ActionEvent): void {
    if (event.action === 'view') {
      // Navigate to /admin/products/:id
      this.router.navigate(['/admin/products', event.row.id]);
    } else if (event.action === 'edit') {
      // Navigate to /admin/products/:id/edit
      this.router.navigate(['/admin/products', event.row.id, 'edit']);
    } else if (event.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = event.row.id;
      this.pendingDeleteName = event.row.name || '';
      this.confirmMessage = `Bạn có chắc chắn muốn xóa sản phẩm "${this.pendingDeleteName}" khỏi MongoDB không?`;
      this.confirmOpen = true;
    }
  }

  onConfirmDelete(): void {
    if (this.isBulkDelete) {
      const idsToDelete = Array.from(this.selectedIds);
      this.apiService.bulkDeleteProducts(idsToDelete).subscribe({
        next: (res) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.showSuccess(res.message || `Đã xóa ${idsToDelete.length} sản phẩm thành công`);
          this.loadProducts();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.showError('Lỗi xóa sản phẩm: ' + (err.error?.message || err.message));
        }
      });
    } else if (this.pendingDeleteId) {
      this.apiService.deleteProduct(this.pendingDeleteId).subscribe({
        next: (res) => {
          this.confirmOpen = false;
          const deletedId = this.pendingDeleteId;
          this.pendingDeleteId = null;
          this.showSuccess(`Đã xóa sản phẩm "${this.pendingDeleteName}" thành công khỏi MongoDB!`);
          this.loadProducts();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.showError('Lỗi xóa sản phẩm: ' + (err.error?.message || err.message));
        }
      });
    }
  }

  onCancelDelete(): void {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.pendingDeleteName = '';
  }

  showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => {
      if (this.successMessage === msg) this.successMessage = '';
    }, 4000);
  }

  showError(msg: string): void {
    this.errorMessage = msg;
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
