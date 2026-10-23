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

  // Danh sách các mục cơ bản cho backward compatibility
  navItems: NavItem[] = [
    { label: 'Dashboard',                     route: '/admin',                    exact: true, icon: 'dashboard' },
    { label: 'Quản lý sản phẩm',              route: '/admin/products',           icon: 'products' },
    { label: 'Quản lý danh mục',              route: '/admin/categories',         icon: 'categories' },
    { label: 'Quản lý đơn hàng',              route: '/admin/orders',             icon: 'orders' },
    { label: 'Mã giảm giá',                   route: '/admin/pages/coupons',      icon: 'coupons' },
    { label: 'Đăng ký nhận ưu đãi',           route: '/admin/marketing/subscribers', icon: 'subscribers' },
    { label: 'Phương thức thanh toán',         route: '/admin/payment-methods',    icon: 'payment-methods' },
    { label: 'Đơn vị vận chuyển',             route: '/admin/shipping-methods',   icon: 'shipping-methods' },
    { label: 'Quản lý tài khoản',             route: '/admin/users',              icon: 'users' },
    { label: 'Quản lý tồn kho',               route: '/admin/inventory',          icon: 'inventory' },
    { label: 'Quản lý tin nhắn',              route: '/admin/messages',           icon: 'messages' },
    { label: 'Quản lý đánh giá',              route: '/admin/reviews',            icon: 'reviews' },
    { label: 'Trang chủ',                     route: ADMIN_PAGES_URLS.HOME,       exact: true, icon: 'home' },
    { label: 'Giới thiệu',                    route: ADMIN_PAGES_URLS.ABOUT,      exact: true, icon: 'about' },
    { label: 'Chính sách',                    route: ADMIN_PAGES_URLS.POLICIES,   exact: false, icon: 'policies' },
  ];

  readonly adminPagesUrls = ADMIN_PAGES_URLS;

  // Phân nhóm menu chuẩn hóa: TỔNG QUAN, KINH DOANH, MARKETING, VẬN HÀNH, CHĂM SÓC KHÁCH HÀNG, CMS
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
        { label: 'Quản lý đơn hàng', route: '/admin/orders', icon: 'orders' }
      ]
    },
    {
      title: 'MARKETING',
      items: [
        { label: 'Mã giảm giá', route: '/admin/pages/coupons', icon: 'coupons' },
        { label: 'Đăng ký nhận ưu đãi', route: '/admin/marketing/subscribers', icon: 'subscribers' }
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
    },
    {
      title: 'CHĂM SÓC KHÁCH HÀNG',
      items: [
        { label: 'Quản lý tin nhắn', route: '/admin/messages', icon: 'messages' },
        { label: 'Quản lý đánh giá', route: '/admin/reviews', icon: 'reviews' }
      ]
    },
    {
      title: 'CMS',
      items: [
        { label: 'Trang chủ', route: ADMIN_PAGES_URLS.HOME, exact: true, icon: 'home' },
        { label: 'Giới thiệu', route: ADMIN_PAGES_URLS.ABOUT, exact: true, icon: 'about' },
        { label: 'Chính sách', route: ADMIN_PAGES_URLS.POLICIES, exact: false, icon: 'policies' }
      ]
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 1200 && window.innerWidth > 768) {
      this.isCollapsed = true;
      this.collapsedChange.emit(this.isCollapsed);
    }

    // Tự động đóng mobile sidebar khi điều hướng hoàn tất
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.closeMobile();
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
