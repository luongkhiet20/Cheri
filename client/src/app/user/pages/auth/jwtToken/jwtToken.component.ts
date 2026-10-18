import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { of } from 'rxjs';
import { map, take, filter, switchMap } from 'rxjs/operators';

import { accessTokenKey } from '../../../shared/constants';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { checkIsAdmin } from '../../../../services/auth.guard';

import { SignalStore } from '../../../../store/signal.store';

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
    @Inject(PLATFORM_ID)
    private platformId: Object
  ) { }

  ngOnInit(): void {
    this.route.params
      .pipe(
        map((params) => params['accessToken']),
        take(1),
        filter(() => isPlatformBrowser(this.platformId)),
        switchMap((accessToken) => {
          if (!accessToken || accessToken === 'null' || accessToken === 'undefined') {
            return of({ error: 'invalid_token' });
          }
          localStorage.setItem(accessTokenKey, accessToken);
          return this.apiService.getUser();
        })
      )
      .subscribe((user: any) => {
        if (user && !user.error && (user.email || user.id || user.accessToken)) {
          this.selectors.userState.update((state) => ({ ...state, user, loading: false }));
          // Hợp nhất giỏ hàng khách vãng lai (nếu có) vào tài khoản User và xóa guest cart
          this.store.mergeGuestCartIfAny('vi');
          this.store.getUserOrders();
          if (checkIsAdmin(user)) {
            this.router.navigate(['/admin']);
            return;
          }
          this.router.navigate(['']);
        } else {
          // Token không hợp lệ hoặc không xác thực được user từ backend
          if (isPlatformBrowser(this.platformId)) {
            localStorage.removeItem(accessTokenKey);
          }
          this.router.navigate(['/vi/authorize/signin'], {
            queryParams: { error: 'social_auth_failed' },
          });
        }
      });
  }
}
