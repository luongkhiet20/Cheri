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
        { value: 'Đã hủy', label: 'Đã hủy' },
      ]
    },
    {
      key: 'payment', label: 'Thanh toán', type: 'select', options: [
        { value: 'COD', label: 'COD' },
        { value: 'Chuyển khoản', label: 'Chuyển khoản' },
        { value: 'MoMo', label: 'MoMo' },
      ]
    },
  ];

  data: any[] = [];
  allOrders: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
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
    this.route.queryParams.subscribe(params => {
      const st = params['status'];
      if (st) {
        // Map common codes to labels
        const map: Record<string, string> = {
          'delivered': 'Đã giao',
          'pending': 'Chờ xác nhận',
          'processing': 'Đang xử lý',
          'shipping': 'Đang giao',
          'cancelled': 'Đã hủy'
        };
        this.initialStatusFilter = map[st.toLowerCase()] || st;
      }
      this.loadOrders();
    });
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
      filtered = filtered.filter(o => o.payment === v['payment']);
    }
    this.data = filtered;
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onRefresh(): void { this.loadOrders(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; this.cdr.markForCheck(); }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; this.cdr.markForCheck(); }
}
