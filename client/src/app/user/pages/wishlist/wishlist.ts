import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { take } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { TranslateService } from '../../../services/translate.service';
import { SignalStore } from '../../../store/signal.store';
import { Product } from '../../shared/models';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule, MatSnackBarModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class Wishlist implements OnInit, OnDestroy {
  wishlist: string[] = [];
  products: any[] = [];
  currentLang = 'vi';
  private _storageListener?: (e: StorageEvent) => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private apiService: ApiService,
    private translateService: TranslateService,
    private store: SignalStore,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) { }

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
    if (isPlatformBrowser(this.platformId)) {
      try {
        const saved = localStorage.getItem('cheri_wishlist') || localStorage.getItem('wishlist');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.wishlist = Array.isArray(parsed) ? parsed : [];
        } else {
          this.wishlist = [];
        }
      } catch (e) {
        this.wishlist = [];
      }

      try {
        const savedItemsStr = localStorage.getItem('cheri_wishlist_items');
        if (savedItemsStr) {
          const parsed = JSON.parse(savedItemsStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.products = parsed.map((p) => this.normalizeProduct(p));
            // Keep this.wishlist IDs synced
            const itemIds = this.products.map((p) => p.id || p._id).filter(Boolean);
            if (this.wishlist.length === 0 && itemIds.length > 0) {
              this.wishlist = itemIds;
            }
          }
        }
      } catch (e) { }
    }
  }

  saveWishlist(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cheri_wishlist', JSON.stringify(this.wishlist));
      localStorage.setItem('wishlist', JSON.stringify(this.wishlist));
      const activeProducts = this.products.filter(
        (p) => this.wishlist.includes(p.id) || this.wishlist.includes(p._id)
      );
      localStorage.setItem('cheri_wishlist_items', JSON.stringify(activeProducts));
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
    this.showToast('Đã bỏ thích sản phẩm', 'info');
  }

  onRemoveFromWishlist(productId: string): void {
    this.wishlist = this.wishlist.filter((id) => id !== productId);
    this.products = this.products.filter((p) => (p._id || p.id) !== productId);
    this.saveWishlist();
    this.cdr.markForCheck();
  }

  addToCart(product: any): void {
    const id = product._id || product.id;
    if (!id) return;
    if (this.isOutOfStock(product) || product.visibility === false || product.vi?.visibility === false) {
      this.showToast('Sản phẩm hiện đã hết hàng hoặc tạm ngưng bán', 'error');
      return;
    }
    this.store.addToCart('?id=' + id);
    const snackBarRef = this.snackBar.open('Đã thêm vào giỏ hàng', 'Xem giỏ hàng', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
    snackBarRef.onAction().pipe(take(1)).subscribe(() => {
      this.router.navigate(['/' + this.currentLang + '/cart']);
    });
  }

  showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    this.snackBar.open(message, 'Đóng', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
      panelClass: type === 'error' ? ['toast-error'] : ['toast-info']
    });
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

  formatVND(price: number): string {
    if (price === undefined || price === null) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(price) + ' ₫';
  }
}
