import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, take, filter, switchMap } from 'rxjs/operators';

import { accessTokenKey } from '../../../shared/constants';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { SignalStore } from '../../../../store/signal.store';
import { TranslateService } from '../../../../services/translate.service';

import { NotificationService } from '../../../shared/notification/notification.service';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  standalone: true,
  templateUrl: './jwtToken.component.html',
  styleUrls: ['./jwtToken.component.css'],
})
export class JwtTokenComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private selectors: SignalStoreSelectors,
    private store: SignalStore,
    private apiService: ApiService,
    private router: Router,
    private translate: TranslateService,
    private notify: NotificationService,
    @Inject(PLATFORM_ID)
    private platformId: Object
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const currentLang = this.translate?.lang || 'vi';
    const defaultHome = '/' + currentLang;
    const queryReturnUrl = this.route.snapshot.queryParams['returnUrl'];
    const safeTarget = this.getSafeReturnUrl(queryReturnUrl, defaultHome);

    const queryCode = this.route.snapshot.queryParams['code'];
    const paramToken = this.route.snapshot.params['accessToken'];

    if (queryCode) {
      // 1. Luồng bảo mật: Trao đổi mã một lần (Single-Use Code) lấy JWT token
      this.apiService.exchangeToken(queryCode).pipe(
        take(1),
        switchMap((res: any) => {
          if (res && !res.error && res.accessToken) {
            localStorage.setItem(accessTokenKey, res.accessToken);
            const userObj = res.user ? { ...res.user, isNewUser: Boolean(res.isNewUser) } : null;
            if (userObj) {
              return of(userObj);
            }
            return this.apiService.getUser().pipe(
              map((u: any) => ({ ...u, isNewUser: Boolean(res.isNewUser) }))
            );
          }
          return of({ error: res?.error || 'oauth_token_invalid' });
        }),
        catchError((err: any) => {
          const status = err?.status || 0;
          let errCode = 'oauth_failed';
          if (status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            errCode = 'oauth_network_failed';
          } else if (status === 401) {
            errCode = 'oauth_token_invalid';
          }
          return of({ error: errCode });
        })
      ).subscribe((user: any) => {
        if (user && !user.error && (user.email || user.accessToken || user.id)) {
          this.store.storeUser(user);
          this.apiService.currentUser$.next(user);
          this.store.getUserOrders();
          this.store.mergeGuestCartIfAny(currentLang);

          if (user.isNewUser) {
            this.notify.success('Đăng ký bằng Google thành công. Chào mừng bạn đến với Chéri!');
          } else {
            this.notify.success('Đăng nhập bằng Google thành công. Chào mừng bạn trở lại!');
          }

          this.router.navigateByUrl(safeTarget);
        } else {
          const errCode = user?.error || 'oauth_failed';
          this.router.navigate(['/' + currentLang + '/authorize/signin'], { queryParams: { error: errCode } });
        }
      });
    } else if (paramToken) {
      // 2. Luồng tương thích ngược: Token được truyền trực tiếp
      localStorage.setItem(accessTokenKey, paramToken);
      this.apiService.getUser().pipe(
        take(1),
        catchError(() => of({ error: 'get_user_failed' }))
      ).subscribe((user: any) => {
        if (user && !user.error && (user.email || user.accessToken)) {
          this.store.storeUser(user);
          this.apiService.currentUser$.next(user);
          this.store.getUserOrders();
          this.store.mergeGuestCartIfAny(currentLang);
          this.notify.success('Đăng nhập bằng Google thành công. Chào mừng bạn trở lại!');
        }
        this.router.navigateByUrl(safeTarget);
      });
    } else {
      this.router.navigate(['/' + currentLang + '/authorize/signin']);
    }
  }

  private getSafeReturnUrl(url: string | null | undefined, fallback: string): string {
    if (!url || typeof url !== 'string') {
      return fallback;
    }
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('/') || cleanUrl.startsWith('//')) {
      return fallback;
    }
    const lower = cleanUrl.toLowerCase();
    if (
      lower.includes('/authorize') ||
      lower.includes('/signin') ||
      lower.includes('/signup') ||
      lower.includes('/login') ||
      lower.includes('/register') ||
      lower.includes('/jwttoken') ||
      lower.startsWith('/admin')
    ) {
      return fallback;
    }
    return cleanUrl;
  }
}
