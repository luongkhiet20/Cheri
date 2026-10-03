import { Component, Signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { SignalStore } from '../../../store/signal.store';
import { Order, TrackingResult, ShippingLog } from '../../shared/models';
import { PriceFormatPipe } from '../../../pipes/price.pipe';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PriceFormatPipe],
})
export class OrderTrackingComponent implements OnInit {

  // ─── Auth state ──────────────────────────────────────────────────────────
  user: Signal<any>;
  userOrders: Signal<Order[]>;

  // ─── Logged-in flow ──────────────────────────────────────────────────────
  selectedOrder: Order | null = null;
  selectedOrderId: string = '';
  ordersLoading = false;

  // ─── Guest flow ──────────────────────────────────────────────────────────
  guestInput = '';
  guestVerify = '';
  guestLoading = false;
  guestResult: TrackingResult | null = null;
  guestError = '';

  // ─── Shared result display ───────────────────────────────────────────────
  trackingResult: TrackingResult | null = null;
  trackingLoading = false;

  private targetOrderIdFromQuery: string | null = null;

  // Thanh tiến trình chuẩn chỉnh 4 bước theo BPMN và bảng ánh xạ CSDL
  readonly OrderSteps = [
    { key: 'PENDING',    label: 'Đã đặt hàng' },
    { key: 'CONFIRMED',  label: 'Đã xác nhận / Đóng gói' },
    { key: 'SHIPPING',   label: 'Đang giao hàng' },
    { key: 'DELIVERED',  label: 'Đã giao hàng' },
  ];

  constructor(
    private selectors: SignalStoreSelectors,
    private store: SignalStore,
    private apiService: ApiService,
    private route: ActivatedRoute,
  ) {
    this.user = this.selectors.user;
    this.userOrders = this.selectors.userOrders;

    // Phản ứng tự động khi trạng thái user hoặc đơn hàng thay đổi
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        const orders = this.userOrders();
        if (!orders || orders.length === 0) {
          this.store.getUserOrders();
        } else if (this.targetOrderIdFromQuery && !this.selectedOrder) {
          const match = orders.find(
            o => o.orderId === this.targetOrderIdFromQuery || (o as any)._id === this.targetOrderIdFromQuery
          );
          if (match) {
            this.selectOrder(match);
          }
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    // Đọc query parameters (hỗ trợ trigger từ link email / thông báo / redirect)
    this.route.queryParams.subscribe(params => {
      const q = params['orderId'] || params['id'] || params['trackingNumber'];
      const verify = params['email'] || params['phone'];

      if (q) {
        this.targetOrderIdFromQuery = q;
        this.guestInput = q;

        // Nếu người dùng đã đăng nhập và đã có orders trong store
        const orders = this.userOrders();
        if (orders && orders.length > 0) {
          const match = orders.find(
            o => o.orderId === q || (o as any)._id === q || o.trackingNumber === q
          );
          if (match) {
            this.selectOrder(match);
          }
        }
      }

      if (verify) {
        this.guestVerify = verify;
      }

      // Tự động gọi API tra cứu nếu có đầy đủ cả 2 trường
      if (this.guestInput && this.guestVerify && !this.user()) {
        this.trackGuest();
      }
    });

    if (this.user()) {
      this.ordersLoading = true;
      this.store.getUserOrders();
      this.ordersLoading = false;
    }
  }

  // ─── Logged-in: chọn đơn hàng ────────────────────────────────────────────
  selectOrder(order: Order): void {
    this.selectedOrder = order;
    this.selectedOrderId = order.orderId;
    this.trackingResult = this.orderToTrackingResult(order);
  }

  onOrderSelectChange(orderId: string): void {
    if (!orderId) {
      this.clearSelection();
      return;
    }
    const orders = this.userOrders();
    const match = orders?.find(o => o.orderId === orderId || (o as any)._id === orderId);
    if (match) {
      this.selectOrder(match);
    }
  }

  clearSelection(): void {
    this.selectedOrder = null;
    this.selectedOrderId = '';
    this.trackingResult = null;
  }

  // ─── Guest: tra cứu ──────────────────────────────────────────────────────
  trackGuest(): void {
    if (!this.guestInput.trim() || !this.guestVerify.trim()) return;

    this.guestLoading = true;
    this.guestError = '';
    this.guestResult = null;
    this.trackingResult = null;

    const payload: any = {
      trackingCode: this.guestInput.trim(),
      orderId: this.guestInput.trim(),
      trackingNumber: this.guestInput.trim(),
      authContact: this.guestVerify.trim(),
      email: this.guestVerify.trim(),
      phone: this.guestVerify.trim(),
    };

    this.apiService.trackOrder(payload).subscribe((res: any) => {
      this.guestLoading = false;
      if (res?.error) {
        this.guestError = res.error;
      } else {
        this.guestResult = res as TrackingResult;
        this.trackingResult = res as TrackingResult;
      }
    });
  }

  resetGuest(): void {
    this.guestInput = '';
    this.guestVerify = '';
    this.guestError = '';
    this.guestResult = null;
    this.trackingResult = null;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Chuyển Order thành TrackingResult để tái sử dụng toàn bộ giao diện */
  orderToTrackingResult(order: Order): TrackingResult {
    const rawOrder = order as any;
    const addr = rawOrder.shippingAddress || (Array.isArray(rawOrder.addresses) ? rawOrder.addresses[0] : null) || {};
    const fullAddress = [
      addr.line1 || addr.address,
      addr.line2,
      addr.ward,
      addr.district,
      addr.city || addr.province,
      addr.country
    ].filter(Boolean).join(', ');

    // Chuẩn hóa sản phẩm
    const items = (Array.isArray(rawOrder.items) && rawOrder.items.length > 0)
      ? rawOrder.items.map((it: any) => ({
          title: it.productSnapshot?.title || 'Sản phẩm',
          sku: it.productSnapshot?.sku || '',
          image: it.productSnapshot?.image || '',
          variant: it.productSnapshot?.variant || null,
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          subtotal: it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1))
        }))
      : (rawOrder.cart?.items || []).map((it: any) => ({
          title: it.item?.title || 'Sản phẩm',
          sku: it.item?.sku || '',
          image: it.item?.mainImage?.url || it.item?.images?.[0] || '',
          variant: it.item?.variants?.[0] ? {
            color: it.item.variants[0].color,
            size: it.item.variants[0].size,
            classification: it.item.variants[0].classification
          } : (it.variant || null),
          quantity: it.qty || 1,
          unitPrice: it.price || 0,
          subtotal: (it.price || 0) * (it.qty || 1)
        }));

    const shippingLogs = Array.isArray(rawOrder.shipping?.logs) && rawOrder.shipping.logs.length > 0
      ? rawOrder.shipping.logs
      : (Array.isArray(rawOrder.shippingLogs) ? rawOrder.shippingLogs : []);

    const statusHistory = Array.isArray(rawOrder.statusHistory)
      ? rawOrder.statusHistory.map((h: any) => ({
          status: h.status,
          updatedAt: h.updatedAt || h.timestamp,
          note: h.note || h.description || ''
        }))
      : [];

    return {
      orderId: rawOrder.orderId,
      status: rawOrder.status || rawOrder.shipping?.status,
      trackingNumber: rawOrder.shipping?.trackingNumber || rawOrder.trackingNumber || null,
      trackingUrl: rawOrder.shipping?.trackingUrl || rawOrder.trackingUrl || null,
      carrierName: rawOrder.shipping?.carrierName || rawOrder.shippingProvider || rawOrder.shippingMethodSnapshot?.name || null,
      estimatedDelivery: rawOrder.shipping?.estimatedDelivery || rawOrder.estimatedDeliveryDate || null,
      dateAdded: rawOrder.dateAdded || rawOrder.createdAt || null,
      shippedAt: rawOrder.shippedAt || null,
      deliveredAt: rawOrder.deliveredAt || null,
      shippingAddress: {
        name: addr.name || addr.fullName || addr.receiverName || '',
        phone: addr.phone || '',
        line1: addr.line1 || addr.address || '',
        line2: addr.line2 || '',
        ward: addr.ward || '',
        district: addr.district || '',
        city: addr.city || addr.province || '',
        country: addr.country || 'Việt Nam',
        fullAddress: fullAddress || 'Theo thông tin đơn hàng'
      },
      shippingLogs,
      statusHistory,
      items,
      paymentMethod: rawOrder.type || rawOrder.paymentMethod || rawOrder.paymentMethodSnapshot?.name || 'COD',
      subtotal: rawOrder.cart?.totalPrice ?? rawOrder.subtotal ?? 0,
      shippingFee: rawOrder.cart?.shippingCost ?? rawOrder.shippingFee ?? 0,
      totalAmount: rawOrder.amount ?? rawOrder.totalAmount ?? 0,
      currency: rawOrder.currency || 'VND'
    };
  }

  isStepDone(stepKey: string, currentStatus: string): boolean {
    if (!currentStatus) return false;
    switch (stepKey) {
      case 'PENDING':
        return true;
      case 'CONFIRMED':
        return ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED'].includes(currentStatus);
      case 'SHIPPING':
        return ['SHIPPING', 'DELIVERED'].includes(currentStatus);
      case 'DELIVERED':
        return currentStatus === 'DELIVERED';
      default:
        return false;
    }
  }

  isStepActive(stepKey: string, currentStatus: string): boolean {
    if (!currentStatus) return false;
    switch (stepKey) {
      case 'PENDING':
        return currentStatus === 'PENDING';
      case 'CONFIRMED':
        return currentStatus === 'CONFIRMED' || currentStatus === 'PROCESSING';
      case 'SHIPPING':
        return currentStatus === 'SHIPPING';
      case 'DELIVERED':
        return currentStatus === 'DELIVERED';
      default:
        return false;
    }
  }

  getStepTimestamp(stepKey: string): Date | string | null {
    if (!this.trackingResult) return null;
    const res = this.trackingResult as any;
    switch (stepKey) {
      case 'PENDING':
        return res.dateAdded || null;
      case 'CONFIRMED': {
        const hist = (res.statusHistory || []).find((h: any) => h.status === 'CONFIRMED' || h.status === 'PROCESSING');
        return hist ? hist.updatedAt : null;
      }
      case 'SHIPPING': {
        const log = (res.shippingLogs || []).find((l: any) => l.status === 'PICKED_UP' || l.status === 'IN_TRANSIT' || l.status === 'SHIPPING');
        if (log) return log.timestamp;
        const hist = (res.statusHistory || []).find((h: any) => h.status === 'SHIPPING');
        return hist ? hist.updatedAt : (res.shippedAt || null);
      }
      case 'DELIVERED': {
        const hist = (res.statusHistory || []).find((h: any) => h.status === 'DELIVERED');
        if (hist) return hist.updatedAt;
        const log = (res.shippingLogs || []).find((l: any) => l.status === 'DELIVERED');
        return log ? log.timestamp : (res.deliveredAt || null);
      }
      default:
        return null;
    }
  }

  formatVariant(variant: any): string {
    if (!variant) return '';
    if (typeof variant === 'string') return variant;
    const parts: string[] = [];
    if (variant.color) parts.push(`Màu: ${variant.color}`);
    if (variant.size) parts.push(`Size: ${variant.size}`);
    if (variant.classification) parts.push(variant.classification);
    return parts.join(' • ');
  }

  isCancelled(status: string): boolean {
    return status === 'CANCELLED' || status === 'RETURNED';
  }

  sortedLogs(logs: ShippingLog[]): ShippingLog[] {
    if (!logs || !logs.length) return [];
    return [...logs].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  sortedHistory(history: { status: string; updatedAt: Date; note: string }[]): any[] {
    if (!history || !history.length) return [];
    return [...history].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  statusLabel(status: string): string {
    const map: { [k: string]: string } = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang chuẩn bị',
      SHIPPING: 'Đang vận chuyển',
      DELIVERED: 'Đã giao hàng',
      CANCELLED: 'Đã huỷ',
      RETURNED: 'Hoàn hàng',
    };
    return map[status] || status;
  }

  getOrderUrl(orderId: string): string {
    return '/vi/orders/' + orderId;
  }
}
