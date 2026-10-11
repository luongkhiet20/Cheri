import { debounceTime, take, delay } from 'rxjs/operators';
import { Component, OnInit, PLATFORM_ID, Inject, Signal, ChangeDetectorRef, effect } from '@angular/core';
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

import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { SearchModalComponent } from '../../shared/search-modal/search-modal.component';

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
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    private cdr: ChangeDetectorRef) {

    this.lang$ = this.translate.getLang$() || of('vi');
    this.user$ = this.selectors.user;
    this.cart$ = this.selectors.cart;
    this.productTitles$ = this.selectors.productsTitles;
    this.userOrders$ = this.selectors.userOrders;

    // Tự động re-render Header ngay lập tức khi user signal thay đổi
    effect(() => {
      const u = this.selectors.user();
      this.avatarLoadFailed = false;
      this.cdr.markForCheck();
      this.cdr.detectChanges();
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

    this.query.valueChanges.pipe(debounceTime(200)).subscribe(value => {
      const sendQuery = value || 'EMPTY___QUERY';
      this.store.getProductSearch(sendQuery);
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

    if (isPlatformBrowser(this._platformId)) {
      try {
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        document.cookie = 'jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
      } catch (e) { }
    }

    this.store.signOut(() => {
      if (isPlatformBrowser(this._platformId)) {
        window.location.href = targetUrl;
      }
    });
  }
}
