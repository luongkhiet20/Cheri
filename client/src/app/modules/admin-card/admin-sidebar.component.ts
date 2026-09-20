import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, Inject, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavItem, DEFAULT_NAV_ITEMS } from './admin.models';
import { accessTokenKey } from '../../shared/constants';
import { SignalStore } from '../../store/signal.store';
import { TranslateService } from '../../services/translate.service';

@Component({
  selector: 'app-admin-sidebar',
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSidebarComponent {
  @Input() activeSection = 'overview';
  @Input() sidebarCollapsed = false;
  @Input() navItems: NavItem[] = DEFAULT_NAV_ITEMS;

  @Output() activeSectionChange = new EventEmitter<string>();
  @Output() sectionChange = new EventEmitter<string>();
  @Output() sidebarCollapsedChange = new EventEmitter<boolean>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() goToDashboard = new EventEmitter<Event>();
  @Output() logout = new EventEmitter<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private sanitizer: DomSanitizer,
    @Optional() private store?: SignalStore,
    @Optional() private translate?: TranslateService
  ) {}

  getSafeIcon(icon: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(icon || '');
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
    event.preventDefault();
    this.onSetSection('overview');
    this.goToDashboard.emit(event);
  }

  onLogout(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
      } catch (e) {}
    }
    if (this.store) {
      this.store.storeUser(null);
    }
    this.logout.emit();
    const lang = this.translate?.lang ? `/${this.translate.lang}` : '/';
    this.router.navigate([lang]);
  }
}
