import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-payment-methods',
  standalone: false,
  templateUrl: './payment-methods.component.html',
  styleUrls: ['./payment-methods.component.css']
})
export class PaymentMethodsComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'name', label: 'Tên phương thức', type: 'text', sortable: true },
    { key: 'code', label: 'Mã phương thức', type: 'text', sortable: true },
    { key: 'type', label: 'Loại thanh toán', type: 'text', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
    { key: 'createdAt', label: 'Ngày tạo', type: 'date', sortable: true },
  ];

  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    { key: 'toggle-off', label: 'Tắt', variant: 'warning', showWhen: (r) => r.isActive !== false },
    { key: 'toggle-on', label: 'Bật', variant: 'primary', showWhen: (r) => r.isActive === false },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];

  filterFields: FilterField[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'active', label: 'Đang hoạt động' },
        { value: 'inactive', label: 'Tạm khóa' }
      ]
    },
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();
  isLoading = false;

  searchQuery = '';
  statusFilter = '';

  // Confirm dialog state
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'danger' | 'warning' | 'default' = 'danger';
  confirmActionType: 'delete' | 'toggle' | 'bulk_delete' | null = null;
  pendingItemId: string | null = null;
  pendingTargetActive = false;

  // Alerts
  errorMessage = '';

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  get deleteLabel(): string {
    return this.selectedCount > 0
      ? `Xóa đã chọn (${this.selectedCount})`
      : 'Xóa đã chọn';
  }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadPaymentMethods();
  }

  loadPaymentMethods(): void {
    this.isLoading = true;
    this.apiService.getPaymentMethods({
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      search: this.searchQuery,
      status: this.statusFilter
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.data = (res.data || []).map((pm: any) => {
            const isActive = pm.isActive !== false;
            return {
              ...pm,
              id: pm._id || pm.id,
              isActive: isActive,
              status: pm.statusText || (isActive ? 'Đang hoạt động' : 'Tạm khóa'),
              statusVariant: pm.statusVariant || (isActive ? 'success' : 'neutral')
            };
          });
          this.pagination = {
            ...this.pagination,
            total: res.total ?? res.pagination?.total ?? this.data.length
          };
          this.selectedIds.clear();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải danh sách phương thức thanh toán';
        console.error('Lỗi payment methods:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onAddPaymentMethod(): void {
    this.router.navigate(['/admin/payment-methods/add']);
  }

  onSelectionChange(ids: Set<any>): void {
    this.selectedIds = new Set(ids);
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.data.map((r: any) => r.id));
    }
  }


  onAction(e: ActionEvent): void {
    const item = e.row;
    const itemId = item.id || item._id;

    if (e.action === 'view') {
      this.router.navigate(['/admin/payment-methods', itemId]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/payment-methods', itemId, 'edit']);
    } else if (e.action === 'toggle-off') {
      this.pendingItemId = itemId;
      this.pendingTargetActive = false;
      this.confirmActionType = 'toggle';
      this.confirmTitle = 'Xác nhận tắt phương thức thanh toán';
      this.confirmMessage = `Bạn có chắc muốn tắt phương thức thanh toán "${item.name}" không?`;
      this.confirmLabel = 'Tắt phương thức';
      this.confirmVariant = 'warning';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    } else if (e.action === 'toggle-on') {
      this.pendingItemId = itemId;
      this.pendingTargetActive = true;
      this.confirmActionType = 'toggle';
      this.confirmTitle = 'Xác nhận bật phương thức thanh toán';
      this.confirmMessage = `Bạn có chắc muốn bật phương thức thanh toán "${item.name}" không?`;
      this.confirmLabel = 'Bật phương thức';
      this.confirmVariant = 'default';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    } else if (e.action === 'delete') {
      this.pendingItemId = itemId;
      this.confirmActionType = 'delete';
      this.confirmTitle = 'Xác nhận xóa';
      this.confirmMessage = `Bạn có chắc muốn xóa phương thức thanh toán "${item.name}" không? Thao tác này sẽ xóa vĩnh viễn khỏi MongoDB.`;
      this.confirmLabel = 'Xóa';
      this.confirmVariant = 'danger';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  onDeleteSelected(): void {
    const count = this.selectedCount;
    if (count === 0) return;
    this.pendingItemId = null;
    this.confirmActionType = 'bulk_delete';
    this.confirmTitle = 'Xác nhận xóa các phương thức thanh toán đã chọn';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${count} phương thức thanh toán đã chọn không? Hành động này không thể hoàn tác.`;
    this.confirmLabel = this.deleteLabel;
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmDialog(): void {
    if (this.confirmActionType === 'bulk_delete') {
      const ids = Array.from(this.selectedIds);
      this.confirmOpen = false;
      this.confirmActionType = null;
      this.isLoading = true;
      this.cdr.markForCheck();

      Promise.all(ids.map(id => this.apiService.deletePaymentMethod(id).toPromise()))
        .then(() => {
          this.isLoading = false;
          this.selectedIds.clear();
          this.notificationService.success(`Đã xóa ${ids.length} phương thức thanh toán thành công.`);
          this.loadPaymentMethods();
        })
        .catch((err) => {
          this.isLoading = false;
          this.errorMessage = err?.error?.message || 'Lỗi khi xóa các phương thức thanh toán đã chọn.';
          this.notificationService.error(this.errorMessage);
          this.loadPaymentMethods();
          setTimeout(() => this.errorMessage = '', 4000);
        });
      return;
    }

    if (!this.pendingItemId) {
      this.confirmOpen = false;
      this.cdr.markForCheck();
      return;
    }

    if (this.confirmActionType === 'toggle') {
      const targetId = this.pendingItemId;
      const targetActive = this.pendingTargetActive;
      this.confirmOpen = false;
      this.pendingItemId = null;
      this.cdr.markForCheck();

      this.apiService.updatePaymentMethodStatus(targetId, targetActive).subscribe({
        next: (res) => {
          const msg = res.message || (targetActive ? 'Đã bật phương thức thanh toán' : 'Đã tắt phương thức thanh toán');
          this.notificationService.success(msg);
          this.loadPaymentMethods();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái';
          this.notificationService.error(this.errorMessage);
          console.error(err);
          this.cdr.markForCheck();
        }
      });
    } else if (this.confirmActionType === 'delete') {
      const targetId = this.pendingItemId;
      this.confirmOpen = false;
      this.pendingItemId = null;
      this.cdr.markForCheck();

      this.apiService.deletePaymentMethod(targetId).subscribe({
        next: (res) => {
          const msg = res.message || 'Xóa phương thức thanh toán thành công';
          this.notificationService.success(msg);
          this.loadPaymentMethods();
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Lỗi khi xóa phương thức thanh toán';
          this.notificationService.error(this.errorMessage);
          console.error(err);
          this.cdr.markForCheck();
        }
      });
    }
  }

  onCancelDialog(): void {
    this.confirmOpen = false;
    this.pendingItemId = null;
    this.confirmActionType = null;
    this.cdr.markForCheck();
  }

  onSearch(v: string): void {
    this.searchQuery = (v || '').trim();
    this.pagination.page = 1;
    this.loadPaymentMethods();
  }

  onFilter(v: Record<string, any>): void {
    this.statusFilter = v['status'] || '';
    this.pagination.page = 1;
    this.loadPaymentMethods();
  }

  onRefresh(): void {
    this.searchQuery = '';
    this.statusFilter = '';
    this.pagination.page = 1;
    this.loadPaymentMethods();
  }

  onPageChange(p: number): void {
    this.pagination = { ...this.pagination, page: p };
    this.loadPaymentMethods();
  }

  onPageSizeChange(s: number): void {
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.loadPaymentMethods();
  }
}

