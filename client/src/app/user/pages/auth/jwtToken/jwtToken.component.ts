import { Component, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
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
          localStorage.setItem(accessTokenKey, accessToken);
          return this.apiService.getUser();
        })
      )
      .subscribe((user: any) => {
        if (user && !user.error && (user.email || user.accessToken)) {
          this.selectors.userState.update((state) => ({ ...state, user }));
          // Hợp nhất giỏ hàng khách vãng lai (nếu có) vào tài khoản User và xóa guest cart
          this.store.mergeGuestCartIfAny('vi');
        }
        this.router.navigate(['/']);
      });
  }
}
