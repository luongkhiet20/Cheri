import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, Inject, PLATFORM_ID, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { User, Order } from '../../../shared/models';
import { formatVND, PriceFormatPipe } from '../../../../pipes/price.pipe';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { SignalStore } from '../../../../store/signal.store';
import { ApiService } from '../../../../services/api.service';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-profile-orders',
  standalone: true,
  imports: [CommonModule, RouterLink, PriceFormatPipe],
  templateUrl: './profile-orders.component.html',
  styleUrl: './profile-orders.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileOrdersComponent implements OnInit, OnChanges, OnDestroy {
  @Input() orders: Order[] | null = null;
  @Input() user: User | null = null;
  @Input() lang: string | null = 'vi';
  @Input() lastSyncTime: string = '';

  @Output() cancelOrder = new EventEmitter<Order>();
  @Output() reviewOrder = new EventEmitter<Order>();
  @Output() editReviewOrder = new EventEmitter<Order>();
  @Output() returnRefundOrder = new EventEmitter<Order>();
  @Output() cancelReturnOrder = new EventEmitter<Order>();
  @Output() viewOrderDetail = new EventEmitter<Order>();

  // Tab filter
  activeTab: string = 'all';

  readonly orderTabs = [
    { key: 'all', label: 'Tất cả' },
    { key: 'PENDING', label: 'Chờ xác nhận' },
    { key: 'PROCESSING', label: 'Đang xử lý' },
    { key: 'SHIPPING', label: 'Đang giao' },
    { key: 'DELIVERED', label: 'Đã giao' },
    { key: 'CANCELLED', label: 'Đã hủy' },
    { key: 'RETURNED', label: 'Trả hàng' },
  ];

  // Trạng thái mở/đóng phần tiến trình Trả hàng & hoàn tiền (mặc định đóng, không lưu storage)
  expandedReturnTracking: { [key: string]: boolean } = {};

  // Quản lý giai đoạn trả hàng / hoàn tiền đang được chọn xem chi tiết
  selectedReturnStep: { [key: string]: number } = {};

  // ── Quản lý đồng hồ đếm ngược 30 phút & Thanh toán tiếp VNPay ──
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  nowMs: number = Date.now();
  retryingOrderMap: { [orderKey: string]: boolean } = {};
  retryErrorMap: { [orderKey: string]: string } = {};
  private expiredRefreshTriggered: Set<string> = new Set();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private selectors: SignalStoreSelectors,
    private store: SignalStore,
    private apiService: ApiService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.nowMs = Date.now();
    this.syncCountdownTimer();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.nowMs = Date.now();
    this.syncCountdownTimer();
  }

  ngOnDestroy(): void {
    this.clearCountdownTimer();
  }

  private clearCountdownTimer(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private syncCountdownTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const rawOrders = this.getRawOrders();
    const hasPendingVnpayWithDeadline = rawOrders.some((o: any) => this.isPendingUnpaidVnpayOrder(o));
    if (hasPendingVnpayWithDeadline && this.countdownTimer === null) {
      this.countdownTimer = setInterval(() => {
        this.nowMs = Date.now();
        this.checkExpiredVnpayOrdersOnTick();
        this.cdr.markForCheck();
      }, 1000);
    } else if (!hasPendingVnpayWithDeadline && this.countdownTimer !== null) {
      this.clearCountdownTimer();
    }
  }

  private checkExpiredVnpayOrdersOnTick(): void {
    const rawOrders = this.getRawOrders();
    let shouldRefreshFromBackend = false;
    for (const ord of rawOrders) {
      if (!this.isPendingUnpaidVnpayOrder(ord)) continue;
      const key = this.getOrderKey(ord);
      const remaining = this.getRemainingPaymentMs(ord);
      if (remaining <= 0 && !this.expiredRefreshTriggered.has(key)) {
        this.expiredRefreshTriggered.add(key);
        shouldRefreshFromBackend = true;
      }
    }
    if (shouldRefreshFromBackend && isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
    }
  }

  getOrderKey(order: any): string {
    return String(order?.orderId || order?._id || '');
  }

  isVnpayMethod(order: any): boolean {
    if (!order) return false;
    const methodCode = String(
      order.payment?.method ||
      order.paymentMethodSnapshot?.code ||
      order.payment?.provider ||
      order.paymentProvider ||
      order.paymentMethod ||
      ''
    ).trim().toUpperCase();
    return methodCode === 'VNPAY' || methodCode === 'VNPAY-QR';
  }

  isOrderPaid(order: any): boolean {
    if (!order) return false;
    const rootPs = String(order.paymentStatus || '').trim().toUpperCase();
    const nestedPs = String(order.payment?.status || '').trim().toUpperCase();
    const paidSet = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED', 'COMPLETED'];
    return paidSet.includes(rootPs) || paidSet.includes(nestedPs);
  }

  isPendingUnpaidVnpayOrder(order: any): boolean {
    if (!order) return false;
    const st = this.normalizeStatus(order.statusCode || order.rawStatus || order.status);
    return st === 'PENDING' && this.isVnpayMethod(order) && !this.isOrderPaid(order);
  }

  getOrderDeadlineMs(order: any): number | null {
    if (!order || !this.isVnpayMethod(order)) return null;
    if (order.paymentDeadlineAt) {
      const parsed = new Date(order.paymentDeadlineAt).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const createdRaw = order.createdAt || order.dateAdded;
    if (createdRaw) {
      const createdMs = new Date(createdRaw).getTime();
      if (!isNaN(createdMs) && createdMs > 0) {
        return createdMs + 30 * 60 * 1000;
      }
    }
    return null;
  }

  getRemainingPaymentMs(order: any): number {
    const deadlineMs = this.getOrderDeadlineMs(order);
    if (!deadlineMs) return 0;
    return Math.max(0, deadlineMs - this.nowMs);
  }

  formatRemainingCountdown(order: any): string {
    const remainingMs = this.getRemainingPaymentMs(order);
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  isCountdownWarning(order: any): boolean {
    const remainingMs = this.getRemainingPaymentMs(order);
    return remainingMs > 0 && remainingMs <= 5 * 60 * 1000;
  }

  isCountdownCritical(order: any): boolean {
    const remainingMs = this.getRemainingPaymentMs(order);
    return remainingMs > 0 && remainingMs <= 60 * 1000;
  }

  shouldShowVnpayPaymentBox(order: any): boolean {
    if (!this.isPendingUnpaidVnpayOrder(order)) return false;
    const deadlineMs = this.getOrderDeadlineMs(order);
    return deadlineMs !== null;
  }

  canShowVnpayRetryAction(order: any): boolean {
    if (!this.shouldShowVnpayPaymentBox(order)) return false;
    if (order.canRetryVnpayPayment !== true) return false;
    return this.getRemainingPaymentMs(order) > 0;
  }

  isVnpayCountdownExpired(order: any): boolean {
    if (!this.shouldShowVnpayPaymentBox(order)) return false;
    return this.getRemainingPaymentMs(order) <= 0 || order.canRetryVnpayPayment === false;
  }

  isRetryingVnpay(order: any): boolean {
    return !!this.retryingOrderMap[this.getOrderKey(order)];
  }

  getRetryError(order: any): string {
    return this.retryErrorMap[this.getOrderKey(order)] || '';
  }

  isOrderCancelledDueToTimeout(order: any): boolean {
    if (!order) return false;
    const st = this.normalizeStatus(order.statusCode || order.rawStatus || order.status);
    if (st !== 'CANCELLED') return false;
    const reason = String(order.cancelReason || order.payment?.failureReason || order.notes || '').toUpperCase();
    return reason.includes('QUÁ HẠN THANH TOÁN') || reason.includes('PAYMENT_TIMEOUT');
  }

  onRetryVnpayPayment(order: Order | any): void {
    if (!order || !this.canShowVnpayRetryAction(order)) return;
    const key = this.getOrderKey(order);
    if (!key || this.retryingOrderMap[key]) return;

    if (this.getRemainingPaymentMs(order) <= 0) {
      this.retryErrorMap[key] = 'Đã hết thời gian thanh toán.';
      this.store.getUserOrders();
      this.cdr.markForCheck();
      return;
    }

    this.retryingOrderMap[key] = true;
    this.retryErrorMap[key] = '';
    this.cdr.markForCheck();

    this.apiService.retryVnpayPayment(key).subscribe({
      next: (res: any) => {
        const paymentUrl = res?.paymentUrl || res?.payment?.paymentUrl;
        if (res && !res.error && paymentUrl && typeof paymentUrl === 'string') {
          if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
            window.location.assign(paymentUrl);
            return;
          }
        }

        this.retryingOrderMap[key] = false;
        const errMsg =
          typeof res?.error === 'string'
            ? res.error
            : (res?.error?.message || res?.message || 'Không thể tạo liên kết thanh toán tiếp VNPay.');
        this.retryErrorMap[key] = errMsg;
        this.notify.error(errMsg);
        this.store.getUserOrders();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.retryingOrderMap[key] = false;
        const errMsg =
          err?.error?.message || err?.message || 'Không thể kết nối máy chủ để thanh toán tiếp. Vui lòng thử lại.';
        this.retryErrorMap[key] = errMsg;
        this.notify.error(errMsg);
        this.store.getUserOrders();
        this.cdr.markForCheck();
      }
    });
  }

  // ── Tab logic ──
  setTab(tab: string): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  getRawOrders(): Order[] {
    const raw: any = this.orders;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.orders)) return raw.orders;
    return [];
  }

  // ── Phân loại đơn hàng vào mục tương ứng (xử lý cả 6 giai đoạn đổi trả & hủy yêu cầu) ──
  getOrderEffectiveTab(order: any): string {
    if (!order) return 'PENDING';
    const rawStatus = this.normalizeStatus(order.statusCode || order.rawStatus || order.status);

    const retReq = this.getLatestReturnRequest(order);
    if (retReq) {
      const s = (retReq.status || '').toUpperCase();
      // Chỉ khi người dùng chủ động hủy yêu cầu (CANC / CANCELLED) hoặc bị từ chối (REJECTED) -> quay về mục Đã giao
      if (s === 'CANC' || s === 'CANCELLED' || s === 'CANCELLED_BY_CUSTOMER' || s === 'REJECTED' || s === 'REJ') {
        return rawStatus === 'RETURNED' ? 'DELIVERED' : rawStatus;
      }

      // Xuyên suốt cả 6 giai đoạn của quy trình đổi trả/hoàn tiền:
      const returnWorkflowStatuses = [
        'PENDING',
        'APPROVED',
        'WAITING_FOR_RETURN_SHIPMENT',
        'RETURN_SHIPPED',
        'RETURN_RECEIVED',
        'INSPECTED',
        'COMPLETED'
      ];
      if (returnWorkflowStatuses.includes(s)) {
        return 'RETURNED'; // Phân loại vào mục Trả hàng/Hoàn tiền
      }
    }

    if (rawStatus === 'RETURNED') {
      return 'RETURNED';
    }

    return rawStatus;
  }

  getTabCount(tab: string): number {
    const orders = this.getRawOrders();
    if (!orders || !orders.length) return 0;
    if (tab === 'all') return orders.length;
    return orders.filter(o => this.getOrderEffectiveTab(o) === tab).length;
  }

  getFilteredOrders(): Order[] {
    const orders = this.getRawOrders();
    if (!orders || !orders.length) return [];
    const sorted = [...orders].sort((a, b) => {
      const da = new Date(a.createdAt || a.dateAdded || 0).getTime();
      const db = new Date(b.createdAt || b.dateAdded || 0).getTime();
      return db - da;
    });
    if (this.activeTab === 'all') return sorted;
    return sorted.filter(o => this.getOrderEffectiveTab(o) === this.activeTab);
  }

  // ── Formatting & Display helpers ──
  formatOrderDate(order: Order): string {
    const d = order.createdAt || order.dateAdded;
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  formatAmount(order: Order): string {
    const total = order.totalAmount ?? order.amount ?? order.subtotal ?? 0;
    return formatVND(total);
  }

  formatItemPrice(item: any): string {
    const val = item?.subtotal ?? (item?.unitPrice ? item.unitPrice * (item.quantity || 1) : 0);
    return formatVND(val);
  }

  getItemImage(item: any): string {
    const img = item?.productSnapshot?.image;
    if (img && typeof img === 'string') {
      if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/')) {
        return img;
      }
      return '/' + img;
    }
    return 'assets/images/placeholder.jpg';
  }

  getReviewDeadline(order: Order): string {
    const d = order.deliveredAt || (order as any).shipping?.deliveredAt || order.createdAt || order.dateAdded;
    if (!d) return '—';
    const base = new Date(d);
    if (isNaN(base.getTime())) return '—';
    base.setDate(base.getDate() + 30);
    const dd = String(base.getDate()).padStart(2, '0');
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const yyyy = base.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  getOrderPhone(order: Order): string {
    return order.shippingAddress?.phone || order.customerPhone || this.user?.phoneNumber || '—';
  }

  getOrderAddress(order: Order): string {
    if (order.shippingAddress?.address) {
      const parts = [
        order.shippingAddress.address,
        order.shippingAddress.ward,
        order.shippingAddress.district,
        order.shippingAddress.province
      ].filter(Boolean);
      return parts.join(', ');
    }
    return this.user?.address || '—';
  }

  normalizeStatus(status: any): string {
    if (status && typeof status === 'object') {
      return this.normalizeStatus(status.statusCode || status.rawStatus || status.status);
    }
    const s = String(status || '').toUpperCase().trim();
    if (['PENDING', 'CHỜ XÁC NHẬN', 'NEW', 'CHỜ XỬ LÝ'].includes(s)) return 'PENDING';
    if (['CONFIRMED', 'ĐÃ XÁC NHẬN'].includes(s)) return 'CONFIRMED';
    if (['PROCESSING', 'ĐANG XỬ LÝ'].includes(s)) return 'PROCESSING';
    if (['SHIPPING', 'SHIPPED', 'ĐANG GIAO', 'ĐANG GIAO HÀNG'].includes(s)) return 'SHIPPING';
    if (['DELIVERED', 'COMPLETED', 'ĐÃ GIAO', 'ĐÃ GIAO HÀNG'].includes(s)) return 'DELIVERED';
    if (['CANCELLED', 'CANCELED', 'ĐÃ HỦY'].includes(s)) return 'CANCELLED';
    if (['RETURNED', 'REFUNDED', 'TRẢ HÀNG', 'ĐÃ HOÀN TRẢ', 'HOÀN TRẢ', 'ĐÃ TRẢ HÀNG'].includes(s)) return 'RETURNED';
    return s;
  }

  isOrderReturnCompleted(order: any): boolean {
    if (!order) return false;
    if (this.normalizeStatus(order.status) === 'RETURNED') return true;
    const latestReq = this.getLatestReturnRequest(order);
    if (latestReq && (latestReq.status || '').toUpperCase() === 'COMPLETED') return true;
    return this.isReturnCompleted(order);
  }

  getStatusClass(orderOrStatus: any): string {
    if (orderOrStatus && typeof orderOrStatus === 'object') {
      if (this.isOrderReturnCompleted(orderOrStatus)) {
        return 'status-returned';
      }
      if (this.isPendingUnpaidVnpayOrder(orderOrStatus)) {
        return 'status-pending status-awaiting-payment';
      }
      return this.getStatusClass(orderOrStatus.statusCode || orderOrStatus.rawStatus || orderOrStatus.status);
    }

    switch (this.normalizeStatus(orderOrStatus)) {
      case 'PENDING': return 'status-pending';
      case 'CONFIRMED': return 'status-confirmed';
      case 'PROCESSING': return 'status-processing';
      case 'SHIPPING': return 'status-shipping';
      case 'DELIVERED': return 'status-delivered';
      case 'CANCELLED': return 'status-cancelled';
      case 'RETURNED': return 'status-returned';
      default: return 'status-pending';
    }
  }

  getStatusLabel(orderOrStatus: any): string {
    if (orderOrStatus && typeof orderOrStatus === 'object') {
      if (this.isOrderReturnCompleted(orderOrStatus)) {
        return 'Trả hàng';
      }
      if (this.isPendingUnpaidVnpayOrder(orderOrStatus)) {
        return 'Chờ thanh toán';
      }
      if (this.isOrderCancelledDueToTimeout(orderOrStatus)) {
        return 'Đã hủy – Quá hạn thanh toán';
      }
      return this.getStatusLabel(orderOrStatus.statusCode || orderOrStatus.rawStatus || orderOrStatus.status);
    }

    switch (this.normalizeStatus(orderOrStatus)) {
      case 'PENDING': return 'Chờ xác nhận';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPING': return 'Đang giao hàng';
      case 'DELIVERED': return 'Đã giao';
      case 'CANCELLED': return 'Đã hủy';
      case 'RETURNED': return 'Trả hàng';
      default: return orderOrStatus ? String(orderOrStatus) : 'Chờ xác nhận';
    }
  }

  // ── Xem chi tiết đơn hàng (Dẫn tới trang Bill chi tiết) ──
  onViewOrderDetail(order: Order): void {
    if (!order) return;
    this.viewOrderDetail.emit(order);
    const targetId = order._id || order.orderId;
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('cheri_last_order', JSON.stringify(order));
      } catch (_) { }
    }
    try {
      this.selectors.productState.update((state: any) => ({ ...state, order }));
    } catch (_) { }
    const currentLang = this.lang || 'vi';
    this.router.navigate(['/' + currentLang + '/order', targetId], {
      queryParams: { orderId: order.orderId }
    });
  }

  // ── Thao tác dialog ──
  canCancelOrder(order: Order | any): boolean {
    if (!order) return false;
    const status = this.normalizeStatus(order.statusCode || order.rawStatus || order.status);
    if (status === 'PENDING') return true;
    // Đơn COD tự xác nhận khi đặt; vẫn hủy được khi chưa xử lý và chưa thu tiền (khớp kiểm tra ở server).
    const method = String(order.payment?.method || order.paymentMethodSnapshot?.code || '').toUpperCase();
    return status === 'CONFIRMED' && method === 'COD' &&
      String(order.paymentStatus || '').toUpperCase() !== 'PAID';
  }

  openCancelDialog(order: Order | any): void {
    if (!this.canCancelOrder(order)) return;
    this.cancelOrder.emit(order);
  }

  isOrderReviewed(order: any): boolean {
    if (!order) return false;
    return !!(order.isReviewed || (order.raw && order.raw.isReviewed));
  }

  canReviewOrder(order: any): boolean {
    if (!order) return false;
    if (this.isOrderReviewed(order)) return false;
    if (this.normalizeStatus(order.statusCode || order.rawStatus || order.status) !== 'DELIVERED') return false;
    if (this.isReturnCompleted(order)) return false;

    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);

    const inactiveReturnStatuses = ['CANCELLED', 'CANC', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'REJ'];
    const hasActiveReturn = requests.some((r: any) => {
      const s = (r?.status || '').toUpperCase().trim();
      return s && !inactiveReturnStatuses.includes(s);
    });

    if (hasActiveReturn) return false;
    return true;
  }

  openReviewDialog(order: Order | any): void {
    if (!order) return;
    this.reviewOrder.emit(order);
  }

  canEditReview(order: any): boolean {
    if (!order) return false;
    if (!this.isOrderReviewed(order)) return false;
    if (this.normalizeStatus(order.statusCode || order.rawStatus || order.status) !== 'DELIVERED') return false;
    if (this.isReturnCompleted(order)) return false;

    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);

    const inactiveReturnStatuses = ['CANCELLED', 'CANC', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'REJ'];
    const hasActiveReturn = requests.some((r: any) => {
      const s = (r?.status || '').toUpperCase().trim();
      return s && !inactiveReturnStatuses.includes(s);
    });

    if (hasActiveReturn) return false;
    return true;
  }

  openEditReviewDialog(order: Order | any): void {
    if (!order || !this.canEditReview(order)) return;
    this.editReviewOrder.emit(order);
  }

  canRequestReturn(order: any): boolean {
    if (!order) return false;
    if (this.isOrderReviewed(order)) return false;
    if (this.normalizeStatus(order.statusCode || order.rawStatus || order.status) !== 'DELIVERED') return false;
    if (this.isReturnCompleted(order)) return false;

    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);

    const hasExistingReturn = requests.some((r: any) => {
      const s = (r.status || '').toUpperCase();
      return s && s !== 'CANCELLED' && s !== 'CANC';
    });

    if (hasExistingReturn) return false;
    return true;
  }

  openReturnRefundDialog(order: Order | any): void {
    if (!order) return;
    this.returnRefundOrder.emit(order);
  }

  canCancelReturnRequest(order: any): boolean {
    if (!order) return false;
    const req = this.getActiveReturnRequest(order);
    if (!req) return false;
    return (req.status || '').toUpperCase() === 'PENDING';
  }

  openReturnCancelDialog(order: Order | any): void {
    if (!order) return;
    const req = this.getActiveReturnRequest(order);
    if (!req || (req.status || '').toUpperCase() !== 'PENDING') return;
    this.cancelReturnOrder.emit(order);
  }

  // ── Return request & workflow helpers ──
  getLatestReturnRequest(order: any): any {
    if (!order) return null;
    return this.getActiveReturnRequest(order);
  }

  getActiveReturnRequest(order: any): any {
    if (!order) return null;
    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);
    if (!requests.length) return null;

    const activeStatuses = ['PENDING', 'APPROVED', 'WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED', 'COMPLETED'];
    const activeReq = requests.find((r: any) => activeStatuses.includes((r.status || '').toUpperCase()));
    if (activeReq) return activeReq;

    return requests[requests.length - 1];
  }

  isReturnCompleted(target: any): boolean {
    if (!target) return false;
    if (target.requestId || (!target.orderId && !target.items && target.status)) {
      const reqSt = (target.status || '').toUpperCase();
      const refSt = (target.refund?.status || '').toUpperCase();
      return reqSt === 'COMPLETED' || (reqSt === 'INSPECTED' && (refSt === 'COMPLETED' || refSt === 'NOT_REQUIRED'));
    }
    const st = this.normalizeStatus(target.statusCode || target.rawStatus || target.status);
    const paySt = (target.paymentStatus || target.payment?.status || '').toUpperCase();
    if (st === 'RETURNED' || paySt === 'REFUNDED') return true;

    const requests: any[] = Array.isArray(target.returnRequests) && target.returnRequests.length > 0
      ? target.returnRequests
      : (target.returnRequest ? [target.returnRequest] : []);
    return requests.some((r: any) => {
      const reqSt = (r.status || '').toUpperCase();
      const refSt = (r.refund?.status || '').toUpperCase();
      return reqSt === 'COMPLETED' && (refSt === 'COMPLETED' || refSt === 'NOT_REQUIRED');
    });
  }

  hasActiveReturnRequest(order: any): boolean {
    if (!order) return false;
    const activeReq = this.getActiveReturnRequest(order);
    if (!activeReq) return false;
    const s = (activeReq.status || '').toUpperCase();
    return ['PENDING', 'APPROVED', 'WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED'].includes(s);
  }

  isReturnPending(order: any): boolean {
    if (!order) return false;
    const activeReq = this.getActiveReturnRequest(order);
    return (activeReq?.status || '').toUpperCase() === 'PENDING';
  }

  getReturnRequestStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED':
      case 'REJ': return 'Từ chối';
      case 'WAITING_FOR_RETURN_SHIPMENT': return 'Chờ gửi hàng hoàn';
      case 'RETURN_SHIPPED': return 'Đã gửi hàng';
      case 'RETURN_RECEIVED': return 'Chéri đã nhận hàng';
      case 'INSPECTED': return 'Đã kiểm tra hàng';
      case 'COMPLETED': return 'Hoàn tất';
      case 'CANCELLED':
      case 'CANC': return 'Đã hủy';
      default: return status || '—';
    }
  }

  getRefundStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'NOT_REQUIRED': return 'Không hoàn tiền';
      case 'PENDING': return 'Chờ xử lý';
      case 'PROCESSING': return 'Đang xử lý';
      case 'COMPLETED': return 'Đã hoàn tiền';
      case 'FAILED': return 'Hoàn tiền thất bại';
      case 'CANCELLED': return 'Đã hủy';
      default: return status || '—';
    }
  }

  getReturnStepIndex(req: any): number {
    if (!req) return 1;
    const s = (req.status || '').toUpperCase();
    if (s === 'REJECTED' || s === 'REJ' || s === 'CANCELLED' || s === 'CANC' || s === 'CANCELLED_BY_CUSTOMER') return -1;
    if (s === 'PENDING') return 1;
    if (s === 'APPROVED' || s === 'WAITING_FOR_RETURN_SHIPMENT') return 2;
    if (s === 'RETURN_SHIPPED' || s === 'RETURN_RECEIVED') return 3;
    if (s === 'INSPECTED') {
      const refSt = (req.refund?.status || '').toUpperCase();
      return (refSt === 'PROCESSING' || (refSt === 'COMPLETED' && s !== 'COMPLETED')) ? 5 : 4;
    }
    if (s === 'COMPLETED') return 6;
    return 1;
  }

  isReturnTrackingExpanded(key: string): boolean {
    if (!key) return false;
    return !!this.expandedReturnTracking[key];
  }

  toggleReturnTracking(key: string): void {
    if (!key) return;
    this.expandedReturnTracking[key] = !this.expandedReturnTracking[key];
    this.cdr.markForCheck();
  }

  getSelectedReturnStep(req: any, orderId: string): number {
    const key = req?.requestId || orderId;
    if (this.selectedReturnStep[key] !== undefined) {
      return this.selectedReturnStep[key];
    }
    const currStep = this.getReturnStepIndex(req);
    return (currStep >= 1 && currStep <= 6) ? currStep : 1;
  }

  selectReturnStep(req: any, orderId: string, step: number, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const key = req?.requestId || orderId;
    this.selectedReturnStep[key] = step;
    this.cdr.markForCheck();
  }

  getReturnStepTitle(step: number): string {
    switch (step) {
      case 1: return 'Gửi yêu cầu';
      case 2: return 'Đã duyệt';
      case 3: return 'Gửi/Nhận hàng';
      case 4: return 'Kiểm hàng';
      case 5: return 'Xử lý hoàn tiền';
      case 6: return 'Hoàn tất';
      default: return `Giai đoạn ${step}`;
    }
  }

  hasStageData(req: any, step: number): boolean {
    if (!req) return false;
    const currStep = this.getReturnStepIndex(req);
    switch (step) {
      case 1:
        return !!(req.reason || req.description || req.notes || (req.items && req.items.length > 0) || req.requestedAt);
      case 2:
        return req.status === 'REJECTED' || !!(req.approvedAt || req.approveNote || req.rejectionReason || req.returnShipping?.instructions || (req.refund?.approvedAmount && currStep >= 2));
      case 3:
        return !!(req.returnShipping?.carrier || req.returnShipping?.trackingCode || req.returnShipping?.shippedAt || req.returnShipping?.receivedAt || req.returnShipping?.notes || req.returnShipping?.receivedNote || req.returnShipping?.instructions);
      case 4:
        return !!(req.inspection?.inspectedAt || req.inspection?.conditionNotes || req.inspection?.isEligible !== undefined);
      case 5:
        return !!(req.refund?.refundedAmount || req.refund?.transactionId || req.refund?.bankName || req.refund?.accountNumber || req.refund?.notes || (req.refund?.status && req.refund?.status !== 'PENDING' && req.refund?.status !== 'NOT_REQUIRED'));
      case 6:
        return req.status === 'COMPLETED' || !!req.completedAt;
      default:
        return false;
    }
  }
}
