import { Component, OnInit, OnDestroy, Signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Observable, Subscription } from 'rxjs';
import { TranslateService } from '../../../services/translate.service';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { ApiService } from '../../../services/api.service';
import { Order } from '../../shared/models';

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

  private sub = new Subscription();

  readonly component = 'orderComponent';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private selectors: SignalStoreSelectors,
    public translate: TranslateService,
    private apiService: ApiService
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

    this.resolveOrderData();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /**
   * Khôi phục dữ liệu đơn hàng:
   * 1. Ưu tiên order trực tiếp từ store (sau khi đặt hàng thành công)
   * 2. Nếu store rỗng (F5/reload): đọc từ sessionStorage ('cheri_last_order')
   * 3. Đối chiếu queryParam orderId hoặc route param :id
   * 4. Nếu user đăng nhập: tìm trong danh sách đơn hàng của user qua getUserOrders()
   */
  resolveOrderData(): void {
    const storeOrder = this.orderSignal();
    const queryOrderId = this.route.snapshot.queryParamMap.get('orderId') || this.route.snapshot.paramMap.get('id');

    // 1. Kiểm tra store
    if (storeOrder && (!queryOrderId || storeOrder.orderId === queryOrderId || (storeOrder as any)._id === queryOrderId)) {
      this.currentOrder = storeOrder;
      this.saveOrderToSession(storeOrder);
      return;
    }

    // 2. Kiểm tra sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const cachedRaw = window.sessionStorage.getItem('cheri_last_order');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && (!queryOrderId || cached.orderId === queryOrderId || cached._id === queryOrderId)) {
            this.currentOrder = cached;
            return;
          }
        }
      } catch (_) {}
    }

    // 3. Nếu người dùng đã đăng nhập và có orderId, thử nạp từ getUserOrders()
    const currentUser = this.selectors.user();
    if (currentUser && queryOrderId) {
      this.isLoading = true;
      this.errorMessage = '';
      this.apiService.getUserOrders().subscribe({
        next: (orders: any[]) => {
          this.isLoading = false;
          if (Array.isArray(orders)) {
            const matched = orders.find(
              (o) => o.orderId === queryOrderId || o._id === queryOrderId
            );
            if (matched) {
              this.currentOrder = matched;
              this.saveOrderToSession(matched);
              return;
            }
          }
          // Thử tiếp qua trackOrder nếu không tìm thấy trong list
          this.fetchViaTrackOrder(queryOrderId);
        },
        error: () => {
          this.isLoading = false;
          this.fetchViaTrackOrder(queryOrderId);
        }
      });
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
    this.isLoading = true;
    this.apiService.trackOrder({ orderId: queryOrderId }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res && !res.error && res.orderId) {
          this.currentOrder = res;
          this.saveOrderToSession(res);
        } else if (!this.currentOrder) {
          this.errorMessage = 'Không tìm thấy thông tin đơn hàng này.';
        }
      },
      error: () => {
        this.isLoading = false;
        if (!this.currentOrder) {
          this.errorMessage = 'Không thể tải thông tin đơn hàng. Vui lòng thử lại sau.';
        }
      }
    });
  }

  private saveOrderToSession(order: any): void {
    if (typeof window !== 'undefined' && window.sessionStorage && order) {
      try {
        window.sessionStorage.setItem('cheri_last_order', JSON.stringify(order));
      } catch (_) {}
    }
  }

  // ─── TÍNH TOÁN VÀ ĐỊNH DẠNG ────────────────────────────────────────────────

  getTotalQuantity(order: any): number {
    const items = order?.items || order?.cart?.items || [];
    return items.reduce((sum: number, it: any) => sum + (Number(it.quantity || it.qty) || 1), 0);
  }

  getOrderStatusText(status: string): string {
    switch ((status || '').toUpperCase()) {
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
        return status || 'Chờ xử lý';
    }
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
        return 'Chờ thanh toán';
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

  printBill(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  goBack(): void {
    this.location.back();
  }
}
