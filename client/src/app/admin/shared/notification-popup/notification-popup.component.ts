import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ElementRef,
  HostListener,
  Inject,
  PLATFORM_ID,
  ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-notification-popup',
  standalone: false,
  templateUrl: './notification-popup.component.html',
  styleUrls: ['./notification-popup.component.scss']
})
export class NotificationPopupComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: any[] = [];
  loading = false;
  hasError = false;
  errorMessage = 'Không thể tải thông báo. Vui lòng thử lại sau.';
  private notifInterval: any = null;

  isMarkingAllRead = false;
  private processingNotifIds = new Set<string>();

  @Output() unreadCountChange = new EventEmitter<number>();
  @Output() closed = new EventEmitter<void>();

  constructor(
    private apiService: AdminService,
    private router: Router,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchNotifications();
      this.notifInterval = setInterval(() => this.fetchNotifications(), 60000);
    }
  }

  ngOnDestroy(): void {
    if (this.notifInterval) {
      clearInterval(this.notifInterval);
      this.notifInterval = null;
    }
  }

  get unreadCount(): number {
    return (this.notifications || []).filter(n => !this.isNotifRead(n)).length;
  }

  get notificationGroups(): { key: string; label: string; items: any[] }[] {
    const labels: Record<string, string> = {
      orders: 'Đơn hàng',
      products: 'Sản phẩm & kho',
      users: 'Người dùng',
    };
    return ['orders', 'products', 'users']
      .map(key => ({
        key,
        label: labels[key],
        items: (this.notifications || []).filter(n => n.group === key),
      }))
      .filter(g => g.items.length > 0);
  }

  isNotifRead(n: any): boolean {
    return n?.isRead === true;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.fetchNotifications();
    }
    this.cdr.markForCheck();
  }

  toggleNotificationMenu(): void {
    this.toggle();
  }

  open(): void {
    if (!this.isOpen) {
      this.toggle();
    }
  }

  close(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.closed.emit();
      this.cdr.markForCheck();
    }
  }

  closeNotificationMenu(): void {
    this.close();
  }

  fetchNotifications(): void {
    this.loading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    this.apiService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = Array.isArray(data) ? data : [];
        this.loading = false;
        this.hasError = false;
        this.emitUnreadCount();
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.hasError = true;
        this.errorMessage = 'Không thể tải thông báo. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }

  refreshNotifications(): void {
    if (this.loading) return;
    this.fetchNotifications();
  }

  onRefresh(): void {
    this.refreshNotifications();
  }

  onMarkAllRead(): void {
    if (this.isMarkingAllRead || this.unreadCount === 0) return;
    this.isMarkingAllRead = true;
    this.cdr.markForCheck();

    this.apiService.markAllNotificationsAsRead().subscribe({
      next: () => {
        this.isMarkingAllRead = false;
        // Tải lại trực tiếp từ backend MongoDB để đảm bảo đồng bộ hoàn toàn
        this.fetchNotifications();
      },
      error: (err) => {
        console.error('Lỗi khi đánh dấu tất cả đã đọc:', err);
        this.isMarkingAllRead = false;
        this.hasError = true;
        this.errorMessage = 'Lỗi cập nhật tất cả thông báo. Vui lòng thử lại.';
        this.fetchNotifications();
        this.cdr.markForCheck();
      }
    });
  }

  onNotificationItemClick(n: any): void {
    if (!n) return;

    // Nếu thông báo đã đọc, chỉ đóng popup và điều hướng ngay, không gọi API cập nhật lại
    if (this.isNotifRead(n)) {
      this.close();
      this.navigateForNotification(n);
      return;
    }

    const notifId = n._id ? String(n._id) : String(n.id);
    if (this.processingNotifIds.has(notifId)) return;
    this.processingNotifIds.add(notifId);

    // Gọi API lưu trạng thái đã đọc vào MongoDB
    this.apiService.markNotificationAsRead(notifId).subscribe({
      next: () => {
        this.processingNotifIds.delete(notifId);
        n.isRead = true;
        n.readAt = new Date();
        this.emitUnreadCount();
        this.close();
        this.navigateForNotification(n);
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.processingNotifIds.delete(notifId);
        console.error('Lỗi cập nhật trạng thái thông báo:', err);
        this.hasError = true;
        this.errorMessage = 'Không thể cập nhật trạng thái thông báo. Vui lòng thử lại.';
        // Đồng bộ lại từ backend, không đóng popup, không điều hướng giả định thành công
        this.fetchNotifications();
        this.cdr.markForCheck();
      }
    });
  }

  private emitUnreadCount(): void {
    this.unreadCountChange.emit(this.unreadCount);
  }

  formatTime(time: any): string {
    if (!time) return '';
    try {
      const date = new Date(time);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      if (diffMs < 0) return 'Vừa xong';
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays <= 7) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target) return;

    if (
      this.elementRef.nativeElement.contains(target) ||
      target.closest('#admin-notification-btn, .admin-header__notification-btn')
    ) {
      return;
    }
    this.close();
  }

  private navigateForNotification(n: any): void {
    if (!n) return;

    switch (n.id) {
      // Đơn hàng mới chờ xác nhận
      case 'orders-new':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'PENDING' } });
        break;

      // Đơn đã xác nhận cần xuất kho
      case 'orders-confirmed':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'CONFIRMED' } });
        break;

      // Đơn hàng thanh toán thành công
      case 'orders-paid':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'CONFIRMED' } });
        break;

      // Đơn hàng bị hủy
      case 'orders-canceled':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'CANCELLED' } });
        break;

      // Đơn hàng yêu cầu đổi trả
      case 'orders-return':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'RETURNED' } });
        break;

      // Đơn hàng đã xuất kho
      case 'stock-out-shipped':
        this.router.navigate(['/admin/orders'], { queryParams: { status: 'SHIPPING' } });
        break;

      // Sản phẩm hết hàng
      case 'stock-out':
        this.router.navigate(['/admin/products'], { queryParams: { status: 'out' } });
        break;

      // Sản phẩm sắp hết hàng
      case 'stock-low':
        this.router.navigate(['/admin/products'], { queryParams: { status: 'out' } });
        break;

      // Nhập kho thành công
      case 'stock-in':
        this.router.navigate(['/admin/products']);
        break;

      // Người dùng mới đăng ký
      case 'users-new':
        this.router.navigate(['/admin/users']);
        break;



      default:
        if (n.group === 'orders') {
          this.router.navigate(['/admin/orders']);
        } else if (n.group === 'products') {
          this.router.navigate(['/admin/products']);
        } else if (n.group === 'users') {
          this.router.navigate(['/admin/users']);
        } else {
          this.router.navigate(['/admin']);
        }
        break;
    }
  }
}
