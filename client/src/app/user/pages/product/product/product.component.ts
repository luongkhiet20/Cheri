import { toObservable } from '@angular/core/rxjs-interop';
import { JsonLDService } from '../../../../services/jsonLD.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, map, take, distinctUntilChanged, skip, withLatestFrom } from 'rxjs/operators';
import { Component, OnDestroy, Signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, combineLatest, Subscription } from 'rxjs';
import { Location } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';

import { Cart, Product, Category, ProductVariant } from '../../../shared/models';
import { ImagesDialogComponent } from '../../../shared/images-dialog/images-dialog.component';
import { TranslateService } from '../../../../services/translate.service';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css'],
  standalone: false
})
export class ProductComponent implements OnDestroy {
  categories$: Observable<Category[]>;
  productLoading$: Signal<boolean>;
  currency$: Observable<string>;
  lang$: Observable<string>;
  currentLang: string = 'vi';
  routeSub: Subscription;
  categoriesSub: Subscription;
  productSub: Subscription;
  product$: Signal<Product>;
  cartIds$: Observable<{ [productId: string]: number }>;

  // State cho Popup/Modal
  selectedImage: string = '';
  galleryImages: string[] = [];
  selectedClassification: string | null = null;
  selectedColor: string | null = null;
  selectedSize: string | null = null;
  selectedVariant: ProductVariant | null = null;

  quantity: number = 1;
  isOnSale: boolean = false;
  displaySalePrice: number = 0;
  displayRegularPrice: number = 0;
  maxStock: number = 0;
  isOutOfStock: boolean = false;
  displaySku: string = '';

  productTitle: string = '';
  productDescription: string = '';
  productDescriptionFull: string[] = [];
  categoryBreadcrumb: string | null = null;

  hasClassification: boolean = false;
  availableClassifications: string[] = [];

  hasColors: boolean = false;
  availableColors: { name: string; hex: string }[] = [];

  hasSizes: boolean = false;
  availableSizes: string[] = [];

  shippingInfo: {
    basicCost: number | null;
    extendedCost: number | null;
    note: string | null;
  } | null = null;

  productTags: string[] = [];
  isUnavailable: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private location: Location,
    private meta: Meta,
    private title: Title,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
    private translate: TranslateService,
    private jsonLDService: JsonLDService,
  ) {
    this.lang$ = this.translate.getLang$();
    this.categories$ = toObservable(this.selectors.categories);

    this.routeSub = combineLatest([this.lang$, this.route.params.pipe(map((params) => params['id']))]).subscribe(([lang, id]) => {
      this.currentLang = lang || 'vi';
      this.store.getProduct(id + '?lang=' + lang);
    });

    this.currency$ = toObservable(this.selectors.currency);

    this.callCategories();
    this.setMetaData();

    this.productLoading$ = this.selectors.productLoading;
    this.product$ = this.selectors.product;
    this.cartIds$ = toObservable(this.selectors.cart).pipe(
      filter(Boolean),
      map((cart: Cart) => cart.items.reduce((prev, curr) => ({ ...prev, [curr.id]: curr.qty }), {})),
    );

    // Đồng bộ state khi dữ liệu product thay đổi
    this.productSub = toObservable(this.selectors.product).subscribe((product) => {
      if (product) {
        this.initProductState(product);
      }
    });
  }

  private initProductState(product: Product): void {
    if (!product) {
      this.isUnavailable = false;
      return;
    }

    // 17. Visibility: nếu false thì không cho hiển thị popup bình thường
    if (product.visibility === false || product.vi?.visibility === false) {
      this.isUnavailable = true;
      return;
    }
    this.isUnavailable = false;

    // Dữ liệu ưu tiên từ vi
    const viData = product.vi || product;

    // 4.2 Tên sản phẩm
    this.productTitle = viData.title || product.title || '';

    // 4.3 Mô tả
    this.productDescription = viData.description || product.description || '';
    if (Array.isArray(viData.descriptionFull) && viData.descriptionFull.length > 0) {
      this.productDescriptionFull = viData.descriptionFull;
    } else if (Array.isArray(product.descriptionFull) && product.descriptionFull.length > 0) {
      this.productDescriptionFull = product.descriptionFull;
    } else {
      this.productDescriptionFull = [];
    }

    // 4.1 Danh mục
    const cat1 = viData.categoryLevel1 || product.categoryLevel1;
    const cat2 = viData.categoryLevel2 || product.categoryLevel2;
    const c1Str = Array.isArray(cat1) ? cat1.join(', ') : (cat1 ? String(cat1).trim() : '');
    const c2Str = cat2 ? String(cat2).trim() : '';
    if (c1Str && c2Str) {
      this.categoryBreadcrumb = `${c1Str} / ${c2Str}`;
    } else if (c1Str) {
      this.categoryBreadcrumb = c1Str;
    } else if (c2Str) {
      this.categoryBreadcrumb = c2Str;
    } else {
      this.categoryBreadcrumb = null;
    }

    // 3. Hình ảnh
    this.galleryImages = [];
    const mainImgUrl = product.mainImage?.url;
    if (mainImgUrl) {
      this.galleryImages.push(mainImgUrl);
    }
    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        if (img && !this.galleryImages.includes(img)) {
          this.galleryImages.push(img);
        }
      }
    }
    this.selectedImage = this.galleryImages.length > 0 ? this.galleryImages[0] : '';

    // 8. Phân loại (Classification)
    this.hasClassification = Boolean(viData.hasClassification ?? product.hasClassification);
    let classList: string[] = [];
    if (Array.isArray(viData.classifications) && viData.classifications.length > 0) {
      classList = viData.classifications;
    } else if (Array.isArray(product.classifications) && product.classifications.length > 0) {
      classList = product.classifications;
    }
    if (classList.length === 0 && Array.isArray(product.variants)) {
      const distinct = Array.from(new Set(product.variants.map((v) => v.classification).filter(Boolean))) as string[];
      if (distinct.length > 0) {
        classList = distinct;
        this.hasClassification = true;
      }
    }
    this.availableClassifications = classList;
    this.selectedClassification = this.availableClassifications.length > 0 ? this.availableClassifications[0] : null;

    // 9. Màu sắc (Colors)
    this.hasColors = Boolean(viData.hasColors ?? product.hasColors);
    let colorList: { name: string; hex: string }[] = [];
    if (Array.isArray(viData.colors) && viData.colors.length > 0) {
      colorList = viData.colors;
    } else if (Array.isArray(product.colors) && product.colors.length > 0) {
      colorList = product.colors;
    }
    if (colorList.length === 0 && Array.isArray(product.variants)) {
      const distinctColors = Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))) as string[];
      if (distinctColors.length > 0) {
        colorList = distinctColors.map((name) => ({ name, hex: '#74070E' }));
        this.hasColors = true;
      }
    }
    this.availableColors = colorList;
    this.selectedColor = this.availableColors.length > 0 ? this.availableColors[0].name : null;

    // 10. Kích cỡ (Sizes)
    this.hasSizes = Boolean(viData.hasSizes ?? product.hasSizes);
    let sizeList: string[] = [];
    if (Array.isArray(viData.sizes) && viData.sizes.length > 0) {
      sizeList = viData.sizes;
    } else if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      sizeList = product.sizes;
    }
    if (sizeList.length === 0 && Array.isArray(product.variants)) {
      const distinctSizes = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean))) as string[];
      if (distinctSizes.length > 0) {
        sizeList = distinctSizes;
        this.hasSizes = true;
      }
    }
    this.availableSizes = sizeList;
    this.selectedSize = this.availableSizes.length > 0 ? this.availableSizes[0] : null;

    // 18. Tags
    this.productTags = Array.isArray(product.tags) ? product.tags : [];

    // 16. Shipping
    const shipBasic = viData.shippingBasicCost !== undefined ? viData.shippingBasicCost : product.shippingBasicCost;
    const shipExt = viData.shippingExtendedCost !== undefined ? viData.shippingExtendedCost : product.shippingExtendedCost;
    const shipCost = viData.shippingCost !== undefined ? viData.shippingCost : product.shippingCost;
    const shipNote = viData.shipping || product.shipping || null;

    if (shipBasic !== undefined || shipExt !== undefined || shipCost !== undefined || shipNote) {
      this.shippingInfo = {
        basicCost: shipBasic !== undefined ? Number(shipBasic) : (shipCost !== undefined ? Number(shipCost) : null),
        extendedCost: shipExt !== undefined ? Number(shipExt) : null,
        note: shipNote ? String(shipNote).trim() : null,
      };
    } else {
      this.shippingInfo = null;
    }

    this.quantity = 1;
    this.updateSelectedVariant();
  }

  updateSelectedVariant(): void {
    const product = this.product$();
    if (!product) return;

    const variants: ProductVariant[] = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
      this.selectedVariant = variants.find((v) => {
        const matchClass = !this.hasClassification || !this.selectedClassification || v.classification === this.selectedClassification;
        const matchColor = !this.hasColors || !this.selectedColor || v.color === this.selectedColor;
        const matchSize = !this.hasSizes || !this.selectedSize || v.size === this.selectedSize;
        return matchClass && matchColor && matchSize;
      }) || null;
    } else {
      this.selectedVariant = null;
    }

    this.calculatePriceAndStock();
  }

  calculatePriceAndStock(): void {
    const product = this.product$();
    if (!product) return;
    const viData = product.vi || product;

    if (this.selectedVariant) {
      // 11. SKU theo variant
      this.displaySku = this.selectedVariant.sku || product.sku || '';

      // 12. Giá theo variant
      const reg = Number(this.selectedVariant.price) || Number(viData.regularPrice ?? product.regularPrice) || 0;
      const disc = Number(this.selectedVariant.discountPrice) || 0;
      if (disc > 0 && disc < reg) {
        this.isOnSale = true;
        this.displaySalePrice = disc;
        this.displayRegularPrice = reg;
      } else {
        this.isOnSale = false;
        this.displaySalePrice = reg;
        this.displayRegularPrice = reg;
      }

      // 13. Tồn kho theo variant
      this.maxStock = Math.max(0, Number(this.selectedVariant.stock) || 0);
      this.isOutOfStock = this.maxStock <= 0;
    } else {
      // Giá root / vi
      this.displaySku = product.sku || '';
      const reg = Number(viData.regularPrice ?? product.regularPrice) || 0;
      const sale = Number(viData.salePrice ?? product.salePrice) || reg;
      const onSaleFlag = Boolean(viData.onSale ?? product.onSale);

      if (onSaleFlag && sale > 0 && reg > sale) {
        this.isOnSale = true;
        this.displaySalePrice = sale;
        this.displayRegularPrice = reg;
      } else {
        this.isOnSale = false;
        this.displaySalePrice = sale || reg;
        this.displayRegularPrice = reg || sale;
      }

      const q = viData.quantity !== undefined ? viData.quantity : product.quantity;
      const s = viData.stock || product.stock;
      this.maxStock = Math.max(0, Number(q) || 0);
      this.isOutOfStock = (q !== undefined && q !== null && Number(q) <= 0) || s === '0' || s === 'out' || s === 'outOfStock' || s === 'unavailable';
    }

    // Điều chỉnh quantity
    if (this.isOutOfStock) {
      this.quantity = 0;
    } else {
      if (this.quantity < 1) this.quantity = 1;
      if (this.maxStock > 0 && this.quantity > this.maxStock) {
        this.quantity = this.maxStock;
      }
    }
  }

  isSelectionComplete(): boolean {
    if (this.hasClassification && !this.selectedClassification) return false;
    if (this.hasColors && !this.selectedColor) return false;
    if (this.hasSizes && !this.selectedSize) return false;
    return true;
  }

  onSelectClassification(cls: string): void {
    this.selectedClassification = cls;
    this.updateSelectedVariant();
  }

  onSelectColor(c: string): void {
    this.selectedColor = c;
    this.updateSelectedVariant();
  }

  onSelectSize(s: string): void {
    this.selectedSize = s;
    this.updateSelectedVariant();
  }

  selectImage(img: string): void {
    this.selectedImage = img;
  }

  openGalleryDialog(): void {
    if (!this.galleryImages.length) return;
    const index = this.galleryImages.indexOf(this.selectedImage);
    this.openDialog(index >= 0 ? index : 0, this.galleryImages);
  }

  decreaseQty(): void {
    if (this.isOutOfStock || this.quantity <= 1) return;
    this.quantity--;
  }

  increaseQty(): void {
    if (this.isOutOfStock) return;
    if (this.maxStock > 0 && this.quantity >= this.maxStock) return;
    this.quantity++;
  }

  handleAddToCart(): void {
    const product = this.product$();
    if (!product || this.isOutOfStock) return;

    if (!this.isSelectionComplete()) {
      this.snackBar.open('Vui lòng chọn đầy đủ thông tin sản phẩm.', 'Đóng', { duration: 3000 });
      return;
    }

    for (let i = 0; i < this.quantity; i++) {
      this.store.addToCart('?id=' + product._id);
    }

    const snackBarRef = this.snackBar.open('Đã thêm vào giỏ hàng', 'Xem giỏ hàng', { duration: 3000 });
    snackBarRef.onAction().pipe(take(1)).subscribe(() => {
      this.router.navigate(['/' + this.currentLang + '/cart']);
    });
  }

  handleBuyNow(): void {
    const product = this.product$();
    if (!product || this.isOutOfStock) return;

    if (!this.isSelectionComplete()) {
      this.snackBar.open('Vui lòng chọn đầy đủ thông tin sản phẩm.', 'Đóng', { duration: 3000 });
      return;
    }

    for (let i = 0; i < this.quantity; i++) {
      this.store.addToCart('?id=' + product._id);
    }

    this.router.navigate(['/' + this.currentLang + '/cart']);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.goBack();
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/' + this.currentLang + '/product/all']);
    }
  }

  openDialog(index: number, images: string[]): void {
    const dialogRef = this.dialog.open(ImagesDialogComponent, {
      width: '100vw',
      maxHeight: '100vh',
      data: { index, images },
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log('The dialog was closed');
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.categoriesSub) this.categoriesSub.unsubscribe();
    if (this.productSub) this.productSub.unsubscribe();
  }

  private callCategories(): void {
    combineLatest([this.categories$.pipe(take(1)), this.lang$.pipe(take(1))])
      .pipe(take(1))
      .subscribe(([categories, lang]) => {
        if (!categories.length) {
          this.store.getCategories(lang);
        }
      });

    this.categoriesSub = this.lang$.pipe(distinctUntilChanged(), skip(1)).subscribe((lang: string) => {
      this.store.getCategories(lang);
    });
  }

  private setMetaData(): void {
    toObservable(this.selectors.product)
      .pipe(
        filter((product: Product) => !!product && !!product.title),
        withLatestFrom(this.currency$),
        take(1),
      )
      .subscribe(([product, currency]) => {
        this.title.setTitle(product.title);
        this.meta.updateTag({ name: 'description', content: product.description });
        const productSchema = {
          '@context': 'https://schema.org/',
          '@type': 'Product',
          name: product.title,
          image: product.mainImage?.url,
          offers: {
            '@type': 'Offer',
            priceCurrency: currency,
            price: product.regularPrice,
            availability: product.stock === 'onStock' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          },
          description: product.description,
        };
        this.jsonLDService.insertSchema(productSchema, 'structured-data-product');
      });
  }
}

