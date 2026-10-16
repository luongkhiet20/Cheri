import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { accessTokenKey } from '../user/shared/constants';

@Injectable()
export class BrowserHttpInterceptor implements HttpInterceptor {

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let req = request;

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem(accessTokenKey);
      const isInternalRequest = !request.url.startsWith('http://') && !request.url.startsWith('https://')
        || request.url.includes('localhost')
        || (typeof window !== 'undefined' && request.url.includes(window.location.hostname));

      if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '' && !request.headers.has('Authorization') && isInternalRequest) {
        req = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    }

    return next.handle(req).pipe(
      catchError((error: any) => {
        const url = error?.url || request.url;
        const statusCode = error?.status || 0;
        this._handleError(url, statusCode);
        return throwError(() => error);
      })
    );
  }

  private _handleError(url: string, statusCode: number): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    switch (statusCode) {
      case 401: {
        // Bỏ qua các endpoint đăng nhập/đăng ký/quên mật khẩu để component hiển thị lỗi cho người dùng
        const isAuthAttempt =
          url.includes('/api/auth/signin') ||
          url.includes('/api/auth/signup') ||
          url.includes('/api/auth/forgot-password') ||
          url.includes('/api/auth/verify-reset-otp') ||
          url.includes('/api/auth/reset-password') ||
          url.includes('/api/auth/exchange-token');

        if (!isAuthAttempt) {
          const hadToken = !!localStorage.getItem(accessTokenKey);
          if (hadToken) {
            localStorage.removeItem(accessTokenKey);
            try {
              sessionStorage.removeItem(accessTokenKey);
            } catch {}

            const currentUrl = this.router.url;
            const isOnAuthPage =
              currentUrl.includes('/authorize/signin') ||
              currentUrl.includes('/authorize/signup') ||
              currentUrl.includes('/signin') ||
              currentUrl.includes('/signup');

            if (!isOnAuthPage) {
              this.router.navigate(['/vi/authorize/signin'], {
                queryParams: { session: 'expired' },
              });
            }
          }
        }
        break;
      }
      case 403: {
        // 403 là lỗi từ chối quyền (Forbidden), KHÔNG tự động đăng xuất người dùng
        console.warn('HTTP status code 403 (Forbidden): Bạn không có quyền truy cập tài nguyên này.', url);
        break;
      }
      case 404:
        console.warn('HTTP status code: 404: ', url);
        break;
      case 410:
        console.warn('HTTP status code: 410: ', url);
        break;
      case 500:
        console.warn('HTTP status code: 500: ', url);
        break;
      case 503:
        console.warn('HTTP status code: 503: ', url);
        break;
      default:
        console.warn('HTTP status code: Unhandled ', url, statusCode);
        break;
    }
  }

}
