import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslateService } from '../../../../services/translate.service';
import { Page } from '../../../shared/models';
import { ApiService } from '../../../../services/api.service';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export function isPagePublished(page: any, lang: string = 'vi'): boolean {
  if (!page || typeof page !== 'object') {
    return false;
  }
  if (page.error || page.statusCode >= 400 || page.name === 'NotFoundException') {
    return false;
  }

  // 1. Explicit draft checks
  if (page.status === 'draft' || page.status === 'Bản nháp' || page.status === 'inactive' || page.status === 'Ẩn') {
    return false;
  }
  if (page.statusCode === 'draft' || page.statusCode === 'inactive') {
    return false;
  }
  if (page.isPublished === false) {
    return false;
  }
  if (page[lang] && typeof page[lang].visibility === 'boolean' && page[lang].visibility === false) {
    return false;
  }
  if (typeof page.visibility === 'boolean' && page.visibility === false) {
    return false;
  }

  // 2. Explicit published checks
  if (page.status === 'published' || page.status === 'active' || page.status === 'Đã xuất bản') {
    return true;
  }
  if (page.statusCode === 'published' || page.statusCode === 'active') {
    return true;
  }
  if (page.isPublished === true) {
    return true;
  }
  if (page[lang] && page[lang].visibility === true) {
    return true;
  }

  // 3. Fallback: if not explicitly draft and visibility is not false
  return page.status !== 'draft' && page[lang]?.visibility !== false;
}

@Component({
  selector: 'app-page',
  templateUrl: './page.component.html',
  styleUrls: ['./page.component.css'],
  imports: [CommonModule, TranslatePipe, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageComponent implements OnInit, OnDestroy {
  lang$: Observable<string>;
  titleUrl$: Observable<string>;
  page: Page | null = null;
  currentLang = 'vi';
  private pageSub: Subscription = new Subscription();

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef
  ) {
    this.lang$ = this.translate.getLang$().pipe(filter((lang: string) => !!lang));
    this.titleUrl$ = this.route.params.pipe(map(params => params['titleUrl']));
  }

  ngOnInit(): void {
    this.pageSub.add(
      combineLatest([this.titleUrl$, this.lang$]).subscribe(([titleUrl, lang]: [string, string]) => {
        this.currentLang = lang || 'vi';

        // 1. Không hiển thị nội dung cũ / tránh rò rỉ nội dung draft trước khi kiểm tra
        this.page = null;
        this.cdr.markForCheck();

        if (!titleUrl) {
          this.navigateToNotFound();
          return;
        }

        // 2. Luôn gọi API kiểm tra trạng thái thực tế từ backend (không dùng cache cũ)
        this.apiService.getPage({ titleUrl, lang: this.currentLang }).subscribe({
          next: (response: any) => {
            // Không tìm thấy trang hoặc backend báo lỗi
            if (!response || response.error || response.statusCode >= 400 || response.name === 'NotFoundException') {
              this.navigateToNotFound();
              return;
            }

            // Kiểm tra trạng thái: nếu Bản nháp / tắt -> điều hướng Not Found
            if (!isPagePublished(response, this.currentLang)) {
              this.navigateToNotFound();
              return;
            }

            // Trang tồn tại + Đã xuất bản -> render bình thường
            this.page = response;
            this.cdr.markForCheck();
          },
          error: () => {
            this.navigateToNotFound();
          }
        });
      })
    );
  }

  private navigateToNotFound(): void {
    this.page = null;
    this.cdr.markForCheck();
    this.router.navigate(['/' + this.currentLang + '/not-found'], { replaceUrl: true });
  }

  goBack(): void {
    this.location.back();
  }

  ngOnDestroy(): void {
    this.pageSub.unsubscribe();
  }
}
