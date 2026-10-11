import { Component, OnInit, OnDestroy, HostListener, Output, EventEmitter } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ADMIN_PAGES_URLS, isPagesAdminUrl } from '../../pages/pages/pages.routes';

export interface NavItem {
  label: string;
  route: string;
  exact?: boolean;
  icon: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export interface PageSubItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: false,
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css']
})
export class AdminSidebarComponent implements OnInit, OnDestroy {
  @Output() collapsedChange = new EventEmitter<boolean>();
  isCollapsed = false;
  isMobileOpen = false;
  private routerSub: Subscription | null = null;

  // 9 mục cơ bản giữ nguyên cho backward compatibility
  navItems: NavItem[] = [
    { label: 'Dashboard',                     route: '/admin',                    exact: true, icon: 'dashboard' },
    { label: 'Quản lý sản phẩm',              route: '/admin/products',           icon: 'products' },
    { label: 'Quản lý danh mục',              route: '/admin/categories',         icon: 'categories' },
    { label: 'Quản lý đơn hàng',              route: '/admin/orders',             icon: 'orders' },
    { label: 'Mã giảm giá',                   route: '/admin/pages/coupons',      icon: 'coupons' },
    { label: 'Phương thức thanh toán',         route: '/admin/payment-methods',    icon: 'payment-methods' },
    { label: 'Đơn vị vận chuyển',             route: '/admin/shipping-methods',   icon: 'shipping-methods' },
    { label: 'Quản lý tài khoản',             route: '/admin/users',              icon: 'users' },
    { label: 'Quản lý tồn kho',               route: '/admin/inventory',          icon: 'inventory' },
  ];

  // Phân nhóm menu theo 3 nhóm đầu: TỔNG QUAN, KINH DOANH, VẬN HÀNH
  navGroups: NavGroup[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        { label: 'Dashboard', route: '/admin', exact: true, icon: 'dashboard' }
      ]
    },
    {
      title: 'KINH DOANH',
      items: [
        { label: 'Quản lý sản phẩm', route: '/admin/products', icon: 'products' },
        { label: 'Quản lý danh mục', route: '/admin/categories', icon: 'categories' },
        { label: 'Quản lý đơn hàng', route: '/admin/orders', icon: 'orders' },
        { label: 'Mã giảm giá', route: '/admin/pages/coupons', icon: 'coupons' }
      ]
    },
    {
      title: 'VẬN HÀNH',
      items: [
        { label: 'Phương thức thanh toán', route: '/admin/payment-methods', icon: 'payment-methods' },
        { label: 'Đơn vị vận chuyển', route: '/admin/shipping-methods', icon: 'shipping-methods' },
        { label: 'Quản lý tài khoản', route: '/admin/users', icon: 'users' },
        { label: 'Quản lý tồn kho', route: '/admin/inventory', icon: 'inventory' }
      ]
    }
  ];

  readonly adminPagesUrls = ADMIN_PAGES_URLS;

  // 3 mục con của Quản lý trang (Nhóm HỆ THỐNG)
  pageSubItems: PageSubItem[] = [
    { label: 'Trang chủ', route: ADMIN_PAGES_URLS.HOME },
    { label: 'Giới thiệu', route: ADMIN_PAGES_URLS.ABOUT },
    { label: 'Chính sách', route: ADMIN_PAGES_URLS.POLICIES }
  ];

  isPagesOpen = false;
  isPagesHovered = false;
  isPagesExplicitlyClosed = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1200 && window.innerWidth > 768) {
      this.isCollapsed = true;
      this.collapsedChange.emit(this.isCollapsed);
    }

    // Mặc định mở nếu đang ở 1 trong các trang con
    if (this.isPagesActive()) {
      this.isPagesOpen = true;
    }

    // Tự động đóng mobile sidebar khi điều hướng hoàn tất và cập nhật trạng thái menu
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobile();
      if (this.isPagesActive() && !this.isPagesExplicitlyClosed) {
        this.isPagesOpen = true;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  isActive(route: string): boolean {
    return this.router.isActive(route, {
      paths: 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    });
  }

  isPagesActive(): boolean {
    return isPagesAdminUrl(this.router.url);
  }

  get isPagesSubmenuOpen(): boolean {
    if (this.isPagesExplicitlyClosed && !this.isPagesHovered) {
      return false;
    }
    return this.isPagesOpen || this.isPagesHovered || (this.isPagesActive() && !this.isPagesExplicitlyClosed);
  }

  togglePagesMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.isPagesSubmenuOpen) {
      this.isPagesOpen = false;
      this.isPagesExplicitlyClosed = true;
    } else {
      this.isPagesOpen = true;
      this.isPagesExplicitlyClosed = false;
    }
  }

  onPagesHover(hovering: boolean): void {
    this.isPagesHovered = hovering;
    if (hovering) {
      this.isPagesExplicitlyClosed = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.admin-sidebar__item--pages')) {
      if (!this.isPagesActive()) {
        this.isPagesOpen = false;
        this.isPagesHovered = false;
      }
    }
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    this.collapsedChange.emit(this.isCollapsed);
  }

  toggleMobile(): void {
    this.isMobileOpen = !this.isMobileOpen;
  }

  closeMobile(): void {
    this.isMobileOpen = false;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window === 'undefined') return;
    const width = window.innerWidth;
    // Tự động đóng overlay mobile khi kéo rộng màn hình trở lại desktop (> 768px)
    if (width > 768 && this.isMobileOpen) {
      this.isMobileOpen = false;
    }
  }
}
