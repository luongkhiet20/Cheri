import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslateService } from '../../../services/translate.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
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

  private langSub: Subscription;

  constructor(
    private translate: TranslateService,
    private selectors: SignalStoreSelectors
  ) {
    this.langSub = this.translate.getLang$().subscribe(lang => {
      this.lang = lang || 'vi';
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
  }
}
