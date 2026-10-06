import { Component, Signal, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { finalize, timeout, catchError } from 'rxjs/operators';

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
    private cdr: ChangeDetectorRef,
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
    this.cdr.detectChanges();
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
    this.cdr.detectChanges();
  }

  // ─── Guest: tra cứu ──────────────────────────────────────────────────────
  trackGuest(): void {
    const code = this.guestInput.trim();
    const verify = this.guestVerify.trim();

    if (!code || !verify) {
      this.guestError = 'Vui lòng nhập đầy đủ mã đơn/mã vận đơn và email hoặc số điện thoại.';
      this.cdr.detectChanges();
      return;
    }

    this.guestLoading = true;
    this.guestError = '';
    this.guestResult = null;
    this.trackingResult = null;
    this.cdr.detectChanges();

    const payload: any = {
      trackingCode: code,
      orderId: code,
      trackingNumber: code,
      authContact: verify,
      email: verify,
      phone: verify,
    };

    this.apiService.trackOrder(payload).pipe(
      timeout(15000),
      catchError((err: any) => {
        return of({ error: err?.message || 'Có lỗi kết nối đến máy chủ. Vui lòng thử lại sau.' });
      }),
      finalize(() => {
        this.guestLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res: any) => {
        if (res?.error) {
          if (typeof res.error === 'string') {
            this.guestError = res.error;
          } else if (res.error?.error?.message) {
            this.guestError = res.error.error.message;
          } else if (res.error?.message) {
            this.guestError = res.error.message;
          } else {
            this.guestError = 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.';
          }
          this.guestResult = null;
          this.trackingResult = null;
        } else if (res?.orderId) {
          this.guestError = '';
          this.guestResult = res as TrackingResult;
          this.trackingResult = res as TrackingResult;
        } else {
          this.guestError = 'Không tìm thấy đơn hàng hoặc thông tin xác thực không chính xác.';
          this.guestResult = null;
          this.trackingResult = null;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.guestError = 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
        this.guestResult = null;
        this.trackingResult = null;
        this.cdr.detectChanges();
      }
    });
  }

  resetGuest(): void {
    this.guestInput = '';
    this.guestVerify = '';
    this.guestError = '';
    this.guestResult = null;
    this.trackingResult = null;
    this.guestLoading = false;
    this.cdr.detectChanges();
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
        return ['CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERY_FAILED', 'DELIVERED'].includes(currentStatus);
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
        return currentStatus === 'SHIPPING' || currentStatus === 'DELIVERY_FAILED';
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

  isDeliveryFailed(status: string): boolean {
    return status === 'DELIVERY_FAILED';
  }

  // ─── THỨ TỰ QUY TRÌNH NGHIỆP VỤ ──────────────────────────────────────────
  readonly trackingStageOrder: { [key: string]: number } = {
    PICKED_UP: 1,        // Bước 1: Đã lấy hàng
    IN_TRANSIT: 2,       // Bước 2: Đang vận chuyển
    OUT_FOR_DELIVERY: 3,  // Bước 3: Đang giao hàng
    DELIVERED: 4,        // Bước 4: Giao hàng thành công
  };

  readonly orderStatusOrder: { [key: string]: number } = {
    PENDING: 1,          // 1. Chờ xác nhận
    CONFIRMED: 2,        // 2. Đã xác nhận
    PROCESSING: 3,       // 3. Đang chuẩn bị / Đang xử lý
    SHIPPING: 4,         // 4. Đang vận chuyển
    DELIVERY_FAILED: 4,  // 4. Giao hàng không thành công (trong quá trình giao)
    DELIVERED: 5,        // 5. Đã giao hàng
    CANCELLED: 99,
    RETURNED: 99,
  };

  /** Ánh xạ status của log từ đối tác vận chuyển sang thứ tự bước cố định (1..4) */
  getLogStageOrder(status: string): number {
    const s = (status || '').toUpperCase().trim();
    if (
      s.includes('LẤY HÀNG') ||
      s.includes('PICKED') ||
      s.includes('TIẾP NHẬN') ||
      s.includes('ĐÃ NHẬN')
    ) {
      return 1; // Bước 1: Đã lấy hàng
    }
    if (
      s.includes('GIAO THÀNH CÔNG') ||
      s.includes('DELIVERED') ||
      s.includes('ĐÃ GIAO') ||
      s.includes('KÝ NHẬN') ||
      s.includes('HOÀN TẤT')
    ) {
      return 4; // Bước 4: Giao hàng thành công
    }
    if (
      s.includes('ĐANG GIAO') ||
      s.includes('OUT_FOR_DELIVERY') ||
      s.includes('BƯU CỤC PHÁT') ||
      s.includes('PHÁT HÀNG')
    ) {
      return 3; // Bước 3: Đang giao hàng
    }
    if (
      s.includes('VẬN CHUYỂN') ||
      s.includes('TRANSIT') ||
      s.includes('TRUNG CHUYỂN') ||
      s.includes('PHÂN LOẠI') ||
      s.includes('LUÂN CHUYỂN') ||
      s.includes('KHO') ||
      s.includes('SOC')
    ) {
      return 2; // Bước 2: Đang vận chuyển
    }
    return 2;
  }

  /**
   * Tạo danh sách timeline hành trình vận chuyển theo thứ tự quy trình cố định:
   * Bước 1 (Đã lấy hàng) → Bước 2 (Đang vận chuyển) → Bước 3 (Đang giao hàng) → Bước 4 (Giao hàng thành công)
   * Giữ nguyên dữ liệu thời gian, địa điểm, mô tả thực tế từ MongoDB.
   * Các bước chưa diễn ra hiển thị ở trạng thái upcoming.
   */
  getShippingTimeline(): {
    stageKey: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
    stepNumber: number;
    status: string;
    location: string;
    description: string;
    timestamp: Date | string | null;
    state: 'completed' | 'current' | 'upcoming';
  }[] {
    if (!this.trackingResult) return [];
    const res = this.trackingResult;
    const currentStatus = (res.status || '').toUpperCase().trim();
    const rawLogs = Array.isArray(res.shippingLogs) ? res.shippingLogs : [];

    // Xác định bước tiến trình cao nhất hiện tại dựa trên trạng thái thực tế
    let maxStageReached = 1;
    if (currentStatus === 'DELIVERED') {
      maxStageReached = 4;
    } else if (currentStatus === 'SHIPPING' || currentStatus === 'OUT_FOR_DELIVERY') {
      maxStageReached = currentStatus === 'OUT_FOR_DELIVERY' ? 3 : 2;
      for (const log of rawLogs) {
        const stage = this.getLogStageOrder(log.status);
        if (stage > maxStageReached) {
          maxStageReached = stage;
        }
      }
    } else if (currentStatus === 'CONFIRMED' || currentStatus === 'PROCESSING') {
      maxStageReached = 0; // Đang xử lý nội bộ, chưa bàn giao cho carrier
    }

    const fullStages = [
      {
        num: 1,
        key: 'PICKED_UP' as const,
        title: 'Đã lấy hàng',
        desc: 'Đơn vị vận chuyển đã tiếp nhận kiện hàng từ kho Chéri',
        loc: 'Kho Chéri Tân Bình, TP. Hồ Chí Minh'
      },
      {
        num: 2,
        key: 'IN_TRANSIT' as const,
        title: 'Đang vận chuyển',
        desc: 'Kiện hàng đang được luân chuyển giữa các trung tâm phân loại',
        loc: 'Trung tâm khai thác & phân loại'
      },
      {
        num: 3,
        key: 'OUT_FOR_DELIVERY' as const,
        title: 'Đang giao hàng',
        desc: 'Bưu tá đang phát hàng đến địa chỉ người nhận',
        loc: res.shippingAddress?.district
          ? `${res.shippingAddress.district}, ${res.shippingAddress.city || res.shippingAddress.province || ''}`
          : 'Bưu cục phát'
      },
      {
        num: 4,
        key: 'DELIVERED' as const,
        title: 'Giao hàng thành công',
        desc: 'Người nhận kiểm tra và ký nhận kiện hàng nguyên vẹn',
        loc: res.shippingAddress?.fullAddress || res.shippingAddress?.line1 || 'Địa chỉ người nhận'
      }
    ];

    if (rawLogs.length > 0) {
      // Sắp xếp các logs từ MongoDB theo THỨ TỰ BƯỚC NGHIỆP VỤ (1 → 2 → 3 → 4)
      // Trong cùng một bước, sắp xếp theo thời gian tăng dần
      const sorted = [...rawLogs].sort((a, b) => {
        const stageA = this.getLogStageOrder(a.status);
        const stageB = this.getLogStageOrder(b.status);
        if (stageA !== stageB) {
          return stageA - stageB;
        }
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      const timeline: any[] = [];
      const visitedStages = new Set<number>();

      sorted.forEach((log) => {
        const stage = this.getLogStageOrder(log.status);
        visitedStages.add(stage);

        let state: 'completed' | 'current' | 'upcoming' = 'completed';
        if (currentStatus === 'DELIVERED') {
          state = 'completed';
        } else if (stage === maxStageReached) {
          state = 'current';
        } else if (stage > maxStageReached) {
          state = 'upcoming';
        } else {
          state = 'completed';
        }

        const stageKeys: { [k: number]: 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' } = {
          1: 'PICKED_UP',
          2: 'IN_TRANSIT',
          3: 'OUT_FOR_DELIVERY',
          4: 'DELIVERED',
        };

        timeline.push({
          stageKey: stageKeys[stage] || 'IN_TRANSIT',
          stepNumber: stage,
          status: log.status,
          location: log.location || '',
          description: log.description || '',
          timestamp: log.timestamp || null,
          state,
        });
      });

      // Bổ sung các bước nghiệp vụ tiếp theo chưa diễn ra (upcoming / pending)
      for (const fs of fullStages) {
        if (!visitedStages.has(fs.num) && fs.num > maxStageReached) {
          timeline.push({
            stageKey: fs.key,
            stepNumber: fs.num,
            status: fs.title,
            location: fs.loc,
            description: fs.desc,
            timestamp: fs.num === 4 ? (res.estimatedDelivery || null) : null,
            state: 'upcoming',
          });
        }
      }

      // Đảm bảo timeline luôn đi theo thứ tự 1 → 2 → 3 → 4
      timeline.sort((a, b) => {
        if (a.stepNumber !== b.stepNumber) {
          return a.stepNumber - b.stepNumber;
        }
        return (new Date(a.timestamp || 0).getTime()) - (new Date(b.timestamp || 0).getTime());
      });

      return timeline;
    }

    // Nếu chưa có logs chi tiết từ webhook carrier nhưng đơn hàng đã có vận đơn:
    return fullStages.map((fs) => {
      let state: 'completed' | 'current' | 'upcoming' = 'upcoming';
      if (currentStatus === 'DELIVERED') {
        state = 'completed';
      } else if (maxStageReached > 0) {
        if (fs.num < maxStageReached) state = 'completed';
        else if (fs.num === maxStageReached) state = 'current';
        else state = 'upcoming';
      }

      let timestamp: Date | string | null = null;
      if (fs.num === 1 && maxStageReached >= 1) {
        timestamp = res.shippedAt || res.dateAdded || null;
      } else if (fs.num === 4) {
        timestamp = currentStatus === 'DELIVERED' ? (res.deliveredAt || res.dateAdded || null) : (res.estimatedDelivery || null);
      }

      return {
        stageKey: fs.key,
        stepNumber: fs.num,
        status: fs.title,
        location: fs.loc,
        description: fs.desc,
        timestamp,
        state,
      };
    });
  }

  /**
   * Sắp xếp danh sách logs vận chuyển theo thứ tự nghiệp vụ (1 → 2 → 3 → 4)
   * thay vì hiển thị mới nhất đến cũ nhất.
   */
  sortedLogs(logs: ShippingLog[]): ShippingLog[] {
    if (!logs || !logs.length) return [];
    return [...logs].sort((a, b) => {
      const stageA = this.getLogStageOrder(a.status);
      const stageB = this.getLogStageOrder(b.status);
      if (stageA !== stageB) {
        return stageA - stageB;
      }
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }

  /**
   * Sắp xếp Lịch sử xử lý đơn hàng theo tiến trình tuần tự:
   * Chờ xác nhận (1) → Đã xác nhận (2) → Đang chuẩn bị (3) → Đang vận chuyển (4) → Đã giao hàng (5)
   */
  sortedHistory(history: { status: string; updatedAt: Date; note: string }[]): any[] {
    if (!history || !history.length) return [];
    return [...history].sort((a, b) => {
      const orderA = this.orderStatusOrder[a.status] ?? 50;
      const orderB = this.orderStatusOrder[b.status] ?? 50;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });
  }

  /** Tạo URL tra cứu động trên website chính thức của đơn vị vận chuyển theo dữ liệu thật */
  getCarrierTrackingUrl(): string | null {
    if (!this.trackingResult) return null;
    const res = this.trackingResult;

    // 1. Nếu đơn hàng đã lưu sẵn URL tra cứu trực tiếp trong MongoDB
    if (res.trackingUrl && typeof res.trackingUrl === 'string' && res.trackingUrl.trim().startsWith('http')) {
      return res.trackingUrl.trim();
    }

    // 2. Tạo URL động từ mã vận đơn và hãng vận chuyển thực tế
    const trackingCode = (res.trackingNumber || '').trim();
    if (!trackingCode) return null;

    const carrier = (res.carrierName || '').toLowerCase();
    if (carrier.includes('viettel')) {
      return `https://viettelpost.com.vn/tra-cuu-hanh-trinh-don-hang?id=${encodeURIComponent(trackingCode)}`;
    }
    if (carrier.includes('ghtk') || carrier.includes('tiết kiệm')) {
      return `https://i.ghtk.vn/${encodeURIComponent(trackingCode)}`;
    }
    if (carrier.includes('ghn') || carrier.includes('giao hàng nhanh')) {
      return `https://donhang.ghn.vn/?order_code=${encodeURIComponent(trackingCode)}`;
    }
    if (carrier.includes('spx') || carrier.includes('shopee')) {
      return `https://spx.vn/track?bill=${encodeURIComponent(trackingCode)}`;
    }
    if (carrier.includes('vnpost') || carrier.includes('bưu điện')) {
      return `http://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=${encodeURIComponent(trackingCode)}`;
    }
    if (carrier.includes('j&t') || carrier.includes('jt')) {
      return `https://jtexpress.vn/vi/tracking?billcode=${encodeURIComponent(trackingCode)}`;
    }

    return null;
  }

  getCarrierName(): string {
    return this.trackingResult?.carrierName || 'hãng vận chuyển';
  }

  statusLabel(status: string): string {
    const map: { [k: string]: string } = {
      PENDING: 'Chờ xác nhận',
      CONFIRMED: 'Đã xác nhận',
      PROCESSING: 'Đang chuẩn bị',
      SHIPPING: 'Đang vận chuyển',
      DELIVERY_FAILED: 'Giao hàng không thành công',
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
