import {
  Component,
  Input,
  OnInit,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  SimpleChanges,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  HostListener,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Product } from '../../../../shared/models';
import { ApiService } from '../../../../../services/api.service';
import { SignalStore } from '../../../../../store/signal.store';
import { WishlistButtonComponent } from '../../../../shared/wishlist-button/wishlist-button.component';
import { ProductRatingComponent } from '../../../../shared/product-rating/product-rating.component';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { formatVND } from '../../../../../pipes/price.pipe';

@Component({
  selector: 'app-product-recommendations',
  standalone: true,
  imports: [CommonModule, RouterModule, WishlistButtonComponent, ProductRatingComponent],
  templateUrl: './product-recommendations.html',
  styleUrl: './product-recommendations.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductRecommendationsComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private lastLoadedProductId: string | null = null;
  private lastLoadedInputId: string | null = null;
  @Input() productId: string = '';
  @Input() lang: string = 'vi';
  @Input() currency: string = 'đ';
  @Input() cartIds: { [productId: string]: number } = {};
  @Input() limit: number = 10;

  @ViewChild('carouselTrack', { static: false }) carouselTrack?: ElementRef<HTMLElement>;

  recommendedProducts: Product[] = [];
  recommendationStrategy: string = '';
  recommendationContextId: string = '';
  modelUsed: string = '';
  isMachineLearning: boolean = false;
  isLoading: boolean = false;
  hasError: boolean = false;

  canScrollLeft: boolean = false;
  canScrollRight: boolean = false;
  hasScrollableContent: boolean = false;

  private generateContextId(): string {
    const rand = Math.random().toString(36).substring(2, 10);
    return `ctx_${Date.now()}_${rand}`;
  }

  private recSubscription: Subscription | null = null;
  private currentRequestId: number = 0;
  private resizeObserver?: ResizeObserver;
  private impressionObserver?: IntersectionObserver;
  private isBrowser: boolean;

  // Deduplication set & batch buffer for viewport impressions (prevents duplicate logging on re-render/change detection)
  private recordedImpressionKeys: Set<string> = new Set<string>();
  private pendingImpressionIds: Set<string> = new Set<string>();
  private impressionFlushTimer: any = null;

  // Hỗ trợ kéo vuốt chuột trên desktop mà không làm ảnh hưởng click sản phẩm
  private isMouseDown: boolean = false;
  private startX: number = 0;
  private scrollLeftStart: number = 0;
  private hasDragged: boolean = false;
  private dragThreshold: number = 6;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private store: SignalStore,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    if (this.productId) {
      this.loadRecommendations();
    }
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();
    this.setupImpressionObserver();
    this.updateScrollState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && !changes['productId'].isFirstChange()) {
      const prev = changes['productId'].previousValue;
      const curr = changes['productId'].currentValue;
      if (prev !== curr && curr) {
        this.loadRecommendations();
      }
    } else if (changes['lang'] && !changes['lang'].isFirstChange()) {
      if (this.productId) {
        this.loadRecommendations();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.recSubscription) {
      this.recSubscription.unsubscribe();
      this.recSubscription = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (this.impressionObserver) {
      this.impressionObserver.disconnect();
      this.impressionObserver = undefined;
    }
    if (this.impressionFlushTimer) {
      clearTimeout(this.impressionFlushTimer);
      this.impressionFlushTimer = null;
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateScrollState();
  }

  private setupResizeObserver(): void {
    if (!this.isBrowser || typeof ResizeObserver === 'undefined') return;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.carouselTrack?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateScrollState();
      });
      this.resizeObserver.observe(this.carouselTrack.nativeElement);
    }
  }

  /**
   * Observes recommendation product cards inside the carousel viewport.
   * Records an impression only when at least 50% of a card is actually visible,
   * and strictly deduplicates per (currentProductId, recommendedProductId) load cycle.
   */
  private setupImpressionObserver(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') return;
    if (this.impressionObserver) {
      this.impressionObserver.disconnect();
    }
    const trackEl = this.carouselTrack?.nativeElement;
    if (!trackEl) return;

    this.impressionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const target = entry.target as HTMLElement;
            const pid = target.getAttribute('data-product-id');
            if (pid) {
              this.queueImpression(pid);
            }
          }
        }
      },
      {
        root: null,
        threshold: 0.5,
      }
    );

    const cards = trackEl.querySelectorAll('.pcard[data-product-id]');
    cards.forEach((card) => this.impressionObserver?.observe(card));
  }

  private queueImpression(recommendedProductId: string): void {
    const cleanRecId = String(recommendedProductId || '').trim();
    if (!cleanRecId) return;

    const activeCtx = this.recommendationContextId || 'ctx_default';
    const contextKey = `${activeCtx}:${cleanRecId}`;
    if (this.recordedImpressionKeys.has(contextKey)) {
      return;
    }

    this.recordedImpressionKeys.add(contextKey);
    this.pendingImpressionIds.add(cleanRecId);

    if (this.impressionFlushTimer) {
      clearTimeout(this.impressionFlushTimer);
    }

    this.impressionFlushTimer = setTimeout(() => {
      this.flushPendingImpressions();
    }, 350);
  }

  private flushPendingImpressions(): void {
    this.impressionFlushTimer = null;
    if (this.pendingImpressionIds.size === 0) return;

    const batchIds = Array.from(this.pendingImpressionIds);
    this.pendingImpressionIds.clear();
    const activeContextId = this.recommendationContextId;

    this.apiService
      .recordRecommendationImpressions({
        productIds: batchIds,
        currentProductId: this.productId || undefined,
        strategy: this.recommendationStrategy || undefined,
        recommendationContextId: activeContextId || undefined,
      })
      .subscribe();
  }

  updateScrollState(): void {
    if (!this.carouselTrack) {
      this.canScrollLeft = false;
      this.canScrollRight = false;
      this.hasScrollableContent = false;
      this.cdr.markForCheck();
      return;
    }

    const el = this.carouselTrack.nativeElement;
    const tolerance = 4;
    const maxScrollLeft = el.scrollWidth - el.clientWidth;

    this.hasScrollableContent = maxScrollLeft > tolerance;
    this.canScrollLeft = el.scrollLeft > tolerance;
    this.canScrollRight = el.scrollLeft < maxScrollLeft - tolerance;
    this.cdr.markForCheck();
  }

  onScroll(): void {
    this.updateScrollState();
  }

  scrollNext(): void {
    if (!this.carouselTrack) return;
    const el = this.carouselTrack.nativeElement;
    const card = el.querySelector('.pcard') as HTMLElement;
    const step = card ? (card.offsetWidth + 24) : (el.clientWidth * 0.75);
    el.scrollBy({ left: step, behavior: 'smooth' });
    setTimeout(() => this.updateScrollState(), 350);
  }

  scrollPrev(): void {
    if (!this.carouselTrack) return;
    const el = this.carouselTrack.nativeElement;
    const card = el.querySelector('.pcard') as HTMLElement;
    const step = card ? (card.offsetWidth + 24) : (el.clientWidth * 0.75);
    el.scrollBy({ left: -step, behavior: 'smooth' });
    setTimeout(() => this.updateScrollState(), 350);
  }

  // Xử lý kéo bằng chuột trên Desktop
  onMouseDown(e: MouseEvent): void {
    if (!this.carouselTrack) return;
    this.isMouseDown = true;
    this.hasDragged = false;
    this.startX = e.pageX - this.carouselTrack.nativeElement.offsetLeft;
    this.scrollLeftStart = this.carouselTrack.nativeElement.scrollLeft;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown || !this.carouselTrack) return;
    const x = e.pageX - this.carouselTrack.nativeElement.offsetLeft;
    const walk = x - this.startX;
    if (Math.abs(walk) > this.dragThreshold) {
      this.hasDragged = true;
      this.carouselTrack.nativeElement.scrollLeft = this.scrollLeftStart - walk;
    }
  }

  onMouseUp(): void {
    this.isMouseDown = false;
    setTimeout(() => {
      this.hasDragged = false;
    }, 120);
  }

  onMouseLeave(): void {
    this.isMouseDown = false;
  }

  loadRecommendations(): void {
    if (!this.productId) {
      this.recommendedProducts = [];
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    // 1. Tạo recommendationContextId mới cho mỗi lần chọn sản phẩm
    const newContextId = this.generateContextId();
    this.recommendationContextId = newContextId;

    // 2. Tăng currentRequestId để loại bỏ mọi response cũ đến muộn (race conditions)
    const requestId = ++this.currentRequestId;

    // 3. Hủy request API cũ nếu vẫn đang xử lý
    if (this.recSubscription) {
      this.recSubscription.unsubscribe();
      this.recSubscription = null;
    }

    // 4. Hủy bộ đếm và xóa impression đang chờ gửi của context cũ
    if (this.impressionFlushTimer) {
      clearTimeout(this.impressionFlushTimer);
      this.impressionFlushTimer = null;
    }
    this.pendingImpressionIds.clear();

    // 5. Reset bộ nhớ deduplication impression cho context mới
    this.recordedImpressionKeys.clear();

    // 6. Xóa danh sách đề xuất cũ khỏi giao diện trong khi tải danh sách mới
    this.recommendedProducts = [];
    this.isLoading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    // 7. Reset trạng thái cuộn carousel về đầu
    if (this.carouselTrack?.nativeElement) {
      this.carouselTrack.nativeElement.scrollLeft = 0;
    }

    const targetLimit = this.limit || 10;

    // 8. Gọi API đề xuất với productId và recommendationContextId mới
    this.recSubscription = this.apiService
      .getRecommendations({
        productId: this.productId,
        limit: targetLimit,
        lang: this.lang || 'vi',
        recommendationContextId: newContextId,
      })
      .subscribe({
        next: (res: any) => {
          // 9. Chỉ hiển thị kết quả thuộc request/context hiện tại
          if (requestId !== this.currentRequestId) return;

          this.isLoading = false;
          if (res?.error || res?.status === 'error') {
            this.hasError = true;
            this.recommendedProducts = [];
            this.recommendationStrategy = '';
            this.modelUsed = '';
            this.isMachineLearning = false;
          } else {
            this.recommendationStrategy = res?.strategy || '';
            this.modelUsed = res?.modelUsed || '';
            this.isMachineLearning = Boolean(res?.isMachineLearning);

            const rawList: any[] = Array.isArray(res?.products)
              ? res.products
              : (Array.isArray(res?.data) ? res.data : []);

            const currentPid = String(this.productId).trim().toLowerCase();
            const filteredList = rawList.filter((p: any) => {
              if (!p) return false;
              if (p.visibility === false) return false;
              const pId = p._id ? String(p._id).trim().toLowerCase() : '';
              const pAltId = p.id ? String(p.id).trim().toLowerCase() : '';
              const pSlug = p.titleUrl ? String(p.titleUrl).trim().toLowerCase() : '';
              return pId !== currentPid && pAltId !== currentPid && pSlug !== currentPid;
            });

            // Tiếp nhận trực tiếp thứ tự đã qua Diversity Re-ranking (6 Priority + 4 Exploration)
            // và Exposure Rotation từ Backend mà không random toàn bộ danh sách một cách độc lập
            this.recommendedProducts = filteredList.slice(0, targetLimit);
          }
          this.cdr.markForCheck();

          // Cập nhật trạng thái cuộn và gắn IntersectionObserver ghi nhận impression thực tế
          setTimeout(() => {
            this.setupResizeObserver();
            this.setupImpressionObserver();
            this.updateScrollState();
          }, 80);
        },
        error: () => {
          if (requestId !== this.currentRequestId) return;
          this.isLoading = false;
          this.hasError = true;
          this.recommendedProducts = [];
          this.cdr.markForCheck();
        }
      });
  }

  hasDiscount(product: any): boolean {
    if (!product) return false;
    if (product.onSale) return true;
    const sale = Number(product.salePrice);
    const regular = Number(product.regularPrice);
    return sale > 0 && regular > 0 && sale < regular;
  }

  isOutOfStock(product: any): boolean {
    if (!product) return false;
    const q = product.quantity;
    if (q !== undefined && q !== null && Number(q) <= 0) return true;
    const s = product.stock;
    return s === '0' || s === 'out' || s === 'outOfStock' || s === 'unavailable';
  }

  formatVND(price: any): string {
    return formatVND(price);
  }

  addToCart(product: any): void {
    const id = product?._id || product?.id;
    if (!id) return;
    if (this.isOutOfStock(product)) {
      this.notify.warning('✨Sản phẩm hiện đã hết hàng✨');
      return;
    }
    this.store.addToCart('?id=' + id);
    this.apiService.recordInteraction({
      productId: String(id),
      eventType: 'ADD_TO_CART',
    }).subscribe();
    this.notify.success('✨Đã thêm sản phẩm vào giỏ hàng✨');
  }

  onOpenQuickView(product: any): void {
    if (this.hasDragged) return;
    const validPid = product?._id || product?.id;
    if (validPid) {
      this.apiService.recordInteraction({
        productId: String(validPid),
        eventType: 'CLICK',
      }).subscribe();
    }
    const slug = product?.titleUrl || product?._id || product?.id;
    if (slug) {
      if (typeof document !== 'undefined') {
        const scrollWrap = document.querySelector('.main-scroll-wrap') as HTMLElement | null;
        if (scrollWrap) {
          scrollWrap.scrollTop = 0;
        }
      }
      this.router.navigate(['/' + (this.lang || 'vi') + '/product/' + slug]);
    }
  }
}

export { ProductRecommendationsComponent as ProductRecommendations };
