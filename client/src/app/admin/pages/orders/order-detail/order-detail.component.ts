/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { paymentStatusLabel } from '../../../../utils/orders-report-csv.cjs';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';

interface StatusOption {
  code: string;
  label: string;
  variant: 'neutral' | 'warning' | 'primary' | 'success' | 'danger';
}

@Component({
  selector: 'app-order-detail',
  standalone: false,
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit {
  orderId: string | null = null;
  order: any = null;

  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý đơn hàng', url: '/admin/orders' },
    { label: 'Chi tiết đơn hàng' }
  ];

  isLoading = true;
  isNotFound = false;
  errorMessage = '';

  // Status transition state
  selectedNextStatus = '';
  statusNote = '';
  statusValidationMessage = '';
  isUpdatingStatus = false;
  confirmOpen = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';

  // ─── Return & Refund Management State ─────────────────────────────────
  selectedReturnReqId: string | null = null;
  actionModalOpen: boolean = false;
  activeModalAction: 'APPROVE' | 'REJECT' | 'CUSTOMER_SHIPPED' | 'RECEIVE_GOODS' | 'INSPECT_GOODS' | 'PROCESS_REFUND' | 'REFUND_FAILED' | 'COD_RECONCILE' | null = null;
  modalTargetReq: any = null;
  modalLoading: boolean = false;
  modalErrorMessage: string = '';

  previewImageModalUrl: string | null = null;

  rejectForm = { reason: '' };
  approveForm = { approvedAmount: 0, instructions: '', note: '' };
  shippingForm = { carrier: '', trackingCode: '', shippedAt: '' };
  inspectForm = { isEligible: true, approvedAmount: 0, conditionNotes: '', restock: true };
  refundForm = { refundAmount: 0, transactionId: '', bankName: '', accountNumber: '', accountHolder: '', notes: '' };
  codForm = { codCollected: true, actualCollectedAmount: 0, codReconciliationStatus: 'RECONCILED', notes: '' };

  // Business state transitions rule
  readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['DELIVERY_FAILED', 'DELIVERED', 'CANCELLED'],
    DELIVERY_FAILED: ['SHIPPING', 'CANCELLED', 'RETURNED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: []
  };

  readonly ALL_STATUSES: StatusOption[] = [
    { code: 'PENDING', label: 'Chờ xác nhận', variant: 'neutral' },

    { code: 'PROCESSING', label: 'Đang xử lý', variant: 'warning' },
    { code: 'SHIPPING', label: 'Đang giao', variant: 'primary' },

    { code: 'DELIVERED', label: 'Đã giao', variant: 'success' },
    { code: 'CANCELLED', label: 'Đã hủy', variant: 'danger' },
    { code: 'RETURNED', label: 'Trả hàng', variant: 'warning' }
  ];

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(AdminService);
  private cdr = inject(ChangeDetectorRef);
  private notificationService = inject(NotificationService);

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id');
    if (this.route.snapshot.queryParamMap.get('updated') === '1') {
      this.notificationService.success('Cập nhật đơn hàng thành công.');
    }
    if (!this.orderId || this.orderId.trim() === '') {
      this.isNotFound = true;
      this.isLoading = false;
      return;
    }
    this.loadOrderDetail(this.orderId);
  }

  loadOrderDetail(id: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getOrderById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.order = res.data;
          if (!this.order.statusCode) {
            this.order.statusCode = this.getOrderStatusCode();
          }
          this.selectedNextStatus = '';
          this.statusNote = '';
          this.statusValidationMessage = '';
          const code = this.order?.orderId || this.order?.code || '';
          this.breadcrumbItems = [
            { label: 'Quản lý đơn hàng', url: '/admin/orders' },
            { label: code ? ('Đơn hàng #' + code) : 'Chi tiết đơn hàng' }
          ];
        } else {
          this.isNotFound = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404 || err.status === 400) {
          this.isNotFound = true;
        } else {
          this.errorMessage = 'Không thể tải thông tin đơn hàng. Vui lòng thử lại.';
        }
        console.error('Error fetching order detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  onEdit(): void {
    if (this.orderId) this.router.navigate(['/admin/orders', this.orderId, 'status']);
  }

  getStatusMeta(code: string): StatusOption | undefined {
    return this.ALL_STATUSES.find(s => s.code === (code || '').toUpperCase());
  }

  getStatusLabel(code: unknown): string {
    const rawCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    return this.getStatusMeta(rawCode)?.label || rawCode || '—';
  }

  getPaymentStatusLabel(status: unknown): string {
    return paymentStatusLabel(status);
  }

  isTransitionAllowed(targetStatus: string): boolean {
    if (!this.order) return false;
    const current = this.getOrderStatusCode();
    if (!current) return false;
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return allowed.includes(targetStatus.toUpperCase());
  }

  getAllowedStatuses(): StatusOption[] {
    if (!this.order) return [];
    const current = this.getOrderStatusCode();
    if (!current) return [];
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return this.ALL_STATUSES.filter(s => allowed.includes(s.code));
  }

  onSelectStatus(targetStatus: string): void {
    this.statusValidationMessage = '';
    this.errorMessage = '';

    if (!this.order) return;
    const current = this.getOrderStatusCode();
    if (!current) return;
    const target = targetStatus.toUpperCase();

    if (current === target) {
      this.statusValidationMessage = 'Đơn hàng hiện tại đã ở trạng thái này.';
      this.selectedNextStatus = '';
      return;
    }

    if (!this.isTransitionAllowed(target)) {
      const allowedLabels = (this.VALID_TRANSITIONS[current] || [])
        .map(c => this.getStatusMeta(c)?.label || c)
        .join(', ') || 'Không có trạng thái nào khả dụng';
      this.statusValidationMessage = `Trạng thái mới không hợp lệ với trạng thái hiện tại. Từ "${this.getStatusMeta(current)?.label || current}" chỉ có thể chuyển sang: ${allowedLabels}.`;
      this.selectedNextStatus = '';
      return;
    }

    this.selectedNextStatus = target;
  }

  onRequestChangeStatus(): void {
    if (!this.selectedNextStatus) {
      this.statusValidationMessage = 'Vui lòng chọn trạng thái hợp lệ để cập nhật.';
      return;
    }

    const current = this.getOrderStatusCode();
    if (!this.isTransitionAllowed(this.selectedNextStatus)) {
      this.statusValidationMessage = 'Trạng thái mới không hợp lệ với trạng thái hiện tại.';
      return;
    }

    const fromLabel = this.getStatusMeta(current)?.label || current;
    const toLabel = this.getStatusMeta(this.selectedNextStatus)?.label || this.selectedNextStatus;

    this.confirmDialogTitle = 'Xác nhận chuyển trạng thái đơn hàng';
    this.confirmDialogMessage = `Bạn có chắc chắn muốn chuyển trạng thái đơn hàng "${this.order?.orderId || this.order?.code}" từ "${fromLabel}" sang "${toLabel}" không?`;
    this.confirmOpen = true;
  }

  onConfirmStatusUpdate(): void {
    if (!this.orderId || !this.selectedNextStatus || this.isUpdatingStatus) return;

    this.isUpdatingStatus = true;
    this.errorMessage = '';
    this.statusValidationMessage = '';

    const newStatus = this.selectedNextStatus;
    const noteText = this.statusNote.trim();

    this.apiService.updateOrderStatus(this.orderId, newStatus, noteText).subscribe({
      next: (res) => {
        this.isUpdatingStatus = false;
        this.confirmOpen = false;
        if (res.success && res.data) {
          this.order = res.data;
          if (!this.order.statusCode) {
            this.order.statusCode = this.getOrderStatusCode();
          }
          this.selectedNextStatus = '';
          this.statusNote = '';
          const msg = res.message || 'Cập nhật trạng thái đơn hàng thành công';
          this.notificationService.success(msg);
        } else {
          this.errorMessage = res.message || 'Cập nhật trạng thái thất bại';
          this.notificationService.error(this.errorMessage);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isUpdatingStatus = false;
        this.confirmOpen = false;
        this.errorMessage = 'Không thể cập nhật trạng thái đơn hàng. Vui lòng kiểm tra lại.';
        this.notificationService.error(this.errorMessage);
        console.error('Update order status error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelConfirmDialog(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  getItemTitle(it: any): string {
    return it?.productSnapshot?.title
      || it?.item?.title
      || it?.title
      || it?.item?.name
      || it?.item?.titleUrl?.replace(/-/g, ' ')
      || '—';
  }

  getItemImage(it: any): string {
    const firstLegacyImage = Array.isArray(it?.item?.images) ? it.item.images[0] : null;
    return it?.productSnapshot?.image
      || it?.item?.mainImage?.url
      || (typeof firstLegacyImage === 'string' ? firstLegacyImage : firstLegacyImage?.url)
      || '';
  }

  getItemVariants(it: any): string[] {
    const list: string[] = [];
    const variant = it?.productSnapshot?.variant || {};
    const legacyProduct = it?.item || {};
    const legacyColor = this.getLegacyVariantValue(legacyProduct.colors ?? legacyProduct.color);
    const legacySize = this.getLegacyVariantValue(legacyProduct.sizes ?? legacyProduct.size);
    const legacyClassification = this.getDisplayString(
      legacyProduct.productType ?? legacyProduct.classification
    );
    const color = this.getDisplayString(variant.color) || legacyColor;
    const size = this.getDisplayString(variant.size) || legacySize;
    const classification = this.getDisplayString(variant.classification) || legacyClassification;

    if (color) list.push(`Màu: ${color}`);
    if (size) list.push(`Size: ${size}`);
    if (classification) list.push(`Phân loại: ${classification}`);
    return list;
  }

  getOrderItems(): any[] {
    const normalizedItems = Array.isArray(this.order?.items)
      ? this.order.items.filter((item: any) => this.isUsableNormalizedItem(item))
      : [];
    if (normalizedItems.length > 0) return normalizedItems;

    return Array.isArray(this.order?.cart?.items)
      ? this.order.cart.items.filter((item: any) => item && typeof item === 'object')
      : [];
  }

  getItemSku(it: any): string {
    return this.getDisplayString(it?.productSnapshot?.sku)
      || this.getDisplayString(it?.item?.sku)
      || this.getDisplayString(it?.sku)
      || '';
  }

  getItemQuantity(it: any): number | null {
    return this.getFiniteNumber(it?.quantity) ?? this.getFiniteNumber(it?.qty);
  }

  getItemUnitPrice(it: any): number | null {
    return this.getFiniteNumber(it?.unitPrice) ?? this.getFiniteNumber(it?.price);
  }

  getItemSubtotal(it: any): number | null {
    const explicitSubtotal = this.getFiniteNumber(it?.subtotal);
    if (explicitSubtotal !== null) return explicitSubtotal;

    const unitPrice = this.getItemUnitPrice(it);
    const quantity = this.getItemQuantity(it);
    return unitPrice !== null && quantity !== null ? unitPrice * quantity : null;
  }

  getTotalQuantity(): number | null {
    if (this.order && Object.prototype.hasOwnProperty.call(this.order, 'itemsCount')) {
      return this.getFiniteNumber(this.order.itemsCount);
    }
    const legacyTotalQty = this.getFiniteNumber(this.order?.cart?.totalQty);
    if (legacyTotalQty !== null) return legacyTotalQty;

    const quantities = this.getOrderItems().map(item => this.getItemQuantity(item));
    if (quantities.some(quantity => quantity === null)) {
      return null;
    }
    return quantities.reduce((total: number, quantity) => total + (quantity as number), 0);
  }

  getTotalQuantityLabel(): number | string {
    const quantity = this.getTotalQuantity();
    return quantity === null ? '—' : quantity;
  }

  getShippingAddresses(): any[] {
    const legacyAddresses = Array.isArray(this.order?.addresses)
      ? this.order.addresses.filter((address: any) => address && typeof address === 'object')
      : [];
    const normalizedAddress = this.order?.shippingAddress;

    if (!normalizedAddress || typeof normalizedAddress !== 'object' || Array.isArray(normalizedAddress)) {
      return legacyAddresses;
    }

    const legacyPrimary = legacyAddresses[0] || {};
    const normalizedProvince = this.getDisplayString(normalizedAddress.province);
    const mergedPrimary = {
      ...legacyPrimary,
      ...normalizedAddress,
      fullName: this.getDisplayString(normalizedAddress.fullName)
        || this.getDisplayString(legacyPrimary.fullName)
        || this.getDisplayString(legacyPrimary.name),
      phone: this.getDisplayString(normalizedAddress.phone)
        || this.getDisplayString(legacyPrimary.phone),
      address: this.getDisplayString(normalizedAddress.address)
        || this.getDisplayString(legacyPrimary.address)
        || this.getDisplayString(legacyPrimary.line1),
      ward: this.getDisplayString(normalizedAddress.ward)
        || this.getDisplayString(legacyPrimary.ward),
      district: this.getDisplayString(normalizedAddress.district)
        || this.getDisplayString(legacyPrimary.district),
      province: normalizedProvince
        || this.getDisplayString(legacyPrimary.province)
        || this.getDisplayString(legacyPrimary.city),
      line1: null,
      city: null
    };

    return [mergedPrimary, ...legacyAddresses.slice(1)];
  }

  getLegacySellerMessage(): string | number | null {
    const value = this.order?.outcome?.seller_message;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  }

  getHistoryUpdatedBy(value: unknown): string | null {
    const name = this.getDisplayString(value);
    if (!name || /^[a-f\d]{24}$/i.test(name)) return null;
    return name;
  }

  private isUsableNormalizedItem(item: any): boolean {
    if (!item || typeof item !== 'object' || !item.productSnapshot || typeof item.productSnapshot !== 'object') {
      return false;
    }
    return Boolean(
      this.getDisplayString(item.productSnapshot.title)
      || this.getDisplayString(item.productSnapshot.sku)
      || item.productId != null
    );
  }

  private getFiniteNumber(value: any): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private getDisplayString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private getLegacyVariantValue(value: any): string | null {
    if (Array.isArray(value)) {
      const values = value
        .map(entry => this.getDisplayString(entry))
        .filter((entry): entry is string => Boolean(entry));
      return values.length > 0 ? values.join(', ') : null;
    }
    return this.getDisplayString(value);
  }

  // ─── Return & Refund Management Methods ──────────────────────────────

  /**
   * Chuẩn hóa mã trạng thái đơn hàng về dạng enum chữ hoa (PENDING, CONFIRMED, PROCESSING, SHIPPING, DELIVERED, CANCELLED, RETURNED, v.v.)
   */
  getOrderStatusCode(): string {
    const raw = (this.order?.statusCode || this.order?.rawStatus || this.order?.status || '')
      .toString()
      .trim()
      .toUpperCase();

    if (['PENDING', 'CHỜ XÁC NHẬN', 'NEW'].includes(raw)) return 'PENDING';
    if (['CONFIRMED', 'ĐÃ XÁC NHẬN'].includes(raw)) return 'CONFIRMED';
    if (['PROCESSING', 'ĐANG XỬ LÝ'].includes(raw)) return 'PROCESSING';
    if (['SHIPPING', 'ĐANG GIAO'].includes(raw)) return 'SHIPPING';
    if (['DELIVERED', 'ĐÃ GIAO', 'COMPLETED'].includes(raw)) return 'DELIVERED';
    if (['CANCELLED', 'CANCELED', 'ĐÃ HỦY'].includes(raw)) return 'CANCELLED';
    if (['RETURNED', 'TRẢ HÀNG', 'ĐÃ TRẢ HÀNG', 'ĐÃ HOÀN TRẢ'].includes(raw)) return 'RETURNED';
    if (['DELIVERY_FAILED', 'GIAO THẤT BẠI'].includes(raw)) return 'DELIVERY_FAILED';

    return raw;
  }

  /**
   * Kiểm tra đơn hàng có khoản thanh toán thực tế cần hoàn hoặc đang/đã theo dõi hoàn tiền
   */
  hasPaymentNeedingRefund(): boolean {
    if (!this.order) return false;

    const collected = this.getActualCollectedAmount();
    const refunded = this.getTotalRefundedAmount();
    const remaining = this.getRemainingRefundableAmount();

    const paymentStatus = (this.order.paymentStatus || this.order.payment?.status || '')
      .toString()
      .trim()
      .toUpperCase();
    const isPaidOrRefund = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(paymentStatus);

    const codCollected = Boolean(this.order.payment?.codCollected);
    const codReconciled = ['RECONCILED', 'COLLECTED_UNRECONCILED'].includes(
      this.order.payment?.codReconciliationStatus
    );

    return collected > 0 || refunded > 0 || remaining > 0 || isPaidOrRefund || codCollected || codReconciled;
  }

  /**
   * Logic kiểm soát hiển thị SECTION 2.5: Quản lý trả hàng & hoàn tiền
   * Quy tắc:
   * - PENDING – Chờ xác nhận: Không
   * - CONFIRMED – Đã xác nhận: Không
   * - PROCESSING – Đang xử lý: Không
   * - SHIPPING – Đang giao: Không
   * - DELIVERED – Đã giao: Chỉ hiển thị nếu có yêu cầu trả hàng/hoàn tiền
   * - CANCELLED – Đã hủy: Không mặc định; chỉ xử lý hoàn tiền nếu có khoản thanh toán cần hoàn
   * - RETURNED – Đã trả hàng: Có, nếu cần theo dõi xử lý trả hàng/hoàn tiền
   */
  shouldShowReturnSection(): boolean {
    if (!this.order) return false;

    const status = this.getOrderStatusCode();
    const hasReturnRequests = this.getReturnRequests().length > 0;
    const hasPaymentToRefund = this.hasPaymentNeedingRefund();

    switch (status) {
      case 'PENDING':
      case 'CONFIRMED':
      case 'PROCESSING':
      case 'SHIPPING':
      case 'DELIVERY_FAILED':
        return false;

      case 'DELIVERED':
        // DELIVERED – Đã giao: Chỉ hiển thị nếu có yêu cầu trả hàng/hoàn tiền
        return hasReturnRequests;

      case 'CANCELLED':
        // CANCELLED – Đã hủy: Không mặc định; chỉ xử lý hoàn tiền nếu có khoản thanh toán cần hoàn
        return hasPaymentToRefund || hasReturnRequests;

      case 'RETURNED':
        // RETURNED – Đã trả hàng: Có, nếu cần theo dõi xử lý trả hàng/hoàn tiền
        return hasReturnRequests || hasPaymentToRefund;

      default:
        return hasReturnRequests || hasPaymentToRefund;
    }
  }

  getReturnRequests(): any[] {
    if (Array.isArray(this.order?.returnRequests) && this.order.returnRequests.length > 0) {
      return this.order.returnRequests;
    }
    if (Array.isArray(this.order?.raw?.returnRequests) && this.order.raw.returnRequests.length > 0) {
      return this.order.raw.returnRequests;
    }
    if (this.order?.returnRequest) {
      return [this.order.returnRequest];
    }
    if (this.order?.raw?.returnRequest) {
      return [this.order.raw.returnRequest];
    }
    return [];
  }

  getActiveReturnRequest(): any {
    const list = this.getReturnRequests();
    if (list.length === 0) return null;
    if (this.selectedReturnReqId) {
      const found = list.find((r: any) => r.requestId === this.selectedReturnReqId || String(r._id) === this.selectedReturnReqId);
      if (found) return found;
    }
    return list[0];
  }

  selectReturnRequest(reqId: string): void {
    this.selectedReturnReqId = reqId;
  }

  getOrderTotal(): number {
    return Number(this.order?.totalAmount) || Number(this.order?.total) || 0;
  }

  isPrepaidMethod(): boolean {
    const m = (this.order?.payment || this.order?.paymentMethodSnapshot?.method || '').toUpperCase();
    return m !== 'COD';
  }

  isCodMethod(): boolean {
    const m = (this.order?.payment || this.order?.paymentMethodSnapshot?.method || '').toUpperCase();
    return m === 'COD';
  }

  isActualCollectedConfirmed(): boolean {
    if (this.isCodMethod()) {
      return Boolean(this.order?.payment?.codCollected);
    }
    const st = (this.order?.paymentStatus || this.order?.payment?.status || '').toUpperCase();
    return st === 'PAID' || st === 'PARTIALLY_REFUNDED' || st === 'REFUNDED';
  }

  getActualCollectedAmount(): number {
    if (this.isCodMethod()) {
      if (!this.order?.payment?.codCollected) return 0;
      return Number(this.order?.payment?.actualCollectedAmount) >= 0
        ? Number(this.order.payment.actualCollectedAmount)
        : this.getOrderTotal();
    }
    if (this.isActualCollectedConfirmed()) {
      return Number(this.order?.payment?.actualCollectedAmount) >= 0
        ? Number(this.order.payment.actualCollectedAmount)
        : this.getOrderTotal();
    }
    return 0;
  }

  getTotalRefundedAmount(): number {
    return Number(this.order?.payment?.refundedAmount) || Number(this.order?.refundedAmount) || 0;
  }

  getRemainingRefundableAmount(): number {
    return Math.max(0, this.getActualCollectedAmount() - this.getTotalRefundedAmount());
  }

  getCodReconciliationStatusLabel(): string {
    const st = this.order?.payment?.codReconciliationStatus;
    if (st === 'RECONCILED') return 'Đã đối soát';
    if (st === 'COLLECTED_UNRECONCILED') return 'Đã thu tiền (chờ đối soát)';
    if (this.order?.payment?.codCollected) return 'Đã thu tiền';
    return 'Chưa thu tiền';
  }

  getReturnRequestStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED': return 'Đã từ chối';
      case 'WAITING_FOR_RETURN_SHIPMENT': return 'Chờ gửi hàng hoàn';
      case 'RETURN_SHIPPED': return 'Khách đã gửi hàng';
      case 'RETURN_RECEIVED': return 'Chéri đã nhận hàng';
      case 'INSPECTED': return 'Đã kiểm tra sản phẩm';
      case 'COMPLETED': return 'Hoàn tất trả hàng';
      case 'CANCELLED': return 'Đã hủy';
      default: return status || '—';
    }
  }

  getReturnHistoryActionLabel(action: string): string {
    if (!action) return '—';
    const a = String(action).toUpperCase().trim();
    switch (a) {
      case 'CREATED':
        return 'Khách gửi yêu cầu';
      case 'APPROVED':
        return 'Đã duyệt yêu cầu';
      case 'REJECTED':
        return 'Từ chối yêu cầu';
      case 'CANCELLED_BY_CUSTOMER':
      case 'CANCELLED':
        return 'Khách đã hủy yêu cầu';
      case 'CUSTOMER_SHIPPED':
        return 'Khách đã gửi hàng hoàn';
      case 'RETURN_SHIPPED':
        return 'Đang gửi hàng hoàn';
      case 'RECEIVE_GOODS':
      case 'RETURN_RECEIVED':
        return 'Đã nhận hàng hoàn';
      case 'INSPECT_GOODS':
      case 'INSPECTED':
        return 'Đã kiểm tra hàng hoàn';
      case 'PROCESS_REFUND':
        return 'Xử lý hoàn tiền';
      case 'REFUND_FAILED':
        return 'Báo lỗi hoàn tiền';
      case 'COMPLETED':
        return 'Hoàn tất yêu cầu';
      default:
        return action;
    }
  }

  getReturnRefundStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'NOT_REQUIRED': return 'Không phát sinh hoàn tiền';
      case 'PENDING': return 'Chờ xử lý';
      case 'PROCESSING': return 'Đang xử lý';
      case 'COMPLETED': return 'Đã hoàn tiền thành công';
      case 'FAILED': return 'Hoàn tiền thất bại';
      case 'CANCELLED': return 'Đã hủy';
      default: return status || '—';
    }
  }

  getReturnStatusBadgeClass(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'badge-neutral';
      case 'APPROVED': return 'badge-primary';
      case 'REJECTED': return 'badge-danger';
      case 'RETURN_SHIPPED': return 'badge-warning';
      case 'RETURN_RECEIVED': return 'badge-warning';
      case 'INSPECTED': return 'badge-primary';
      case 'COMPLETED': return 'badge-success';
      default: return 'badge-neutral';
    }
  }

  getRefundStatusBadgeClass(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED': return 'badge-success';
      case 'PROCESSING': return 'badge-warning';
      case 'PENDING': return 'badge-neutral';
      case 'FAILED': return 'badge-danger';
      case 'NOT_REQUIRED': return 'badge-neutral';
      default: return 'badge-neutral';
    }
  }

  getItemVariantText(item: any): string {
    const v = item?.productSnapshot?.variant || item?.variant;
    if (!v) return '';
    if (typeof v === 'string') return v;
    const parts: string[] = [];
    if (v.color) parts.push(`Màu: ${v.color}`);
    if (v.size) parts.push(`Size: ${v.size}`);
    if (v.classification) parts.push(v.classification);
    return parts.join(' | ');
  }

  canProcessRefund(): boolean {
    if (!this.order) return false;
    if (this.isCodMethod()) {
      return Boolean(this.order.payment?.codCollected);
    }
    const paymentStatus = (this.order.paymentStatus || this.order.payment?.status || '').toUpperCase();
    return paymentStatus === 'PAID' || paymentStatus === 'PARTIALLY_REFUNDED';
  }

  getRefundBlockReason(): string | null {
    if (!this.order) return null;
    if (this.isCodMethod()) {
      if (!this.order.payment?.codCollected) {
        return 'Đơn hàng COD chưa có xác nhận đã thu tiền hoặc chưa đối soát COD. Vui lòng đối soát COD trước khi hoàn tiền.';
      }
    } else {
      const paymentStatus = (this.order.paymentStatus || this.order.payment?.status || '').toUpperCase();
      if (paymentStatus !== 'PAID' && paymentStatus !== 'PARTIALLY_REFUNDED') {
        return 'Đơn hàng trực tuyến chưa thanh toán thành công (Trạng thái: ' + (paymentStatus || 'CHƯA THANH TOÁN') + '). Không thể thực hiện hoàn tiền.';
      }
    }
    return null;
  }

  openActionModal(action: 'APPROVE' | 'REJECT' | 'CUSTOMER_SHIPPED' | 'RECEIVE_GOODS' | 'INSPECT_GOODS' | 'PROCESS_REFUND' | 'REFUND_FAILED' | 'COD_RECONCILE', req: any): void {
    if (action === 'PROCESS_REFUND') {
      const blockReason = this.getRefundBlockReason();
      if (blockReason) {
        this.notificationService.error(blockReason);
        return;
      }
    }

    this.activeModalAction = action;
    this.modalTargetReq = req;
    this.modalErrorMessage = '';
    this.modalLoading = false;

    if (action === 'APPROVE') {
      const requested = Number(req?.refund?.requestedAmount) || 0;
      this.approveForm = {
        approvedAmount: requested,
        instructions: 'Quý khách vui lòng đóng gói sản phẩm kèm đầy đủ phụ kiện và tem mác, sau đó gửi về địa chỉ: Chéri Fashion, 123 Nguyễn Huệ, Quận 1, TP.HCM.',
        note: ''
      };
    } else if (action === 'REJECT') {
      this.rejectForm = { reason: '' };
    } else if (action === 'CUSTOMER_SHIPPED') {
      this.shippingForm = {
        carrier: req?.returnShipping?.carrier || 'Giao Hàng Nhanh (GHN)',
        trackingCode: req?.returnShipping?.trackingCode || '',
        shippedAt: new Date().toISOString().slice(0, 16)
      };
    } else if (action === 'INSPECT_GOODS') {
      const requested = Number(req?.refund?.approvedAmount) || Number(req?.refund?.requestedAmount) || 0;
      this.inspectForm = {
        isEligible: true,
        approvedAmount: requested,
        conditionNotes: 'Sản phẩm nguyên vẹn, còn nguyên tem mác, không có dấu hiệu đã qua sử dụng hay hư hỏng.',
        restock: true
      };
    } else if (action === 'PROCESS_REFUND') {
      const approved = Number(req?.refund?.approvedAmount) || Number(req?.refund?.requestedAmount) || 0;
      const remaining = this.getRemainingRefundableAmount();
      const defaultRefundAmt = Math.min(approved, remaining > 0 ? remaining : approved);
      this.refundForm = {
        refundAmount: defaultRefundAmt,
        transactionId: `RFD-${this.order?.orderId || 'TX'}-${Date.now().toString().slice(-4)}`,
        bankName: req?.refund?.bankName || '',
        accountNumber: req?.refund?.accountNumber || '',
        accountHolder: req?.refund?.accountHolder || '',
        notes: 'Chuyển khoản hoàn tiền trả hàng cho khách hàng qua internet banking.'
      };
    } else if (action === 'COD_RECONCILE') {
      this.codForm = {
        codCollected: true,
        actualCollectedAmount: this.getOrderTotal(),
        codReconciliationStatus: 'RECONCILED',
        notes: 'Đã nhận tiền đối soát thu hộ COD từ đơn vị vận chuyển.'
      };
    }

    this.actionModalOpen = true;
    this.cdr.markForCheck();
  }

  closeActionModal(): void {
    this.actionModalOpen = false;
    this.activeModalAction = null;
    this.modalTargetReq = null;
    this.modalErrorMessage = '';
    this.modalLoading = false;
    this.cdr.markForCheck();
  }

  submitActionModal(): void {
    if (!this.activeModalAction || !this.orderId) return;

    this.modalErrorMessage = '';
    this.modalLoading = true;

    if (this.activeModalAction === 'COD_RECONCILE') {
      this.apiService.updateCodReconciliation(this.orderId, this.codForm).subscribe({
        next: (res) => {
          this.modalLoading = false;
          this.closeActionModal();
          this.notificationService.success('Cập nhật đối soát COD thành công.');
          this.loadOrderDetail(this.orderId!);
        },
        error: (err) => {
          this.modalLoading = false;
          this.modalErrorMessage = err?.error?.message || err?.message || 'Không thể cập nhật đối soát COD.';
          this.cdr.markForCheck();
        }
      });
      return;
    }

    const reqId = this.modalTargetReq?.requestId || 'latest';
    let payload: any = { action: this.activeModalAction };

    if (this.activeModalAction === 'APPROVE') {
      payload = { ...payload, ...this.approveForm };
    } else if (this.activeModalAction === 'REJECT') {
      if (!this.rejectForm.reason.trim()) {
        this.modalLoading = false;
        this.modalErrorMessage = 'Lý do từ chối yêu cầu là bắt buộc.';
        return;
      }
      payload = { ...payload, reason: this.rejectForm.reason.trim() };
    } else if (this.activeModalAction === 'CUSTOMER_SHIPPED') {
      payload = { ...payload, ...this.shippingForm };
    } else if (this.activeModalAction === 'RECEIVE_GOODS') {
      payload = { ...payload };
    } else if (this.activeModalAction === 'INSPECT_GOODS') {
      payload = { ...payload, ...this.inspectForm };
    } else if (this.activeModalAction === 'PROCESS_REFUND') {
      if (this.refundForm.refundAmount <= 0) {
        this.modalLoading = false;
        this.modalErrorMessage = 'Số tiền hoàn phải lớn hơn 0.';
        return;
      }
      payload = { ...payload, ...this.refundForm };
    } else if (this.activeModalAction === 'REFUND_FAILED') {
      payload = { ...payload, failureReason: this.rejectForm.reason || 'Hoàn tiền thất bại' };
    }

    this.apiService.updateReturnRequestWorkflow(this.orderId, reqId, this.activeModalAction, payload).subscribe({
      next: (res) => {
        this.modalLoading = false;
        this.closeActionModal();
        this.notificationService.success(`Cập nhật yêu cầu trả hàng (${this.activeModalAction}) thành công.`);
        this.loadOrderDetail(this.orderId!);
      },
      error: (err) => {
        this.modalLoading = false;
        this.modalErrorMessage = err?.error?.message || err?.message || 'Có lỗi xảy ra khi thực hiện thao tác.';
        this.cdr.markForCheck();
      }
    });
  }

  getProofImageUrl(img: any): string {
    if (!img) return '';
    if (typeof img === 'string') return img;
    if (typeof img === 'object' && img.url) return img.url;
    return '';
  }

  openImagePreview(url: string): void {
    this.previewImageModalUrl = url;
    this.cdr.markForCheck();
  }

  closeImagePreview(): void {
    this.previewImageModalUrl = null;
    this.cdr.markForCheck();
  }
}
