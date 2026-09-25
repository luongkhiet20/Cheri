import { APP_INITIALIZER, ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CookieService } from 'ngx-cookie-service';
import { routes } from './app.routes';
import { provideClientHydration, withHttpTransferCacheOptions, } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { WindowService } from './services/window.service';
import { EnvConfigurationService } from './services/env-configuration.service';
import { BrowserHttpInterceptor } from './services/browser-http-interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';


export function WindowFactory() {
  return typeof window !== 'undefined' ? window : {};
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    provideClientHydration(withHttpTransferCacheOptions({
      filter: (req) => !req.url.includes('/api/'),
      includePostRequests: false,
      includeRequestsWithAuthHeaders: false
    })),
    provideAnimations(),
    CookieService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: BrowserHttpInterceptor,
      multi: true,
    },

    {
      provide: WindowService,
      useFactory: (WindowFactory)
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (envConfigService: EnvConfigurationService) => () => envConfigService.load().toPromise(),
      deps: [EnvConfigurationService],
      multi: true
    },
  ]
};
