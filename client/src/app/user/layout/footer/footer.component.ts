import { ChangeDetectionStrategy, Component, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { TranslateService } from '../../../services/translate.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../../admin/pages/settings/settings.service';
import { ContactSettings } from '../../../admin/pages/settings/settings.model';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { isPagePublished } from '../../pages/cheri/policies/page.component';
import { ApiService } from '../../../services/api.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule]
})
export class FooterComponent implements OnDestroy {
  currentYear = new Date().getFullYear();
  lang = 'vi';

  /** Thông tin liên hệ lấy từ MongoDB collection `settings` */
  contact: ContactSettings | null = null;

  subscribeEmail = '';
  isSubscribing = false;

  private langSub: Subscription;
  private settingsSub: Subscription;

  constructor(
    private translate: TranslateService,
    private selectors: SignalStoreSelectors,
    private settingsService: SettingsService,
    private apiService: ApiService,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {
    this.langSub = this.translate.getLang$().subscribe(lang => {
      this.lang = lang || 'vi';
    });

    // Tái sử dụng cache BehaviorSubject từ SettingsService (đã được load bởi AppComponent).
    // Không phát sinh HTTP request mới.
    this.settingsSub = this.settingsService.settings$.subscribe(settings => {
      this.contact = settings?.contact ?? null;
    });
  }

  isPageVisible(slug: string): boolean {
    const pages = this.selectors.pages();
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return true;
    }
    const page = pages.find((p: any) => p.titleUrl === slug);
    if (!page) {
      return false;
    }
    return isPagePublished(page, this.lang);
  }

  onSubscribe(event: Event): void {
    event.preventDefault();
    const email = (this.subscribeEmail || '').trim();
    if (!email) {
      this.notify.warning('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.notify.error('Địa chỉ email không đúng định dạng. Vui lòng kiểm tra lại.');
      return;
    }
    if (this.isSubscribing) return;

    this.isSubscribing = true;
    this.cdr.markForCheck();

    this.apiService.subscribeNewsletter(email).subscribe({
      next: (res: any) => {
        this.isSubscribing = false;
        this.subscribeEmail = '';
        this.cdr.markForCheck();
        const message = res?.message || 'Đăng ký nhận ưu đãi thành công!';
        this.notify.success(message);
      },
      error: (err: any) => {
        this.isSubscribing = false;
        this.cdr.markForCheck();
        const errorMsg =
          err?.error?.message ||
          'Có lỗi xảy ra trong quá trình đăng ký. Vui lòng thử lại sau.';
        this.notify.error(errorMsg);
      },
    });
  }

  ngOnDestroy(): void {
    this.langSub.unsubscribe();
    this.settingsSub.unsubscribe();
  }
}
