import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AdminService } from '../../services/admin.service';
import { SignalStore } from '../../../store/signal.store';
import { accessTokenKey } from '../../../user/shared/constants';
import { SettingsService } from '../../pages/settings/settings.service';

@Component({
  selector: 'app-admin-header',
  standalone: false,
  templateUrl: './admin-header.component.html',
  styleUrls: ['./admin-header.component.css']
})
export class AdminHeaderComponent implements OnInit, OnDestroy {
  @Output() toggleMenu = new EventEmitter<void>();

  isUserMenuOpen = false;
  currentUser: any = null;
  logoUrl: string = '';
  hasLogoError = false;

  // ── Notification State ──────────────────────
  isNotificationOpen = false;
  notifications: any[] = [];
  readNotifIds = new Set<string>();
  loadingNotifs = false;
  private notifInterval: any = null;

  private userSub: Subscription | null = null;
  private settingsSub: Subscription | null = null;

  get unreadCount(): number {
    return this.notifications.filter(n => !this.readNotifIds.has(n.id)).length;
  }

  get notificationGroups(): { key: string; label: string; items: any[] }[] {
    const labels: Record<string, string> = {
      orders: '🔔 Đơn hàng',
      products: '🔔 Sản phẩm & kho',
      users: '🔔 Người dùng',
    };
    return ['orders', 'products', 'users']
      .map(key => ({
        key,
        label: labels[key],
        items: this.notifications.filter(n => n.group === key),
      }))
      .filter(g => g.items.length > 0);
  }

  onToggleMenu(): void {
    this.toggleMenu.emit();
  }

  constructor(
    private apiService: AdminService,
    private settingsService: SettingsService,
    private router: Router,
    private store: SignalStore,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit(): void {
    // Subscribe to reactive user updates (triggered when user updates profile or avatar)
    this.userSub = this.apiService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });

    // Subscribe to reactive settings updates (triggered when settings are loaded or saved)
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      if (settings?.site?.logo) {
        this.logoUrl = settings.site.logo;
        this.hasLogoError = false;
      } else if (settings?.site) {
        this.logoUrl = '';
      }
      this.cdr.markForCheck();
    });

    // Fetch initial profile & settings (only in browser to prevent SSR blocking)
    if (isPlatformBrowser(this.platformId)) {
      this.apiService.getAccountProfile().subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: () => { }
      });

      this.settingsService.getSettings().subscribe({
        next: (res) => {
          if (res?.success && res.data?.site?.logo) {
            this.logoUrl = res.data.site.logo;
            this.hasLogoError = false;
            this.cdr.markForCheck();
          }
        },
        error: () => { }
      });

      this.fetchNotifications();
      this.notifInterval = setInterval(() => this.fetchNotifications(), 60000);
    }
  }

  onLogoError(): void {
    this.hasLogoError = true;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.settingsSub) {
      this.settingsSub.unsubscribe();
    }
    if (this.notifInterval) {
      clearInterval(this.notifInterval);
    }
  }

  // ── Notification Handlers ───────────────────
  toggleNotificationMenu(): void {
    this.isNotificationOpen = !this.isNotificationOpen;
    if (this.isNotificationOpen) {
      this.closeUserMenu();
      this.fetchNotifications();
      this.notifications.forEach(n => this.readNotifIds.add(n.id));
    }
  }

  closeNotificationMenu(): void {
    this.isNotificationOpen = false;
  }

  markAllNotificationsRead(): void {
    this.notifications.forEach(n => this.readNotifIds.add(n.id));
    this.cdr.markForCheck();
  }

  refreshNotifications(): void {
    this.fetchNotifications();
  }

  fetchNotifications(): void {
    this.loadingNotifs = true;
    this.cdr.markForCheck();
    this.apiService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = Array.isArray(data) ? data : [];
        this.loadingNotifs = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingNotifs = false;
        this.cdr.markForCheck();
      }
    });
  }

  isNotifRead(id: string): boolean {
    return this.readNotifIds.has(id);
  }

  onNotificationItemClick(n: any): void {
    if (!n) return;
    this.readNotifIds.add(n.id);
    this.closeNotificationMenu();

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

      // Người dùng bị khóa
      case 'users-locked':
        this.router.navigate(['/admin/users'], { queryParams: { status: 'inactive' } });
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

  get userInitial(): string {
    const name = this.currentUser?.fullName || this.currentUser?.name || this.currentUser?.username || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  toggleUserMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.cdr.markForCheck();
  }

  closeUserMenu(): void {
    if (this.isUserMenuOpen) {
      this.isUserMenuOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isUserMenuOpen) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.closest('.admin-header__user-menu') || target.closest('.admin-header__user-btn'))) {
      return;
    }
    this.closeUserMenu();
  }

  navigateTo(path: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isUserMenuOpen = false;
    this.router.navigate([path]);
  }

  onLogout(): void {
    this.closeUserMenu();
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        document.cookie = 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) {}
    }

    this.store.signOut(() => {
      this.router.navigate(['/vi/authorize/signin']);
    });
  }
}



