import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { map, distinctUntilChanged, filter, take, skip, withLatestFrom, delay } from 'rxjs/operators';
import { Component, ChangeDetectionStrategy, OnDestroy, Signal, computed, AfterViewInit, ViewChild, ElementRef, Inject, DOCUMENT, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, Subscription, of } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

import { MatSnackBar, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TranslateService } from '../../../../services/translate.service';
import { ApiService } from '../../../../services/api.service';
import { sortOptions } from '../../../shared/constants';

import { Product, Category, Pagination, Cart } from '../../../shared/models';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ThemeService } from '../../../../services/theme.service';
import { WishlistButtonComponent } from '../../../shared/wishlist-button/wishlist-button.component';
import {
  HomeSection,
  CarouselSlideItem,
  CarouselConfig,
  TypographyElementKey,
} from '../../../../admin/pages/pages/home/home-cms.models';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  imports: [
    CommonModule,
    SlicePipe,
    MatSidenavModule,
    SidebarComponent,
    RouterLink,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    WishlistButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  // ── State Dynamic Sections từ CMS (Giai đoạn 3) ──────────────────
  dynamicSections: HomeSection[] = [];
  hasDynamicConfig = false;
  isLoadingHomeConfig = true;
  homeConfigError = false;

  // Quản lý Carousel đa section
  activeSlideIndices: { [sectionId: string]: number } = {};
  private carouselTimers: { [sectionId: string]: any } = {};
  private touchStartX = 0;
  private touchEndX = 0;

  // ── State Storefront Cũ ──────────────────────────────────────────
  products: Signal<Product[]>;
  cartIds: Signal<{ [productID: string]: number }>;
  cart: Signal<Cart>;
  loadingProducts: Signal<boolean>;
  categories: Signal<Category[]>;
  pagination: Signal<Pagination>;
  category: Signal<string>;
  filterPrice: Signal<number>;
  maxPrice: Signal<number>;
  minPrice: Signal<number>;
  page: Signal<number>;
  sortBy: Signal<string>;
  currency: Signal<string>;
  lang: Signal<string>;
  categoriesSub: Subscription;
  productsSub: Subscription;
  sortOptions = sortOptions;
  sidebarOpened = false;
  video = null;

  readonly component = 'homeComponent';

  @ViewChild('videoRef') private videoRef: ElementRef;
  @ViewChild('featuredLane') private featuredLane: ElementRef<HTMLElement>;
  @ViewChild('museSection') private museSection?: ElementRef<HTMLElement>;
  private museObserver?: IntersectionObserver;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private meta: Meta,
    private title: Title,
    private translate: TranslateService,
    private snackBar: MatSnackBar,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private themeService: ThemeService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(DOCUMENT)
    private _document: Document,
    @Inject(PLATFORM_ID)
    private platformId: Object,
  ) {
    this.category = toSignal(this.route.params.pipe(
      map((params) => params['category']),
    ));
    this.page = toSignal(this.route.queryParams.pipe(
      map((params) => params['page']),
      map((page) => parseFloat(page))
    ));
    this.sortBy = toSignal(this.route.queryParams.pipe(
      map((params) => params['sort'])
    ));
    this.lang = toSignal(this.translate.getLang$().pipe(filter((lang: string) => !!lang)), { initialValue: 'vi' });
    this.cart = this.selectors.cart;
    this.maxPrice = this.selectors.maxPrice;
    this.minPrice = this.selectors.minPrice;
    this.filterPrice = this.selectors.priceFilter;
    this.loadingProducts = this.selectors.loadingProducts;
    this.products = this.selectors.products;
    this.cartIds = computed(() => {
      if (!this.cart()) {
        return {};
      }
      return this.cart().items && this.cart().items.length ? this.cart().items.reduce((prev, curr) => ({ ...prev, [curr.id]: curr.qty }), {}) : {}
    }
    );

    this.title.setTitle('Cheri');
    this.meta.updateTag({ name: 'description', content: 'Angular - Node.js - Cheri application - MEAN Cheri with dashboard' });

    this.categories = this.selectors.categories;
    this.pagination = this.selectors.pagination;
    this.currency = this.selectors.currency;
    this.video = this.themeService.video;

    this._loadCategories();
    this._loadProducts();
    this._loadPublishedHomeConfig();
  }

  isOutOfStock(product: any): boolean {
    if (!product) return false;
    const q = product.quantity;
    if (q !== undefined && q !== null && Number(q) <= 0) return true;
    const s = product.stock;
    return s === '0' || s === 'out' || s === 'outOfStock' || s === 'unavailable';
  }

  addToCart(id: string): void {
    const p = (this.products() || []).find((item: any) => (item._id || item.id) === id);
    if (p && (this.isOutOfStock(p) || p.visibility === false)) {
      this.snackBar.open('Sản phẩm hiện đã hết hàng', 'Đóng', { duration: 3000 });
      return;
    }
    this.store.addToCart('?id=' + id);

    this.translate.getTranslations$()
      .pipe(map(translations => translations
        ? { message: translations['ADDED_TO_CART'] || 'Added to cart', action: translations['TO_CART'] || 'To Cart' }
        : { message: 'Added to cart', action: 'To Cart' }
      ), take(1))
      .subscribe(({ message, action }) => {
        let snackBarRef = this.snackBar.open(message, action, { duration: 3000 });
        snackBarRef.onAction().pipe(
          take(1))
          .subscribe(() => {
            this.router.navigate(['/' + this.lang() + '/cart'])
          });
      });
  }

  removeFromCart(id: string): void {
    this.store.removeFromCart('?id=' + id);
  }

  goToCart(): void {
    const lang = this.lang() || 'vi';
    this.router.navigate(['/' + lang + '/cart']);
  }

  goToProducts(): void {
    const lang = this.lang() || 'vi';
    this.router.navigate(['/' + lang + '/product/all']);
  }

  onOpenQuickView(product: any): void {
    const slug = product?.titleUrl || product?._id || product?.id;
    if (slug) {
      const lang = this.lang() || 'vi';
      this.router.navigate(['/' + lang + '/product/' + slug]);
    }
  }

  priceRange(price: number): void {
    if (this.filterPrice() !== price) {
      this.store.filterPrice(price);
    }
  }

  changeCategory(): void {
    this.store.updatePosition({ productsComponent: 0 });
  }

  changePage(page: number): void {
    if (this.category()) {
      this.router.navigate(['/' + this.lang() + '/product/category/' + this.category()], {
        queryParams: { sort: this.sortBy() || 'newest', page: page || 1 },
      });
    } else {
      this.router.navigate(['/' + this.lang() + '/product/all'], {
        queryParams: { sort: this.sortBy() || 'newest', page: page || 1 },
      });
    }
    this.store.updatePosition({ productsComponent: 0 });
  }

  changeSort(sort: string): void {
    if (this.category()) {
      this.router.navigate(['/' + this.lang() + '/product/category/' + this.category()], {
        queryParams: { sort, page: this.page() || 1 },
      });
    } else {
      this.router.navigate(['/' + this.lang() + '/product/all'], { queryParams: { sort, page: this.page() || 1 } });
    }
    this.store.updatePosition({ productsComponent: 0 });
  }

  toggleSidebar() {
    this.sidebarOpened = !this.sidebarOpened;
  }

  scrollLane(direction: -1 | 1): void {
    const el = this.featuredLane?.nativeElement;
    if (el) {
      el.scrollBy({ left: direction * 300, behavior: 'smooth' });
    }
  }

  ngAfterViewInit() {
    of('delay').pipe(
      delay(100),
      take(1),
    ).subscribe(() => {
      const vid = this.videoRef?.nativeElement as HTMLVideoElement;
      if (vid) {
        vid.muted = true; // required in most browsers
        vid.play().catch(err => console.log('Autoplay blocked', err));
      }
      this._document.getElementById('navbar')?.classList?.add("transparent");
      this._document.getElementById('main-content')?.classList?.add("transparent");

      // Scroll reveal observer for Section 4 (Nàng Thơ)
      if (typeof window !== 'undefined' && 'IntersectionObserver' in window && this.museSection?.nativeElement) {
        this.museObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.museSection?.nativeElement.classList.add('is-visible');
            }
          });
        }, {
          threshold: 0.12,
          rootMargin: '0px 0px -40px 0px'
        });
        this.museObserver.observe(this.museSection.nativeElement);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.museObserver) {
      this.museObserver.disconnect();
    }
    this.stopAllCarouselAutoplays();
    this.categoriesSub?.unsubscribe();
    this.productsSub?.unsubscribe();
    this._document.getElementById('navbar')?.classList?.remove("transparent");
    this._document.getElementById('main-content')?.classList?.remove("transparent");
  }

  // ── 1. Tải Cấu Hình Trang Chủ Đã Xuất Bản (Public API) ─────────────
  private _loadPublishedHomeConfig(): void {
    this.isLoadingHomeConfig = true;
    this.homeConfigError = false;

    this.apiService.getHomePublished().subscribe({
      next: (res: any) => {
        this.isLoadingHomeConfig = false;
        if (res && res.error) {
          this.homeConfigError = true;
          this.hasDynamicConfig = false;
          this.cdr.markForCheck();
          return;
        }

        const sections = res?.data?.sections || res?.sections;
        if (Array.isArray(sections) && sections.length > 0) {
          this.dynamicSections = sections
            .filter((s: HomeSection) => s && s.enabled !== false)
            .sort((a: HomeSection, b: HomeSection) => (a.order ?? 0) - (b.order ?? 0));
          this.hasDynamicConfig = this.dynamicSections.length > 0;

          if (this.hasDynamicConfig) {
            this.initDynamicCarousels();
          }
        } else {
          // Chưa có bản xuất bản trên máy chủ -> fallback an toàn
          this.hasDynamicConfig = false;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingHomeConfig = false;
        this.homeConfigError = true;
        this.hasDynamicConfig = false;
        this.cdr.markForCheck();
      },
    });
  }

  // ── 2. Quản Lý Carousel Tự Động & Chuyển Slide ────────────────────
  private initDynamicCarousels(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.dynamicSections.forEach((sec) => {
      if (sec.layout?.variant === 'carousel') {
        this.activeSlideIndices[sec.id] = 0;
        const cfg = sec.layout.carouselConfig;
        if (cfg?.autoplay) {
          this.startCarouselAutoplay(sec);
        }
      }
    });
  }

  getCarouselSlides(section: HomeSection | null): CarouselSlideItem[] {
    if (!section?.media?.carouselSlides) return [];
    return section.media.carouselSlides.filter((s) => s && s.enabled !== false && !!s.url && s.url.trim().length > 0);
  }

  getCarouselActiveIndex(sectionId: string): number {
    return this.activeSlideIndices[sectionId] || 0;
  }

  startCarouselAutoplay(section: HomeSection): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stopCarouselAutoplay(section.id);

    const intervalSec = section.layout?.carouselConfig?.autoplayInterval || 4;
    this.carouselTimers[section.id] = setInterval(() => {
      this.onNextSlide(section);
      this.cdr.markForCheck();
    }, Math.max(2, intervalSec) * 1000);
  }

  stopCarouselAutoplay(sectionId: string): void {
    if (this.carouselTimers[sectionId]) {
      clearInterval(this.carouselTimers[sectionId]);
      delete this.carouselTimers[sectionId];
    }
  }

  private stopAllCarouselAutoplays(): void {
    Object.keys(this.carouselTimers).forEach((id) => {
      clearInterval(this.carouselTimers[id]);
    });
    this.carouselTimers = {};
  }

  onNextSlide(section: HomeSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const slides = this.getCarouselSlides(section);
    if (slides.length <= 1) return;
    const current = this.getCarouselActiveIndex(section.id);
    const loop = section.layout?.carouselConfig?.loop !== false;

    if (current < slides.length - 1) {
      this.activeSlideIndices[section.id] = current + 1;
    } else if (loop) {
      this.activeSlideIndices[section.id] = 0;
    }
    this.cdr.markForCheck();
  }

  onPrevSlide(section: HomeSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const slides = this.getCarouselSlides(section);
    if (slides.length <= 1) return;
    const current = this.getCarouselActiveIndex(section.id);
    const loop = section.layout?.carouselConfig?.loop !== false;

    if (current > 0) {
      this.activeSlideIndices[section.id] = current - 1;
    } else if (loop) {
      this.activeSlideIndices[section.id] = slides.length - 1;
    }
    this.cdr.markForCheck();
  }

  onGoToSlide(section: HomeSection, index: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.activeSlideIndices[section.id] = index;
    this.cdr.markForCheck();
  }

  // Vuốt chạm trên Mobile
  onTouchStart(event: TouchEvent): void {
    if (event.changedTouches && event.changedTouches.length > 0) {
      this.touchStartX = event.changedTouches[0].screenX;
    }
  }

  onTouchEnd(section: HomeSection, event: TouchEvent): void {
    if (event.changedTouches && event.changedTouches.length > 0) {
      this.touchEndX = event.changedTouches[0].screenX;
      const diff = this.touchStartX - this.touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          this.onNextSlide(section);
        } else {
          this.onPrevSlide(section);
        }
      }
    }
  }

  // ── 3. Lọc Danh Sách Sản Phẩm Theo Cấu Hình CMS ─────────────────
  getFilteredProducts(section: HomeSection): Product[] {
    const all = this.products() || [];
    if (!all.length) return [];
    const source = section.settings?.source || 'featured';
    const limit = section.settings?.limit || 10;

    let filtered = [...all];
    if (source === 'sale') {
      const saleItems = filtered.filter((p) => p.onSale && p.salePrice);
      filtered = saleItems.length > 0 ? saleItems : filtered;
    } else if (source === 'latest') {
      // Giữ nguyên thứ tự sản phẩm mới
    } else if (source === 'manual' && section.settings?.manualProductIds?.length) {
      const ids = section.settings.manualProductIds;
      const manualItems = filtered.filter((p) => ids.includes(p._id || (p as any).id));
      if (manualItems.length > 0) {
        filtered = manualItems;
      }
    }

    return filtered.slice(0, limit);
  }

  // ── 4. Style Typography & Layout Theo Cấu Hình CMS ───────────────
  getTypographyStyle(
    section: HomeSection | null | undefined,
    element: TypographyElementKey,
  ): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};

    // A. Thuộc tính Typography
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

    // B. Thuộc tính Màu sắc (Colors)
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

  getSectionContainerStyle(section: HomeSection | null | undefined): Record<string, string> {
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

  getBannerStyle(section: HomeSection): Record<string, string> {
    const containerStyle = this.getSectionContainerStyle(section);
    const style: Record<string, string> = { ...containerStyle };
    if (section.settings?.textColor) {
      style['color'] = section.settings.textColor;
    }
    if (section.layout?.minHeight) {
      style['min-height'] = section.layout.minHeight;
    }
    return style;
  }

  private _loadCategories(): void {
    if (!this.categories()?.length) {
      this.store.getCategories(this.lang());
    }

    this.categoriesSub = toObservable(this.lang).pipe(distinctUntilChanged(), skip(1)).subscribe((lang: string) => {
      this.store.getCategories(lang);
    });
  }

  private _loadProducts(): void {
    this.productsSub = combineLatest([
      toObservable(this.lang).pipe(distinctUntilChanged()),
      toObservable(this.category).pipe(distinctUntilChanged()),
      toObservable(this.filterPrice).pipe(distinctUntilChanged()),
      this.route.queryParams.pipe(
        map((params) => ({ page: params['page'], sort: params['sort'] })),
        distinctUntilChanged()
      ),
    ]).subscribe(([lang, category, filterPrice, { page, sort }]) => {
      this.store.getProducts({ lang, category, maxPrice: filterPrice, page: page || 1, sort: sort || 'newest' });
    });
  }
}
