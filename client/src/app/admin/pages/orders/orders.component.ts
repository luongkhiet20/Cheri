import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'code', label: 'Mã đơn', type: 'text', sortable: true },
    { key: 'customer', label: 'Khách hàng', type: 'text' },
    { key: 'total', label: 'Tổng tiền', type: 'currency', sortable: true, align: 'right' },
    { key: 'payment', label: 'Thanh toán', type: 'text' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
    { key: 'createdAt', label: 'Ngày đặt', type: 'date', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
  ];
  filterFields: FilterField[] = [
    {
      key: 'status', label: 'Trạng thái', type: 'select', options: [
        { value: 'Đã giao', label: 'Đã giao' },
        { value: 'Đang giao', label: 'Đang giao' },
        { value: 'Đang xử lý', label: 'Đang xử lý' },
        { value: 'Chờ xác nhận', label: 'Chờ xác nhận' },
        { value: 'Đã xác nhận', label: 'Đã xác nhận' },
        { value: 'Đã hủy', label: 'Đã hủy' },
        { value: 'Đã hoàn trả', label: 'Đã hoàn trả' },
      ]
    },
    {
      key: 'payment', label: 'Thanh toán', type: 'select', options: []
    },
  ];

  data: any[] = [];
  allOrders: any[] = [];
  paymentMethods: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
  isLoadingPaymentMethods = false;
  initialStatusFilter = '';

  selectedIds: Set<any> = new Set();
  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id));
  }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.route.queryParams.subscribe(params => {
      const st = params['status'];
      if (st) {
        // Map common codes to labels
        const map: Record<string, string> = {
          'delivered': 'Đã giao',
          'pending': 'Chờ xác nhận',
          'confirmed': 'Đã xác nhận',
          'processing': 'Đang xử lý',
          'shipping': 'Đang giao',
          'cancelled': 'Đã hủy',
          'returned': 'Đã hoàn trả'
        };
        this.initialStatusFilter = map[st.toLowerCase()] || st;
      }
      this.loadOrders();
    });
  }

  loadPaymentMethods(): void {
    this.isLoadingPaymentMethods = true;
    this.loadPaymentMethodsPage(1, []);
  }

  private loadPaymentMethodsPage(page: number, accumulatedMethods: any[]): void {
    this.apiService.getPaymentMethods({ page, limit: 100 }).subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.data)) {
          this.finishPaymentMethodsLoad([]);
          return;
        }

        const methods = [...accumulatedMethods, ...res.data];
        const rawTotalPages = Number(res.totalPages ?? res.pagination?.totalPages ?? 1);
        const totalPages = Number.isFinite(rawTotalPages) && rawTotalPages > 0
          ? Math.floor(rawTotalPages)
          : 1;

        if (page < totalPages) {
          this.loadPaymentMethodsPage(page + 1, methods);
          return;
        }

        this.finishPaymentMethodsLoad(methods);
      },
      error: (err) => {
        console.error('Lỗi khi tải phương thức thanh toán cho bộ lọc đơn hàng:', err);
        this.finishPaymentMethodsLoad([]);
      }
    });
  }

  private finishPaymentMethodsLoad(methods: any[]): void {
    const seen = new Set<string>();
    this.isLoadingPaymentMethods = false;
    this.paymentMethods = methods
      .map((method: any) => ({
        ...method,
        filterValue: this.getPaymentMethodFilterValue(method)
      }))
      .filter((method: any) => {
        if (!method.filterValue || seen.has(method.filterValue)) return false;
        seen.add(method.filterValue);
        return true;
      });

    const options = this.paymentMethods.map((method: any) => ({
      value: method.filterValue,
      label: this.getDisplayString(method.name) || this.getDisplayString(method.code) || method.filterValue
    }));
    this.setPaymentFilterOptions(options);
    this.cdr.markForCheck();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.apiService.getOrders().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allOrders = (res.data || []).map((o: any) => ({
            ...o,
            id: o._id || o.id,
            status: o.statusText || o.status,
            statusVariant: o.statusVariant || 'neutral'
          }));
          if (this.initialStatusFilter) {
            this.data = this.allOrders.filter(o => o.status === this.initialStatusFilter);
          } else {
            this.data = [...this.allOrders];
          }
          this.pagination = { ...this.pagination, total: this.data.length };
          this.selectedIds.clear();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải đơn hàng từ MongoDB:', err);
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
    const count = this.selectedCount;
    if (count === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn không?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.pendingDeleteId) {
      this.apiService.deleteOrder(this.pendingDeleteId).subscribe({
        next: () => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.loadOrders();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          console.error(err);
          this.cdr.markForCheck();
        }
      });
    } else if (this.isBulkDelete && this.selectedIds.size > 0) {
      this.apiService.bulkDeleteOrders(Array.from(this.selectedIds)).subscribe({
        next: () => {
          this.selectedIds.clear();
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.loadOrders();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.isBulkDelete = false;
          console.error('Lỗi xóa hàng loạt đơn hàng:', err);
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

  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      const orderDocId = e.row._id || e.row.id;
      this.router.navigate(['/admin/orders', orderDocId]);
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allOrders];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    const q = v.toLowerCase();
    this.data = this.allOrders.filter(o =>
      (o.code || '').toLowerCase().includes(q) ||
      (o.customer || '').toLowerCase().includes(q) ||
      (o.payment || '').toLowerCase().includes(q)
    );
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onFilter(v: Record<string, any>): void {
    let filtered = [...this.allOrders];
    if (v['status']) {
      filtered = filtered.filter(o => o.status === v['status']);
    }
    if (v['payment']) {
      const paymentFilter = this.normalizePaymentValue(v['payment']);
      filtered = filtered.filter(o => this.getOrderPaymentFilterValue(o) === paymentFilter);
    }
    this.data = filtered;
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onRefresh(): void { this.loadPaymentMethods(); this.loadOrders(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; this.cdr.markForCheck(); }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; this.cdr.markForCheck(); }

  private setPaymentFilterOptions(options: Array<{ value: string; label: string }>): void {
    this.filterFields = this.filterFields.map(field =>
      field.key === 'payment' ? { ...field, options } : field
    );
  }

  private getPaymentMethodFilterValue(method: any): string {
    return this.normalizePaymentValue(method?.code)
      || this.normalizePaymentValue(method?._id)
      || this.normalizePaymentValue(method?.id)
      || '';
  }

  private getOrderPaymentFilterValue(order: any): string {
    const snapshotCode = this.normalizePaymentValue(order?.paymentMethodSnapshot?.code);
    if (snapshotCode) return snapshotCode;

    const explicitCode = this.normalizePaymentValue(order?.paymentMethodCode);
    if (explicitCode) return explicitCode;

    const paymentMethodId = this.getDisplayString(order?.paymentMethodId);
    if (paymentMethodId) {
      const method = this.paymentMethods.find((candidate: any) =>
        this.getDisplayString(candidate?._id) === paymentMethodId
        || this.getDisplayString(candidate?.id) === paymentMethodId
      );
      if (method?.filterValue) return method.filterValue;
    }

    return '';
  }

  private normalizePaymentValue(value: any): string {
    const text = this.getDisplayString(value);
    return text ? text.toUpperCase() : '';
  }

  private getDisplayString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
