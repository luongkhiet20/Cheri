import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { SignalStoreSelectors } from '../store/signal.store.selectors';
import { SignalStore } from '../store/signal.store';
import { ApiService } from './api.service';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { accessTokenKey } from '../user/shared/constants';

export const checkIsAdmin = (user: any): boolean => {
  if (!user) return false;
  const roles = user.roles || (user.role ? [user.role] : []);
  if (Array.isArray(roles) && roles.some((r: string) => r && r.toLowerCase() === 'admin')) {
    return true;
  }
  return false;
};

export const AuthGuard: CanActivateFn = (_route: ActivatedRouteSnapshot): Observable<boolean> | boolean => {
  const selectors = inject(SignalStoreSelectors);
  const store = inject(SignalStore);
  const apiService = inject(ApiService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const currentUser = selectors.user();
  if (currentUser) {
    return Boolean(currentUser.email || currentUser.accessToken);
  }

  const token = localStorage.getItem(accessTokenKey);
  if (!token) {
    router.navigate(['/']);
    return false;
  }

  return apiService.getUser().pipe(
    take(1),
    map((user: any) => {
      const isAuth = Boolean(user && !user.error && (user.email || user.accessToken));
      if (isAuth) {
        store.storeUser(user);
      } else {
        router.navigate(['/']);
      }
      return isAuth;
    }),
    catchError(() => {
      router.navigate(['/']);
      return of(false);
    })
  );
};

export const AdminGuard: CanActivateFn = (_route: ActivatedRouteSnapshot): Observable<boolean> | boolean => {
  const selectors = inject(SignalStoreSelectors);
  const store = inject(SignalStore);
  const apiService = inject(ApiService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const currentUser = selectors.user();
  if (currentUser) {
    const isAdmin = checkIsAdmin(currentUser);
    if (!isAdmin) {
      router.navigate(['/']);
    }
    return isAdmin;
  }

  const token = localStorage.getItem(accessTokenKey);
  if (!token) {
    router.navigate(['/']);
    return false;
  }

  return apiService.getUser().pipe(
    take(1),
    map((user: any) => {
      if (user && !user.error && (user.email || user.accessToken)) {
        store.storeUser(user);
        const isAdmin = checkIsAdmin(user);
        if (!isAdmin) {
          router.navigate(['/']);
        }
        return isAdmin;
      }
      router.navigate(['/']);
      return false;
    }),
    catchError(() => {
      router.navigate(['/']);
      return of(false);
    })
  );
};
