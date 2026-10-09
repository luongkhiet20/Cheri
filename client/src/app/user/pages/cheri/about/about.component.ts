import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { finalize, takeUntil, timeout } from 'rxjs/operators';
import { ApiService } from '../../../../services/api.service';
import {
  AboutSection,
  TypographyElementKey,
} from '../../../../admin/pages/pages/about/about-cms.models';

@Component({
  selector: 'app-user-about',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit, OnDestroy {
  sections: AboutSection[] = [];
  isLoading = true;

  private destroy$ = new Subject<void>();
  private requestSub?: Subscription;
  private isDestroyed = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private titleService: Title,
    private metaService: Meta,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Giới thiệu về Chéri | Câu Chuyện Thương Hiệu');
    this.metaService.updateTag({
      name: 'description',
      content:
        'Khám phá câu chuyện thương hiệu, triết lý thiết kế và vẻ đẹp thanh lịch vượt thời gian tại Atelier de Chéri.',
    });

    this.loadPublishedAboutConfig();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
    this.requestSub?.unsubscribe();
  }

  /**
   * Tải dữ liệu các phân đoạn đã xuất bản từ collection pages_about.
   * Quản lý loading state bằng finalize() của RxJS, timeout ngăn treo request,
   * và hủy subscription an toàn khi rời trang.
   */
  loadPublishedAboutConfig(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.requestSub?.unsubscribe();

    this.requestSub = this.apiService
      .getAboutPublished()
      .pipe(
        timeout(10000),
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          if (!this.isDestroyed) {
            this.cdr.markForCheck();
          }
        }),
      )
      .subscribe({
        next: (res: any) => {
          // Trường hợp C: API trả về lỗi
          if (!res || res.error) {
            this.navigateToNotFound();
            return;
          }

          // Trường hợp D: API trả về dữ liệu không đúng định dạng
          const rawSections = res.data?.sections ?? res.sections;
          if (!Array.isArray(rawSections)) {
            this.navigateToNotFound();
            return;
          }

          // Lọc các section hợp lệ đang ở trạng thái kích hoạt (enabled)
          const validSections: AboutSection[] = rawSections
            .filter(
              (sec: any): sec is AboutSection =>
                sec && typeof sec === 'object' && sec.enabled !== false,
            )
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          // Trường hợp B: Danh sách rỗng hoặc sau khi lọc không còn phần tử hợp lệ
          if (validSections.length === 0) {
            this.navigateToNotFound();
            return;
          }

          // Trường hợp A: Có dữ liệu hợp lệ xuất bản từ CMS
          this.sections = validSections;
          if (!this.isDestroyed) {
            this.cdr.markForCheck();
          }
        },
        error: () => {
          // Trường hợp C & Timeout: HTTP lỗi, mất mạng hoặc quá 10s không phản hồi
          this.navigateToNotFound();
        },
      });
  }

  /**
   * Điều hướng sang trang Not Found khi không có nội dung CMS hợp lệ
   */
  private navigateToNotFound(): void {
    this.sections = [];
    if (!this.isDestroyed) {
      this.cdr.markForCheck();
    }
    this.router.navigateByUrl('/not-found', { replaceUrl: true });
  }

  /**
   * Tính toán style Typography & Màu sắc động dựa trên cấu hình quản trị viên đã xuất bản từ CMS Admin
   */
  getTypographyStyle(
    section: AboutSection | null | undefined,
    element: TypographyElementKey,
  ): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};

    // 1. Cấu hình Typography
    if (section.typography) {
      const cfg = section.typography[element];
      if (cfg) {
        if (cfg.fontFamily && cfg.fontFamily !== 'inherit') {
          style['font-family'] = cfg.fontFamily;
        }
        if (cfg.fontSize) {
          style['font-size'] = `${cfg.fontSize}px`;
        }
        if (cfg.fontWeight) {
          style['font-weight'] = `${cfg.fontWeight}`;
        }
        if (cfg.lineHeight) {
          style['line-height'] = `${cfg.lineHeight}`;
        }
        if (cfg.letterSpacing !== undefined && cfg.letterSpacing !== null) {
          style['letter-spacing'] = `${cfg.letterSpacing}px`;
        }
        if (cfg.textTransform && cfg.textTransform !== 'none') {
          style['text-transform'] = cfg.textTransform;
        }
        if (cfg.textAlign) {
          style['text-align'] = cfg.textAlign;
        }
      }
    }

    // 2. Cấu hình Màu sắc (Colors)
    if (section.colors) {
      if (element === 'heading' && section.colors.titleColor) {
        style['color'] = section.colors.titleColor;
      } else if ((element === 'subheading' || element === 'eyebrow') && section.colors.subtitleColor) {
        style['color'] = section.colors.subtitleColor;
      } else if (element === 'body' && section.colors.bodyColor) {
        style['color'] = section.colors.bodyColor;
      } else if (element === 'quote' && section.colors.quoteColor) {
        style['color'] = section.colors.quoteColor;
      } else if (element === 'button') {
        if (section.colors.buttonTextColor) {
          style['color'] = section.colors.buttonTextColor;
        }
        if (section.colors.buttonBackgroundColor) {
          style['background-color'] = section.colors.buttonBackgroundColor;
        }
      }
    }

    return style;
  }

  /**
   * Tính toán style vùng chứa phân đoạn (Màu nền & CSS Variables cho nút bấm)
   */
  getSectionContainerStyle(section: AboutSection | null | undefined): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};
    if (section.colors?.backgroundColor) {
      style['background-color'] = section.colors.backgroundColor;
    } else if (section.settings?.bgColor) {
      style['background-color'] = section.settings.bgColor;
    }
    if (section.colors?.buttonTextColor) {
      style['--sec-btn-color'] = section.colors.buttonTextColor;
    }
    if (section.colors?.buttonBackgroundColor) {
      style['--sec-btn-bg'] = section.colors.buttonBackgroundColor;
    }
    if (section.colors?.buttonHoverTextColor) {
      style['--sec-btn-hover-color'] = section.colors.buttonHoverTextColor;
    }
    if (section.colors?.buttonHoverBackgroundColor) {
      style['--sec-btn-hover-bg'] = section.colors.buttonHoverBackgroundColor;
    }
    return style;
  }
}
