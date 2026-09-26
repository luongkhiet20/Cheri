import { debounceTime, take, delay } from 'rxjs/operators';
import { Component, OnInit, PLATFORM_ID, Inject, Signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, of } from 'rxjs';

import { TranslateService } from '../../../../services/translate.service';
import { accessTokenKey } from '../../constants';
import { Cart, User, Order } from '../../models';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';

import { MatIconModule } from '@angular/material/icon';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, RouterLinkActive, ReactiveFormsModule, MatIconModule, MatButtonModule, MatAutocompleteModule, MatInputModule, MatToolbarModule, MatMenuModule]
})
export class HeaderComponent implements OnInit {
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
    { label: 'Thử đồ ảo', page: 'virtual-try-on' },
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
    this.isSearchOpen = !this.isSearchOpen;
    if (this.isSearchOpen) {
      this.showAutocomplete$.next(true);
    }
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
    public translate: TranslateService) {

    this.lang$ = this.translate.getLang$() || of('vi');
  }

  ngOnInit() {
    this.user$ = this.selectors.user;
    this.cart$ = this.selectors.cart;
    this.productTitles$ = this.selectors.productsTitles;
    this.userOrders$ = this.selectors.userOrders;

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
    if (!user) {
      console.log('[HeaderComponent] isAdmin(): false (Guest/No user)');
      return false;
    }
    const roles = user.roles || (user.role ? [user.role] : []);
    const isAdm = Array.isArray(roles) && roles.some((r: string) => r && r.toLowerCase() === 'admin');
    console.log('[HeaderComponent] isAdmin():', isAdm, 'Roles:', roles);
    return isAdm;
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
