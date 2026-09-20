import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { NavItem, DEFAULT_NAV_ITEMS } from './admin.models';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminLayoutComponent {
  @Input() activeSection = 'overview';
  @Input() sidebarCollapsed = false;
  @Input() pageTitle = '';
  @Input() searchQuery = '';
  @Input() navItems: NavItem[] = DEFAULT_NAV_ITEMS;

  @Output() activeSectionChange = new EventEmitter<string>();
  @Output() sectionChange = new EventEmitter<string>();
  @Output() sidebarCollapsedChange = new EventEmitter<boolean>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() goToDashboard = new EventEmitter<Event>();
  @Output() logout = new EventEmitter<void>();
  @Output() notificationClick = new EventEmitter<void>();
  @Output() accountClick = new EventEmitter<void>();

  get resolvedTitle(): string {
    if (this.pageTitle) {
      return this.pageTitle;
    }
    const found = this.navItems?.find(n => n.key === this.activeSection);
    return found ? found.label : 'Dashboard';
  }

  onToggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.sidebarCollapsedChange.emit(this.sidebarCollapsed);
    this.toggleSidebar.emit();
  }

  onSetSection(key: string): void {
    this.activeSection = key;
    this.activeSectionChange.emit(key);
    this.sectionChange.emit(key);
  }

  onGoToDashboard(event: Event): void {
    this.onSetSection('overview');
    this.goToDashboard.emit(event);
  }

  onLogout(): void {
    this.logout.emit();
  }

  onSearchChange(val: string): void {
    this.searchQuery = val;
    this.searchQueryChange.emit(val);
  }
}
