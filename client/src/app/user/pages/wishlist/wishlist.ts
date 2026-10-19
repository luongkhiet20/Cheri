import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ChangeDetectorRef, effect, Signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { NotificationService } from '../../shared/notification/notification.service';
import { ApiService } from '../../../services/api.service';
import { TranslateService } from '../../../services/translate.service';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { Product } from '../../shared/models';
import { WishlistService } from '../../../services/wishlist.service';
import { WishlistButtonComponent } from '../../shared/wishlist-button/wishlist-button.component';
import { formatVND } from '../../../pipes/price.pipe';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule, WishlistButtonComponent],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class Wishlist implements OnInit, OnDestroy {
  products: any[] = [];
  currentLang = 'vi';
  user: Signal<any>;
  private _storageListener?: (e: StorageEvent) => void;

  get wishlist(): string[] {
    return this.wishlistService.wishlistIds();
  }

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private apiService: ApiService,
    private translateService: TranslateService,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private router: Router,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef,
    private wishlistService: WishlistService
  ) {
    this.user = this.selectors.user;

    // Automatically trigger change detection when wishlist state changes
    effect(() => {
      this.wishlistService.wishlistIds();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.translateService.getLang$().subscribe((lang) => {
      if (lang) {
        this.currentLang = lang;
      }
    });

    this.loadWishlist();
    this.loadProducts();

    if (isPlatformBrowser(this.platformId)) {
      this._storageListener = (e: StorageEvent) => {
        if (e.key === 'cheri_wishlist' || e.key === 'wishlist' || e.key === 'cheri_wishlist_items') {
          this.loadWishlist();
          this.cdr.markForCheck();
        }
      };
      window.addEventListener('storage', this._storageListener);
    }
  }

  ngOnDestroy(): void {
    if (this._storageListener && isPlatformBrowser(this.platformId)) {
      window.removeEventListener('storage', this._storageListener);
    }
  }

  loadWishlist(): void {
    this.wishlistService.loadFromStorage();
    if (isPlatformBrowser(this.platformId)) {
      try {
        const savedItemsStr = localStorage.getItem('cheri_wishlist_items');
        if (savedItemsStr) {
          const parsed = JSON.parse(savedItemsStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.products = parsed.map((p) => this.normalizeProduct(p));
            // Keep wishlist IDs synced
            const itemIds = this.products.map((p) => p.id || p._id).filter(Boolean);
            if (this.wishlist.length === 0 && itemIds.length > 0) {
              this.wishlistService.setWishlistIds(itemIds);
            }
          }
        }
      } catch (e) { }
    }
  }

  saveWishlist(): void {
    if (isPlatformBrowser(this.platformId)) {
      const activeProducts = this.products.filter(
        (p) => this.wishlist.includes(p.id) || this.wishlist.includes(p._id)
      );
      this.wishlistService.setWishlist(this.wishlist, activeProducts);
    }
  }

  loadProducts(): void {
    this.apiService.getProducts({ lang: this.currentLang, page: 1, sort: 'newest' }).subscribe({
      next: (res: any) => {
        if (res && res.products && Array.isArray(res.products)) {
          const apiProducts = res.products.map((p: Product) => this.normalizeProduct(p));
          const existingIds = new Set(this.products.map((p) => p.id || p._id));
          const toAdd = apiProducts.filter(
            (p) => (this.wishlist.includes(p.id) || this.wishlist.includes(p._id)) && !existingIds.has(p.id || p._id)
          );
          if (toAdd.length > 0) {
            this.products = [...this.products, ...toAdd];
            this.saveWishlist();
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });
  }

  normalizeProduct(p: any): any {
    return {
      ...p,
      id: p._id || p.id,
      _id: p._id || p.id,
      name: p.title || p.name,
      title: p.title || p.name,
      titleUrl: p.titleUrl || p._id || p.id,
      image: p.mainImage?.url || (p.images && p.images[0]) || p.image || 'assets/images/placeholder.png',
      price: p.salePrice ?? p.regularPrice ?? p.price ?? 0,
      regularPrice: p.regularPrice,
      salePrice: p.salePrice,
      onSale: p.onSale,
      stock: p.stock,
      categoryName: (p.tags && p.tags[0]) || p.categoryName || 'Thiết Kế'
    };
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

  get wishlistProducts(): any[] {
    if (!this.wishlist || this.wishlist.length === 0) {
      return [];
    }
    return this.products
      .filter((p) => this.wishlist.includes(p.id) || this.wishlist.includes(p._id))
      .filter((p) => p.visibility !== false && p.vi?.visibility !== false);
  }

  onRemoveClick(event: MouseEvent, productId: string): void {
    event.stopPropagation();
    this.onRemoveFromWishlist(productId);
    this.notify.info('✨Đã xóa khỏi danh sách yêu thích✨');
  }

  onRemoveFromWishlist(productId: string): void {
    this.wishlistService.removeFromWishlist(productId);
    this.products = this.products.filter((p) => (p._id || p.id) !== productId);
    this.cdr.markForCheck();
  }

  addToCart(product: any): void {
    const id = product._id || product.id;
    if (!id) return;
    if (this.isOutOfStock(product) || product.visibility === false || product.vi?.visibility === false) {
      this.notify.warning('✨Sản phẩm hiện đã hết hàng hoặc tạm ngưng bán✨');
      return;
    }
    this.store.addToCart('?id=' + id);
    this.notify.success('✨Đã thêm sản phẩm vào giỏ hàng✨');
  }

  onOpenQuickView(product: any): void {
    const slug = product.titleUrl || product._id || product.id;
    if (slug) {
      this.router.navigate(['/' + this.currentLang + '/product/' + slug]);
    }
  }

  onNavigate(target: string): void {
    if (target === 'products' || target === 'product') {
      this.router.navigate(['/' + this.currentLang + '/product/all']);
    } else {
      this.router.navigate(['/' + this.currentLang + '/' + target]);
    }
  }

  formatVND(price: any): string {
    return formatVND(price);
  }
}
