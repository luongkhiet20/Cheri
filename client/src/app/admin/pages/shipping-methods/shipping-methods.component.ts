import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-shipping-methods',
  standalone: false,
  templateUrl: './shipping-methods.component.html',
  styleUrls: ['./shipping-methods.component.css']
})
export class ShippingMethodsComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'name', label: 'Tên phương thức', type: 'text', sortable: true },
    { key: 'code', label: 'Mã', type: 'text' },
    { key: 'baseCost', label: 'Phí cơ bản', type: 'currency', sortable: true },
    { key: 'estimatedDays', label: 'Thời gian giao dự kiến', type: 'text' },
    { key: 'coverageArea', label: 'Phạm vi giao hàng', type: 'text' },
    { key: 'freeShippingThresholdText', label: 'Miễn phí từ', type: 'text' },
    { key: 'statusText', label: 'Trạng thái', type: 'status' }
  ];

  actions: RowAction[] = [
    { key: 'view', label: 'Xem', variant: 'primary' },
    { key: 'edit', label: 'Sửa' },
    {
      key: 'toggle_off',
      label: 'Tắt',
      variant: 'warning',
      showWhen: (r: any) => r.isActive !== false
    },
    {
      key: 'toggle_on',
      label: 'Bật',
      variant: 'default',
      showWhen: (r: any) => r.isActive === false
    },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];

  filterFields: FilterField[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả trạng thái' },
        { value: 'true', label: 'Đang bật' },
        { value: 'false', label: 'Đang tắt' }
      ]
    }
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();

  currentSearch = '';
  currentStatusFilter = '';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Confirm dialog state
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = 'Xác nhận';
  confirmVariant: 'danger' | 'warning' | 'default' = 'default';
  pendingAction: { type: 'delete' | 'toggle'; row: any } | null = null;

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r._id || r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadShippingMethods();
  }

  loadShippingMethods(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: any = {
      page: this.pagination.page,
      limit: this.pagination.pageSize
    };

    if (this.currentSearch.trim()) {
      params.search = this.currentSearch.trim();
    }

    if (this.currentStatusFilter) {
      params.isActive = this.currentStatusFilter;
    }

    this.apiService.getShippingMethods(params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success) {
          this.data = (res.data || []).map((item: any) => {
            const isActive = item.isActive !== false;
            return {
              ...item,
              id: item._id || item.id,
              isActive: isActive,
              statusText: isActive ? 'Đang bật' : 'Đang tắt',
              statusTextVariant: isActive ? 'success' : 'neutral'
            };
          });

          this.pagination = {
            page: res.page || res.pagination?.page || this.pagination.page,
            pageSize: res.limit || res.pagination?.pageSize || this.pagination.pageSize,
            total: res.total != null ? res.total : (res.pagination?.total || this.data.length)
          };
        } else {
          this.errorMessage = res?.message || 'Không thể tải danh sách phương thức vận chuyển.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải danh sách phương thức vận chuyển:', err);
        this.errorMessage = err?.error?.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }

  onAddShippingMethod(): void {
    this.router.navigate(['/admin/shipping-methods/add']);
  }

  onAction(e: ActionEvent): void {
    const row = e.row;
    const itemId = row._id || row.id;

    if (e.action === 'view') {
      this.router.navigate(['/admin/shipping-methods', itemId]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/shipping-methods', itemId, 'edit']);
    } else if (e.action === 'toggle_off') {
      this.pendingAction = { type: 'toggle', row };
      this.confirmTitle = 'Tắt phương thức vận chuyển';
      this.confirmMessage = `Bạn có chắc muốn tắt phương thức vận chuyển "${row.name}" không?`;
      this.confirmLabel = 'Tắt';
      this.confirmVariant = 'warning';
      this.confirmOpen = true;
    } else if (e.action === 'toggle_on') {
      this.pendingAction = { type: 'toggle', row };
      this.confirmTitle = 'Bật phương thức vận chuyển';
      this.confirmMessage = `Bạn có chắc muốn bật phương thức vận chuyển "${row.name}" không?`;
      this.confirmLabel = 'Bật';
      this.confirmVariant = 'default';
      this.confirmOpen = true;
    } else if (e.action === 'delete') {
      this.pendingAction = { type: 'delete', row };
      this.confirmTitle = 'Xóa phương thức vận chuyển';
      this.confirmMessage = 'Bạn có chắc muốn xóa phương thức vận chuyển này?';
      this.confirmLabel = 'Xóa';
      this.confirmVariant = 'danger';
      this.confirmOpen = true;
    }
  }

  onConfirmDialog(): void {
    if (!this.pendingAction) {
      this.confirmOpen = false;
      return;
    }

    const { type, row } = this.pendingAction;
    const itemId = row._id || row.id;

    if (type === 'toggle') {
      const targetState = !(row.isActive !== false);
      this.apiService.updateShippingMethodStatus(itemId, targetState).subscribe({
        next: (res) => {
          this.confirmOpen = false;
          this.pendingAction = null;
          if (res && res.success) {
            this.showSuccess(res.message || `Đã ${targetState ? 'bật' : 'tắt'} phương thức vận chuyển.`);
            this.loadShippingMethods();
          } else {
            this.showError(res?.message || 'Thao tác không thành công.');
          }
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingAction = null;
          this.showError(err?.error?.message || 'Lỗi khi cập nhật trạng thái.');
        }
      });
    } else if (type === 'delete') {
      this.apiService.deleteShippingMethod(itemId).subscribe({
        next: (res) => {
          this.confirmOpen = false;
          this.pendingAction = null;
          if (res && res.success) {
            this.showSuccess('Xóa phương thức vận chuyển thành công.');
            this.loadShippingMethods();
          } else {
            this.showError(res?.message || 'Không thể xóa phương thức vận chuyển.');
          }
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingAction = null;
          this.showError(err?.error?.message || 'Lỗi khi xóa phương thức vận chuyển.');
        }
      });
    }
  }

  onCancelDialog(): void {
    this.confirmOpen = false;
    this.pendingAction = null;
  }

  onSearch(v: string): void {
    this.currentSearch = v || '';
    this.pagination.page = 1;
    this.loadShippingMethods();
  }

  onFilter(v: Record<string, any>): void {
    this.currentStatusFilter = v['status'] || '';
    this.pagination.page = 1;
    this.loadShippingMethods();
  }

  onRefresh(): void {
    this.loadShippingMethods();
  }

  onPageChange(p: number): void {
    this.pagination.page = p;
    this.loadShippingMethods();
  }

  onPageSizeChange(s: number): void {
    this.pagination.pageSize = s;
    this.pagination.page = 1;
    this.loadShippingMethods();
  }

  onSelectionChange(ids: Set<any>): void {
    this.selectedIds = new Set(ids);
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.data.map((r: any) => r._id || r.id));
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => {
      if (this.successMessage === msg) this.successMessage = '';
    }, 4000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    setTimeout(() => {
      if (this.errorMessage === msg) this.errorMessage = '';
    }, 5000);
  }
}
