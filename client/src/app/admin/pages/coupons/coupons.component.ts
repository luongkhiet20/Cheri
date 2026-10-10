import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-coupons',
  standalone: false,
  templateUrl: './coupons.component.html',
  styleUrls: ['./coupons.component.css']
})
export class CouponsComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Mã giảm giá' }
  ];

  columns: TableColumn[] = [
    { key: 'code', label: 'Mã giảm giá', type: 'text', sortable: true },
    { key: 'description', label: 'Mô tả', type: 'text' },
    { key: 'discountTypeLabel', label: 'Loại giảm', type: 'text' },
    { key: 'discountValueFormatted', label: 'Giá trị giảm', type: 'text', sortable: true },
    { key: 'minOrderValueFormatted', label: 'Đơn tối thiểu', type: 'text', sortable: true },
    { key: 'usageText', label: 'Lượt sử dụng', type: 'text' },
    { key: 'validityText', label: 'Thời gian hiệu lực', type: 'text' },
    { key: 'statusText', label: 'Trạng thái', type: 'status', sortable: true }
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
    },
    {
      key: 'discountType',
      label: 'Loại giảm giá',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả loại' },
        { value: 'PERCENTAGE', label: 'Phần trăm (%)' },
        { value: 'FIXED', label: 'Số tiền cố định' }
      ]
    }
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();

  currentSearch = '';
  currentStatusFilter = '';
  currentTypeFilter = '';
  isLoading = false;

  errorMessage = '';

  // Confirm dialog
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' | 'danger' = 'warning';
  pendingAction: { type: 'toggle' | 'delete' | 'bulk_delete'; row?: any; ids?: string[] } | null = null;
  isProcessing = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadCoupons();
  }

  loadCoupons(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: any = {
      page: this.pagination.page,
      limit: this.pagination.pageSize
    };

    if (this.currentSearch) {
      params.search = this.currentSearch;
    }
    if (this.currentStatusFilter) {
      params.isActive = this.currentStatusFilter;
    }
    if (this.currentTypeFilter) {
      params.discountType = this.currentTypeFilter;
    }

    this.apiService.getCoupons(params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && Array.isArray(res.data)) {
          this.data = res.data.map((item: any) => {
            const isActive = item.isActive !== false;
            const discountType = item.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
            const discountTypeLabel = discountType === 'PERCENTAGE' ? 'Phần trăm (%)' : 'Số tiền cố định';

            let discountValueFormatted = '';
            if (discountType === 'PERCENTAGE') {
              discountValueFormatted = `${item.discountValue}%`;
              if (item.maxDiscount > 0) {
                discountValueFormatted += ` (tối đa ${Number(item.maxDiscount).toLocaleString('vi-VN')} ₫)`;
              }
            } else {
              discountValueFormatted = `${Number(item.discountValue).toLocaleString('vi-VN')} ₫`;
            }

            const minOrderValueFormatted = item.minOrderValue > 0
              ? `${Number(item.minOrderValue).toLocaleString('vi-VN')} ₫`
              : '0 ₫';

            const usedCount = Number(item.usedCount) || 0;
            const usageLimit = Number(item.usageLimit) || 0;
            const remainingUsage = Math.max(0, usageLimit - usedCount);
            const usageText = `${usedCount} / ${usageLimit} (còn ${remainingUsage})`;

            const startStr = item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : '—';
            const endStr = item.endDate ? new Date(item.endDate).toLocaleDateString('vi-VN') : 'Không giới hạn';
            const validityText = `${startStr} - ${endStr}`;

            return {
              ...item,
              id: item._id || item.id,
              discountTypeLabel,
              discountValueFormatted,
              minOrderValueFormatted,
              usageText,
              validityText,
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
          this.errorMessage = res?.message || 'Không thể tải danh sách mã giảm giá.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải danh sách mã giảm giá:', err);
        this.errorMessage = err?.error?.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }

  onAddCoupon(): void {
    this.router.navigate(['/admin/pages/coupons/new']);
  }

  onAction(e: ActionEvent): void {
    const row = e.row;
    const itemId = row._id || row.id;

    if (e.action === 'view') {
      this.router.navigate(['/admin/pages/coupons', itemId]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/pages/coupons', itemId, 'edit']);
    } else if (e.action === 'toggle_off') {
      this.pendingAction = { type: 'toggle', row };
      this.confirmTitle = 'Tắt mã giảm giá';
      this.confirmMessage = `Bạn có chắc chắn muốn tắt mã giảm giá "${row.code}"? Khách hàng sẽ không thể sử dụng mã này.`;
      this.confirmLabel = 'Tắt mã';
      this.confirmVariant = 'warning';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    } else if (e.action === 'toggle_on') {
      this.pendingAction = { type: 'toggle', row };
      this.confirmTitle = 'Bật mã giảm giá';
      this.confirmMessage = `Bạn có muốn bật lại mã giảm giá "${row.code}" cho khách hàng sử dụng?`;
      this.confirmLabel = 'Bật mã';
      this.confirmVariant = 'default';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    } else if (e.action === 'delete') {
      this.pendingAction = { type: 'delete', row };
      this.confirmTitle = 'Xóa mã giảm giá';
      this.confirmMessage = `Bạn có chắc chắn muốn xóa mã giảm giá "${row.code}"? Thao tác này không thể hoàn tác.`;
      this.confirmLabel = 'Xóa mã';
      this.confirmVariant = 'danger';
      this.confirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  onSearch(term: string): void {
    this.currentSearch = term.trim();
    this.pagination.page = 1;
    this.selectedIds.clear();
    this.loadCoupons();
  }

  onFilter(filters: Record<string, any>): void {
    this.currentStatusFilter = filters['status'] || '';
    this.currentTypeFilter = filters['discountType'] || '';
    this.pagination.page = 1;
    this.selectedIds.clear();
    this.loadCoupons();
  }

  onRefresh(): void {
    this.selectedIds.clear();
    this.loadCoupons();
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.loadCoupons();
  }

  onSelectionChange(selected: Set<any>): void {
    this.selectedIds = new Set(selected);
    this.cdr.markForCheck();
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds.clear();
    } else {
      this.data.forEach((row) => this.selectedIds.add(row._id || row.id));
    }
    this.cdr.markForCheck();
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every((r) => this.selectedIds.has(r._id || r.id));
  }

  get isIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  get displayTotal(): number {
    return this.pagination?.total ?? this.data.length;
  }

  onDeleteSelected(): void {
    if (this.selectedCount === 0) return;
    const ids = Array.from(this.selectedIds);
    this.pendingAction = { type: 'bulk_delete', ids };
    this.confirmTitle = 'Xóa các mã giảm giá đã chọn';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${this.selectedCount} mã giảm giá đã chọn? Hành động này không thể hoàn tác.`;
    this.confirmLabel = `Xóa ${this.selectedCount} mục`;
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  confirmDialogAction(): void {
    if (!this.pendingAction || this.isProcessing) return;

    this.isProcessing = true;
    const action = this.pendingAction;

    if (action.type === 'bulk_delete') {
      const ids = action.ids || [];
      this.apiService.bulkDeleteCoupons(ids).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.selectedIds.clear();
          this.notificationService.success(res?.message || 'Xóa các mã giảm giá thành công.');
          this.loadCoupons();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.notificationService.error(err?.error?.message || 'Lỗi khi xóa các mã giảm giá.');
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const row = action.row;
    const itemId = row._id || row.id;

    if (action.type === 'toggle') {
      const targetState = !(row.isActive !== false);
      this.apiService.updateCouponStatus(itemId, targetState).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.notificationService.success(res?.message || `Mã giảm giá đã được ${targetState ? 'bật' : 'tắt'}`);
          this.loadCoupons();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.notificationService.error(err?.error?.message || 'Lỗi khi cập nhật trạng thái.');
          this.cdr.markForCheck();
        }
      });
    } else if (action.type === 'delete') {
      this.apiService.deleteCoupon(itemId).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.selectedIds.delete(itemId);
          this.notificationService.success(res?.message || 'Xóa mã giảm giá thành công.');
          this.loadCoupons();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.pendingAction = null;
          this.notificationService.error(err?.error?.message || 'Lỗi khi xóa mã giảm giá.');
          this.cdr.markForCheck();
        }
      });
    }
  }

  cancelDialogAction(): void {
    this.confirmOpen = false;
    this.pendingAction = null;
    this.isProcessing = false;
    this.cdr.markForCheck();
  }
}
