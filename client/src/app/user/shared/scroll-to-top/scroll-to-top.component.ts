import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  Optional,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-scroll-to-top',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-to-top.component.html',
  styleUrls: ['./scroll-to-top.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollToTopComponent implements OnInit, OnDestroy {
  isVisible = false;

  private platformBrowser: boolean;
  private cleanups: Array<() => void> = [];
  private rafId?: number;

  get isBrowser(): boolean {
    return this.platformBrowser || (typeof window !== 'undefined' && typeof document !== 'undefined');
  }

  /** Ngưỡng cuộn xuất hiện: khoảng 200–300px (mặc định chọn 250px) */
  readonly scrollThreshold = 250;

  /** Ngưỡng chiều rộng màn hình điện thoại: <= 767px sẽ ẩn hoàn toàn */
  readonly mobileBreakpoint = 767;

  constructor(
    @Optional() @Inject(PLATFORM_ID) platformId?: Object,
    @Optional() private ngZone?: NgZone,
    @Optional() private cdr?: ChangeDetectorRef
  ) {
    this.platformBrowser = platformId ? isPlatformBrowser(platformId) : false;
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const setupListeners = () => {
      const handleScrollOrResize = () => {
        if (this.rafId) return;
        this.rafId = window.requestAnimationFrame(() => {
          this.rafId = undefined;
          this.checkScrollPosition();
        });
      };

      // Bắt sự kiện cuộn ở cả window và capture toàn bộ DOM container (vd: .main-scroll-wrap)
      window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
      window.addEventListener('resize', handleScrollOrResize, { passive: true });

      this.cleanups.push(() => {
        window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
        window.removeEventListener('resize', handleScrollOrResize);
        if (this.rafId) {
          window.cancelAnimationFrame(this.rafId);
          this.rafId = undefined;
        }
      });

      // Kiểm tra trạng thái ngay sau khi khởi tạo
      handleScrollOrResize();
    };

    if (this.ngZone) {
      this.ngZone.runOutsideAngular(setupListeners);
    } else {
      setupListeners();
    }
  }

  ngOnDestroy(): void {
    for (const cleanup of this.cleanups) {
      cleanup();
    }
    this.cleanups = [];
  }

  /**
   * Tính toán vị trí cuộn hiện tại và kích thước màn hình để cập nhật trạng thái hiển thị của nút
   */
  checkScrollPosition(): void {
    if (!this.isBrowser) return;

    // 1. Kiểm tra kích thước viewport: trên mobile (<= 767px) luôn luôn ẩn
    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    if (viewportWidth <= this.mobileBreakpoint) {
      if (this.isVisible) {
        this.isVisible = false;
        this.cdr?.detectChanges();
      }
      return;
    }

    // 2. Lấy vị trí cuộn: hỗ trợ cả window scroll và container .main-scroll-wrap của layout Chéri
    const windowY = window.pageYOffset || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
    const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
    const wrapY = scrollWrap ? scrollWrap.scrollTop : 0;
    const currentScrollY = Math.max(windowY, wrapY);

    // 3. Cập nhật trạng thái hiển thị
    const shouldBeVisible = currentScrollY > this.scrollThreshold;
    if (this.isVisible !== shouldBeVisible) {
      this.isVisible = shouldBeVisible;
      this.cdr?.detectChanges();
    }
  }

  /**
   * Cuộn mượt trang về đầu trang
   */
  scrollToTop(): void {
    if (!this.isBrowser) return;

    // Cuộn mượt window
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Cuộn mượt .main-scroll-wrap và documentElement nếu đang ở layout có scroll container riêng
    const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
    if (scrollWrap) {
      scrollWrap.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (document.documentElement) {
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (document.body) {
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
