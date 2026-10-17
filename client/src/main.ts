import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Clean up any legacy Service Worker and caches registered from previous PWA installations
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});

  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        if (key.includes('ngsw') || key.includes('cheri-preload') || key.includes('workbox')) {
          caches.delete(key).catch(() => {});
        }
      }
    }).catch(() => {});
  }
}

export const config = appConfig;

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
