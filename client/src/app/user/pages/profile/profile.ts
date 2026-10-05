import { Component, OnInit, Inject, PLATFORM_ID, Signal } from '@angular/core';
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
  }

  ngOnInit(): void {
    this.user$ = this.selectors.user;
    this.userOrders$ = this.selectors.userOrders;

    // Pre-fill form from user store
    const user = this.user$();
    if (user) {
      this.formName    = user.fullName || user.name || '';
      this.formEmail   = user.email || '';
      this.formPhone   = user.phoneNumber || '';
      this.formAddress = user.address || '';
    }

    // Set sync time
    this.updateSyncTime();
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
    if (roles.includes('admin')) return 'Quản trị viên';
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
    const d = order.deliveredAt || order.createdAt || order.dateAdded;
    const base = d ? new Date(d) : new Date();
    base.setDate(base.getDate() + 30);
    const dd = String(base.getDate()).padStart(2, '0');
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const yyyy = base.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  getOrderPhone(order: Order): string {
    return order.shippingAddress?.phone || order.customerPhone || this.user$()?.phoneNumber || '0881 1880 080';
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
    return this.user$()?.address || '118 Linh Trung, Phường Linh Trung, Thủ Đức, Thành phố Hồ Chí Minh';
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

  // ── Save profile ──
  onSave(): void {
    this.saveSuccess = false;
    this.saveError = '';

    // Validate passwords if provided
    if (this.formNewPassword || this.formConfirmPassword) {
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
      this.saveError = 'Không tìm thấy thông tin tài khoản.';
      return;
    }

    const userId = user._id || user.id;
    if (!userId) {
      this.saveError = 'Không xác định được tài khoản.';
      return;
    }

    const payload: any = {
      fullName: this.formName.trim() || undefined,
      email: this.formEmail.trim() || undefined,
      phoneNumber: this.formPhone.trim() || undefined,
      address: this.formAddress.trim() || undefined,
    };

    if (this.formNewPassword) {
      payload.password = this.formNewPassword;
    }

    this.isSaving = true;
    this.apiService.updateUser(userId, payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res?.error) {
          this.saveError = res.error?.message || 'Có lỗi xảy ra khi lưu.';
          return;
        }
        // Update store with new data
        this.store.storeUser({ ...user, ...payload });
        this.formNewPassword = '';
        this.formConfirmPassword = '';
        this.saveSuccess = true;
        this.updateSyncTime();
        setTimeout(() => { this.saveSuccess = false; }, 4000);
      },
      error: () => {
        this.isSaving = false;
        this.saveError = 'Có lỗi kết nối. Vui lòng thử lại.';
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
