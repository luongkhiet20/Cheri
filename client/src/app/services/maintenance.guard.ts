import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, take, catchError } from 'rxjs/operators';
import { SettingsService } from '../admin/pages/settings/settings.service';
import { SignalStoreSelectors } from '../store/signal.store.selectors';
import { checkIsAdmin } from './auth.guard';

/**
 * Kiểm tra xem URL hiện tại có nằm trong danh sách các route được phép truy cập
 * trong thời gian hệ thống đang bảo trì hay không.
 * Bao gồm:
 * - Trang thông báo bảo trì (/system-maintenance)
 * - Tất cả các route quản trị (/admin/*)
 * - Các route xác thực/đăng nhập (/authorize, /signin, /login,...) để quản trị viên có thể đăng nhập tắt bảo trì
 * - Token auth (/jwtToken)
 */
export const isRouteAllowedDuringMaintenance = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    cleanUrl.includes('system-maintenance') ||
    cleanUrl.startsWith('/admin') ||
    cleanUrl.includes('/admin') ||
    cleanUrl.includes('/authorize') ||
    cleanUrl.includes('/signin') ||
    cleanUrl.includes('/signup') ||
    cleanUrl.includes('/login') ||
    cleanUrl.includes('/register') ||
    cleanUrl.startsWith('/jwttoken') ||
    cleanUrl.includes('/jwttoken')
  );
};

/**
 * Guard bảo vệ các route người dùng thông thường khi website đang bảo trì.
 * - Nếu maintenance.enabled === true: Chuyển hướng khách truy cập sang /system-maintenance.
 *   (Quản trị viên đã đăng nhập vẫn được phép truy cập để kiểm tra hệ thống).
 * - Nếu maintenance.enabled === false hoặc lỗi API: Cho phép truy cập bình thường.
 */
export const MaintenanceGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | boolean => {
  const settingsService = inject(SettingsService);
  const router = inject(Router);
  const selectors = inject(SignalStoreSelectors);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Nếu route đích nằm trong danh sách được phép, cho phép ngay lập tức
  if (isRouteAllowedDuringMaintenance(state.url)) {
    return true;
  }

  // Kiểm tra nếu quản trị viên đã đăng nhập
  const currentUser = selectors.user();
  if (currentUser && checkIsAdmin(currentUser)) {
    return true;
  }

  return settingsService.ensureSettings().pipe(
    take(1),
    map((settings) => {
      const isMaint = Boolean(settings?.maintenance?.enabled === true);
      if (isMaint) {
        router.navigate(['/system-maintenance']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      // Khi API lỗi hoặc không kết nối được, không tự ý coi là bảo trì
      return of(true);
    })
  );
};

/**
 * Guard dành riêng cho route /system-maintenance:
 * - Khi maintenance.enabled === true: Cho phép hiển thị trang bảo trì.
 * - Khi maintenance.enabled === false: Không cho phép hiển thị, điều hướng ngay về trang chủ (/).
 * - Tránh vòng lặp điều hướng vô hạn.
 */
export const MaintenancePageGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot
): Observable<boolean> | boolean => {
  const settingsService = inject(SettingsService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  return settingsService.ensureSettings().pipe(
    take(1),
    map((settings) => {
      const isMaint = Boolean(settings?.maintenance?.enabled === true);
      if (!isMaint) {
        // Hệ thống không bảo trì => chuyển về trang chủ, không ở lại trang bảo trì
        router.navigate(['/']);
        return false;
      }
      return true;
    }),
    catchError(() => {
      // Lỗi kết nối => không giữ ở trang bảo trì, về trang chủ
      router.navigate(['/']);
      return of(false);
    })
  );
};
