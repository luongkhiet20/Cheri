import { Component, OnInit, Inject, PLATFORM_ID, Signal, ViewChild, ElementRef, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { TranslateService } from '../../../services/translate.service';
import { ApiService } from '../../../services/api.service';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { User, Order } from '../../shared/models';
import { accessTokenKey } from '../../shared/constants';
import { NotificationService } from '../../shared/notification/notification.service';
import { ProfileOrdersComponent } from './profile-orders/profile-orders.component';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { OrderCancelDialogComponent } from './order-cancel-dialog/order-cancel-dialog.component';
import { ProductReviewDialogComponent } from './product-review-dialog.component/product-review-dialog.component';
import { OrderReturnRefundDialogComponent } from './order-return-refund-dialog.component/order-return-refund-dialog.component';
import { OrderReturnCancelDialogComponent } from './order-return-cancel-dialog/order-return-cancel-dialog.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ProfileOrdersComponent,
    ProfileInfoComponent,
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

    effect(() => {
      const u = this.selectors.user();
      if (u && isPlatformBrowser(this.platformId)) {
        this.updateSyncTime();
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Tải dữ liệu người dùng mới nhất từ MongoDB qua API
      this.apiService.getUser().subscribe({
        next: (res: any) => {
          if (res && !res.error) {
            const userData = res.data || res;
            this.store.storeUser(userData);
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
      this.cdr.markForCheck();
    }
  }

  onProfileUpdated(_updatedUser: User): void {
    this.updateSyncTime();
    this.cdr.markForCheck();
  }

  // ── Avatar Upload & Hero Info ──
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

  // ── Xử lý Hủy đơn hàng ──
  openCancelDialog(order: Order | any): void {
    if (!order) return;
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

  // ── Xử lý Hủy yêu cầu trả hàng ──
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

  // ── Logout ──
  onLogout(): void {
    const currentLang = (this.translate as any)?.lang || 'vi';
    const targetUrl = `/${currentLang}`;

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    this.store.signOut((res) => {
      if (isOffline || res?.networkError) {
        this.notify.warning('Đã đăng xuất trên thiết bị này (thiết bị đang ở chế độ ngoại tuyến).');
      } else if (res?.serverError) {
        this.notify.warning('Đã đăng xuất trên thiết bị này.');
      } else {
        this.notify.success('Hẹn gặp lại tại Chéri!');
      }

      this.router.navigateByUrl(targetUrl);
    });
  }
}
