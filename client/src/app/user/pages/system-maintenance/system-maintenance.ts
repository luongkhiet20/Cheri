import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { SettingsService } from '../../../admin/pages/settings/settings.service';
import { AppSettings, MaintenanceSettings, ContactSettings } from '../../../admin/pages/settings/settings.model';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { SignalStore } from '../../../store/signal.store';
import { ApiService } from '../../../services/api.service';
import { checkIsAdmin } from '../../../services/auth.guard';
import { accessTokenKey } from '../../shared/constants';

@Component({
  selector: 'app-system-maintenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './system-maintenance.html',
  styleUrls: ['./system-maintenance.css']
})
export class SystemMaintenance implements OnInit, OnDestroy {
  isLoading = true;
  isChecking = false;
  hasError = false;

  maintenance: MaintenanceSettings | null = null;
  contact: ContactSettings | null = null;
  siteName = 'Chéri';
  siteLogo = '';

  private settingsSub: Subscription | null = null;

  constructor(
    private settingsService: SettingsService,
    private router: Router,
    private titleService: Title,
    private cdr: ChangeDetectorRef,
    private selectors: SignalStoreSelectors,
    private store: SignalStore,
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Chéri đang bảo trì');

    // Subscribe nhận dữ liệu cấu hình thời gian thực từ SettingsService
    this.settingsSub = this.settingsService.settings$.subscribe({
      next: (settings: AppSettings | null) => {
        if (!settings) {
          return;
        }

        this.isLoading = false;
        this.isChecking = false;
        this.hasError = false;

        this.maintenance = settings.maintenance || null;
        this.contact = settings.contact || null;
        if (settings.site?.name) {
          this.siteName = settings.site.name;
        }
        if (settings.site?.logo) {
          this.siteLogo = settings.site.logo;
        }

        // Nếu chế độ bảo trì đã được tắt ở database, tự động đưa người dùng về trang chủ
        if (isPlatformBrowser(this.platformId) && settings.maintenance && settings.maintenance.enabled === false) {
          this.router.navigate(['/']);
        }

        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.isChecking = false;
        this.hasError = true;
        this.cdr.markForCheck();
      }
    });

    // Nếu chưa có dữ liệu trong cache, chủ động gọi API lấy từ MongoDB
    if (!this.settingsService.currentSettings && isPlatformBrowser(this.platformId)) {
      this.fetchSettings();
    } else if (this.settingsService.currentSettings) {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.settingsSub) {
      this.settingsSub.unsubscribe();
      this.settingsSub = null;
    }
  }

  /**
   * Gọi API nạp cấu hình settings từ MongoDB
   */
  fetchSettings(): void {
    this.settingsService.getSettings().subscribe({
      next: () => {
        this.isLoading = false;
        this.isChecking = false;
        this.hasError = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.isChecking = false;
        this.hasError = true;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Khách hàng bấm nút "Kiểm tra lại" để làm mới dữ liệu từ server
   */
  onRefresh(): void {
    if (this.isChecking) return;
    this.isChecking = true;
    this.cdr.markForCheck();

    this.settingsService.getSettings().subscribe({
      next: (res) => {
        this.isChecking = false;
        if (res?.data?.maintenance && res.data.maintenance.enabled === false) {
          this.router.navigate(['/']);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isChecking = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Điều hướng nhanh tới trang quản trị hoặc trang đăng nhập Admin:
   * - Nếu Admin đã đăng nhập & phiên hợp lệ: chuyển thẳng đến /admin
   * - Nếu chưa đăng nhập, đã đăng xuất hoặc phiên hết hạn: chuyển đến trang đăng nhập Admin (/vi/authorize/signin?returnUrl=/admin)
   * - Tránh việc coi là đã xác thực chỉ vì còn dữ liệu rác trong localStorage
   */
  onAdminLogin(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.router.navigate(['/admin']);
      return;
    }

    const token = localStorage.getItem(accessTokenKey);

    // 1. Không có token -> chưa đăng nhập / đã đăng xuất -> chuyển ngay đến trang đăng nhập
    if (!token) {
      this.router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      return;
    }

    // 2. Có token -> xác thực phiên thực tế từ server qua API getUser()
    this.apiService.getUser().pipe(take(1)).subscribe({
      next: (user: any) => {
        if (user && !user.error && (user.email || user.accessToken) && checkIsAdmin(user)) {
          this.store.storeUser(user);
          this.router.navigate(['/admin']);
        } else {
          // Phiên không hợp lệ hoặc tài khoản không có quyền Admin
          if (!user || user.error || !user.email) {
            localStorage.removeItem(accessTokenKey);
            sessionStorage.clear();
          }
          this.router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
        }
      },
      error: () => {
        // Token lỗi / hết hạn 401
        localStorage.removeItem(accessTokenKey);
        sessionStorage.clear();
        this.router.navigate(['/vi/authorize/signin'], { queryParams: { returnUrl: '/admin' } });
      }
    });
  }
}
