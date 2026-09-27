import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, take } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  readonly wishlistIds = signal<string[]>([]);
  private _storageListener?: (e: StorageEvent) => void;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this._initWishlist();
  }

  private _initWishlist(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFromStorage();

      // Listen for cross-tab storage changes
      this._storageListener = (e: StorageEvent) => {
        if (e.key === 'cheri_wishlist' || e.key === 'wishlist' || e.key === 'cheri_wishlist_items') {
          this.loadFromStorage();
        }
      };
      window.addEventListener('storage', this._storageListener);

      // Re-sync wishlist state on route changes (e.g. navigating from Wishlist back to Home or Products)
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        this.loadFromStorage();
      });
    }
  }

  loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const saved = localStorage.getItem('cheri_wishlist') || localStorage.getItem('wishlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
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
          return;
        }
      }
      this.wishlistIds.set([]);
    } catch {
      this.wishlistIds.set([]);
    }
  }

  isInWishlist(id: string): boolean {
    return !!id && this.wishlistIds().includes(id);
  }

  removeFromWishlist(id: string): void {
    if (!id) return;
    const current = this.wishlistIds();
    const next = current.filter(x => x !== id);
    this.wishlistIds.set(next);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cheri_wishlist', JSON.stringify(next));
      localStorage.setItem('wishlist', JSON.stringify(next));

      try {
        const savedItemsStr = localStorage.getItem('cheri_wishlist_items');
        let savedItems: any[] = savedItemsStr ? JSON.parse(savedItemsStr) : [];
        if (Array.isArray(savedItems)) {
          savedItems = savedItems.filter(item => (item._id || item.id) !== id);
          localStorage.setItem('cheri_wishlist_items', JSON.stringify(savedItems));
        }
      } catch (e) {
        console.error('Error removing from wishlist items', e);
      }
    }
  }

  setWishlist(ids: string[], items?: any[]): void {
    this.wishlistIds.set(ids);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cheri_wishlist', JSON.stringify(ids));
      localStorage.setItem('wishlist', JSON.stringify(ids));
      if (items) {
        localStorage.setItem('cheri_wishlist_items', JSON.stringify(items));
      }
    }
  }

  setWishlistIds(ids: string[]): void {
    this.setWishlist(ids);
  }

  toggleWishlist(product: any, lang: string = 'vi'): boolean {
    if (!product) return false;
    const id: string = product._id || product.id;
    if (!id) return false;

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
            image: product.mainImage?.url || (product.images && product.images[0]) || product.image || '',
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
        this.router.navigate(['/' + (lang || 'vi') + '/wishlist']);
      });
    }

    return !isIn;
  }
}
