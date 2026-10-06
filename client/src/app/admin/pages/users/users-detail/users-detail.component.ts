import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-users-detail',
  standalone: false,
  templateUrl: './users-detail.component.html',
  styleUrls: ['./users-detail.component.css']
})
export class UsersDetailComponent implements OnInit {
  userId: string | null = null;
  user: any = null;
  isLoading = false;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Orders section state
  orders: any[] = [];
  isOrdersLoading = false;
  ordersErrorMessage = '';

  // Confirm dialog for lock/unlock
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' | 'danger' = 'warning';
  isStatusUpdating = false;

  defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="%23e2e8f0"><circle cx="12" cy="8" r="4" fill="%2394a3b8"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="%2394a3b8"/></svg>';
  avatarHasError = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId || this.userId.trim() === '') {
      this.isNotFound = true;
      return;
    }
    this.loadUser();
    this.loadOrders();
  }

  getUserInitial(): string {
    if (!this.user) return 'U';
    const raw = (this.user.fullName || this.user.name || this.user.email || '').trim();
    if (!raw) return 'U';
    return String(Array.from(raw)[0] || 'U').toUpperCase();
  }

  getInitialsAvatar(): string {
    const initial = this.getUserInitial();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><rect width="100%" height="100%" fill="%23F8EBEB"/><text x="50%" y="54%" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="700" fill="%2374070E" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }

  getRawAvatarUrl(): string {
    if (!this.user) return '';

    let raw = this.user.avatar;

    // Fallback: check user.image
    if (!raw && this.user.image) {
      raw = typeof this.user.image === 'string' ? this.user.image : this.user.image?.url;
    }

    // Fallback: check user.images array
    if (!raw && Array.isArray(this.user.images) && this.user.images.length > 0) {
      const first = this.user.images[0];
      raw = typeof first === 'string' ? first : first?.url;
    }

    if (!raw || typeof raw !== 'string') return '';
    raw = raw.trim();
    if (!raw) return '';

    // If it's a relative path to uploads, prepend backend origin if needed
    if (raw.startsWith('/uploads') || raw.startsWith('uploads/')) {
      const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
      const origin = (environment.adminApiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      return `${origin}${cleanPath}`;
    }

    return raw;
  }

  get avatarSrc(): string {
    if (this.avatarHasError) {
      return this.getInitialsAvatar();
    }
    const raw = this.getRawAvatarUrl();
    if (raw) {
      return raw;
    }
    return this.getInitialsAvatar();
  }

  onAvatarError(): void {
    if (this.avatarHasError) return;
    this.avatarHasError = true;
    this.cdr.markForCheck();
  }

  loadUser(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';
    this.avatarHasError = false;

    this.apiService.getUserById(this.userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.user = res.data;
          this.avatarHasError = false;
        } else {
          this.isNotFound = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404 || err.status === 400) {
          this.isNotFound = true;
        } else {
          this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin tài khoản từ máy chủ MongoDB';
        }
        console.error('Error fetching account detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  loadOrders(): void {
    if (!this.userId) return;

    this.isOrdersLoading = true;
    this.ordersErrorMessage = '';

    this.apiService.getUserOrders(this.userId).subscribe({
      next: (res) => {
        this.isOrdersLoading = false;
        if (res.success && Array.isArray(res.data)) {
          this.orders = res.data;
        } else {
          this.orders = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isOrdersLoading = false;
        this.ordersErrorMessage = err.error?.message || 'Không thể tải danh sách đơn hàng.';
        console.error('Error fetching user orders:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onViewOrder(orderId: string): void {
    if (!orderId) return;
    this.router.navigate(['/admin/orders', orderId]);
  }

  getOrderStatusVariant(status: string): string {
    if (!status) return 'neutral';
    const s = status.toUpperCase().trim();
    switch (s) {
      case 'DELIVERED':
      case 'ĐÃ GIAO':
      case 'ĐÃ GIAO HÀNG':
      case 'SUCCESS':
        return 'success';
      case 'SHIPPING':
      case 'ĐANG GIAO':
      case 'ĐANG GIAO HÀNG':
      case 'CONFIRMED':
      case 'ĐÃ XÁC NHẬN':
      case 'PRIMARY':
        return 'primary';
      case 'PROCESSING':
      case 'ĐANG XỬ LÝ':
      case 'PENDING':
      case 'CHỜ XÁC NHẬN':
      case 'CHỜ XỬ LÝ':
      case 'RETURNED':
      case 'ĐÃ HOÀN TRẢ':
      case 'WARNING':
        return 'warning';
      case 'CANCELLED':
      case 'ĐÃ HỦY':
      case 'DELIVERY_FAILED':
      case 'GIAO HÀNG KHÔNG THÀNH CÔNG':
      case 'DANGER':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  getOrderStatusLabel(order: any): string {
    return order.statusText || order.status || 'Chờ xử lý';
  }

  onBack(): void {
    this.router.navigate(['/admin/users']);
  }

  onEdit(): void {
    if (!this.userId) return;
    this.router.navigate(['/admin/users', this.userId, 'edit']);
  }

  onToggleStatusClick(): void {
    if (!this.user || !this.userId) return;

    const isActive = this.user.status !== false;
    if (isActive) {
      this.confirmTitle = 'Khóa tài khoản';
      this.confirmMessage = `Bạn có chắc chắn muốn khóa tài khoản "${this.user.email}" không? Người dùng sẽ không thể đăng nhập vào hệ thống.`;
      this.confirmLabel = 'Khóa tài khoản';
      this.confirmVariant = 'warning';
    } else {
      this.confirmTitle = 'Mở khóa tài khoản';
      this.confirmMessage = `Bạn có chắc chắn muốn mở khóa tài khoản "${this.user.email}" không?`;
      this.confirmLabel = 'Mở khóa';
      this.confirmVariant = 'default';
    }
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmStatusChange(): void {
    if (!this.user || !this.userId || this.isStatusUpdating) return;

    const currentStatus = this.user.status !== false;
    const newStatus = !currentStatus;
    this.isStatusUpdating = true;

    this.apiService.updateUserStatus(this.userId, newStatus).subscribe({
      next: (res) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        if (res.success) {
          this.successMessage = res.message || (newStatus ? 'Đã mở khóa tài khoản thành công' : 'Đã khóa tài khoản thành công');
          this.notificationService.success(this.successMessage);
          this.loadUser();
        } else {
          this.errorMessage = res.message || 'Thao tác không thành công';
          this.notificationService.error(this.errorMessage);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái người dùng';
        this.notificationService.error(this.errorMessage);
        console.error('Status change error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelStatusChange(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  get hasCartItems(): boolean {
    return !!(this.user?.cart?.items && Array.isArray(this.user.cart.items) && this.user.cart.items.length > 0);
  }

  get cartItemsCount(): number {
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + (item.qty || item.quantity || 1), 0);
  }

  get cartTotalPrice(): number {
    if (this.user?.cart?.totalPrice) return this.user.cart.totalPrice;
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
  }
}

export { UsersDetailComponent as AccountDetailComponent };
