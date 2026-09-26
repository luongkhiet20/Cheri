import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppSettings, SettingsApiResponse } from './settings.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private baseUrl = environment.adminApiUrl || 'http://localhost:5000/api';

  private settingsSubject = new BehaviorSubject<AppSettings | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.settings$.subscribe((settings) => {
      if (settings?.site !== undefined) {
        this.updateFavicon(settings.site?.favicon);
      }
    });
  }

  updateFavicon(faviconUrl?: string | null): void {
    if (typeof document === 'undefined') return;

    const defaultFavicon = 'favicon.ico';
    const targetUrl = (faviconUrl && faviconUrl.trim()) ? faviconUrl.trim() : defaultFavicon;

    const oldLinks = document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
    const newLink = document.createElement('link');
    newLink.rel = 'icon';

    if (targetUrl.endsWith('.ico')) {
      newLink.type = 'image/x-icon';
    } else if (targetUrl.endsWith('.png') || targetUrl.startsWith('data:image/png')) {
      newLink.type = 'image/png';
    } else if (targetUrl.endsWith('.svg') || targetUrl.startsWith('data:image/svg+xml')) {
      newLink.type = 'image/svg+xml';
    } else if (targetUrl.endsWith('.webp') || targetUrl.startsWith('data:image/webp')) {
      newLink.type = 'image/webp';
    } else if (targetUrl.endsWith('.jpg') || targetUrl.endsWith('.jpeg') || targetUrl.startsWith('data:image/jpeg')) {
      newLink.type = 'image/jpeg';
    }

    newLink.href = targetUrl;

    oldLinks.forEach(el => el.remove());
    document.head.appendChild(newLink);
  }

  getSettings(): Observable<SettingsApiResponse> {
    return this.http.get<SettingsApiResponse>(`${this.baseUrl}/settings`).pipe(
      tap((res) => {
        if (res && res.success && res.data) {
          this.settingsSubject.next(res.data);
          this.updateFavicon(res.data.site?.favicon);
        }
      })
    );
  }

  updateSettings(data: Partial<AppSettings>): Observable<SettingsApiResponse> {
    return this.http.patch<SettingsApiResponse>(`${this.baseUrl}/settings`, data).pipe(
      tap((res) => {
        if (res && res.success && res.data) {
          this.settingsSubject.next(res.data);
          this.updateFavicon(res.data.site?.favicon);
        }
      })
    );
  }
}
