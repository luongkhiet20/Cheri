import { MatSnackBar } from '@angular/material/snack-bar';
import { map, distinctUntilChanged, filter, take, skip } from 'rxjs/operators';
import { Component, ChangeDetectionStrategy, OnDestroy, Signal, computed, effect, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, Subscription } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

import { TranslateService } from '../../../services/translate.service';
import { sortOptions } from '../../../shared/constants';
import { Product, Category, Pagination, Cart } from '../../../shared/models';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';

@Component({
    selector: 'app-products',
    templateUrl: './products.component.html',
    styleUrls: ['./products.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class ProductsComponent implements OnDestroy {
  products: Signal<Product[]>;
  cartIds: Signal<{ [productID: string]: number }>;
  loadingProducts: Signal<boolean>;
  categories: Signal<Category[]>;
  subCategories: Signal<Category[]>;
  pagination: Signal<Pagination>;
  category: Signal<string>;
  categoryInfo: Signal<Category>;
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

  // ── New filter signals ──
  filterMinPrice = signal<number>(0);
  filterStock = signal<string>('all');
  filterRating = signal<any>(0);
  selectedCategories = signal<string[]>([]);
  selectedRatings = signal<number[]>([]);
  sidebarOpened = false;
  columnsView = signal<number>(4);
  wishlistIds = signal<string[]>([]);
  private _storageListener?: (e: StorageEvent) => void;

  // ── Computed active filters count ──
  activeFiltersCount = computed(() => {
    let count = 0;
    if (this.filterPrice() && this.filterPrice() < (this.maxPrice() || Infinity)) count++;
    if (this.filterMinPrice() > 0) count++;
    if (this.filterStock() !== 'all') count++;
    if (this.selectedRatings().length > 0) {
      count += this.selectedRatings().length;
    } else if (this.filterRating() && String(this.filterRating()) !== '0') {
      count += String(this.filterRating()).split(',').length;
    }
    if (this.selectedCategories().length > 0) {
      count += this.selectedCategories().length;
    }
    return count;
  });

  setColumns(cols: number): void {
    this.columnsView.set(cols);
  }

  hasDiscount(product: any): boolean {
    if (!product) return false;
    if (product.onSale) return true;
    const sale = Number(product.salePrice);
    const regular = Number(product.regularPrice);
    return sale > 0 && regular > 0 && sale < regular;
  }

  getDisplayPrice(product: any): number {
    if (!product) return 0;
    if (this.hasDiscount(product)) {
      const sale = Number(product.salePrice);
      const regular = Number(product.regularPrice);
      if (sale > 0 && regular > 0) {
        return Math.min(sale, regular);
      }
      return sale || regular || 0;
    }
    return Number(product.salePrice) || Number(product.regularPrice) || 0;
  }

  getOriginalPrice(product: any): number {
    if (!product) return 0;
    const sale = Number(product.salePrice);
    const regular = Number(product.regularPrice);
    if (sale > 0 && regular > 0) {
      if (sale === regular) return regular;
      return Math.max(sale, regular);
    }
    return regular || sale || 0;
  }

  isInWishlist(id: string): boolean {
    return !!id && this.wishlistIds().includes(id);
  }

  toggleWishlist(event: MouseEvent, product: any): void {
    event.stopPropagation();
    const id: string = product._id || product.id;
    if (!id) return;
    const current = this.wishlistIds();
    const isIn = current.includes(id);
    const next = isIn ? current.filter(x => x !== id) : [...current, id];
    this.wishlistIds.set(next);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cheri_wishlist', JSON.stringify(next));
      localStorage.setItem('wishlist', JSON.stringify(next));

      try {
        const savedItemsStr = localStorage.getItem('cheri_wishlist_items');
        let savedItems: any[] = savedItemsStr ? JSON.parse(savedItemsStr) : [];
        if (!Array.isArray(savedItems)) savedItems = [];

        if (isIn) {
          savedItems = savedItems.filter(item => (item._id || item.id) !== id);
        } else {
          const itemToSave = {
            _id: id,
            id: id,
            title: product.title || product.name || '',
            name: product.title || product.name || '',
            titleUrl: product.titleUrl || id,
            mainImage: product.mainImage,
            images: product.images || [],
            image: product.mainImage?.url || (product.images && product.images[0]) || '',
            price: product.salePrice ?? product.regularPrice ?? product.price ?? 0,
            salePrice: product.salePrice,
            regularPrice: product.regularPrice,
            stock: product.stock,
            onSale: product.onSale,
            tags: product.tags || [],
            categoryName: (product.tags && product.tags[0]) || 'Thiết Kế'
          };
          savedItems = [itemToSave, ...savedItems.filter(item => (item._id || item.id) !== id)];
        }
        localStorage.setItem('cheri_wishlist_items', JSON.stringify(savedItems));
      } catch (e) {
        console.error('Error saving wishlist items', e);
      }
    }

    const msg = isIn ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích ♡';
    const action = isIn ? 'Đóng' : 'Xem yêu thích';
    const snackBarRef = this.snackBar.open(msg, action, {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });

    if (!isIn) {
      snackBarRef.onAction().pipe(take(1)).subscribe(() => {
        this.router.navigate(['/' + (this.lang() || 'vi') + '/wishlist']);
      });
    }
  }

  private _loadWishlist(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('cheri_wishlist') || localStorage.getItem('wishlist');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.wishlistIds.set(parsed);
            return;
          }
        }
        const savedItems = localStorage.getItem('cheri_wishlist_items');
        if (savedItems) {
          const parsedItems = JSON.parse(savedItems);
          if (Array.isArray(parsedItems)) {
            const ids = parsedItems.map((p: any) => p._id || p.id).filter(Boolean);
            this.wishlistIds.set(ids);
          }
        }
      } catch { }
    }
  }

  readonly component = 'productsComponent';

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private meta: Meta,
    private title: Title,
    private translate: TranslateService
  ) {
    this.category = toSignal(this.route.params.pipe(
      map((params) => params['category'])
    ));
    this.route.params.subscribe((params) => {
      const cat = params['category'];
      if (cat && cat !== 'all') {
        this.selectedCategories.set([cat]);
      } else {
        this.selectedCategories.set([]);
      }
    });
    this.page = toSignal(this.route.queryParams.pipe(
      map((params) => parseFloat(params['page']))
    ));
    this.sortBy = toSignal(this.route.queryParams.pipe(
      map((params) => params['sort'])
    ));
    this.lang = toSignal(this.translate.getLang$().pipe(filter((lang: string) => !!lang)));

    this.maxPrice = this.selectors.maxPrice;
    this.minPrice = this.selectors.minPrice;
    this.filterPrice = this.selectors.priceFilter;
    this.loadingProducts = this.selectors.loadingProducts;
    this.products = this.selectors.products;
    this.cartIds = computed(() => {
      const cart = this.selectors.cart();
      if (!cart) {
        return {};
      }
      return cart.items && cart.items.length ? cart.items.reduce((prev, curr) => ({ ...prev, [curr.id]: curr.qty }), {}) : {}
     }
    );

    this.title.setTitle('Cheri — Cửa hàng');
    this.meta.updateTag({ name: 'description', content: 'Khám phá bộ sưu tập thời trang Cheri — lọc theo danh mục, giá, tình trạng hàng và đánh giá.' });

    this.categories = this.selectors.categories;
    this.pagination = this.selectors.pagination;
    this.currency = this.selectors.currency;
    this.categoryInfo = computed(() => this.categories().find(cat => cat.titleUrl === this.category()));
    this.subCategories = computed(() => this.categories().filter((cat) => this.categoryInfo() ? this.categoryInfo().subCategories.includes(cat.titleUrl) : false));

    this._loadCategories();
    this._loadProducts();
    this._loadWishlist();

    if (isPlatformBrowser(this.platformId)) {
      this._storageListener = (e: StorageEvent) => {
        if (e.key === 'cheri_wishlist' || e.key === 'wishlist' || e.key === 'cheri_wishlist_items') {
          this._loadWishlist();
        }
      };
      window.addEventListener('storage', this._storageListener);
    }
  }

  addToCart(id: string): void {
    this.store.addToCart('?id=' + id);

    this.translate.getTranslations$()
      .pipe(map(translations => translations
        ? {message: translations['ADDED_TO_CART'] || 'Added to cart', action: translations['TO_CART'] || 'To Cart'}
        : {message: 'Added to cart', action: 'To Cart'}
        ),take(1))
      .subscribe(({message, action}) => {
        let snackBarRef = this.snackBar.open(message, action, {duration: 3000});
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

  priceRange(price: number): void {
    if (this.filterPrice() !== price) {
      this.store.filterPrice(price);
    }
  }

  changeMinPrice(price: number): void {
    this.filterMinPrice.set(price || 0);
  }

  changeCategory(cats?: any): void {
    let arr: string[] = [];
    if (Array.isArray(cats)) {
      arr = cats;
    } else if (typeof cats === 'string' && cats.trim().length > 0 && cats !== 'all') {
      arr = cats.split(',').map((c: string) => c.trim()).filter(Boolean);
    }
    this.selectedCategories.set(arr);
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

  changeStock(stock: string): void {
    this.filterStock.set(stock);
  }

  changeRating(rating: any): void {
    let nums: number[] = [];
    if (Array.isArray(rating)) {
      nums = rating.map(r => Number(r)).filter(r => !isNaN(r) && r > 0);
    } else if (typeof rating === 'string' && rating.length > 0 && rating !== '0') {
      nums = rating.split(',').map(r => Number(r)).filter(r => !isNaN(r) && r > 0);
    } else if (typeof rating === 'number' && rating > 0) {
      nums = [rating];
    }
    this.selectedRatings.set(nums);
    this.filterRating.set(nums.length > 0 ? nums.join(',') : 0);
    this.store.updatePosition({ productsComponent: 0 });
  }

  getCategoryTitle(catUrl: string): string {
    const found = (this.categories() || []).find(c => c.titleUrl === catUrl);
    return found ? found.title : catUrl;
  }

  removeCategoryFilter(catUrl: string): void {
    const next = this.selectedCategories().filter(c => c !== catUrl);
    this.selectedCategories.set(next);
    if (this.category()) {
      this.router.navigate(['/' + this.lang() + '/product/all'], {
        queryParams: { sort: this.sortBy() || 'newest', page: 1 },
      });
    }
    this.store.updatePosition({ productsComponent: 0 });
  }

  removeRatingFilter(stars: number): void {
    const next = this.selectedRatings().filter(r => r !== stars);
    this.selectedRatings.set(next);
    this.filterRating.set(next.length > 0 ? next.join(',') : 0);
    this.store.updatePosition({ productsComponent: 0 });
  }

  clearAllFilters(): void {
    this.filterMinPrice.set(0);
    this.filterStock.set('all');
    this.filterRating.set(0);
    this.selectedCategories.set([]);
    this.selectedRatings.set([]);
    this.store.filterPrice(0);
    this.router.navigate(['/' + this.lang() + '/product/all'], {
      queryParams: { sort: 'newest', page: 1 }
    });
    this.store.updatePosition({ productsComponent: 0 });
  }

  toggleSidebar() {
    this.sidebarOpened = !this.sidebarOpened;
  }

  ngOnDestroy(): void {
    this.categoriesSub.unsubscribe();
    this.productsSub.unsubscribe();
    if (this._storageListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('storage', this._storageListener);
    }
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
      toObservable(this.selectedCategories).pipe(
        distinctUntilChanged((a, b) => a.slice().sort().join(',') === b.slice().sort().join(','))
      ),
      toObservable(this.filterPrice).pipe(distinctUntilChanged()),
      toObservable(this.filterMinPrice).pipe(distinctUntilChanged()),
      toObservable(this.filterStock).pipe(distinctUntilChanged()),
      toObservable(this.selectedRatings).pipe(
        distinctUntilChanged((a, b) => a.slice().sort().join(',') === b.slice().sort().join(','))
      ),
      this.route.queryParams.pipe(
        map((params) => ({ page: params['page'], sort: params['sort'] })),
        distinctUntilChanged((a, b) => a.page === b.page && a.sort === b.sort)
      ),
    ]).subscribe(([lang, selectedCategories, filterPrice, minPrice, stock, selectedRatings, { page, sort }]) => {
      const catParam = selectedCategories.length > 0
        ? selectedCategories.join(',')
        : undefined;
      const ratParam = selectedRatings.length > 0
        ? selectedRatings.join(',')
        : undefined;

      this.store.getProducts({
        lang,
        category: catParam,
        maxPrice: filterPrice || undefined,
        minPrice: minPrice || undefined,
        stock: stock !== 'all' ? stock : undefined,
        rating: ratParam,
        page: page || 1,
        sort: sort || 'newest',
      });
    });
  }
}
