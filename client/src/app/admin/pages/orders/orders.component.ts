/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { escapeCsvTextField, paymentStatusLabel } from '../../../utils/orders-report-csv.cjs';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { formatVND } from '../../../pipes/price.pipe';

@Component({
  selector: 'app-orders',
  standalone: false,
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Kinh doanh' },
    { label: 'Quản lý đơn hàng' }
  ];

  columns: TableColumn[] = [
    { key: 'code', label: 'Mã đơn', type: 'text', sortable: true },
    { key: 'customer', label: 'Khách hàng', type: 'text', sortable: true },
    { key: 'total', label: 'Tổng tiền', type: 'currency', sortable: true, align: 'right' },
    { key: 'payment', label: 'Thanh toán', type: 'text', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
    { key: 'returnStatus', label: 'Trạng thái yêu cầu', type: 'status', sortable: true },
    { key: 'createdAt', label: 'Ngày đặt', type: 'date', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'edit', label: 'Cập nhật trạng thái' },
    { key: 'view', label: 'Xem' },


  ];
  filterFields: FilterField[] = [
    {
      key: 'status', label: 'Trạng thái đơn hàng', type: 'select', value: '', options: [
        { value: '', label: 'Tất cả trạng thái' },
        { value: 'PENDING', label: 'Chờ xác nhận' },
        { value: 'PROCESSING', label: 'Đang xử lý' },
        { value: 'SHIPPING', label: 'Đang giao' },
        { value: 'DELIVERED', label: 'Đã giao' },
        { value: 'RETURNED', label: 'Trả hàng' },
        { value: 'CANCELLED', label: 'Đã hủy' },
      ]
    },
    {
      key: 'returnStatus', label: 'Trạng thái yêu cầu', type: 'select', value: '', options: [
        { value: '', label: 'Tất cả yêu cầu' },
        { value: 'PENDING', label: 'Chờ duyệt trả hàng' },
        { value: 'APPROVED', label: 'Đã duyệt trả hàng' },
        { value: 'RETURN_SHIPPED', label: 'Đang trả hàng' },
        { value: 'RETURN_RECEIVED', label: 'Đã nhận hàng trả' },
        { value: 'INSPECTED', label: 'Đang xử lý hoàn tiền' },
        { value: 'COMPLETED', label: 'Đã hoàn tiền' },
        { value: 'REJECTED', label: 'Yêu cầu bị từ chối' },
        { value: 'CANCELLED', label: 'Yêu cầu đã hủy' },
        { value: 'NONE', label: 'Chưa có yêu cầu' },
      ],
      showWhen: (values) => values['status'] === 'RETURNED'
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
  errorMessage = '';
  searchTerm = '';
  selectedStatus = '';
  selectedReturnStatus = '';
  selectedPaymentMethod = '';
  pendingReturnCount = 0;
  isStatusModalOpen = false;
  selectedOrderForStatus: any = null;
  selectedStatusModalTab: 'order' | 'return' = 'order';
  private hasInitializedQueryState = false;
  private skipNextResetFilterLoad = false;
  private ordersRequestId = 0;
  private readonly orderStatusCodes = new Set([
    'DELIVERED', 'SHIPPING', 'PROCESSING', 'PENDING', 'CANCELLED', 'RETURNED'
  ]);
  private readonly returnStatusCodes = new Set([
    'PENDING', 'APPROVED', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'NONE'
  ]);

  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  private apiService = inject(AdminService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private notificationService = inject(NotificationService);

  ngOnInit(): void {
    this.loadPaymentMethods();
    this.route.queryParams.subscribe(params => {
      const rawRouteStatus = this.normalizePaymentValue(params['status']);
      let routeStatus = this.getCanonicalOrderStatus(params['status']);
      let routeReturnStatus = this.getCanonicalReturnStatus(params['returnStatus']);

      // Hỗ trợ tương thích ngược nếu query params cũ có status=return_pending
      if (rawRouteStatus === 'RETURN_PENDING' || rawRouteStatus === 'RETURN_REQUESTS') {
        routeReturnStatus = 'PENDING';
        routeStatus = '';
      }

      if (routeStatus !== 'RETURNED') {
        routeReturnStatus = '';
      }

      const shouldLoad = !this.hasInitializedQueryState
        || routeStatus !== this.selectedStatus
        || routeReturnStatus !== this.selectedReturnStatus;

      this.selectedStatus = routeStatus;
      this.selectedReturnStatus = routeReturnStatus;
      this.syncFilterFieldValues();
      this.hasInitializedQueryState = true;
      if (shouldLoad) {
        this.pagination = { ...this.pagination, page: 1 };
        this.loadOrders();
      }
      this.updateQueryParams(this.selectedStatus, this.selectedReturnStatus);
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
      returnStatus: this.selectedReturnStatus || undefined,
      paymentMethod: this.selectedPaymentMethod || undefined
    }).subscribe({
      next: (res) => {
        if (requestId !== this.ordersRequestId) return;
        this.isLoading = false;
        if (res.success) {
          this.pendingReturnCount = Number(res.pendingReturnCount) || 0;
          this.data = (res.data || []).map((o: any) => {
            const rawStatus = String(o.status || 'PENDING').toUpperCase();
            const statusText = o.statusText || this.getOrderStatusLabel(rawStatus);
            const statusVariant = o.statusVariant || this.getOrderStatusVariant(rawStatus);

            const activeReturn = this.resolveActiveReturnRequest(o);
            const returnInfo = this.mapReturnRequestBadgeInfo(activeReturn);

            return {
              ...o,
              id: o._id || o.id,
              status: statusText,
              statusVariant: statusVariant,
              returnStatus: returnInfo.label,
              returnStatusVariant: returnInfo.variant,
              activeReturnRequest: activeReturn
            };
          });
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

  onAddOrder(): void {
    this.router.navigate(['/admin/orders/add']);
  }

  onExportOrders(): void {
    if (this.isExporting || this.isLoading) return;

    this.isExporting = true;
    this.errorMessage = '';

    // Tiến hành lấy toàn bộ đơn hàng phù hợp với bộ lọc hiện tại để xuất báo cáo
    this.fetchAllOrdersForExport(1, []);
  }

  private fetchAllOrdersForExport(page: number, accumulatedOrders: any[]): void {
    this.apiService.getOrders({
      page,
      limit: 100,
      search: this.searchTerm || undefined,
      status: this.selectedStatus || undefined,
      returnStatus: this.selectedReturnStatus || undefined,
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
        this.notificationService.success(`Đã xuất báo cáo thành công cho ${allOrders.length} đơn hàng.`);
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
      'Trạng thái yêu cầu',
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
        const price = it.unitPrice != null ? formatVND(it.unitPrice) : '';
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

      // 16b. Trạng thái yêu cầu trả hàng / hoàn tiền
      const activeReq = this.resolveActiveReturnRequest(o);
      const reqStatus = this.escapeCsvField(this.mapReturnRequestBadgeInfo(activeReq).label);

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
        reqStatus,
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


  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      const orderDocId = e.row._id || e.row.id;
      this.router.navigate(['/admin/orders', orderDocId]);
    } else if (e.action === 'edit') {
      this.openStatusModal(e.row, 'order');
    } else if (e.action === 'return') {
      this.openStatusModal(e.row, 'return');
    }
  }

  openStatusModal(order: any, tab: 'order' | 'return' = 'order'): void {
    this.selectedOrderForStatus = order;
    this.selectedStatusModalTab = tab;
    this.isStatusModalOpen = true;
    this.cdr.markForCheck();
  }

  onCloseStatusModal(): void {
    this.isStatusModalOpen = false;
    this.selectedOrderForStatus = null;
    this.selectedStatusModalTab = 'order';
    this.cdr.markForCheck();
  }

  onOrderStatusUpdated(event: { orderId: string; newStatus: string }): void {
    this.loadOrders({ preserveSelection: true });
  }

  onReturnUpdated(event: { orderId: string; action: string }): void {
    this.loadOrders({ preserveSelection: true });
  }

  onSearch(v: string): void {
    const searchTerm = (v || '').trim();
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
    this.selectedReturnStatus = this.selectedStatus === 'RETURNED'
      ? this.getCanonicalReturnStatus(v['returnStatus'])
      : '';
    this.selectedPaymentMethod = this.normalizePaymentValue(v['payment']);
    this.pagination = { ...this.pagination, page: 1 };
    this.syncFilterFieldValues();
    const skipLoad = this.skipNextResetFilterLoad
      && !this.selectedStatus
      && !this.selectedReturnStatus
      && !this.selectedPaymentMethod;
    this.skipNextResetFilterLoad = false;
    if (!skipLoad) {
      this.loadOrders();
      this.updateQueryParams(this.selectedStatus, this.selectedReturnStatus);
    }
  }

  onFilterReset(): void {
    if (!this.prepareForQueryChange()) return;
    this.selectedStatus = '';
    this.selectedReturnStatus = '';
    this.selectedPaymentMethod = '';
    this.pagination = { ...this.pagination, page: 1 };
    this.skipNextResetFilterLoad = true;
    this.syncFilterFieldValues();
    this.loadOrders();
    this.updateQueryParams('', '');
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
    return true;
  }

  private setPaymentFilterOptions(options: Array<{ value: string; label: string }>): void {
    this.filterFields = this.filterFields.map(field =>
      field.key === 'payment'
        ? { ...field, value: this.selectedPaymentMethod, options }
        : field.key === 'status'
          ? { ...field, value: this.selectedStatus }
          : field.key === 'returnStatus'
            ? { ...field, value: this.selectedReturnStatus }
            : field
    );
  }

  private syncFilterFieldValues(): void {
    this.filterFields = this.filterFields.map(field => {
      if (field.key === 'status') return { ...field, value: this.selectedStatus };
      if (field.key === 'returnStatus') return { ...field, value: this.selectedReturnStatus };
      if (field.key === 'payment') return { ...field, value: this.selectedPaymentMethod };
      return field;
    });
  }

  private updateQueryParams(status: string, returnStatus: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: status ? status.toLowerCase() : null,
        returnStatus: returnStatus ? returnStatus.toLowerCase() : null
      },
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

  private getCanonicalReturnStatus(value: any): string {
    const normalizedValue = this.normalizePaymentValue(value);
    if (!normalizedValue) return '';
    if (this.returnStatusCodes.has(normalizedValue)) return normalizedValue;

    const returnField = this.filterFields.find(field => field.key === 'returnStatus');
    const matchingOption = returnField?.options?.find(option =>
      this.normalizePaymentValue(option.label) === normalizedValue
    );
    const optionCode = this.normalizePaymentValue(matchingOption?.value);
    return this.returnStatusCodes.has(optionCode) ? optionCode : '';
  }

  getReturnStatusText(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED': return 'Đã từ chối';
      case 'RETURN_SHIPPED': return 'Đang chuyển hoàn';
      case 'RETURN_RECEIVED': return 'Đã nhận hàng';
      case 'INSPECTED': return 'Đã kiểm hàng';
      case 'COMPLETED': return 'Hoàn tất';
      default: return status || 'Đang xử lý';
    }
  }

  resolveActiveReturnRequest(order: any): any {
    if (!order) return null;
    if (order.activeReturnRequest) return order.activeReturnRequest;

    const reqs: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (Array.isArray(order.raw?.returnRequests) && order.raw.returnRequests.length > 0
        ? order.raw.returnRequests
        : (order.returnRequest ? [order.returnRequest] : (order.raw?.returnRequest ? [order.raw.returnRequest] : [])));

    if (reqs.length === 0) {
      if (order.latestReturnStatus) {
        return {
          status: order.latestReturnStatus,
          requestId: order.latestReturnRequestId,
          refund: { status: order.latestReturnRefundStatus }
        };
      }
      return null;
    }

    const getScore = (st: string) => {
      const s = String(st || '').toUpperCase();
      if (s === 'PENDING') return 5;
      if (['APPROVED', 'WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED'].includes(s)) return 4;
      if (s === 'COMPLETED') return 3;
      if (s === 'REJECTED' || s === 'REJ') return 2;
      if (s === 'CANCELLED' || s === 'CANC') return 1;
      return 0;
    };

    const sorted = [...reqs].sort((a: any, b: any) => {
      const scoreDiff = getScore(b?.status) - getScore(a?.status);
      if (scoreDiff !== 0) return scoreDiff;
      const timeA = new Date(a?.requestedAt || a?.createdAt || 0).getTime();
      const timeB = new Date(b?.requestedAt || b?.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return sorted[0];
  }

  mapReturnRequestBadgeInfo(req: any): { label: string; variant: string } {
    if (!req) return { label: '—', variant: 'neutral' };
    const s = String(req.status || '').toUpperCase();
    const refundStatus = String(req.refund?.status || '').toUpperCase();

    switch (s) {
      case 'PENDING':
        return { label: 'Chờ duyệt trả hàng', variant: 'pending' };
      case 'APPROVED':
        return { label: 'Đã duyệt trả hàng', variant: 'approved' };
      case 'WAITING_FOR_RETURN_SHIPMENT':
      case 'RETURN_SHIPPED':
        return { label: 'Đang trả hàng', variant: 'shipping' };
      case 'RETURN_RECEIVED':
        return { label: 'Đã nhận hàng trả', variant: 'received' };
      case 'INSPECTED':
        if (refundStatus === 'COMPLETED') {
          return { label: 'Đã hoàn tiền', variant: 'completed' };
        }
        return { label: 'Đang xử lý hoàn tiền', variant: 'refunding' };
      case 'COMPLETED':
        return { label: 'Đã hoàn tiền', variant: 'completed' };
      case 'REJECTED':
      case 'REJ':
        return { label: 'Yêu cầu bị từ chối', variant: 'rejected' };
      case 'CANCELLED':
      case 'CANC':
        return { label: 'Yêu cầu đã hủy', variant: 'cancelled' };
      default:
        return { label: '—', variant: 'neutral' };
    }
  }

  mapReturnSubBadgeInfo(req: any): { label: string; variant: string } | null {
    const info = this.mapReturnRequestBadgeInfo(req);
    return info.label === '—' ? null : info;
  }

  isReturnActionAvailable(row: any): boolean {
    const activeReq = this.resolveActiveReturnRequest(row);
    if (!activeReq) return false;
    const s = String(activeReq.status || '').toUpperCase();
    if (['REJECTED', 'REJ', 'CANCELLED', 'CANC', 'COMPLETED'].includes(s)) return false;
    if (s === 'INSPECTED') {
      const refSt = String(activeReq.refund?.status || '').toUpperCase();
      if (refSt === 'COMPLETED' || refSt === 'NOT_REQUIRED') return false;
    }
    return true;
  }

  getOrderStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    const map: Record<string, string> = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang xử lý',
      SHIPPING: 'Đang giao',
      DELIVERED: 'Đã giao',
      CANCELLED: 'Đã hủy',
      RETURNED: 'Trả hàng',
      DELIVERY_FAILED: 'Giao thất bại',
    };
    return map[s] || status || 'Không rõ';
  }

  getOrderStatusVariant(status: string): string {
    const s = (status || '').toUpperCase();
    const map: Record<string, string> = {
      PENDING: 'warning',
      CONFIRMED: 'info',
      PROCESSING: 'info',
      SHIPPING: 'primary',
      DELIVERED: 'success',
      CANCELLED: 'danger',
      RETURNED: 'neutral',
      DELIVERY_FAILED: 'danger',
    };
    return map[s] || 'neutral';
  }

  private getDisplayString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
