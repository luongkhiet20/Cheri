/**
 * Carousel dùng chung (Home hiện có đầy đủ; About có model nhưng CHƯA có logic).
 * Tách thành controller thuần TS → không phụ thuộc Angular, test dễ.
 * Autoplay: 1 timer duy nhất cho section đang chọn (thay vì quét mọi section).
 */
import { CarouselConfig, CarouselSlideItem, CmsSection } from './cms.models';

export function defaultCarouselConfig(): CarouselConfig {
  return { autoplay: true, autoplayInterval: 4, showDots: true, showArrows: true, loop: true };
}

export class CarouselController {
  private activeIndex = new Map<string, number>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly onTick: () => void) {}

  config(sec: CmsSection): CarouselConfig {
    return (sec.layout.carouselConfig ??= defaultCarouselConfig());
  }
  slides(sec: CmsSection | null): CarouselSlideItem[] {
    return sec?.media?.carouselSlides ?? [];
  }
  enabledSlides(sec: CmsSection | null): CarouselSlideItem[] {
    return this.slides(sec).filter((s) => s.enabled);
  }
  index(secId: string): number {
    return this.activeIndex.get(secId) ?? 0;
  }
  active(sec: CmsSection): CarouselSlideItem | null {
    const list = this.enabledSlides(sec);
    return list[Math.min(this.index(sec.id), list.length - 1)] ?? null;
  }

  go(sec: CmsSection, target: number): void {
    const n = this.enabledSlides(sec).length;
    if (!n) return;
    const loop = this.config(sec).loop;
    const next = loop ? (target + n) % n : Math.max(0, Math.min(n - 1, target));
    this.activeIndex.set(sec.id, next);
    this.onTick();
  }
  next(sec: CmsSection) { this.go(sec, this.index(sec.id) + 1); }
  prev(sec: CmsSection) { this.go(sec, this.index(sec.id) - 1); }

  // ── Vuốt cảm ứng ──
  private touchStartX = 0;
  touchStart(e: TouchEvent) { this.touchStartX = e.changedTouches[0].clientX; }
  touchEnd(sec: CmsSection, e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? this.next(sec) : this.prev(sec);
  }

  // ── Chỉnh sửa danh sách slide ──
  add(sec: CmsSection, partial: Partial<CarouselSlideItem> = {}): CarouselSlideItem {
    const slide: CarouselSlideItem = {
      id: `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      url: '', enabled: true, ...partial,
    };
    (sec.media.carouselSlides ??= []).push(slide);
    return slide;
  }
  remove(sec: CmsSection, i: number) { sec.media.carouselSlides?.splice(i, 1); this.clamp(sec); }
  move(sec: CmsSection, from: number, to: number) {
    const arr = sec.media.carouselSlides;
    if (!arr || to < 0 || to >= arr.length) return;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
  }
  private clamp(sec: CmsSection) {
    const n = this.enabledSlides(sec).length;
    if (this.index(sec.id) >= n) this.activeIndex.set(sec.id, Math.max(0, n - 1));
  }

  // ── Autoplay ──
  start(sec: CmsSection | null): void {
    this.stop();
    if (!sec) return;
    const cfg = sec.layout.carouselConfig;
    if (!cfg?.autoplay || this.enabledSlides(sec).length < 2) return;
    this.timer = setInterval(() => this.next(sec), Math.max(1, cfg.autoplayInterval) * 1000);
  }
  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
