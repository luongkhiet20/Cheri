import { Component, OnInit, Inject, PLATFORM_ID, Signal, effect, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateService } from '../../../services/translate.service';
import { ApiService } from '../../../services/api.service';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { User, Order } from '../../shared/models';
import { accessTokenKey } from '../../shared/constants';
import { NotificationService } from '../../shared/notification/notification.service';
import { formatVND, PriceFormatPipe } from '../../../pipes/price.pipe';
import { OrderCancelDialogComponent } from './order-cancel-dialog/order-cancel-dialog.component';
import { ProductReviewDialogComponent } from './product-review-dialog.component/product-review-dialog.component';
import { OrderReturnRefundDialogComponent } from './order-return-refund-dialog.component/order-return-refund-dialog.component';
import { OrderReturnCancelDialogComponent } from './order-return-cancel-dialog/order-return-cancel-dialog.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PriceFormatPipe,
    OrderCancelDialogComponent,
    ProductReviewDialogComponent,
    OrderReturnRefundDialogComponent,
    OrderReturnCancelDialogComponent
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  user$: Signal<User>;
  userOrders$: Signal<Order[]>;
  lang$: Observable<string>;

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

  // Cancel order dialog state
  isCancelDialogOpen: boolean = false;
  selectedOrderToCancel: any = null;

  // Review dialog state
  isReviewDialogOpen: boolean = false;
  selectedOrderToReview: any = null;

  // Return / refund dialog state
  isReturnRefundDialogOpen: boolean = false;
  selectedOrderToReturn: any = null;

  // Cancel return request dialog state
  isReturnCancelDialogOpen: boolean = false;
  selectedOrderToCancelReturn: any = null;
  selectedReturnRequestToCancel: any = null;

  // Form fields
  formName: string = '';
  formEmail: string = '';
  formPhone: string = '';
  formGender: string = '';
  formDateOfBirth: string = '';
  formAddress: string = '';
  formNewPassword: string = '';
  formConfirmPassword: string = '';

  // Giới hạn ngày sinh hợp lệ (không nhỏ hơn 01/01/1900 và không trong tương lai)
  readonly minBirthDate: string = '1900-01-01';
  get maxBirthDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Save state
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  saveError: string = '';

  // Avatar upload state
  isUploadingAvatar: boolean = false;
  avatarUploadError: string = '';
  avatarImgError: boolean = false;
  previewAvatar: string | null = null;
  @ViewChild('avatarFileInput') avatarFileInput!: ElementRef<HTMLInputElement>;

  // Sync time
  lastSyncTime: string = '';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private translate: TranslateService,
    private apiService: ApiService,
    private notify: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.lang$ = this.translate.getLang$();
    this.user$ = this.selectors.user;
    this.userOrders$ = this.selectors.userOrders;

    // Tự động đồng bộ dữ liệu vào Form khi user signal thay đổi từ MongoDB
    effect(() => {
      const user = this.selectors.user();
      if (user) {
        this.populateForm(user);
        this.cdr.markForCheck();
      }
    });
  }

  formatDateForInput(dob: any): string {
    if (!dob) return '';
    if (typeof dob === 'string') {
      const trimmed = dob.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return trimmed;
    }
    if (dob instanceof Date && !isNaN(dob.getTime())) {
      const yyyy = dob.getFullYear();
      const mm = String(dob.getMonth() + 1).padStart(2, '0');
      const dd = String(dob.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  }

  populateForm(user: any): void {
    if (!user) return;
    this.formName = (user.fullName || user.name || (user.email ? user.email.split('@')[0] : '')).trim();
    this.formEmail = user.email || '';
    this.formPhone = user.phoneNumber || user.phone || '';
    this.formGender = user.gender || '';
    this.formDateOfBirth = this.formatDateForInput(user.dateOfBirth);
    this.formAddress = user.address || (user.shippingAddress?.address ? this.getOrderAddress({ shippingAddress: user.shippingAddress } as any) : '');
    this.avatarImgError = false;
  }

  ngOnInit(): void {
    this.formNewPassword = '';
    this.formConfirmPassword = '';

    // Nạp ngay dữ liệu người dùng nếu store đã có sẵn
    const existingUser = this.selectors.user();
    if (existingUser) {
      this.populateForm(existingUser);
    }

    if (isPlatformBrowser(this.platformId)) {
      // Tải dữ liệu người dùng mới nhất từ MongoDB qua API và bind trực tiếp vào form
      this.apiService.getUser().subscribe({
        next: (res: any) => {
          if (res && !res.error) {
            const userData = res.data || res;
            this.store.storeUser(userData);
            this.populateForm(userData);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Lỗi khi tải thông tin user:', err);
        }
      });

      // Tải đơn hàng người dùng
      this.store.getUserOrders();
      this.updateSyncTime();
    }
  }

  updateSyncTime(): void {
    if (isPlatformBrowser(this.platformId)) {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const lang = (this.translate as any)?.lang || 'VN';
      this.lastSyncTime = `${h}:${m} ${lang.toUpperCase()}`;
    }
  }

  openAvatarPicker(): void {
    if (this.isUploadingAvatar) return;
    this.avatarUploadError = '';
    if (this.avatarFileInput?.nativeElement) {
      this.avatarFileInput.nativeElement.value = '';
      this.avatarFileInput.nativeElement.click();
    }
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.avatarUploadError = 'Định dạng ảnh không hợp lệ. Vui lòng chọn jpg, jpeg, png hoặc webp.';
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      this.avatarUploadError = 'Ảnh đại diện không được vượt quá 5MB.';
      return;
    }

    this.avatarUploadError = '';

    // Preview trực tiếp trên giao diện
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.previewAvatar = e.target.result;
    };
    reader.readAsDataURL(file);

    // Upload lên backend
    this.isUploadingAvatar = true;
    this.apiService.uploadAvatar(file).subscribe({
      next: (res: any) => {
        this.isUploadingAvatar = false;
        if (res?.error) {
          this.previewAvatar = null;
          this.avatarUploadError =
            typeof res.error === 'string'
              ? res.error
              : (res.error?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.');
          return;
        }

        const updatedUser = res.data || res;
        const currentUser = this.user$() || ({} as User);
        const newAvatarUrl = updatedUser.avatar || updatedUser.avatarUrl || this.previewAvatar;

        // Cập nhật Angular state/signal ngay lập tức
        this.store.storeUser({
          ...currentUser,
          ...updatedUser,
          avatar: newAvatarUrl,
        });

        // Reset preview vì state đã có ảnh chính thức từ MongoDB
        this.previewAvatar = null;
        this.updateSyncTime();
        this.notify.success('✨Đã cập nhật ảnh đại diện thành công✨');
      },
      error: (err: any) => {
        this.isUploadingAvatar = false;
        this.previewAvatar = null;
        this.avatarUploadError = err?.error?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.';
        this.notify.error(`✨${this.avatarUploadError}✨`);
      }
    });
  }

  getAvatarUrl(): string | null {
    if (this.avatarImgError) {
      return null;
    }
    if (this.previewAvatar) {
      return this.previewAvatar;
    }
    const u: any = this.user$();
    const avatar = u?.avatar || u?.avatarUrl || (u?.images?.[0]?.url || u?.images?.[0]);
    if (!avatar || typeof avatar !== 'string' || avatar.trim() === '') return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
      return avatar;
    }
    if (avatar.startsWith('/')) {
      return `${this.apiService.apiUrl}${avatar}`;
    }
    return `${this.apiService.apiUrl}/${avatar}`;
  }

  onAvatarImgError(): void {
    this.avatarImgError = true;
    this.cdr.markForCheck();
  }

  getUserInitial(): string {
    const user = this.user$();
    if (!user) return 'C';
    const name = (user.fullName || user.name || user.email || 'C').trim();
    return name.charAt(0).toUpperCase();
  }

  getDisplayName(): string {
    const user = this.user$();
    if (!user) return 'Quý khách';
    return (user.fullName || user.name || (user.email ? user.email.split('@')[0] : 'Quý khách')).trim();
  }

  getRoleLabel(): string {
    const user = this.user$();
    if (!user) return 'Thành viên';
    const rawRoles = user.roles || (user.role ? [user.role] : []);
    const roles = Array.isArray(rawRoles) ? rawRoles.flat() : [rawRoles];
    if (roles.some((r: any) => typeof r === 'string' && (r.toLowerCase().includes('admin')))) return 'Quản trị viên';
    return 'Thành viên';
  }

  getMemberCode(): string {
    const user = this.user$();
    if (!user) return '';
    const id = (user._id || user.id || '').toString();
    if (!id) return '';
    return `CHR-${id.slice(-5).toUpperCase()}`;
  }

  // ── Status Normalization ──
  normalizeStatus(status: string | undefined): string {
    const s = (status || '').toUpperCase().trim();
    if (s === 'PENDING') return 'PENDING';
    if (s === 'CONFIRMED') return 'CONFIRMED';
    if (s === 'PROCESSING') return 'PROCESSING';
    if (s === 'SHIPPING' || s === 'SHIPPED') return 'SHIPPING';
    if (s === 'DELIVERY_FAILED') return 'DELIVERY_FAILED';
    if (s === 'DELIVERED' || s === 'COMPLETED') return 'DELIVERED';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
    if (s === 'RETURNED' || s === 'REFUNDED') return 'RETURNED';
    return s;
  }

  // ── Tab logic ──
  setTab(tab: string): void {
    this.activeTab = tab;
  }

  private getRawOrders(): Order[] {
    const raw: any = this.userOrders$();
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.orders)) return raw.orders;
    return [];
  }

  // ── Phân loại đơn hàng vào mục tương ứng (xử lý cả 6 giai đoạn đổi trả & hủy yêu cầu) ──
  getOrderEffectiveTab(order: any): string {
    if (!order) return 'PENDING';
    const rawStatus = this.normalizeStatus(order.status);

    const retReq = this.getLatestReturnRequest(order);
    if (retReq) {
      const s = (retReq.status || '').toUpperCase();
      // Chỉ khi người dùng chủ động hủy yêu cầu (CANC / CANCELLED) hoặc bị từ chối (REJECTED) -> quay về mục Đã giao
      if (s === 'CANC' || s === 'CANCELLED' || s === 'CANCELLED_BY_CUSTOMER' || s === 'REJECTED' || s === 'REJ') {
        return rawStatus === 'RETURNED' ? 'DELIVERED' : rawStatus;
      }

      // Xuyên suốt cả 6 giai đoạn của quy trình đổi trả/hoàn tiền:
      // 1. Gửi yêu cầu (PENDING)
      // 2. Đã duyệt (APPROVED / WAITING_FOR_RETURN_SHIPMENT)
      // 3. Gửi/Nhận hàng (RETURN_SHIPPED / RETURN_RECEIVED)
      // 4. Kiểm hàng (INSPECTED)
      // 5. Xử lý hoàn tiền
      // 6. Hoàn tất (COMPLETED)
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

  // ── Formatting & Display helpers (100% dữ liệu thực từ MongoDB) ──
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
    return order.shippingAddress?.phone || order.customerPhone || this.user$()?.phoneNumber || '—';
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
    return this.user$()?.address || '—';
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
      return this.getStatusClass(orderOrStatus.status);
    }

    switch (this.normalizeStatus(orderOrStatus)) {
      case 'PENDING': return 'status-pending';
      case 'CONFIRMED': return 'status-confirmed';
      case 'PROCESSING': return 'status-processing';
      case 'SHIPPING': return 'status-shipping';
      case 'DELIVERY_FAILED': return 'status-cancelled';
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
      return this.getStatusLabel(orderOrStatus.status);
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
    const targetId = order._id || order.orderId;
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('cheri_last_order', JSON.stringify(order));
      } catch (_) { }
    }
    try {
      this.selectors.productState.update((state: any) => ({ ...state, order }));
    } catch (_) { }
    const currentLang = (this.translate as any)?.lang || 'vi';
    this.router.navigate(['/' + currentLang + '/order', targetId], {
      queryParams: { orderId: order.orderId }
    });
  }

  // ── Xử lý Hủy đơn hàng (Chỉ khả dụng khi trạng thái thực tế là Chờ xác nhận) ──
  canCancelOrder(order: Order | any): boolean {
    if (!order) return false;
    return this.normalizeStatus(order.status) === 'PENDING';
  }

  openCancelDialog(order: Order | any): void {
    if (!this.canCancelOrder(order)) return;
    this.selectedOrderToCancel = order;
    this.isCancelDialogOpen = true;
    this.cdr.markForCheck();
  }

  closeCancelDialog(): void {
    this.isCancelDialogOpen = false;
    this.selectedOrderToCancel = null;
    this.cdr.markForCheck();
  }

  onOrderCancelled(event: any): void {
    const targetId = event?.orderId || this.selectedOrderToCancel?.orderId || this.selectedOrderToCancel?._id;
    this.closeCancelDialog();

    // 1. Cập nhật ngay trong local store để UI phản hồi tức thì
    if (targetId) {
      try {
        this.selectors.productState.update((state: any) => {
          if (!state?.userOrders) return state;
          const updated = state.userOrders.map((o: any) => {
            if (o._id === targetId || o.orderId === targetId) {
              return { ...o, status: 'CANCELLED' };
            }
            return o;
          });
          return { ...state, userOrders: updated };
        });
      } catch (_) { }
    }

    // 2. Đồng bộ bộ đếm trạng thái và danh sách đơn hàng chính thức từ máy chủ
    if (isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
      this.updateSyncTime();
    }
    this.notify.success('✨Đã hủy đơn hàng thành công✨');
    this.cdr.markForCheck();
  }

  // ── Xử lý Đánh giá sản phẩm ──
  openReviewDialog(order: Order | any): void {
    if (!order) return;
    this.selectedOrderToReview = order;
    this.isReviewDialogOpen = true;
    this.cdr.markForCheck();
  }

  closeReviewDialog(): void {
    this.isReviewDialogOpen = false;
    this.selectedOrderToReview = null;
    this.cdr.markForCheck();
  }

  onOrderReviewed(event: any): void {
    const orderId = event?.orderId || this.selectedOrderToReview?.orderId || this.selectedOrderToReview?._id;
    this.closeReviewDialog();

    // 1. Cập nhật ngay trong local store để đổi nút sang "Đã đánh giá" tức thì
    if (orderId) {
      try {
        this.selectors.productState.update((state: any) => {
          if (!state?.userOrders) return state;
          const updated = state.userOrders.map((o: any) => {
            if (o._id === orderId || o.orderId === orderId || (o.raw && (o.raw._id === orderId || o.raw.orderId === orderId))) {
              return {
                ...o,
                isReviewed: true,
                reviewedAt: new Date(),
              };
            }
            return o;
          });
          return { ...state, userOrders: updated };
        });
      } catch (_) { }
    }

    if (isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
      this.updateSyncTime();
    }
    this.notify.success('✨Đã gửi đánh giá sản phẩm thành công✨');
    this.cdr.markForCheck();
  }

  // ── Xử lý Trả hàng / Hoàn tiền ──
  openReturnRefundDialog(order: Order | any): void {
    if (!order) return;
    this.selectedOrderToReturn = order;
    this.isReturnRefundDialogOpen = true;
    this.cdr.markForCheck();
  }

  closeReturnRefundDialog(): void {
    this.isReturnRefundDialogOpen = false;
    this.selectedOrderToReturn = null;
    this.cdr.markForCheck();
  }

  onReturnRefundSubmitted(event: any): void {
    const orderId = event?.orderId;
    const returnRequest = event?.returnRequest;
    this.closeReturnRefundDialog();

    // 1. Cập nhật ngay trong local store để UI phản hồi tức thì
    if (orderId && returnRequest) {
      try {
        this.selectors.productState.update((state: any) => {
          if (!state?.userOrders) return state;
          const updated = state.userOrders.map((o: any) => {
            if (o._id === orderId || o.orderId === orderId) {
              const clonedOrder = { ...o };
              const currentReqs = Array.isArray(clonedOrder.returnRequests) ? [...clonedOrder.returnRequests] : [];
              currentReqs.push(returnRequest);
              clonedOrder.returnRequests = currentReqs;
              clonedOrder.returnRequest = returnRequest;
              return clonedOrder;
            }
            return o;
          });
          return { ...state, userOrders: updated };
        });
      } catch (_) { }
    }

    // 2. Đồng bộ danh sách đơn hàng chính thức từ máy chủ
    if (isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
      this.updateSyncTime();
    }
    this.notify.success('✨Đã gửi yêu cầu trả hàng / hoàn tiền✨');
    this.cdr.markForCheck();
  }

  getLatestReturnRequest(order: any): any {
    if (!order) return null;
    return this.getActiveReturnRequest(order);
  }

  // ── Các hàm nghiệp vụ kiểm tra điều kiện thao tác Trả hàng & Đánh giá ──
  getActiveReturnRequest(order: any): any {
    if (!order) return null;
    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);
    if (!requests.length) return null;

    // Ưu tiên yêu cầu đang trong tiến trình xử lý (active) hoặc đã hoàn tất (cả 6 giai đoạn)
    const activeStatuses = ['PENDING', 'APPROVED', 'WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED', 'COMPLETED'];
    const activeReq = requests.find((r: any) => activeStatuses.includes((r.status || '').toUpperCase()));
    if (activeReq) return activeReq;

    // Nếu không có yêu cầu đang xử lý, lấy yêu cầu cuối cùng (REJECTED hoặc CANCELLED/CANC)
    return requests[requests.length - 1];
  }

  isReturnCompleted(target: any): boolean {
    if (!target) return false;
    // Nếu target là một returnRequest
    if (target.requestId || (!target.orderId && !target.items && target.status)) {
      const reqSt = (target.status || '').toUpperCase();
      const refSt = (target.refund?.status || '').toUpperCase();
      return reqSt === 'COMPLETED' || (reqSt === 'INSPECTED' && (refSt === 'COMPLETED' || refSt === 'NOT_REQUIRED'));
    }
    // Nếu target là một order
    const st = this.normalizeStatus(target.status);
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

  isOrderReviewed(order: any): boolean {
    if (!order) return false;
    return !!(order.isReviewed || (order.raw && order.raw.isReviewed));
  }

  canReviewOrder(order: any): boolean {
    if (!order) return false;
    // 1. Đơn hàng đã được đánh giá thành công -> Ẩn Đánh giá (đổi sang nút Đã đánh giá)
    if (this.isOrderReviewed(order)) return false;

    // Chỉ cho phép đánh giá khi đơn hàng đã giao thành công (DELIVERED)
    if (this.normalizeStatus(order.status) !== 'DELIVERED') return false;

    // Đã hoàn tất hoàn trả -> không cho đánh giá
    if (this.isReturnCompleted(order)) return false;

    // Kiểm tra danh sách yêu cầu đổi trả: chỉ cho phép khi chưa có yêu cầu nào đang tồn tại, hoặc yêu cầu trước đó đã bị hủy (CANCELLED)
    const requests: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (order.returnRequest ? [order.returnRequest] : []);

    const hasActiveOrExistingReturn = requests.some((r: any) => {
      const s = (r.status || '').toUpperCase();
      return s && s !== 'CANCELLED' && s !== 'CANC';
    });

    if (hasActiveOrExistingReturn) return false;

    return true;
  }

  canRequestReturn(order: any): boolean {
    if (!order) return false;
    // 1. Đơn hàng đã được đánh giá thành công -> Ẩn Trả hàng / Hoàn tiền
    if (this.isOrderReviewed(order)) return false;

    // Chỉ cho phép khi đơn hàng đã giao thành công (DELIVERED)
    if (this.normalizeStatus(order.status) !== 'DELIVERED') return false;

    // Đã hoàn tất quy trình đổi trả/hoàn tiền -> Ẩn Trả hàng / Hoàn tiền
    if (this.isReturnCompleted(order)) return false;

    // Kiểm tra các yêu cầu đổi trả: không cho phép tạo yêu cầu mới nếu đang có yêu cầu tồn tại chưa bị hủy
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

  canCancelReturnRequest(order: any): boolean {
    if (!order) return false;
    const req = this.getActiveReturnRequest(order);
    if (!req) return false;
    // 2. Chỉ hiển thị Hủy yêu cầu khi yêu cầu đang ở PENDING (Chờ duyệt)
    return (req.status || '').toUpperCase() === 'PENDING';
  }

  openReturnCancelDialog(order: Order | any): void {
    if (!order) return;
    const req = this.getActiveReturnRequest(order);
    if (!req || (req.status || '').toUpperCase() !== 'PENDING') return;
    this.selectedOrderToCancelReturn = order;
    this.selectedReturnRequestToCancel = req;
    this.isReturnCancelDialogOpen = true;
    this.cdr.markForCheck();
  }

  closeReturnCancelDialog(): void {
    this.isReturnCancelDialogOpen = false;
    this.selectedOrderToCancelReturn = null;
    this.selectedReturnRequestToCancel = null;
    this.cdr.markForCheck();
  }

  onReturnRequestCancelled(event: any): void {
    const orderId = event?.orderId;
    const reqId = event?.requestId;
    const cancelReason = event?.reason || 'Bạn đã yêu cầu hủy quy trình trả hàng hoàn tiền.';
    this.closeReturnCancelDialog();

    // 1. Cập nhật ngay trong local store để UI phản hồi tức thì
    if (orderId && reqId) {
      try {
        this.selectors.productState.update((state: any) => {
          if (!state?.userOrders) return state;
          const updated = state.userOrders.map((o: any) => {
            if (o._id === orderId || o.orderId === orderId) {
              const clonedOrder = { ...o };
              clonedOrder.status = 'DELIVERED';
              if (Array.isArray(clonedOrder.returnRequests)) {
                clonedOrder.returnRequests = clonedOrder.returnRequests.map((r: any) => {
                  if (r.requestId === reqId || r._id === reqId) {
                    return {
                      ...r,
                      status: 'CANC',
                      rejectionReason: cancelReason,
                      refund: { ...(r.refund || {}), status: 'CANCELLED' }
                    };
                  }
                  return r;
                });
              }
              if (clonedOrder.returnRequest && (clonedOrder.returnRequest.requestId === reqId || clonedOrder.returnRequest._id === reqId)) {
                clonedOrder.returnRequest = {
                  ...clonedOrder.returnRequest,
                  status: 'CANC',
                  rejectionReason: cancelReason,
                  refund: { ...(clonedOrder.returnRequest.refund || {}), status: 'CANCELLED' }
                };
              }
              return clonedOrder;
            }
            return o;
          });
          return { ...state, userOrders: updated };
        });
      } catch (_) { }
    }

    // 2. Đồng bộ danh sách đơn hàng chính thức từ máy chủ
    if (isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
      this.updateSyncTime();
    }
    this.notify.success('✨Đã hủy yêu cầu trả hàng / hoàn tiền thành công✨');
    this.cdr.markForCheck();
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

  // ── Trạng thái mở/đóng phần tiến trình Trả hàng & hoàn tiền (mặc định đóng, không lưu storage) ──
  expandedReturnTracking: { [key: string]: boolean } = {};

  isReturnTrackingExpanded(key: string): boolean {
    if (!key) return false;
    return !!this.expandedReturnTracking[key];
  }

  toggleReturnTracking(key: string): void {
    if (!key) return;
    this.expandedReturnTracking[key] = !this.expandedReturnTracking[key];
    this.cdr.markForCheck();
  }

  // ── Quản lý giai đoạn trả hàng / hoàn tiền đang được chọn xem chi tiết ──
  selectedReturnStep: { [key: string]: number } = {};

  getSelectedReturnStep(req: any, orderId: string): number {
    const key = req?.requestId || orderId;
    if (this.selectedReturnStep[key] !== undefined) {
      return this.selectedReturnStep[key];
    }
    // Mặc định chọn giai đoạn đang xử lý hiện tại
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

  // ── Save profile (Gửi API cập nhật MongoDB & đồng bộ state tức thì) ──
  onSave(): void {
    this.saveSuccess = false;
    this.saveError = '';

    // Validate mật khẩu nếu người dùng muốn đổi
    if (this.formNewPassword || this.formConfirmPassword) {
      if (!this.formNewPassword || !this.formConfirmPassword) {
        this.saveError = 'Vui lòng nhập cả mật khẩu mới và xác nhận mật khẩu.';
        return;
      }
      if (this.formNewPassword !== this.formConfirmPassword) {
        this.saveError = 'Mật khẩu mới không khớp. Vui lòng kiểm tra lại.';
        return;
      }
      if (this.formNewPassword.length < 6) {
        this.saveError = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
        return;
      }
    }

    // Validate ngày sinh (không cho phép ngày trong tương lai và không nhỏ hơn 01/01/1900)
    if (this.formDateOfBirth) {
      if (this.formDateOfBirth > this.maxBirthDate) {
        this.saveError = 'Ngày sinh không hợp lệ: Không được chọn ngày trong tương lai.';
        return;
      }
      if (this.formDateOfBirth < this.minBirthDate) {
        this.saveError = 'Ngày sinh không hợp lệ: Ngày sinh không được nhỏ hơn 01/01/1900.';
        return;
      }
    }

    const user = this.user$();
    if (!user) {
      this.saveError = 'Không tìm thấy phiên đăng nhập, vui lòng đăng nhập lại.';
      return;
    }

    const payload: any = {
      fullName: this.formName?.trim() || undefined,
      name: this.formName?.trim() || undefined,
      phoneNumber: this.formPhone?.trim() ?? '',
      phone: this.formPhone?.trim() ?? '',
      gender: this.formGender ?? '',
      dateOfBirth: this.formDateOfBirth ?? '',
      address: this.formAddress?.trim() ?? '',
    };

    if (this.formNewPassword) {
      payload.password = this.formNewPassword;
    }

    this.isSaving = true;
    this.apiService.updateProfile(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res?.error) {
          this.saveError = res.error?.message || (typeof res.error === 'string' ? res.error : 'Có lỗi xảy ra khi lưu thông tin.');
          this.cdr.markForCheck();
          return;
        }

        // Cập nhật store với dữ liệu người dùng thật vừa được lưu vào MongoDB
        const updatedUser = res.data || res;
        const currentUser = this.user$() || ({} as User);
        const mergedUser = { ...currentUser, ...updatedUser };
        this.store.storeUser(mergedUser);
        this.populateForm(mergedUser);

        this.formNewPassword = '';
        this.formConfirmPassword = '';
        this.saveSuccess = true;
        this.updateSyncTime();
        this.notify.success('✨Đã cập nhật thông tin tài khoản✨');
        this.cdr.markForCheck();
        setTimeout(() => {
          this.saveSuccess = false;
          this.cdr.markForCheck();
        }, 4000);
      },
      error: (err: any) => {
        this.isSaving = false;
        this.saveError = err?.error?.message || 'Có lỗi kết nối máy chủ. Vui lòng thử lại.';
        this.notify.error(`✨${this.saveError}✨`);
        this.cdr.markForCheck();
      }
    });
  }

  // ── Logout ──
  onLogout(): void {
    const currentLang = (this.translate as any)?.lang || 'vi';
    const targetUrl = `/${currentLang}`;

    let hadToken = false;
    let localCleanFailed = false;

    if (isPlatformBrowser(this.platformId)) {
      hadToken = Boolean(localStorage.getItem(accessTokenKey) || sessionStorage.getItem(accessTokenKey));
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.removeItem(accessTokenKey);
      } catch (e) {
        localCleanFailed = true;
      }
    }

    if (!hadToken) {
      this.notify.info('Phiên đăng nhập đã hết hạn.');
      this.store.signOut(() => {
        this.router.navigateByUrl(targetUrl);
      });
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify.error('Không thể kết nối đến máy chủ để hoàn tất đăng xuất.');
      return;
    }

    this.store.signOut((res) => {
      if (res?.networkError) {
        this.notify.error('Không thể kết nối đến máy chủ để hoàn tất đăng xuất.');
      } else if (res?.serverError) {
        this.notify.error('Chưa thể hoàn tất đăng xuất. Vui lòng thử lại.');
      } else if (localCleanFailed) {
        this.notify.warning('Đã đăng xuất khỏi tài khoản, nhưng không thể xóa toàn bộ dữ liệu phiên trên thiết bị. Vui lòng tải lại trang.');
      } else {
        this.notify.success('Hẹn gặp lại tại Chéri!');
      }

      this.router.navigateByUrl(targetUrl);
    });
  }
}
