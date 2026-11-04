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
  if (user.isAdmin === true) return true;
  if (typeof user.role === 'string' && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'superadmin')) return true;
  if (typeof user.roles === 'string' && (user.roles.toLowerCase() === 'admin' || user.roles.toLowerCase() === 'superadmin')) return true;
  const roles = user.roles || (user.role ? [user.role] : []);
  if (
    Array.isArray(roles) &&
    roles.some((r: string) => typeof r === 'string' && (r.toLowerCase() === 'admin' || r.toLowerCase() === 'superadmin' || r.toLowerCase() === 'super-admin'))
  ) {
    return true;
  }
  return false;
};

export const checkIsStaff = (user: any): boolean => {
  if (!user) return false;
  if (typeof user.role === 'string' && user.role.toLowerCase() === 'staff') return true;
  if (typeof user.roles === 'string' && user.roles.toLowerCase() === 'staff') return true;
  const roles = user.roles || (user.role ? [user.role] : []);
  if (
    Array.isArray(roles) &&
    roles.some((r: string) => typeof r === 'string' && r.toLowerCase() === 'staff')
  ) {
    return true;
  }
  return false;
};

export const checkIsAdminOrStaff = (user: any): boolean => {
  return checkIsAdmin(user) || checkIsStaff(user);
};

export const getUserPermissions = (user: any): string[] => {
  if (!user) return [];
  const target = user.user || user.data || user;
  if (Array.isArray(target.permissions)) return target.permissions;
  if (Array.isArray(user.permissions)) return user.permissions;
  return [];
};

export const hasPermission = (user: any, permission?: string): boolean => {
  if (!user) return false;
  if (checkIsAdmin(user)) return true;
  if (checkIsStaff(user)) {
    if (!permission) return true;
    const userPermissions = getUserPermissions(user);
    return userPermissions.includes(permission);
  }
  return false;
};

const STAFF_LANDING_PRIORITY: { perm: string; route: string }[] = [
  { perm: 'dashboard:view', route: '/admin/dashboard' },
  { perm: 'orders:view', route: '/admin/orders' },
  { perm: 'products:view', route: '/admin/products' },
  { perm: 'categories:view', route: '/admin/categories' },
  { perm: 'inventory:view', route: '/admin/inventory' },
  { perm: 'coupons:view', route: '/admin/pages/coupons' },
  { perm: 'subscribers:view', route: '/admin/marketing/subscribers' },
  { perm: 'messages:view', route: '/admin/messages' },
  { perm: 'reviews:view', route: '/admin/reviews' },
  { perm: 'payment_methods:view', route: '/admin/payment-methods' },
  { perm: 'shipping_methods:view', route: '/admin/shipping-methods' },
  { perm: 'cms:home', route: '/admin/pages/home' },
  { perm: 'cms:about', route: '/admin/pages/about' },
  { perm: 'cms:policies', route: '/admin/policies' },
  { perm: 'cms:social_links', route: '/admin/social-links' },
  { perm: 'users:view', route: '/admin/users' },
  { perm: 'settings:view', route: '/admin/settings' },
];

export const getStaffDefaultRoute = (user: any): string => {
  const userPerms = getUserPermissions(user);
  for (const item of STAFF_LANDING_PRIORITY) {
    if (userPerms.includes(item.perm)) {
      return item.route;
    }
  }
  return '/admin/unauthorized';
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

  const token = localStorage.getItem(accessTokenKey);
  if (!token) {
    if (selectors.user()) {
      store.storeUser(null);
    }
    router.navigate(['/']);
    return false;
  }

  const currentUser = selectors.user();
  if (currentUser) {
    return Boolean(currentUser.email || currentUser.accessToken);
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

  const token = localStorage.getItem(accessTokenKey);
  if (!token) {
    if (selectors.user()) {
      store.storeUser(null);
    }
    router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
    return false;
  }

  const currentUser = selectors.user();
  if (currentUser) {
    const isPrivileged = checkIsAdminOrStaff(currentUser);
    if (!isPrivileged) {
      router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return false;
    }
    return true;
  }

  return apiService.getUser().pipe(
    take(1),
    map((user: any) => {
      if (user && !user.error && (user.email || user.accessToken)) {
        store.storeUser(user);
        const isPrivileged = checkIsAdminOrStaff(user);
        if (!isPrivileged) {
          router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
          return false;
        }
        return true;
      }
      localStorage.removeItem(accessTokenKey);
      sessionStorage.clear();
      router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return false;
    }),
    catchError(() => {
      localStorage.removeItem(accessTokenKey);
      sessionStorage.clear();
      router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return of(false);
    })
  );
};

export const PermissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot): Observable<boolean> | boolean => {
  const selectors = inject(SignalStoreSelectors);
  const store = inject(SignalStore);
  const apiService = inject(ApiService);
  const platformId = inject(PLATFORM_ID);
  const router = inject(Router);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const token = localStorage.getItem(accessTokenKey);
  if (!token) {
    router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
    return false;
  }

  const requiredPermission = route.data?.['permission'] as string | undefined;

  const checkAccess = (user: any): boolean => {
    if (!user) return false;
    // 1. ADMIN bypass
    if (checkIsAdmin(user)) {
      return true;
    }

    // 2. STAFF check
    if (checkIsStaff(user)) {
      if (!requiredPermission) {
        return true;
      }
      const userPermissions = getUserPermissions(user);
      if (userPermissions.includes(requiredPermission)) {
        return true;
      }

      // 2a. Staff chưa được cấp bất kỳ quyền nào (permissions: [])
      if (userPermissions.length === 0) {
        const currentUrl = router.url || '';
        if (!currentUrl.startsWith('/admin/unauthorized')) {
          router.navigate(['/admin/unauthorized']);
        }
        return false;
      }

      // 2b. Nếu truy cập route gốc /admin hoặc /admin/dashboard mà không có dashboard:view
      // Điều hướng đến module đầu tiên được phân quyền theo thứ tự ưu tiên
      const routePath = route.routeConfig?.path || '';
      const isDashboardOrRoot = !routePath || routePath === '' || routePath === 'dashboard';
      if (isDashboardOrRoot) {
        const fallbackRoute = getStaffDefaultRoute(user);
        const currentUrl = router.url || '';
        if (!currentUrl.startsWith(fallbackRoute)) {
          router.navigate([fallbackRoute]);
        }
        return false;
      }

      // 2c. Nếu cố truy cập trực tiếp URL của một module nghiệp vụ chưa được phân quyền
      const currentUrl = router.url || '';
      if (!currentUrl.startsWith('/admin/unauthorized')) {
        router.navigate(['/admin/unauthorized'], {
          queryParams: {
            deniedModule: routePath || 'module',
            required: requiredPermission
          }
        });
      }
      return false;
    }

    // 3. Customer -> điều hướng về trang đăng nhập
    router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
    return false;
  };

  const currentUser = selectors.user();
  if (currentUser) {
    return checkAccess(currentUser);
  }

  return apiService.getUser().pipe(
    take(1),
    map((user: any) => {
      if (user && !user.error && (user.email || user.accessToken)) {
        store.storeUser(user);
        return checkAccess(user);
      }
      router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return false;
    }),
    catchError(() => {
      router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return of(false);
    })
  );
};
