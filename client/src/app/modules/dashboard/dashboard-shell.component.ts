import { Component, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { TranslateService } from '../../services/translate.service';
import { SignalStore } from '../../store/signal.store';
import { NavItem, DEFAULT_NAV_ITEMS } from '../admin-card';
import { accessTokenKey } from '../../shared/constants';

@Component({
  selector: 'app-dashboard-shell',
  templateUrl: './dashboard-shell.component.html',
  standalone: false
})
export class DashboardShellComponent implements OnDestroy {

  sidebarCollapsed = false;
  searchQuery = '';
  navItems: NavItem[] = DEFAULT_NAV_ITEMS;
  activeSection = 'overview';

  private routerSub: Subscription;

  constructor(
    private router: Router,
    private translate: TranslateService,
    private store: SignalStore
  ) {
    // Sync activeSection từ URL hiện tại
    this.syncSectionFromUrl(this.router.url);

    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: NavigationEnd) => {
      this.syncSectionFromUrl(e.urlAfterRedirects);
    });
  }

  private syncSectionFromUrl(url: string): void {
    // URL dạng /vi/dashboard/products hoặc /vi/dashboard
    const match = url.match(/\/dashboard\/?([^?#/]*)/);
    const segment = match?.[1] || '';
    this.activeSection = segment || 'overview';
  }

  get currentPageTitle(): string {
    const found = this.navItems.find(n => n.key === this.activeSection);
    return found ? found.label : 'Dashboard';
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setSection(key: string): void {
    const lang = this.translate.lang || 'vi';
    const path = key === 'overview' ? `/${lang}/dashboard` : `/${lang}/dashboard/${key}`;
    this.router.navigate([path]);
  }

  goToDashboard(event?: Event): void {
    if (event) event.preventDefault();
    this.setSection('overview');
  }

  logout(): void {
    const lang = this.translate.lang || 'vi';
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        ['jwt', 'token', 'accessToken', 'connect.sid'].forEach(name => {
          document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
        });
      } catch (e) {}
    }
    this.store.signOut(() => {
      if (typeof window !== 'undefined') {
        window.location.href = `/${lang}`;
      } else {
        this.router.navigate([`/${lang}`], { replaceUrl: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }
}
