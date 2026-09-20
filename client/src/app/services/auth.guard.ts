import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { SignalStoreSelectors } from '../store/signal.store.selectors';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';
import { accessTokenKey } from '../shared/constants';

export const AuthGuard: CanActivateFn = (_route: ActivatedRouteSnapshot): Observable<boolean> | boolean => {
  const selectors = inject(SignalStoreSelectors);
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

  return toObservable(selectors.user).pipe(
    filter((user) => !!user),
    take(1),
    map((user) => {
      const isAuth = Boolean(user && (user.email || user.accessToken));
      if (!isAuth) {
        router.navigate(['/']);
      }
      return isAuth;
    })
  );
};

export const AdminGuard: CanActivateFn = (_route: ActivatedRouteSnapshot): Observable<boolean> | boolean => {
  const selectors = inject(SignalStoreSelectors);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const currentUser = selectors.user();
  if (currentUser) {
    const isAdmin = Boolean(Array.isArray(currentUser.roles) && currentUser.roles.includes('admin'));
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

  return toObservable(selectors.user).pipe(
    filter((user) => !!user),
    take(1),
    map((user) => {
      const isAdmin = Boolean(user && Array.isArray(user.roles) && user.roles.includes('admin'));
      if (!isAdmin) {
        router.navigate(['/']);
      }
      return isAdmin;
    })
  );
};
