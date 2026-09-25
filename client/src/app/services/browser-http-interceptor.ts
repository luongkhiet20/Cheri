import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { accessTokenKey } from '../user/shared/constants';

@Injectable()
export class BrowserHttpInterceptor implements HttpInterceptor {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let req = request;

    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem(accessTokenKey);
      if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '' && !request.headers.has('Authorization')) {
        req = request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    }

    return next.handle(req).pipe(
      catchError((error: HttpResponse<any>) => {
        this._handleError(error.url, error.status);
        return throwError(() => (error));
      }));
  }


  private _handleError(url: string, statusCode: number): void {
    switch (statusCode) {
      case 404:
        console.warn('HTTP status code: 404: ', url, statusCode);
        break;
      case 410:
        console.warn('HTTP status code: 410: ', url, statusCode);
        break;
      case 500:
        console.warn('HTTP status code: 500: ', url, statusCode);
        break;
      case 503:
        console.warn('HTTP status code: 503: ', url, statusCode);
        break;
      default:
        console.warn('HTTP status code: Unhandled ', url, statusCode);
        break;
    }
  }

}
