import { Component, Input } from '@angular/core';

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
}
