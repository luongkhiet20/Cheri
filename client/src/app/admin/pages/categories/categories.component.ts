import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { Router } from '@angular/router';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-categories',
  standalone: false,
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Kinh doanh' },
    { label: 'Quản lý danh mục' }
  ];

  columns: TableColumn[] = [
    { key: 'position', label: 'Vị trí', type: 'number', sortable: true, width: '90px', align: 'center' },
    { key: 'name', label: 'Tên danh mục', type: 'text', sortable: true },
    { key: 'slug', label: 'Slug', type: 'text', sortable: true },
    { key: 'productCount', label: 'Số sản phẩm', type: 'number', sortable: true, align: 'right', clickable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'edit', label: 'Sửa' },
    {
      key: 'toggle',
      label: 'Tắt',
      variant: 'warning',
      showWhen: (r: any) => CategoriesComponent.checkCategoryVisible(r)
    },
    {
      key: 'toggle',
      label: 'Bật',
      variant: 'primary',
      showWhen: (r: any) => !CategoriesComponent.checkCategoryVisible(r)
    },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];
  filterFields: FilterField[] = [
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Hiển thị' }, { value: 'inactive', label: 'Ẩn' }] },
  ];

  data: any[] = [];
  allCategories: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();
  isLoading = false;

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  // Toggle category visibility
  toggleConfirmOpen = false;
  toggleConfirmTitle = '';
  toggleConfirmMessage = '';
  toggleConfirmLabel = 'Xác nhận';
  toggleConfirmVariant: 'warning' | 'primary' | 'default' = 'default';
  pendingToggleCategory: any = null;
  pendingToggleNextState = false;
  isToggling = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.apiService.getCategories().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allCategories = res.data || [];
          this.data = [...this.allCategories];
          this.pagination = { ...this.pagination, total: this.data.length };
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải danh mục từ MongoDB:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onSelectionChange(ids: Set<any>): void { this.selectedIds = new Set(ids); }
  onToolbarSelectAll(): void {
    if (this.allSelected) { this.selectedIds = new Set(); }
    else { this.selectedIds = new Set(this.data.map((r: any) => r.id)); }
  }

  onDeleteSelected(): void {
    const c = this.selectedCount;
    if (c === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${c} danh mục đã chọn không?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.pendingDeleteId) {
      this.apiService.deleteCategory(this.pendingDeleteId).subscribe({
        next: () => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.notificationService.success('Xóa danh mục thành công.');
          this.loadCategories();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.notificationService.error('Lỗi khi xóa danh mục.');
          console.error('Lỗi xóa danh mục:', err);
          this.cdr.markForCheck();
        }
      });
    } else if (this.isBulkDelete && this.selectedIds.size > 0) {
      this.apiService.bulkDeleteCategories(Array.from(this.selectedIds)).subscribe({
        next: () => {
          this.selectedIds.clear();
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.notificationService.success('Đã xóa các danh mục đã chọn thành công.');
          this.loadCategories();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.notificationService.error('Lỗi khi xóa hàng loạt danh mục.');
          console.error('Lỗi xóa hàng loạt danh mục:', err);
          this.cdr.markForCheck();
        }
      });
    } else {
      this.confirmOpen = false;
      this.cdr.markForCheck();
    }
  }

  onCancelDelete(): void {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.cdr.markForCheck();
  }

  static checkCategoryVisible(r: any): boolean {
    if (r?.visibility !== undefined && r?.visibility !== null) {
      return r.visibility !== false;
    }
    if (r?.vi?.visibility !== undefined && r?.vi?.visibility !== null) {
      return r.vi.visibility !== false;
    }
    return r?.status !== 'Ẩn';
  }

  isCategoryVisible(r: any): boolean {
    return CategoriesComponent.checkCategoryVisible(r);
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc chắn muốn xóa danh mục "${e.row.name}" khỏi MongoDB không?`;
      this.confirmOpen = true;
      this.cdr.markForCheck();
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/categories', e.row.id, 'edit']);
    } else if (e.action === 'toggle' || e.action === 'toggle_off' || e.action === 'toggle_on') {
      if (this.isToggling) return;
      const isVisible = this.isCategoryVisible(e.row);
      const nextState = e.action === 'toggle_off' ? false : (e.action === 'toggle_on' ? true : !isVisible);

      this.pendingToggleCategory = e.row;
      this.pendingToggleNextState = nextState;
      this.toggleConfirmTitle = nextState ? 'Bật hiển thị danh mục' : 'Tắt hiển thị danh mục';
      this.toggleConfirmMessage = nextState
        ? `Bạn có chắc chắn muốn bật hiển thị danh mục "${e.row.name}" không? Danh mục sẽ xuất hiện trên cửa hàng.`
        : `Bạn có chắc chắn muốn tắt hiển thị danh mục "${e.row.name}" không? Danh mục sẽ bị ẩn trên cửa hàng (các sản phẩm và dữ liệu liên quan sẽ không bị xóa).`;
      this.toggleConfirmLabel = nextState ? 'Bật' : 'Tắt';
      this.toggleConfirmVariant = nextState ? 'primary' : 'warning';
      this.toggleConfirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  onConfirmToggle(): void {
    if (this.isToggling || !this.pendingToggleCategory) {
      this.toggleConfirmOpen = false;
      this.cdr.markForCheck();
      return;
    }

    const row = this.pendingToggleCategory;
    const catId = row.id || row._id;
    const nextState = this.pendingToggleNextState;

    this.isToggling = true;
    this.toggleConfirmOpen = false;

    this.apiService.toggleCategoryVisibility(catId, nextState, row.name).subscribe({
      next: (res) => {
        this.isToggling = false;
        this.pendingToggleCategory = null;

        if (res && res.success !== false) {
          const statusText = nextState ? 'Hiển thị' : 'Ẩn';
          const statusVariant = nextState ? 'success' : 'neutral';

          // Update row in allCategories
          this.allCategories = this.allCategories.map(c => {
            if ((c.id || c._id) === catId) {
              return {
                ...c,
                visibility: nextState,
                status: statusText,
                statusVariant
              };
            }
            return c;
          });

          // Update row in current table view data
          this.data = this.data.map(c => {
            if ((c.id || c._id) === catId) {
              return {
                ...c,
                visibility: nextState,
                status: statusText,
                statusVariant
              };
            }
            return c;
          });

          this.notificationService.success(
            nextState
              ? `Đã bật hiển thị danh mục "${row.name}" thành công.`
              : `Đã tắt hiển thị danh mục "${row.name}" thành công.`
          );
        } else {
          this.notificationService.error(res?.message || 'Không thể cập nhật trạng thái danh mục.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isToggling = false;
        this.pendingToggleCategory = null;
        console.error('Lỗi khi bật/tắt hiển thị danh mục:', err);
        this.notificationService.error(
          err?.error?.message || 'Lỗi khi cập nhật trạng thái danh mục vào MongoDB. Vui lòng thử lại.'
        );
        this.cdr.markForCheck();
      }
    });
  }

  onCancelToggle(): void {
    this.toggleConfirmOpen = false;
    this.pendingToggleCategory = null;
    this.cdr.markForCheck();
  }

  onCellClick(event: { column: TableColumn; row: any }): void {
    if (event.column.key === 'productCount') {
      const categoryId = event.row.id || event.row._id;
      const categorySlug = event.row.slug || event.row.titleUrl;
      if (categoryId) {
        this.router.navigate(['/admin/products'], {
          queryParams: {
            categoryId,
            ...(categorySlug ? { category: categorySlug } : {})
          }
        });
      }
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allCategories];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    const q = v.toLowerCase();
    this.data = this.allCategories.filter(c => (c.name || '').toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q));
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onFilter(v: Record<string, any>): void {
    const statusVal = v['status'];
    if (!statusVal) {
      this.data = [...this.allCategories];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    const target = statusVal === 'active' ? 'Hiển thị' : 'Ẩn';
    this.data = this.allCategories.filter(c => c.status === target);
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onRefresh(): void { this.loadCategories(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; this.cdr.markForCheck(); }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; this.cdr.markForCheck(); }
}
