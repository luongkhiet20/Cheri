import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SettingsService } from './settings.service';
import { AppSettings } from './settings.model';

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  isLoading = true;
  isSaving = false;

  settings: AppSettings = {
    site: {
      name: '',
      logo: '',
      favicon: '',
      description: ''
    },
    contact: {
      email: '',
      phone: '',
      address: ''
    },
    store: {
      isOpen: true
    },
    checkout: {
      allowOrder: true
    },
    shipping: {
      enabled: true
    },
    maintenance: {
      enabled: false,
      message: ''
    },
    system: {
      language: 'vi',
      currency: 'đ',
      timezone: 'Asia/Ho_Chi_Minh'
    }
  };

  originalSettings: AppSettings | null = null;

  // Validation errors
  errors: { [key: string]: string } = {};

  // Alerts
  successMessage = '';
  errorMessage = '';
  private timer: any = null;

  // Modals for Logo & Favicon
  isLogoModalOpen = false;
  isFaviconModalOpen = false;
  tempLogoUrl = '';
  tempFaviconUrl = '';
  modalError = '';

  // Language, Currency, Timezone options
  languages = [
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'en', name: 'English (Tiếng Anh)' },
    { code: 'fr', name: 'Français (Tiếng Pháp)' }
  ];

  currencies = [
    { code: 'đ', name: 'VND / đ (Việt Nam Đồng)' },
    { code: '$', name: 'USD / $ (Đô la Mỹ)' },
    { code: '€', name: 'EUR / € (Euro)' }
  ];

  timezones = [
    { code: 'Asia/Ho_Chi_Minh', name: 'Asia/Ho_Chi_Minh (GMT+7)' },
    { code: 'Asia/Bangkok', name: 'Asia/Bangkok (GMT+7)' },
    { code: 'Asia/Singapore', name: 'Asia/Singapore (GMT+8)' },
    { code: 'UTC', name: 'UTC (GMT+0)' }
  ];

  constructor(
    private settingsService: SettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  loadSettings(): void {
    this.isLoading = true;
    this.clearAlerts();

    this.settingsService.getSettings().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && res.data) {
          this.settings = JSON.parse(JSON.stringify(res.data));
          this.originalSettings = JSON.parse(JSON.stringify(res.data));
        } else {
          this.showError('Không thể tải cấu hình hệ thống từ MongoDB.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error fetching settings:', err);
        this.showError(err?.error?.message || 'Lỗi kết nối khi tải cài đặt hệ thống.');
        this.cdr.markForCheck();
      }
    });
  }

  validate(): boolean {
    this.errors = {};
    let isValid = true;

    // Tên website bắt buộc
    if (!this.settings.site?.name || !this.settings.site.name.trim()) {
      this.errors['site.name'] = 'Vui lòng nhập tên website.';
      isValid = false;
    }

    // Email liên hệ hợp lệ
    if (this.settings.contact?.email && this.settings.contact.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.settings.contact.email.trim())) {
        this.errors['contact.email'] = 'Địa chỉ email liên hệ không hợp lệ.';
        isValid = false;
      }
    }

    return isValid;
  }

  onSave(): void {
    if (!this.validate()) {
      this.showError('Vui lòng kiểm tra lại các trường thông tin chưa hợp lệ.');
      return;
    }

    this.isSaving = true;
    this.clearAlerts();

    const payload: Partial<AppSettings> = {
      site: {
        name: this.settings.site.name.trim(),
        logo: this.settings.site.logo ? this.settings.site.logo.trim() : '',
        favicon: this.settings.site.favicon ? this.settings.site.favicon.trim() : '',
        description: this.settings.site.description ? this.settings.site.description.trim() : ''
      },
      contact: {
        email: this.settings.contact.email ? this.settings.contact.email.trim() : '',
        phone: this.settings.contact.phone ? this.settings.contact.phone.trim() : '',
        address: this.settings.contact.address ? this.settings.contact.address.trim() : ''
      },
      store: {
        isOpen: Boolean(this.settings.store?.isOpen)
      },
      checkout: {
        allowOrder: Boolean(this.settings.checkout?.allowOrder)
      },
      shipping: {
        enabled: Boolean(this.settings.shipping?.enabled)
      },
      maintenance: {
        enabled: Boolean(this.settings.maintenance?.enabled),
        message: this.settings.maintenance?.message ? this.settings.maintenance.message.trim() : ''
      },
      system: {
        language: this.settings.system?.language || 'vi',
        currency: this.settings.system?.currency || 'đ',
        timezone: this.settings.system?.timezone || 'Asia/Ho_Chi_Minh'
      }
    };

    this.settingsService.updateSettings(payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        if (res && res.success && res.data) {
          this.settings = JSON.parse(JSON.stringify(res.data));
          this.originalSettings = JSON.parse(JSON.stringify(res.data));
          this.showSuccess('Đã lưu thay đổi cấu hình hệ thống thành công.');
        } else {
          this.showError(res?.message || 'Không thể lưu cài đặt.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error updating settings:', err);
        this.showError(err?.error?.message || 'Lỗi máy chủ khi cập nhật cấu hình hệ thống.');
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    if (this.originalSettings) {
      this.settings = JSON.parse(JSON.stringify(this.originalSettings));
      this.errors = {};
      this.clearAlerts();
      this.cdr.markForCheck();
    }
  }

  // ── TOGGLES ─────────────────────────────────────────
  toggleStoreOpen(): void {
    if (!this.settings.store) this.settings.store = { isOpen: true };
    this.settings.store.isOpen = !this.settings.store.isOpen;
    this.cdr.markForCheck();
  }

  toggleAllowOrder(): void {
    if (!this.settings.checkout) this.settings.checkout = { allowOrder: true };
    this.settings.checkout.allowOrder = !this.settings.checkout.allowOrder;
    this.cdr.markForCheck();
  }

  toggleShippingEnabled(): void {
    if (!this.settings.shipping) this.settings.shipping = { enabled: true };
    this.settings.shipping.enabled = !this.settings.shipping.enabled;
    this.cdr.markForCheck();
  }

  toggleMaintenance(): void {
    if (!this.settings.maintenance) this.settings.maintenance = { enabled: false, message: '' };
    this.settings.maintenance.enabled = !this.settings.maintenance.enabled;
    this.cdr.markForCheck();
  }

  // ── LOGO MODAL ──────────────────────────────────────
  openLogoModal(): void {
    this.tempLogoUrl = this.settings.site.logo || '';
    this.modalError = '';
    this.isLogoModalOpen = true;
    this.cdr.markForCheck();
  }

  closeLogoModal(): void {
    this.isLogoModalOpen = false;
    this.tempLogoUrl = '';
    this.modalError = '';
    this.cdr.markForCheck();
  }

  onLogoFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.modalError = 'Chỉ chấp nhận tệp hình ảnh (PNG, JPG, SVG, WEBP).';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.modalError = 'Kích thước tệp logo không được vượt quá 5MB.';
      this.cdr.markForCheck();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.tempLogoUrl = reader.result as string;
      this.modalError = '';
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  saveLogo(): void {
    this.settings.site.logo = this.tempLogoUrl;
    this.closeLogoModal();
    this.cdr.markForCheck();
  }

  // ── FAVICON MODAL ───────────────────────────────────
  openFaviconModal(): void {
    this.tempFaviconUrl = this.settings.site.favicon || '';
    this.modalError = '';
    this.isFaviconModalOpen = true;
    this.cdr.markForCheck();
  }

  closeFaviconModal(): void {
    this.isFaviconModalOpen = false;
    this.tempFaviconUrl = '';
    this.modalError = '';
    this.cdr.markForCheck();
  }

  onFaviconFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.name.endsWith('.ico')) {
      this.modalError = 'Chỉ chấp nhận định dạng ảnh hoặc ICO.';
      this.cdr.markForCheck();
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.modalError = 'Kích thước tệp favicon không được vượt quá 2MB.';
      this.cdr.markForCheck();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.tempFaviconUrl = reader.result as string;
      this.modalError = '';
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  saveFavicon(): void {
    this.settings.site.favicon = this.tempFaviconUrl;
    this.closeFaviconModal();
    this.cdr.markForCheck();
  }

  // ── ALERTS ──────────────────────────────────────────
  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    this.cdr.markForCheck();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.successMessage = '';
      this.cdr.markForCheck();
    }, 6000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
    this.cdr.markForCheck();
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.errorMessage = '';
      this.cdr.markForCheck();
    }, 8000);
  }

  clearAlerts(): void {
    this.successMessage = '';
    this.errorMessage = '';
    if (this.timer) clearTimeout(this.timer);
    this.cdr.markForCheck();
  }
}
