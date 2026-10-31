import { Component, Input, Optional } from '@angular/core';
import { Router } from '@angular/router';
import { resolveAdminBreadcrumbs } from './admin-breadcrumb.mapping';

export interface BreadcrumbItem {
  label: string;
  url?: string | any[];
  queryParams?: { [key: string]: any };
}

@Component({
  selector: 'app-admin-breadcrumb',
  standalone: false,
  templateUrl: './admin-breadcrumb.component.html',
  styleUrls: ['./admin-breadcrumb.component.css']
})
export class AdminBreadcrumbComponent {
  @Input() items: BreadcrumbItem[] = [];
  @Input() showHomeIcon: boolean = false;
  @Input() showBackArrow: boolean = false;
  @Input() separator: 'chevron' | 'slash' = 'chevron';

  constructor(@Optional() private router: Router) {}

  /**
   * Danh sách breadcrumb items sau khi chuẩn hóa qua mapping tập trung.
   * Cấu trúc: Tên nhóm quản lý > Tên trang hiện tại
   * Loại trừ Quản lý tin nhắn và không làm ảnh hưởng các trang khác.
   */
  get displayItems(): BreadcrumbItem[] {
    const currentUrl = this.router ? this.router.url : '';
    return resolveAdminBreadcrumbs(currentUrl, this.items);
  }
}
