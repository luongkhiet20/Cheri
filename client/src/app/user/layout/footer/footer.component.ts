import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslateService } from '../../../services/translate.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../../admin/pages/settings/settings.service';
import { ContactSettings } from '../../../admin/pages/settings/settings.model';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { isPagePublished } from '../../pages/cheri/policies/page.component';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink]
})
export class FooterComponent implements OnDestroy {
  currentYear = new Date().getFullYear();
  lang = 'vi';

  /** Thông tin liên hệ lấy từ MongoDB collection `settings` */
  contact: ContactSettings | null = null;

  private langSub: Subscription;
  private settingsSub: Subscription;

  constructor(
    private translate: TranslateService,
    private selectors: SignalStoreSelectors,
    private settingsService: SettingsService
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

  ngOnDestroy(): void {
    this.langSub.unsubscribe();
    this.settingsSub.unsubscribe();
  }
}
