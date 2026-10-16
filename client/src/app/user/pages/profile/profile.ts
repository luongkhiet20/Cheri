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
    OrderReturnRefundDialogComponent
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
    { key: 'RETURNED', label: 'Đã hoàn trả' },
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

  getTabCount(tab: string): number {
    const orders = this.getRawOrders();
    if (!orders || !orders.length) return 0;
    if (tab === 'all') return orders.length;
    return orders.filter(o => this.normalizeStatus(o.status) === tab).length;
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
    return sorted.filter(o => this.normalizeStatus(o.status) === this.activeTab);
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

  getStatusClass(status: string | undefined): string {
    switch (this.normalizeStatus(status)) {
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

  getStatusLabel(status: string | undefined): string {
    switch (this.normalizeStatus(status)) {
      case 'PENDING': return 'Chờ xác nhận';

      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPING': return 'Đang giao hàng';

      case 'DELIVERED': return 'Đã giao hàng thành công';
      case 'CANCELLED': return 'Đã hủy';
      case 'RETURNED': return 'Đã hoàn trả';
      default: return status ? status : 'Chờ xác nhận';
    }
  }

  // ── Xem chi tiết đơn hàng (Dẫn tới trang Bill chi tiết) ──
  onViewOrderDetail(order: Order): void {
    if (!order) return;
    const targetId = order._id || order.orderId;
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('cheri_last_order', JSON.stringify(order));
      } catch (_) {}
    }
    try {
      this.selectors.productState.update((state: any) => ({ ...state, order }));
    } catch (_) {}
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
      } catch (_) {}
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
    this.closeReviewDialog();
    if (isPlatformBrowser(this.platformId)) {
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
    this.closeReturnRefundDialog();
    // Đồng bộ lại danh sách đơn hàng để cập nhật trạng thái yêu cầu trả hàng
    if (isPlatformBrowser(this.platformId)) {
      this.store.getUserOrders();
      this.updateSyncTime();
    }
    this.notify.success('✨Đã gửi yêu cầu trả hàng / hoàn tiền✨');
    this.cdr.markForCheck();
  }

  getLatestReturnRequest(order: any): any {
    if (!order) return null;
    if (Array.isArray(order.returnRequests) && order.returnRequests.length > 0) {
      return order.returnRequests[order.returnRequests.length - 1];
    }
    return order.returnRequest || null;
  }

  getReturnRequestStatusLabel(status: string): string {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PENDING': return 'Chờ duyệt';
      case 'APPROVED': return 'Đã duyệt';
      case 'REJECTED': return 'Từ chối';
      case 'WAITING_FOR_RETURN_SHIPMENT': return 'Chờ gửi hàng hoàn';
      case 'RETURN_SHIPPED': return 'Đã gửi hàng';
      case 'RETURN_RECEIVED': return 'Chéri đã nhận hàng';
      case 'INSPECTED': return 'Đã kiểm tra hàng';
      case 'COMPLETED': return 'Hoàn tất';
      case 'CANCELLED': return 'Đã hủy';
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
      this.saveError = 'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.';
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

    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.removeItem(accessTokenKey);
      } catch (e) {
        // ignore
      }
    }

    this.store.signOut(() => {
      this.router.navigateByUrl(targetUrl);
    });
  }
}
