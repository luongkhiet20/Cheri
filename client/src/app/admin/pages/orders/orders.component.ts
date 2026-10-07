import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { escapeCsvTextField, paymentStatusLabel } from './orders-report-csv.cjs';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'code', label: 'Mã đơn', type: 'text', sortable: true },
    { key: 'customer', label: 'Khách hàng', type: 'text', sortable: true },
    { key: 'total', label: 'Tổng tiền', type: 'currency', sortable: true, align: 'right' },
    { key: 'payment', label: 'Thanh toán', type: 'text', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
    { key: 'createdAt', label: 'Ngày đặt', type: 'date', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    { key: 'delete', label: 'Xóa', variant: 'danger' },
  ];
  filterFields: FilterField[] = [
    {
      key: 'status', label: 'Trạng thái', type: 'select', value: '', options: [
        { value: 'DELIVERED', label: 'Đã giao' },
        { value: 'SHIPPING', label: 'Đang giao' },

        { value: 'PROCESSING', label: 'Đang xử lý' },
        { value: 'PENDING', label: 'Chờ xác nhận' },

        { value: 'CANCELLED', label: 'Đã hủy' },
        { value: 'RETURNED', label: 'Đã hoàn trả' },
      ]
    },
    {
      key: 'payment', label: 'Thanh toán', type: 'select', value: '', options: []
    },
  ];

  data: any[] = [];
  paymentMethods: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
  isExporting = false;
  isLoadingPaymentMethods = false;
  isDeleting = false;
  successMessage = '';
  errorMessage = '';
  searchTerm = '';
  selectedStatus = '';
  selectedPaymentMethod = '';
  private hasInitializedQueryState = false;
  private skipNextResetFilterLoad = false;
  private ordersRequestId = 0;
  private readonly orderStatusCodes = new Set([
    'PENDING', 'PROCESSING', 'SHIPPING', 'DELIVERY_FAILED', 'DELIVERED', 'CANCELLED', 'RETURNED'
  ]);

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
  pendingBulkDeleteIds: any[] = [];
  pendingBulkQueryState: {
    searchTerm: string;
    selectedStatus: string;
    selectedPaymentMethod: string;
    page: number;
    pageSize: number;
  } | null = null;
  isBulkDelete = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.route.queryParams.subscribe(params => {
      const rawRouteStatus = this.normalizePaymentValue(params['status']);
      const routeStatus = this.getCanonicalOrderStatus(params['status']);
      const hasStatusParam = Object.prototype.hasOwnProperty.call(params, 'status');
      const shouldLoad = !this.hasInitializedQueryState || routeStatus !== this.selectedStatus;
      this.selectedStatus = routeStatus;
      this.syncFilterFieldValues();
      this.hasInitializedQueryState = true;
      if (shouldLoad) {
        this.pagination = { ...this.pagination, page: 1 };
        this.loadOrders();
      }
      if (hasStatusParam && !routeStatus) {
        this.updateStatusQueryParam('');
      } else if (routeStatus && rawRouteStatus !== routeStatus) {
        this.updateStatusQueryParam(routeStatus);
      }
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

  loadOrders(options: { preserveError?: boolean; preserveSelection?: boolean } = {}): void {
    const requestId = ++this.ordersRequestId;
    this.isLoading = true;
    if (!options.preserveError) {
      this.errorMessage = '';
    }
    this.apiService.getOrders({
      page: this.pagination.page,
      limit: this.pagination.pageSize,
      search: this.searchTerm || undefined,
      status: this.selectedStatus || undefined,
      paymentMethod: this.selectedPaymentMethod || undefined
    }).subscribe({
      next: (res) => {
        if (requestId !== this.ordersRequestId) return;
        this.isLoading = false;
        if (res.success) {
          this.data = (res.data || []).map((o: any) => ({
            ...o,
            id: o._id || o.id,
            status: o.statusText || o.status,
            statusVariant: o.statusVariant || 'neutral'
          }));
          const responsePagination = res.pagination || {};
          const responsePage = Number(responsePagination.page);
          const responsePageSize = Number(responsePagination.pageSize);
          const responseTotal = Number(responsePagination.total);
          this.pagination = {
            page: Number.isFinite(responsePage) && responsePage > 0 ? responsePage : this.pagination.page,
            pageSize: Number.isFinite(responsePageSize) && responsePageSize > 0
              ? responsePageSize
              : this.pagination.pageSize,
            total: Number.isFinite(responseTotal) && responseTotal >= 0 ? responseTotal : this.data.length
          };
          if (!options.preserveSelection) {
            this.selectedIds.clear();
          }
        } else {
          this.errorMessage = 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (requestId !== this.ordersRequestId) return;
        this.isLoading = false;
        this.errorMessage = 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.';
        console.error('Lỗi khi tải đơn hàng từ MongoDB:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onSelectionChange(ids: Set<any>): void { this.selectedIds = new Set(ids); }

  onAddOrder(): void {
    this.router.navigate(['/admin/orders/add']);
  }

  onExportOrders(): void {
    if (this.isExporting || this.isLoading) return;

    this.isExporting = true;
    this.successMessage = '';
    this.errorMessage = '';

    // Nếu người dùng đã tick chọn một số đơn hàng cụ thể trên bảng
    if (this.selectedCount > 0) {
      const selectedOrders = this.data.filter((r: any) => this.selectedIds.has(r.id));
      this.generateAndDownloadReport(selectedOrders);
      this.isExporting = false;
      this.successMessage = `Đã xuất báo cáo thành công cho ${selectedOrders.length} đơn hàng đã chọn.`;
      this.cdr.markForCheck();
      return;
    }

    // Nếu không tick chọn đơn cụ thể, tiến hành lấy toàn bộ đơn hàng phù hợp với bộ lọc hiện tại
    this.fetchAllOrdersForExport(1, []);
  }

  private fetchAllOrdersForExport(page: number, accumulatedOrders: any[]): void {
    this.apiService.getOrders({
      page,
      limit: 100,
      search: this.searchTerm || undefined,
      status: this.selectedStatus || undefined,
      paymentMethod: this.selectedPaymentMethod || undefined
    }).subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.data)) {
          this.isExporting = false;
          this.errorMessage = 'Không thể lấy dữ liệu đơn hàng để xuất báo cáo.';
          this.cdr.markForCheck();
          return;
        }

        const allOrders = [...accumulatedOrders, ...res.data];
        const pagination = res.pagination || {};
        const totalPages = Number(pagination.totalPages) || 1;

        if (page < totalPages) {
          this.fetchAllOrdersForExport(page + 1, allOrders);
          return;
        }

        if (allOrders.length === 0) {
          this.isExporting = false;
          this.errorMessage = 'Không có đơn hàng nào phù hợp với bộ lọc để xuất báo cáo.';
          this.cdr.markForCheck();
          return;
        }

        this.generateAndDownloadReport(allOrders);
        this.isExporting = false;
        this.successMessage = `Đã xuất báo cáo thành công cho ${allOrders.length} đơn hàng.`;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isExporting = false;
        this.errorMessage = 'Có lỗi xảy ra khi tải dữ liệu xuất báo cáo. Vui lòng thử lại.';
        console.error('Lỗi xuất báo cáo đơn hàng:', err);
        this.cdr.markForCheck();
      }
    });
  }

  private generateAndDownloadReport(orders: any[]): void {
    const headers = [
      'Mã đơn hàng',
      'Ngày đặt',
      'Khách hàng',
      'Số điện thoại',
      'Email',
      'Địa chỉ giao hàng',
      'Danh sách sản phẩm',
      'Tổng số lượng món',
      'Tiền hàng',
      'Phí vận chuyển',
      'Giảm giá',
      'Mã giảm giá',
      'Tổng thanh toán',
      'Hình thức thanh toán',
      'Trạng thái thanh toán',
      'Trạng thái đơn hàng',
      'Đơn vị vận chuyển',
      'Mã vận đơn',
      'Ghi chú đơn hàng'
    ];

    const lines: string[] = [headers.join(',')];

    for (const o of orders) {
      // 1. Mã đơn
      const code = this.escapeCsvField(o.orderId || o.code || '');

      // 2. Ngày đặt (DD/MM/YYYY HH:mm)
      const rawDate = o.createdAt || o.dateAdded;
      const formattedDate = this.escapeCsvField(this.formatReportDateTime(rawDate));

      // 3. Khách hàng
      const customer = this.escapeCsvField(o.customer || o.shippingAddress?.fullName || '');

      // 4. Số điện thoại (dạng ="..." để Excel giữ nguyên số 0 đầu)
      const rawPhone = o.customerPhone || o.phone || o.shippingAddress?.phone || '';
      const phone = escapeCsvTextField(rawPhone);

      // 5. Email
      const email = this.escapeCsvField(o.customerEmail || '');

      // 6. Địa chỉ giao hàng
      const addr = o.shippingAddress;
      let fullAddress = '';
      if (addr) {
        const parts = [addr.address, addr.ward, addr.district, addr.province].filter(p => typeof p === 'string' && p.trim());
        fullAddress = parts.join(', ');
      }
      const addressField = this.escapeCsvField(fullAddress);

      // 7. Danh sách sản phẩm: [Tên SP (Phân loại) x Số lượng (Đơn giá)]
      const items = Array.isArray(o.items) ? o.items : [];
      const itemSummaries: string[] = [];
      for (const it of items) {
        const title = it.productSnapshot?.title || it.title || 'Sản phẩm';
        const variantParts: string[] = [];
        if (it.productSnapshot?.variant?.color) variantParts.push(`Màu: ${it.productSnapshot.variant.color}`);
        if (it.productSnapshot?.variant?.size) variantParts.push(`Size: ${it.productSnapshot.variant.size}`);
        if (it.productSnapshot?.variant?.classification) variantParts.push(it.productSnapshot.variant.classification);
        const variantText = variantParts.length > 0 ? ` (${variantParts.join(' - ')})` : '';
        const qty = it.quantity != null ? it.quantity : 1;
        const price = it.unitPrice != null ? it.unitPrice.toLocaleString('vi-VN') + 'đ' : '';
        itemSummaries.push(`${title}${variantText} x ${qty} [${price}]`);
      }
      const itemsField = this.escapeCsvField(itemSummaries.join(' | '));

      // 8. Tổng số lượng món
      const totalItemsCount = o.itemsCount != null
        ? o.itemsCount
        : items.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0);

      // 9. Tiền hàng
      const subtotal = o.subtotal != null ? o.subtotal : (o.total || o.totalAmount || 0);

      // 10. Phí vận chuyển
      const shippingFee = o.shippingFee != null ? o.shippingFee : 0;

      // 11. Giảm giá
      const discount = (o.discountAmount || 0) + (o.couponDiscount || 0);

      // 12. Mã giảm giá
      const couponCode = this.escapeCsvField(o.couponCode || '');

      // 13. Tổng thanh toán
      const totalAmount = o.totalAmount != null ? o.totalAmount : (o.total || 0);

      // 14. Hình thức thanh toán
      const paymentMethod = this.escapeCsvField(o.payment || o.paymentMethodSnapshot?.name || o.paymentMethodCode || '');

      // 15. Trạng thái thanh toán
      const paymentStatus = this.escapeCsvField(this.getPaymentStatusLabel(o.paymentStatus));

      // 16. Trạng thái đơn hàng
      const orderStatus = this.escapeCsvField(o.statusText || o.status || '');

      // 17. Đơn vị vận chuyển
      const shippingProvider = this.escapeCsvField(o.shippingProvider || o.shippingMethodSnapshot?.name || '');

      // 18. Mã vận đơn
      const trackingNumber = escapeCsvTextField(o.trackingNumber || '');

      // 19. Ghi chú
      const notes = this.escapeCsvField(o.notes || '');

      const row = [
        code,
        formattedDate,
        customer,
        phone,
        email,
        addressField,
        itemsField,
        totalItemsCount,
        subtotal,
        shippingFee,
        discount,
        couponCode,
        totalAmount,
        paymentMethod,
        paymentStatus,
        orderStatus,
        shippingProvider,
        trackingNumber,
        notes
      ];

      lines.push(row.join(','));
    }

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `don-hang-cheri-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  private escapeCsvField(val: any): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  private formatReportDateTime(dateVal: any): string {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return String(dateVal);
    }
  }

  private getPaymentStatusLabel(status: string): string {
    return paymentStatusLabel(status);
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) { this.selectedIds = new Set(); }
    else { this.selectedIds = new Set(this.data.map((r: any) => r.id)); }
  }

  onDeleteSelected(): void {
    if (this.isDeleting || this.isLoading) return;
    const count = this.selectedCount;
    if (count === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.pendingBulkDeleteIds = Array.from(this.selectedIds);
    this.pendingBulkQueryState = {
      searchTerm: this.searchTerm,
      selectedStatus: this.selectedStatus,
      selectedPaymentMethod: this.selectedPaymentMethod,
      page: this.pagination.page,
      pageSize: this.pagination.pageSize
    };
    this.successMessage = '';
    this.errorMessage = '';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn không?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.isDeleting) return;

    if (this.pendingDeleteId) {
      const deleteId = this.pendingDeleteId;
      this.isDeleting = true;
      this.ordersRequestId += 1;
      this.isLoading = false;
      this.successMessage = '';
      this.errorMessage = '';
      this.apiService.deleteOrder(deleteId).subscribe({
        next: (res) => {
          this.isDeleting = false;
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.isBulkDelete = false;
          if (!res?.success) {
            this.errorMessage = 'Không thể xóa đơn hàng. Vui lòng thử lại.';
            this.notificationService.error(this.errorMessage);
            this.loadOrders({ preserveError: true });
            this.cdr.markForCheck();
            return;
          }
          this.selectedIds.delete(deleteId);
          this.selectedIds = new Set(this.selectedIds);
          this.successMessage = 'Xóa đơn hàng thành công.';
          this.notificationService.success(this.successMessage);
          this.loadOrders();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isDeleting = false;
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.isBulkDelete = false;
          this.errorMessage = 'Không thể xóa đơn hàng. Vui lòng thử lại.';
          this.notificationService.error(this.errorMessage);
          this.loadOrders({ preserveError: true });
          console.error('Lỗi xóa đơn hàng:', err);
          this.cdr.markForCheck();
        }
      });
    } else if (this.isBulkDelete && this.pendingBulkDeleteIds.length > 0) {
      const deleteIds = [...this.pendingBulkDeleteIds];
      this.isDeleting = true;
      this.ordersRequestId += 1;
      this.isLoading = false;
      this.successMessage = '';
      this.errorMessage = '';
      this.apiService.bulkDeleteOrders(deleteIds).subscribe({
        next: (res) => {
          this.isDeleting = false;
          this.confirmOpen = false;
          this.isBulkDelete = false;
          if (!res?.success) {
            this.restorePendingBulkQueryState();
            this.pendingBulkDeleteIds = [];
            this.pendingBulkQueryState = null;
            this.selectedIds = new Set(deleteIds);
            this.errorMessage = 'Không thể xóa các đơn hàng đã chọn. Vui lòng thử lại.';
            this.notificationService.error(this.errorMessage);
            this.loadOrders({ preserveError: true, preserveSelection: true });
            this.cdr.markForCheck();
            return;
          }
          this.pendingBulkDeleteIds = [];
          this.pendingBulkQueryState = null;
          this.selectedIds.clear();
          this.successMessage = 'Xóa các đơn hàng đã chọn thành công.';
          this.notificationService.success(this.successMessage);
          this.loadOrders();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isDeleting = false;
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.restorePendingBulkQueryState();
          this.pendingBulkDeleteIds = [];
          this.pendingBulkQueryState = null;
          this.selectedIds = new Set(deleteIds);
          this.errorMessage = 'Không thể xóa các đơn hàng đã chọn. Vui lòng thử lại.';
          this.notificationService.error(this.errorMessage);
          this.loadOrders({ preserveError: true, preserveSelection: true });
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
    if (this.isDeleting) return;
    if (this.isBulkDelete && this.pendingBulkDeleteIds.length > 0) {
      this.selectedIds = new Set(this.pendingBulkDeleteIds);
    }
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.pendingBulkDeleteIds = [];
    this.pendingBulkQueryState = null;
    this.isBulkDelete = false;
    this.cdr.markForCheck();
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      const orderDocId = e.row._id || e.row.id;
      this.router.navigate(['/admin/orders', orderDocId]);
    } else if (e.action === 'edit') {
      const orderDocId = e.row._id || e.row.id;
      if (orderDocId) this.router.navigate(['/admin/orders', orderDocId, 'edit']);
    } else if (e.action === 'delete') {
      const orderDocId = e.row._id || e.row.id;
      if (!orderDocId) {
        this.errorMessage = 'Không thể xác định đơn hàng cần xóa.';
        this.cdr.markForCheck();
        return;
      }
      this.pendingDeleteId = orderDocId;
      this.pendingBulkDeleteIds = [];
      this.pendingBulkQueryState = null;
      this.isBulkDelete = false;
      this.confirmMessage = 'Bạn có chắc muốn xóa đơn hàng này?';
      this.confirmOpen = true;
      this.successMessage = '';
      this.errorMessage = '';
      this.cdr.markForCheck();
    }
  }

  onSearch(v: string): void {
    const searchTerm = (v || '').trim();
    if (this.isDeleting) {
      this.searchTerm = searchTerm;
      this.pagination = { ...this.pagination, page: 1 };
      return;
    }
    if (!this.prepareForQueryChange()) return;
    if (searchTerm === this.searchTerm && this.pagination.page === 1) return;
    this.searchTerm = searchTerm;
    this.pagination = { ...this.pagination, page: 1 };
    this.loadOrders();
  }

  onFilter(v: Record<string, any>): void {
    if (!this.prepareForQueryChange()) return;
    const status = this.normalizePaymentValue(v['status']);
    this.selectedStatus = this.orderStatusCodes.has(status) ? status : '';
    this.selectedPaymentMethod = this.normalizePaymentValue(v['payment']);
    this.pagination = { ...this.pagination, page: 1 };
    this.syncFilterFieldValues();
    const skipLoad = this.skipNextResetFilterLoad
      && !this.selectedStatus
      && !this.selectedPaymentMethod;
    this.skipNextResetFilterLoad = false;
    if (!skipLoad) {
      this.loadOrders();
      this.updateStatusQueryParam(this.selectedStatus);
    }
  }

  onFilterReset(): void {
    if (!this.prepareForQueryChange()) return;
    this.selectedStatus = '';
    this.selectedPaymentMethod = '';
    this.pagination = { ...this.pagination, page: 1 };
    this.skipNextResetFilterLoad = true;
    this.syncFilterFieldValues();
    this.loadOrders();
    this.updateStatusQueryParam('');
  }

  onRefresh(): void {
    if (!this.prepareForQueryChange()) return;
    this.loadPaymentMethods();
    this.loadOrders();
  }
  onPageChange(p: number): void {
    if (!this.prepareForQueryChange()) return;
    if (!Number.isFinite(p) || p < 1 || p === this.pagination.page) return;
    this.pagination = { ...this.pagination, page: p };
    this.loadOrders();
  }
  onPageSizeChange(s: number): void {
    if (!this.prepareForQueryChange()) return;
    if (!Number.isFinite(s) || s < 1) return;
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.loadOrders();
  }

  private prepareForQueryChange(): boolean {
    if (this.isDeleting) return false;
    if (this.confirmOpen) {
      this.onCancelDelete();
    }
    return true;
  }

  private restorePendingBulkQueryState(): void {
    if (!this.pendingBulkQueryState) return;
    const state = this.pendingBulkQueryState;
    this.searchTerm = state.searchTerm;
    this.selectedStatus = state.selectedStatus;
    this.selectedPaymentMethod = state.selectedPaymentMethod;
    this.pagination = {
      ...this.pagination,
      page: state.page,
      pageSize: state.pageSize
    };
    this.syncFilterFieldValues();
  }

  private setPaymentFilterOptions(options: Array<{ value: string; label: string }>): void {
    this.filterFields = this.filterFields.map(field =>
      field.key === 'payment'
        ? { ...field, value: this.selectedPaymentMethod, options }
        : field.key === 'status'
          ? { ...field, value: this.selectedStatus }
          : field
    );
  }

  private syncFilterFieldValues(): void {
    this.filterFields = this.filterFields.map(field => {
      if (field.key === 'status') return { ...field, value: this.selectedStatus };
      if (field.key === 'payment') return { ...field, value: this.selectedPaymentMethod };
      return field;
    });
  }

  private updateStatusQueryParam(status: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: status ? status.toLowerCase() : null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private getPaymentMethodFilterValue(method: any): string {
    return this.normalizePaymentValue(method?.code)
      || this.normalizePaymentValue(method?._id)
      || this.normalizePaymentValue(method?.id)
      || '';
  }

  private normalizePaymentValue(value: any): string {
    const text = this.getDisplayString(value);
    return text ? text.toUpperCase() : '';
  }

  private getCanonicalOrderStatus(value: any): string {
    const normalizedValue = this.normalizePaymentValue(value);
    if (this.orderStatusCodes.has(normalizedValue)) return normalizedValue;

    const statusField = this.filterFields.find(field => field.key === 'status');
    const matchingOption = statusField?.options?.find(option =>
      this.normalizePaymentValue(option.label) === normalizedValue
    );
    const optionCode = this.normalizePaymentValue(matchingOption?.value);
    return this.orderStatusCodes.has(optionCode) ? optionCode : '';
  }

  private getDisplayString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
