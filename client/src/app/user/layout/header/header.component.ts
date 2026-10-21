import { debounceTime, take, delay, distinctUntilChanged } from 'rxjs/operators';
import { Component, OnInit, PLATFORM_ID, Inject, Signal, ChangeDetectorRef, effect, HostListener } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, of } from 'rxjs';

import { TranslateService } from '../../../services/translate.service';
import { accessTokenKey } from '../../shared/constants';
import { Cart, User, Order } from '../../shared/models';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { checkIsAdmin } from '../../../services/auth.guard';

import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';

import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SearchModalComponent } from '../../shared/search-modal/search-modal.component';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [
    CommonModule,
    TranslatePipe,
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    MatIconModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatInputModule,
    MatToolbarModule,
    MatMenuModule,
    SearchModalComponent,
  ]
})
export class HeaderComponent implements OnInit {
  isSearchModalOpen = false;
  user$: Signal<User>;
  cart$: Signal<Cart>;
  productTitles$: Signal<string[]>;
  userOrders$: Signal<Order[]>;
  showAutocomplete$ = new BehaviorSubject(false);
  lang$: Observable<string> = of('vi');
  showMobileNav = false;

  leftNavItems = [
    { label: 'Giới thiệu', page: 'about' },
    { label: 'Cửa hàng', page: 'product/all' },
    { label: 'Tra cứu đơn', page: 'tracking' }
  ];

  rightNavItems = [
    { label: 'Yêu thích', page: 'wishlist' }
  ];

  readonly query: FormControl = new FormControl();
  isSearchOpen = false;

  scrollToTop(): void {
    if (!isPlatformBrowser(this._platformId)) return;
    const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
    if (scrollWrap) {
      const prevBehavior = scrollWrap.style.scrollBehavior;
      scrollWrap.style.scrollBehavior = 'auto';
      scrollWrap.scrollTop = 0;
      scrollWrap.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      requestAnimationFrame(() => {
        if (scrollWrap) {
          scrollWrap.scrollTop = 0;
          scrollWrap.style.scrollBehavior = prevBehavior;
        }
      });
    }
    const adminMain = document.querySelector('.admin-main') as HTMLElement | null;
    if (adminMain) {
      adminMain.scrollTop = 0;
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }

  @HostListener('click', ['$event'])
  onHeaderClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    const navLink = target?.closest('a, button[routerLink], .cheri-logo, .nav-label, .nav-cart-label, .nav-avatar-btn, .nav-account-guest-btn');
    if (navLink && !navLink.classList.contains('nav-search-trigger') && !navLink.classList.contains('mat-mdc-icon-button')) {
      this.scrollToTop();
    }
  }

  toggleSearch(): void {
    this.openSearchModal();
  }

  openSearchModal(): void {
    this.isSearchModalOpen = true;
  }

  closeSearchModal(): void {
    this.isSearchModalOpen = false;
  }

  closeSearch(): void {
    this.isSearchOpen = false;
    this.showAutocomplete$.next(false);
    this.query.setValue('');
  }

  constructor(
    @Inject(PLATFORM_ID)
    private _platformId: Object,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    public translate: TranslateService,
    private router: Router,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef) {

    this.lang$ = this.translate.getLang$() || of('vi');
    this.user$ = this.selectors.user;
    this.cart$ = this.selectors.cart;
    this.productTitles$ = this.selectors.productsTitles;
    this.userOrders$ = this.selectors.userOrders;

    // Tự động re-render Header khi user signal thay đổi
    effect(() => {
      const u = this.selectors.user();
      this.avatarLoadFailed = false;
      this.cdr.markForCheck();
    });
  }

  ngOnInit() {
    this.user$ = this.selectors.user;
    this.cart$ = this.selectors.cart;
    this.productTitles$ = this.selectors.productsTitles;
    this.userOrders$ = this.selectors.userOrders;

    // Khi vào web, nếu có accessToken mà chưa có thông tin user đầy đủ trong store, lập tức gọi getUser()
    if (isPlatformBrowser(this._platformId)) {
      const token = localStorage.getItem(accessTokenKey);
      if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
        const currentUser = this.selectors.user();
        if (!currentUser || !currentUser.email) {
          this.store.getUser();
        }
      }
    }

    this.query.valueChanges.pipe(
      debounceTime(200),
      distinctUntilChanged()
    ).subscribe(value => {
      const trimmed = (value || '').trim();
      if (!trimmed) {
        this.selectors.productState.update((state) => ({ ...state, productsTitles: [] }));
        return;
      }
      this.store.getProductSearch(trimmed);
    });
  }

  onFocus(): void {
    this.showAutocomplete$.next(true);
  }

  onBlur(): void {
    of('blur_event').pipe(delay(300), take(1)).subscribe(() => {
      this.showAutocomplete$.next(false);
    })
  }

  onTitleLink(): void {
    this.query.setValue('');
    this.isSearchOpen = false;
  }

  isAdmin(): boolean {
    const user = typeof this.user$ === 'function' ? this.user$() : null;
    return checkIsAdmin(user);
  }

  isRegularUser(): boolean {
    const user = typeof this.user$ === 'function' ? this.user$() : null;
    if (!user) return false;
    return !this.isAdmin();
  }

  getUserDisplayName(): string {
    const user = typeof this.user$ === 'function' ? this.user$() : null;
    if (!user) return '';
    return user.fullName || user.name || (user.email ? user.email.split('@')[0] : '');
  }

  private lastUserId: string | null = null;
  avatarLoadFailed = false;

  getUserAvatar(): string | null {
    const user = typeof this.user$ === 'function' ? this.user$() : null;
    if (!user) return null;

    const currentId = user.id || (user as any)._id || user.email;
    if (currentId !== this.lastUserId) {
      this.lastUserId = currentId;
      this.avatarLoadFailed = false;
    }

    if (this.avatarLoadFailed) return null;

    // 1. Ưu tiên hàng đầu: trường avatar trực tiếp trong MongoDB user
    if (user.avatar && typeof user.avatar === 'string' && user.avatar.trim().length > 0) {
      return user.avatar.trim();
    }
    if ((user as any).avatarUrl && typeof (user as any).avatarUrl === 'string' && (user as any).avatarUrl.trim().length > 0) {
      return (user as any).avatarUrl.trim();
    }
    if ((user as any).photoUrl && typeof (user as any).photoUrl === 'string' && (user as any).photoUrl.trim().length > 0) {
      return (user as any).photoUrl.trim();
    }

    // 2. Mảng images
    const imgs = (user as any).images;
    if (Array.isArray(imgs) && imgs.length > 0) {
      const first = imgs.find((img: any) =>
        (typeof img === 'string' && img.trim().length > 0) ||
        (img && typeof img.url === 'string' && img.url.trim().length > 0)
      );
      if (first) return typeof first === 'string' ? first.trim() : first.url.trim();
    }
    if (typeof imgs === 'string' && (imgs as string).trim().length > 0) {
      return (imgs as string).trim();
    }

    return null;
  }

  getUserInitial(): string {
    const user = typeof this.user$ === 'function' ? this.user$() : null;
    if (!user) return 'C';
    const name = user.fullName || user.name || user.email || 'C';
    return name.charAt(0).toUpperCase();
  }

  onAvatarError(): void {
    this.avatarLoadFailed = true;
    this.cdr.detectChanges();
  }

  onLogout(): void {
    const currentLang = (this.translate as any)?.lang || 'vi';
    const targetUrl = `/${currentLang}`;

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    this.store.signOut((res) => {
      if (isOffline || res?.networkError) {
        this.notify.warning('Đã đăng xuất trên thiết bị này (thiết bị đang ở chế độ ngoại tuyến).');
      } else if (res?.serverError) {
        this.notify.warning('Đã đăng xuất trên thiết bị này.');
      } else {
        this.notify.success('Bạn đã đăng xuất thành công. Hẹn gặp lại tại Chéri!');
      }

      if (isPlatformBrowser(this._platformId)) {
        this.router.navigateByUrl(targetUrl);
      }
    });
  }
}
