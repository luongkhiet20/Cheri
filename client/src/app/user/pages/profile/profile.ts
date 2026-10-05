import { Component, OnInit, Inject, PLATFORM_ID, Signal, effect, ViewChild, ElementRef } from '@angular/core';
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

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
    { key: 'all',        label: 'Tất cả' },
    { key: 'PENDING',    label: 'Chờ xác nhận' },
    { key: 'CONFIRMED',  label: 'Đã xác nhận' },
    { key: 'PROCESSING', label: 'Đang xử lý' },
    { key: 'SHIPPING',   label: 'Đang giao' },
    { key: 'DELIVERED',  label: 'Đã giao' },
    { key: 'CANCELLED',  label: 'Đã hủy' },
    { key: 'RETURNED',   label: 'Đã hoàn trả' },
  ];

  // Form fields
  formName: string = '';
  formEmail: string = '';
  formPhone: string = '';
  formAddress: string = '';
  formNewPassword: string = '';
  formConfirmPassword: string = '';

  // Save state
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  saveError: string = '';

  // Avatar upload state
  isUploadingAvatar: boolean = false;
  avatarUploadError: string = '';
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
    private router: Router
  ) {
    this.lang$ = this.translate.getLang$();
    this.user$ = this.selectors.user;
    this.userOrders$ = this.selectors.userOrders;

    // Tự động đồng bộ dữ liệu vào Form khi user signal thay đổi từ MongoDB
    effect(() => {
      const user = this.selectors.user();
      if (user) {
        this.formName            = user.fullName || user.name || '';
        this.formEmail           = user.email || '';
        this.formPhone           = user.phoneNumber || '';
        this.formAddress         = user.address || '';
        this.formNewPassword     = '';
        this.formConfirmPassword = '';
      }
    });
  }

  ngOnInit(): void {
    this.formNewPassword = '';
    this.formConfirmPassword = '';
    if (isPlatformBrowser(this.platformId)) {
      // Tải dữ liệu người dùng và đơn hàng mới nhất từ MongoDB qua API
      this.store.getUser();
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
      },
      error: (err: any) => {
        this.isUploadingAvatar = false;
        this.previewAvatar = null;
        this.avatarUploadError = err?.error?.message || 'Không thể cập nhật ảnh đại diện. Vui lòng thử lại.';
      }
    });
  }

  getAvatarUrl(): string | null {
    if (this.previewAvatar) {
      return this.previewAvatar;
    }
    const avatar = this.user$()?.avatar;
    if (!avatar) return null;
    if (avatar.startsWith('http://') || avatar.startsWith('https://') || avatar.startsWith('data:')) {
      return avatar;
    }
    if (avatar.startsWith('/')) {
      return `${this.apiService.apiUrl}${avatar}`;
    }
    return `${this.apiService.apiUrl}/${avatar}`;
  }

  getUserInitial(): string {
    const user = this.user$();
    if (!user) return 'C';
    const name = user.fullName || user.name || user.email || 'C';
    return name.charAt(0).toUpperCase();
  }

  getDisplayName(): string {
    const user = this.user$();
    if (!user) return 'Quý khách';
    return user.fullName || user.name || (user.email ? user.email.split('@')[0] : 'Quý khách');
  }

  getRoleLabel(): string {
    const user = this.user$();
    if (!user) return 'Thành viên';
    const roles = user.roles || (user.role ? [user.role] : []);
    if (roles.includes('admin') || roles.includes('super-admin')) return 'Quản trị viên';
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
    if (s === 'DELIVERED' || s === 'COMPLETED') return 'DELIVERED';
    if (s === 'CANCELLED' || s === 'CANCELED') return 'CANCELLED';
    if (s === 'RETURNED' || s === 'REFUNDED') return 'RETURNED';
    return s;
  }

  // ── Tab logic ──
  setTab(tab: string): void {
    this.activeTab = tab;
  }

  getTabCount(tab: string): number {
    const orders = this.userOrders$();
    if (!orders) return 0;
    if (tab === 'all') return orders.length;
    return orders.filter(o => this.normalizeStatus(o.status) === tab).length;
  }

  getFilteredOrders(): Order[] {
    const orders = this.userOrders$();
    if (!orders) return [];
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
    return total.toLocaleString('vi-VN') + ' đ';
  }

  formatItemPrice(item: any): string {
    const val = item?.subtotal ?? (item?.unitPrice ? item.unitPrice * (item.quantity || 1) : 0);
    return val.toLocaleString('vi-VN') + ' đ';
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
      case 'PENDING':    return 'status-pending';
      case 'CONFIRMED':  return 'status-confirmed';
      case 'PROCESSING': return 'status-processing';
      case 'SHIPPING':   return 'status-shipping';
      case 'DELIVERED':  return 'status-delivered';
      case 'CANCELLED':  return 'status-cancelled';
      case 'RETURNED':   return 'status-returned';
      default:           return 'status-pending';
    }
  }

  getStatusLabel(status: string | undefined): string {
    switch (this.normalizeStatus(status)) {
      case 'PENDING':    return 'Chờ xác nhận';
      case 'CONFIRMED':  return 'Đã xác nhận';
      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPING':   return 'Đang giao hàng';
      case 'DELIVERED':  return 'Đã giao hàng thành công';
      case 'CANCELLED':  return 'Đã hủy';
      case 'RETURNED':   return 'Đã hoàn trả';
      default:           return status ? status : 'Chờ xác nhận';
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

    const user = this.user$();
    if (!user) {
      this.saveError = 'Không tìm thấy phiên đăng nhập. Vui lòng đăng nhập lại.';
      return;
    }

    const payload: any = {
      fullName: this.formName?.trim() || undefined,
      name: this.formName?.trim() || undefined,
      phoneNumber: this.formPhone?.trim() ?? '',
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
          return;
        }

        // Cập nhật store với dữ liệu người dùng thật vừa được lưu vào MongoDB
        const updatedUser = res.data || res;
        this.store.storeUser({ ...user, ...updatedUser });

        this.formNewPassword = '';
        this.formConfirmPassword = '';
        this.saveSuccess = true;
        this.updateSyncTime();
        setTimeout(() => { this.saveSuccess = false; }, 4000);
      },
      error: (err: any) => {
        this.isSaving = false;
        this.saveError = err?.error?.message || 'Có lỗi kết nối máy chủ. Vui lòng thử lại.';
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
