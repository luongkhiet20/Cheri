import { ChangeDetectionStrategy, Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { TranslateService } from '../../../services/translate.service';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink]
})
export class FooterComponent implements OnDestroy {
  currentYear = new Date().getFullYear();
  lang = 'vn';

  private langSub: Subscription;

  constructor(translate: TranslateService) {
    this.langSub = translate.getLang$().subscribe(lang => {
      this.lang = lang;
    });
  }

  ngOnDestroy(): void {
    this.langSub.unsubscribe();
  }
}
