import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

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
export class AdminSidebarComponent implements OnInit {
  isMobileOpen = false;

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

  ngOnInit(): void {}

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
