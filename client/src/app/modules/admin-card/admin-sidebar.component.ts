import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, Inject, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavItem, DEFAULT_NAV_ITEMS } from './admin.models';
import { accessTokenKey } from '../../shared/constants';
import { SignalStore } from '../../store/signal.store';
import { TranslateService } from '../../services/translate.service';
import { filter } from 'rxjs/operators';

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
    const lang = this.translate?.lang || 'vi';
    const path = key === 'overview' ? `/${lang}/dashboard` : `/${lang}/dashboard/${key}`;
    this.router.navigate([path]);
    // emit vẫn giữ để DashboardShellComponent nhận và cập nhật activeSection cho highlight
    this.activeSection = key;
    this.activeSectionChange.emit(key);
    this.sectionChange.emit(key);
  }

  onGoToDashboard(event: Event): void {
    event.preventDefault();
    this.onSetSection('overview');
    this.goToDashboard.emit(event);
  }

  /** Lấy lang hiện tại từ URL để build đúng route */
  private getLang(): string {
    if (this.translate?.lang) return this.translate.lang;
    const match = this.router.url.match(/^\/([a-z]{2})\//); 
    return match?.[1] || 'vi';
  }

  onLogout(): void {
    const currentLang = this.translate?.lang || 'vi';
    const targetUrl = `/${currentLang}`;

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

    if (this.store) {
      this.store.signOut(() => {
        this.logout.emit();
        if (isPlatformBrowser(this.platformId)) {
          window.location.href = targetUrl;
        } else {
          this.router.navigate([targetUrl], { replaceUrl: true });
        }
      });
    } else {
      this.logout.emit();
      if (isPlatformBrowser(this.platformId)) {
        window.location.href = targetUrl;
      } else {
        this.router.navigate([targetUrl], { replaceUrl: true });
      }
    }
  }
}
