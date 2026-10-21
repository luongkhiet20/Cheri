import {
  Component,
  ElementRef,
  Renderer2,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import {
  CommonModule,
  isPlatformBrowser,
  isPlatformServer,
} from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take, delay, map, skip } from 'rxjs/operators';
import { of } from 'rxjs';
import { NavigationStart, NavigationEnd, Router, RouterOutlet, Scroll } from '@angular/router';

import { TranslateService } from './services/translate.service';
import { JsonLDService } from './services/jsonLD.service';
import { User } from './user/shared/models';
import { currencyLang, accessTokenKey } from './user/shared/constants';
import { SignalStore } from './store/signal.store';
import { SignalStoreSelectors } from './store/signal.store.selectors';
import { SettingsService } from './admin/pages/settings/settings.service';
import { isRouteAllowedDuringMaintenance } from './services/maintenance.guard';
import { FooterComponent } from './user/layout/footer/footer.component';
import { HeaderComponent } from './user/layout/header/header.component';
import { ChatbotWidgetComponent } from './user/shared/chatbot/chatbot-widget/chatbot-widget.component';
import { NotificationComponent } from './user/shared/notification/notification.component';
import { ScrollToTopComponent } from './user/shared/scroll-to-top/scroll-to-top.component';

@Component({
  selector: 'cheri-app',
  imports: [CommonModule, RouterOutlet, FooterComponent, HeaderComponent, ChatbotWidgetComponent, NotificationComponent, ScrollToTopComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  position = 0;
  isDashboard = false;
  isMaintenancePage = false;
  private lastNavigatedPath = '';

  constructor(
    private elRef: ElementRef,
    private renderer: Renderer2,
    private router: Router,
    private translate: TranslateService,
    private jsonLDService: JsonLDService,
    @Inject(PLATFORM_ID)
    private platformId: Object,
    private signalStore: SignalStore,
    private selectors: SignalStoreSelectors,
    private settingsService: SettingsService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.settingsService.getSettings().subscribe({
        next: () => { },
        error: () => { }
      });
    }

    this.translate.getLang$()
      .pipe(filter(Boolean), take(1))
      .subscribe((lang: string) => {
        const langUpdate = {
          lang,
          currency: currencyLang[lang]
        };
        this.signalStore.changeLanguage(langUpdate);
      });


    toObservable(this.selectors.appLang)
      .pipe(filter(Boolean), skip(1))
      .subscribe((lang: string) => {
        translate.use(lang);
      });

    toObservable(this.selectors.position)
      .pipe(filter(Boolean))
      .subscribe(() => {
        this.resetScrollToTop();
      });

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem(accessTokenKey);
      if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
        this.signalStore.getUser();
      }
    }

    toObservable(this.selectors.user).pipe(delay(100))
      .subscribe((user: User) => {
        if (user && user.email) {
          this.signalStore.getUserOrders();
        }
      });

    this.translate.getLang$()
      .pipe(filter(lang => !!lang && isPlatformBrowser(this.platformId)))
      .subscribe(lang => {
        this.signalStore.getCart(lang);
        this.signalStore.getPages({ lang, titles: true });
      });

    if (isPlatformServer(this.platformId)) {
      this.jsonLDService.insertSchema(this.jsonLDService.websiteSchema);
      this.jsonLDService.insertSchema(this.jsonLDService.orgSchema, 'structured-data-org');
    }

    this.router.events.pipe(
      filter((event) => event instanceof NavigationStart),
      map((checkRoute: NavigationStart) => {
        this.jsonLDService.insertSchema(this.jsonLDService.websiteSchema);
        this.jsonLDService.insertSchema(this.jsonLDService.orgSchema, 'structured-data-org');
      })
    );

    // Ẩn header/footer trên trang admin hoặc trang bảo trì
    const checkIsAdmin = (url: string): boolean => {
      return url.includes('/admin') || url.includes('/dashboard') || url.includes('/product-management');
    };
    const checkIsMaintenance = (url: string): boolean => {
      return url.includes('system-maintenance');
    };

    const initialUrl = this.router.url || '';
    this.isDashboard = checkIsAdmin(initialUrl);
    this.isMaintenancePage = checkIsMaintenance(initialUrl);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const currentUrl = event.urlAfterRedirects || event.url || '';
      this.isDashboard = checkIsAdmin(currentUrl);
      this.isMaintenancePage = checkIsMaintenance(currentUrl);

      // Tự động cuộn lên đầu trang khi điều hướng sang trang khác (khác pathname)
      const currentPath = currentUrl.split('?')[0].split('#')[0];
      if (!this.lastNavigatedPath || this.lastNavigatedPath !== currentPath) {
        this.lastNavigatedPath = currentPath;
        this.resetScrollToTop();
      }

      // Nếu hệ thống đang bật bảo trì và khách truy cập đang ở trang mua sắm thông thường
      if (isPlatformBrowser(this.platformId)) {
        const curSettings = this.settingsService.currentSettings;
        if (curSettings?.maintenance?.enabled === true && !isRouteAllowedDuringMaintenance(currentUrl) && !this.isAdmin()) {
          this.router.navigate(['/system-maintenance']);
        }
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof Scroll)
    ).subscribe((event: Scroll) => {
      if (event.position) {
        this.scrollToPosition(event.position[0], event.position[1]);
      } else if (event.anchor) {
        this.scrollToAnchor(event.anchor);
      } else {
        this.resetScrollToTop();
      }
    });

    // Lắng nghe thay đổi settings thời gian thực từ database
    if (isPlatformBrowser(this.platformId)) {
      this.settingsService.settings$.subscribe((settings) => {
        if (!settings?.maintenance) return;
        const currentUrl = this.router.url || '';
        if (settings.maintenance.enabled === true) {
          if (!isRouteAllowedDuringMaintenance(currentUrl) && !this.isAdmin()) {
            this.router.navigate(['/system-maintenance']);
          }
        } else if (settings.maintenance.enabled === false) {
          if (currentUrl.includes('system-maintenance')) {
            this.router.navigate(['/']);
          }
        }
      });
    }
  }

  isAdmin(): boolean {
    const user = this.selectors.user();
    if (!user) return false;
    const roles = user.roles || (user.role ? [user.role] : []);
    return Array.isArray(roles) && roles.some((r: string) => r && r.toLowerCase() === 'admin');
  }

  onScrolling(event: Event): void {
    this.position = event['target']['scrollTop'];
  }

  onActivate(component: any): void {
    this.resetScrollToTop();
  }

  onDeactivate(component: any): void {
    // Không lưu lại vị trí cuộn cũ để đảm bảo trang đích luôn mở ở vị trí đầu trang
  }

  scrollToPosition(x: number, y: number): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const scrollWrap = (this.elRef?.nativeElement?.querySelector('.main-scroll-wrap') ||
      document.querySelector('.main-scroll-wrap')) as HTMLElement | null;

    if (scrollWrap) {
      const prevBehavior = scrollWrap.style.scrollBehavior;
      scrollWrap.style.scrollBehavior = 'auto';
      scrollWrap.scrollTop = y;
      scrollWrap.scrollTo({ top: y, left: x, behavior: 'auto' });
      requestAnimationFrame(() => {
        if (scrollWrap) {
          scrollWrap.scrollTop = y;
          scrollWrap.style.scrollBehavior = prevBehavior;
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: y, left: x, behavior: 'auto' });
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.scrollTop = y;
      if (document.body) document.body.scrollTop = y;
    }
  }

  scrollToAnchor(anchor: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const element = document.getElementById(anchor) || document.querySelector(`[name="${anchor}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  resetScrollToTop(): void {
    this.scrollToPosition(0, 0);
  }
}
