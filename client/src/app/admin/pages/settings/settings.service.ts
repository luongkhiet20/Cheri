import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppSettings, SettingsApiResponse } from './settings.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private baseUrl = environment.adminApiUrl || 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  getSettings(): Observable<SettingsApiResponse> {
    return this.http.get<SettingsApiResponse>(`${this.baseUrl}/settings`);
  }

  updateSettings(data: Partial<AppSettings>): Observable<SettingsApiResponse> {
    return this.http.patch<SettingsApiResponse>(`${this.baseUrl}/settings`, data);
  }
}
