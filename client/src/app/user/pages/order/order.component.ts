import { ChangeDetectorRef, Component, OnInit, OnDestroy, Signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { TranslateService } from '../../../services/translate.service';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { Order } from '../../shared/models';
import { accessTokenKey } from '../../shared/constants';

@Component({
  selector: 'app-order',
  templateUrl: './order.component.html',
  styleUrls: ['./order.component.css'],
  standalone: false
})
export class OrderComponent implements OnInit, OnDestroy {
  orderSignal: Signal<Order>;
  lang$: Observable<string>;
  currentLang = 'vi';
  currentOrder: any = null;
  isLoading = false;
  errorMessage = '';
  get paymentMethodLabel(): string {
    const order = this.currentOrder;
    const code = String(order?.payment?.method || order?.paymentMethodCode || order?.paymentMethodSnapshot?.code || '').toUpperCase();
    const labels: Record<string, string> = {
      VNPAY: 'Thanh toán qua VNPAY', STRIPE: 'Thanh toán thẻ (Stripe)',
      CREDIT_CARD: 'Thẻ tín dụng / Ghi nợ', CARD: 'Thanh toán thẻ',
      COD: 'Thanh toán khi nhận hàng (COD)', BANK_TRANSFER: 'Chuyển khoản ngân hàng',
    };
    return labels[code] || order?.paymentMethodSnapshot?.name || order?.paymentMethod || order?.payment?.provider || 'Chưa xác định';
  }
  get awaitingOnlinePayment(): boolean {
    const order = this.currentOrder;
    const method = String(order?.payment?.method || order?.paymentMethodSnapshot?.code || order?.paymentMethodCode || order?.payment?.provider || order?.paymentMethod || '').toUpperCase();
    const status = String(order?.paymentStatus || order?.payment?.status || '').toUpperCase();
    return ['VNPAY', 'STRIPE', 'CARD', 'CREDIT_CARD'].includes(method) && !['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'].includes(status);
  }

  get confirmationTitle(): string {
    if (this.currentOrder?.status === 'CANCELLED') return 'Đơn hàng đã hủy';
    if (this.awaitingOnlinePayment) {
      const status = this.currentOrder?.paymentStatus || this.currentOrder?.payment?.status;
      return status === 'FAILED' ? 'Thanh toán không thành công' : 'Đơn hàng chờ thanh toán';
    }
    return 'Đặt hàng thành công';
  }
  storeContact: { email?: string; phone?: string; address?: string } | null = null;

  private sub = new Subscription();

  readonly component = 'orderComponent';

  get currentUser(): any {
    return this.selectors.user();
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private selectors: SignalStoreSelectors,
    public translate: TranslateService,
    private apiService: ApiService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.orderSignal = this.selectors.order;
    this.lang$ = this.translate.getLang$();
  }

  ngOnInit(): void {
    this.sub.add(
      this.lang$.subscribe((l) => {
        if (l) this.currentLang = l;
      })
    );

    this.loadStoreContact();

    let lastOrderId: string | null = null;
    this.sub.add(
      combineLatest([this.route.params, this.route.queryParams]).subscribe(([params, queryParams]) => {
        const orderId = params['id'] || queryParams['orderId'] || '';
        const orderIdStr = orderId ? String(orderId).trim() : '';

        // Tự động cuộn lên đầu trang khi mã đơn hàng thay đổi (kể cả khi component được tái sử dụng)
        if (orderIdStr !== lastOrderId) {
          lastOrderId = orderIdStr;
          this.resetScrollToTop();
        }

        this.resolveOrderData(orderIdStr || undefined);
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /**
   * Khôi phục dữ liệu đơn hàng:
   * 1. Ưu tiên order trực tiếp từ store (sau khi đặt hàng thành công)
   * 2. Nếu store rỗng (F5/reload): đọc từ sessionStorage ('cheri_last_order')
   * 3. Đối chiếu queryParam orderId hoặc route param :id
   * 4. Nếu có phiên đăng nhập: lấy riêng đơn qua API có kiểm tra quyền truy cập.
   */
  resolveOrderData(explicitOrderId?: string): void {
    const paymentReturn = this.route.snapshot.queryParamMap.has('payment');
    if (paymentReturn) this.currentOrder = null;
    const storeOrder = this.orderSignal();
    const queryOrderId = explicitOrderId !== undefined
      ? explicitOrderId
      : (this.route.snapshot.queryParamMap.get('orderId') || this.route.snapshot.paramMap.get('id'));

    // 1. Kiểm tra store
    if (!paymentReturn && !queryOrderId && storeOrder) {
      this.currentOrder = storeOrder;
      this.errorMessage = '';
      this.saveOrderToSession(storeOrder);
      this.resetScrollToTop();
      return;
    }

    // 2. Kiểm tra sessionStorage
    let hasSessionCache = false;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const cachedRaw = window.sessionStorage.getItem('cheri_last_order');
        if (cachedRaw && !paymentReturn) {
          const cached = JSON.parse(cachedRaw);
          if (cached && (!queryOrderId || cached.orderId === queryOrderId || cached._id === queryOrderId)) {
            this.currentOrder = cached;
            this.errorMessage = '';
            hasSessionCache = true;
          }
        }
      } catch (_) {}
    }

    // 3. Nạp trạng thái mới nhất từ API chi tiết đơn hàng.
    // The API uses the stored token even while the user signal is still hydrating.
    // Fetch one authorized order: admin list endpoints may return a paginated object.
    const hasSession = !!this.selectors.user() || (typeof window !== 'undefined' && !!window.localStorage.getItem(accessTokenKey));
    if (hasSession && queryOrderId) {
      if (!hasSessionCache) {
        this.isLoading = true;
      }
      this.errorMessage = '';
      this.apiService.getOrder(queryOrderId).subscribe({
        next: (order: any) => {
          this.isLoading = false;
          if (order && !order.error) {
            const matched = order.orderId === queryOrderId || order._id === queryOrderId ? order : null;
            if (matched) {
              this.currentOrder = matched;
              this.errorMessage = '';
              this.saveOrderToSession(matched);
              this.resetScrollToTop();
              this.cdr.markForCheck();
              return;
            }
          }
          if (!hasSessionCache) {
            this.fetchViaTrackOrder(queryOrderId);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          if (!hasSessionCache) {
            this.fetchViaTrackOrder(queryOrderId);
          }
          this.cdr.markForCheck();
        }
      });
      return;
    }

    if (hasSessionCache) {
      this.resetScrollToTop();
      return;
    }

    // 4. Nếu có queryOrderId (khách vãng lai): thử nạp qua tracking
    if (queryOrderId) {
      this.fetchViaTrackOrder(queryOrderId);
      return;
    }

    // 5. Nếu không có order nào
    if (!this.currentOrder) {
      this.errorMessage = 'Không tìm thấy thông tin đơn hàng.';
    }
  }

  private fetchViaTrackOrder(queryOrderId: string): void {
    let authContact = '';
    if (typeof window !== 'undefined' && window.sessionStorage) {
      authContact = window.sessionStorage.getItem('cheri_last_order_contact') || '';
    }
    const queryContact = this.route.snapshot.queryParamMap.get('contact') ||
      this.route.snapshot.queryParamMap.get('phone') ||
      this.route.snapshot.queryParamMap.get('email');
    if (queryContact) {
      authContact = queryContact;
    }

    if (!authContact) {
      if (!this.currentOrder) {
        this.errorMessage = 'Không tìm thấy thông tin đơn hàng này.';
      }
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();
    this.apiService.trackOrder({ orderId: queryOrderId, authContact }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res && !res.error && res.orderId) {
          this.currentOrder = res;
          this.errorMessage = '';
          this.saveOrderToSession(res);
          this.resetScrollToTop();
        } else if (!this.currentOrder) {
          this.errorMessage = res?.error || 'Không tìm thấy thông tin đơn hàng này.';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        if (!this.currentOrder) {
          this.errorMessage = 'Không thể tải thông tin đơn hàng. Vui lòng thử lại sau.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  private saveOrderToSession(order: any): void {
    if (typeof window !== 'undefined' && window.sessionStorage && order) {
      try {
        window.sessionStorage.setItem('cheri_last_order', JSON.stringify(order));
        const contact = (
          order.customerPhone ||
          order.customerEmail ||
          order.shippingAddress?.phone ||
          order.shippingAddress?.email ||
          order.email ||
          order.phone ||
          ''
        ).trim();
        if (contact) {
          window.sessionStorage.setItem('cheri_last_order_contact', contact);
        }
      } catch (_) {}
    }
  }

  // ─── TÍNH TOÁN VÀ ĐỊNH DẠNG ────────────────────────────────────────────────

  getTotalQuantity(order: any): number {
    const items = order?.items || order?.cart?.items || [];
    return items.reduce((sum: number, it: any) => sum + (Number(it.quantity || it.qty) || 1), 0);
  }

  getOrderStatusText(status: any): string {
    switch (this.normalizeStatus(status)) {
      case 'PENDING':
        return 'Chờ xử lý';
      case 'CONFIRMED':
        return 'Đã xác nhận';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'SHIPPING':
        return 'Đang giao hàng';
      case 'DELIVERY_FAILED':
        return 'Giao hàng không thành công';
      case 'DELIVERED':
        return 'Đã giao hàng';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'RETURNED':
        return 'Đã trả hàng';
      default:
        return (status && typeof status === 'object' ? (status.status || status.statusCode) : status) || 'Chờ xử lý';
    }
  }

  // ─── Chuẩn hóa trạng thái đơn hàng (Đồng bộ chuẩn hệ thống Chéri) ───────────────
  normalizeStatus(status: any): string {
    if (status && typeof status === 'object') {
      return this.normalizeStatus(status.statusCode || status.rawStatus || status.status);
    }
    const s = String(status || '').toUpperCase().trim();
    if (['PENDING', 'CHỜ XÁC NHẬN', 'NEW', 'CHỜ XỬ LÝ'].includes(s)) return 'PENDING';
    if (['CONFIRMED', 'ĐÃ XÁC NHẬN'].includes(s)) return 'CONFIRMED';
    if (['PROCESSING', 'ĐANG XỬ LÝ'].includes(s)) return 'PROCESSING';
    if (['SHIPPING', 'SHIPPED', 'ĐANG GIAO', 'ĐANG GIAO HÀNG'].includes(s)) return 'SHIPPING';
    if (['DELIVERY_FAILED', 'GIAO THẤT BẠI', 'GIAO HÀNG KHÔNG THÀNH CÔNG'].includes(s)) return 'DELIVERY_FAILED';
    if (['DELIVERED', 'COMPLETED', 'ĐÃ GIAO', 'ĐÃ GIAO HÀNG'].includes(s)) return 'DELIVERED';
    if (['CANCELLED', 'CANCELED', 'ĐÃ HỦY'].includes(s)) return 'CANCELLED';
    if (['RETURNED', 'REFUNDED', 'TRẢ HÀNG', 'ĐÃ HOÀN TRẢ', 'HOÀN TRẢ', 'ĐÃ TRẢ HÀNG'].includes(s)) return 'RETURNED';
    return s;
  }

  /**
   * Kiểm tra xem đơn hàng có thực sự thuộc mục "Đã giao" (DELIVERED) hay không.
   * Chặn tuyệt đối các trường hợp:
   * 1. Trạng thái chưa giao: PENDING, CONFIRMED, PROCESSING, SHIPPING, DELIVERY_FAILED...
   * 2. Đơn hàng đã hủy: CANCELLED
   * 3. Đơn hàng đang hoặc đã qua quy trình trả hàng/hoàn tiền:
   *    (PENDING, APPROVED, WAITING_FOR_RETURN_SHIPMENT, RETURN_SHIPPED, RETURN_RECEIVED, INSPECTED, COMPLETED)
   * 4. Trạng thái thanh toán bị hoàn tiền (REFUNDED)
   */
  get isDeliveredOrder(): boolean {
    if (!this.currentOrder) return false;
    const rawStatus = this.normalizeStatus(this.currentOrder.statusCode || this.currentOrder.rawStatus || this.currentOrder.status);
    if (rawStatus !== 'DELIVERED') {
      return false;
    }

    // Kiểm tra các yêu cầu trả hàng & hoàn tiền
    const reqs = this.getReturnRequests();
    if (reqs && reqs.length > 0) {
      const returnWorkflowStatuses = [
        'PENDING',
        'APPROVED',
        'WAITING_FOR_RETURN_SHIPMENT',
        'RETURN_SHIPPED',
        'RETURN_RECEIVED',
        'INSPECTED',
        'COMPLETED'
      ];
      // Nếu có bất kỳ yêu cầu trả hàng nào đang active hoặc đã hoàn tất quy trình
      const hasActiveReturn = reqs.some((r: any) => {
        const s = (r?.status || '').toUpperCase();
        return returnWorkflowStatuses.includes(s);
      });
      if (hasActiveReturn) {
        return false;
      }
    }

    const payStatus = (this.currentOrder.paymentStatus || this.currentOrder.payment?.status || '').toUpperCase();
    if (payStatus === 'REFUNDED') {
      return false;
    }

    return true;
  }

  get isOrderCancelled(): boolean {
    return this.normalizeStatus(this.currentOrder?.status) === 'CANCELLED';
  }

  get canPrintInvoice(): boolean {
    return this.isDeliveredOrder;
  }

  getOrderStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'CONFIRMED':
        return 'status-confirmed';
      case 'PROCESSING':
        return 'status-processing';
      case 'SHIPPING':
        return 'status-shipping';
      case 'DELIVERED':
        return 'status-delivered';
      case 'DELIVERY_FAILED':
        return 'status-failed';
      case 'CANCELLED':
      case 'RETURNED':
        return 'status-cancelled';
      case 'PENDING':
      default:
        return 'status-pending';
    }
  }

  getPaymentStatusText(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PENDING':
        return String(this.currentOrder?.payment?.method || this.currentOrder?.paymentMethodCode || this.currentOrder?.paymentMethodSnapshot?.code || '').toUpperCase() === 'COD'
          ? 'Chưa thanh toán' : 'Chờ thanh toán';
      case 'PAID':
        return 'Đã thanh toán';
      case 'FAILED':
        return 'Thanh toán thất bại';
      case 'REFUNDED':
        return 'Đã hoàn tiền';
      case 'PARTIALLY_REFUNDED':
        return 'Đã hoàn tiền một phần';
      default:
        return status || 'Chờ thanh toán';
    }
  }

  getPaymentStatusClass(status: string): string {
    switch ((status || '').toUpperCase()) {
      case 'PAID':
        return 'payment-paid';
      case 'FAILED':
        return 'payment-failed';
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'payment-refunded';
      case 'PENDING':
      default:
        return 'payment-pending';
    }
  }

  getFormattedAddress(order: any): string {
    const addr = order?.shippingAddress || (Array.isArray(order?.addresses) ? order.addresses[0] : null);
    if (!addr) return '';
    const detail = addr.addressDetail || addr.line1;
    const parts = [
      detail,
      addr.wardName || addr.ward,
      addr.districtName || addr.district,
      addr.provinceName || addr.province || addr.city
    ].filter(Boolean);
    if (parts.length > 1) {
      return Array.from(new Set(parts)).join(', ');
    }
    if (addr.fullAddress && addr.fullAddress.trim()) {
      return addr.fullAddress.trim();
    }
    if (addr.address && addr.address.trim()) {
      return addr.address.trim();
    }
    return '';
  }

  getVariantDescription(item: any): string {
    const v = item?.productSnapshot?.variant || item?.variant;
    if (!v) return '';
    const parts: string[] = [];
    if (v.classification) parts.push(v.classification);
    if (v.color) parts.push(`Màu ${v.color}`);
    if (v.size) parts.push(`Size ${v.size}`);
    return parts.join(' · ');
  }

  // ─── ACTION BUTTONS ────────────────────────────────────────────────────────

  continueShopping(): void {
    this.router.navigate(['/' + this.currentLang + '/product/all']);
  }

  goToTracking(): void {
    const code = this.currentOrder?.orderId || '';
    if (code) {
      this.router.navigate(['/' + this.currentLang + '/tracking'], {
        queryParams: { code }
      });
    } else {
      this.router.navigate(['/' + this.currentLang + '/tracking']);
    }
  }

  loadStoreContact(): void {
    this.sub.add(
      this.apiService.getStoreContact().subscribe({
        next: (contact) => {
          if (contact && (contact.email || contact.phone || contact.address)) {
            this.storeContact = contact;
          } else {
            this.storeContact = null;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.storeContact = null;
          this.cdr.markForCheck();
        }
      })
    );
  }

  get hasStoreContact(): boolean {
    return Boolean(
      this.storeContact &&
      (this.storeContact.email || this.storeContact.phone || this.storeContact.address)
    );
  }

  printBill(): void {
    if (!this.canPrintInvoice) {
      this.notify.warning('Chỉ đơn hàng ở trạng thái Đã giao mới được phép in hóa đơn điện tử.');
      return;
    }
    if (typeof window === 'undefined') return;
    if (this.storeContact) {
      window.print();
    } else {
      this.apiService.getStoreContact().subscribe({
        next: (contact) => {
          if (contact && (contact.email || contact.phone || contact.address)) {
            this.storeContact = contact;
          }
          if (!this.canPrintInvoice) {
            this.notify.warning('Chỉ đơn hàng ở trạng thái Đã giao mới được phép in hóa đơn điện tử.');
            return;
          }
          window.print();
        },
        error: () => {
          if (!this.canPrintInvoice) {
            this.notify.warning('Chỉ đơn hàng ở trạng thái Đã giao mới được phép in hóa đơn điện tử.');
            return;
          }
          window.print();
        }
      });
    }
  }

  goBack(): void {
    this.location.back();
  }

  resetScrollToTop(): void {
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
      if (scrollWrap) {
        const prevBehavior = scrollWrap.style.scrollBehavior;
        scrollWrap.style.scrollBehavior = 'auto';
        scrollWrap.scrollTop = 0;
        scrollWrap.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            if (scrollWrap) {
              scrollWrap.scrollTop = 0;
              scrollWrap.style.scrollBehavior = prevBehavior;
            }
          });
        }
      }
      const adminMain = document.querySelector('.admin-main') as HTMLElement | null;
      if (adminMain) {
        adminMain.scrollTop = 0;
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }

  // ── Return & Refund Tracking ──
  getReturnRequests(): any[] {
    if (!this.currentOrder) return [];
    if (Array.isArray(this.currentOrder.returnRequests) && this.currentOrder.returnRequests.length > 0) {
      return this.currentOrder.returnRequests;
    }
    if (this.currentOrder.returnRequest) {
      return [this.currentOrder.returnRequest];
    }
    return [];
  }

  getReturnRequestStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED': return 'Từ chối';
      case 'WAITING_FOR_RETURN_SHIPMENT': return 'Chờ gửi hàng hoàn';
      case 'RETURN_SHIPPED': return 'Đã gửi hàng hoàn';
      case 'RETURN_RECEIVED': return 'Chéri đã nhận hàng';
      case 'INSPECTED': return 'Đã kiểm tra hàng';
      case 'COMPLETED': return 'Hoàn tất trả hàng';
      case 'CANCELLED': return 'Đã hủy';
      default: return status || '—';
    }
  }

  getRefundStatusLabel(status: string): string {
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

  getReturnStepIndex(req: any): number {
    if (!req) return 1;
    const s = (req.status || '').toUpperCase();
    if (s === 'REJECTED') return -1;
    if (s === 'PENDING') return 1;
    if (s === 'APPROVED' || s === 'WAITING_FOR_RETURN_SHIPMENT') return 2;
    if (s === 'RETURN_SHIPPED' || s === 'RETURN_RECEIVED') return 3;
    if (s === 'INSPECTED') {
      const refSt = (req.refund?.status || '').toUpperCase();
      return (refSt === 'PROCESSING' || refSt === 'COMPLETED') ? 5 : 4;
    }
    if (s === 'COMPLETED') return 6;
    return 1;
  }
}
