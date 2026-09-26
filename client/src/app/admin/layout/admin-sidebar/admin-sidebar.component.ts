import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

interface NavItem {
  label: string;
  route: string;
  exact?: boolean;
}

@Component({
  selector: 'app-admin-sidebar',
  standalone: false,
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css']
})
export class AdminSidebarComponent implements OnInit, OnDestroy {
  isMobileOpen = false;
  private routerSub: Subscription | null = null;

  navItems: NavItem[] = [
    { label: 'Dashboard',                     route: '/admin',                    exact: true },
    { label: 'Quản lý sản phẩm',              route: '/admin/products' },
    { label: 'Quản lý danh mục',              route: '/admin/categories' },
    { label: 'Quản lý đơn hàng',              route: '/admin/orders' },
    { label: 'Phương thức thanh toán',         route: '/admin/payment-methods' },
    { label: 'Đơn vị vận chuyển',             route: '/admin/shipping-methods' },
    { label: 'Quản lý tài khoản',             route: '/admin/users' },
    { label: 'Quản lý tồn kho',               route: '/admin/inventory' },
    { label: 'Quản lý trang',                 route: '/admin/pages' },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
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

  toggleMobile(): void {
    this.isMobileOpen = !this.isMobileOpen;
  }

  closeMobile(): void {
    this.isMobileOpen = false;
  }
}
