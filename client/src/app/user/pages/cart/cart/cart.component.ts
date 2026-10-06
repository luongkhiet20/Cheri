import { toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { filter, take, withLatestFrom } from 'rxjs/operators';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TranslateService } from '../../../../services/translate.service';
import { Cart, User, Order, PaymentMethod } from '../../../shared/models';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { VietnamAddressService, AdministrativeUnit } from '../../../../services/vietnam-address.service';

export interface AppliedCoupon {
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED' | string;
  discountValue: number;
  discountAmount: number;
}

export interface ShippingOption {
  _id?: string;
  id: string;
  name: string;
  code?: string;
  description: string;
  fee: number;
  baseFee?: number;
  estimatedDeliveryTime?: string;
  freeShippingCondition?: {
    enabled: boolean;
    minimumOrderValue: number;
    description: string;
  };
}

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css'],
  standalone: false
})
export class CartComponent implements OnInit, OnDestroy {
  cart$: Observable<Cart>;
  lang$: Observable<string>;
  order$: Observable<Order>;
  user$: Observable<User>;
  orderForm: FormGroup;
  currency$: Observable<string>;
  productUrl: string;

  // ─── 9. PHƯƠNG THỨC THANH TOÁN (TỪ DATABASE QUA API) ───
  paymentMethods: PaymentMethod[] = [];
  isLoadingPaymentMethods = false;
  selectedPaymentMethodId = '';
  paymentMethodControl = new FormControl<string>('', { nonNullable: true, validators: [Validators.required] });
  private readonly paymentStorageKey = 'cheri_cart_payment_method';
  loading$: Observable<boolean>;
  error$: Observable<string>;

  // Dữ liệu địa giới hành chính
  provinces: AdministrativeUnit[] = [];
  districts: AdministrativeUnit[] = [];
  wards: AdministrativeUnit[] = [];

  // Trạng thái tải và lỗi địa chỉ
  isProvincesLoading = false;
  isDistrictsLoading = false;
  isWardsLoading = false;
  provincesError = '';
  districtsError = '';
  wardsError = '';

  // ─── 1. CHỌN SẢN PHẨM & SELECTION ───
  selectedItemIds = new Set<string>();
  private readonly storageKey = 'cheri_cart_selected_ids';
  private cartSub?: Subscription;
  latestCart: Cart | null = null;

  // ─── 2 & 3. TĂNG / GIẢM & NHẬP SỐ LƯỢNG ───
  updatingItemId: string | null = null;

  // ─── 6. MÃ GIẢM GIÁ ───
  couponInput = '';
  appliedCoupon: AppliedCoupon | null = null;
  isApplyingCoupon = false;
  couponError = '';
  couponSuccess = '';

  // ─── 7. MODAL CHỌN LẠI BIẾN THỂ (POPUP) ───
  isVariantModalOpen = false;
  editingCartItem: any = null;
  modalClassification: string | null = null;
  modalColor: string | null = null;
  modalSize: string | null = null;
  modalSelectedVariant: any = null;
  modalQuantity = 1;
  modalPrice = 0;
  modalRegularPrice = 0;
  modalStock = 0;
  modalError = '';
  isModalSubmitting = false;

  // ─── 8. PHƯƠNG THỨC VẬN CHUYỂN (TỪ DATABASE QUA API) ───
  shippingMethods: ShippingOption[] = [];
  isLoadingShippingMethods = false;
  private readonly shippingStorageKey = 'cheri_cart_shipping_method';
  selectedShippingMethodId = '';

  readonly component = 'cartComponent';

  // Regex xác thực họ tên (chữ tiếng Việt và khoảng trắng, không số)
  private readonly namePattern = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s]+$/;
  // Regex xác thực số điện thoại Việt Nam (10 số, bắt đầu 03, 05, 07, 08, 09 hoặc +84)
  private readonly phonePattern = /^(0|\+84)(3[2-9]|5[2|6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

  constructor(
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    private fb: FormBuilder,
    private router: Router,
    private location: Location,
    private translate: TranslateService,
    private addressService: VietnamAddressService,
    private snackBar: MatSnackBar
  ) {
    this.store.cleanError();

    this.lang$ = this.translate.getLang$();
    this.cart$ = toObservable(this.selectors.cart);
    this.order$ = toObservable(this.selectors.order).pipe(filter(order => !!order));
    this.user$ = toObservable(this.selectors.user);
    this.currency$ = toObservable(this.selectors.currency);
    this.loading$ = toObservable(this.selectors.loading);
    this.error$ = toObservable(this.selectors.error);

    this.orderForm = this.fb.group({
      // 1. Họ và tên
      name: ['', [Validators.required, Validators.pattern(this.namePattern)]],
      // 2. Email liên lạc
      email: ['', [Validators.required, Validators.email]],
      // 3. Điện thoại liên hệ
      phone: ['', [Validators.required, Validators.pattern(this.phonePattern)]],
      // 4. Tỉnh / Thành phố
      provinceCode: ['', Validators.required],
      provinceName: [''],
      // 5. Quận / Huyện
      districtCode: [{ value: '', disabled: true }, Validators.required],
      districtName: [''],
      // 6. Phường / Xã
      wardCode: [{ value: '', disabled: true }, Validators.required],
      wardName: [''],
      // 7. Địa chỉ chi tiết
      addressDetail: ['', Validators.required],
      // 8. Ghi chú đơn hàng
      notes: ['']
    });

    this.order$.pipe(
      filter(order => !!order),
      withLatestFrom(this.lang$),
      take(1)
    ).subscribe(([order, lang]) => {
      this.router.navigate(['/' + lang + '/cart/summary']);
    });

    this.error$.pipe(filter((err) => !!err)).subscribe((err) => {
      const msg = typeof err === 'string' ? err : 'Đặt hàng thất bại. Vui lòng thử lại.';
      if (typeof window !== 'undefined') {
        this.snackBar.open(msg, 'Đóng', { duration: 4000 });
      }
    });
  }

  ngOnInit(): void {
    this.loadProvinces(() => {
      this.autoFillUserData();
    });
    this.autoFillUserData();
    this.restoreSelectionFromStorage();
    this.loadShippingMethods();
    this.loadPaymentMethods();

    // Theo dõi giỏ hàng để cập nhật trạng thái chọn
    this.cartSub = this.cart$.subscribe((cart) => {
      this.latestCart = cart;
      if (cart && cart.items && cart.items.length > 0) {
        this.syncSelectionWithCart(cart);
        // Ưu tiên phương thức vận chuyển từ backend nếu có lưu
        if ((cart as any)?.shippingMethodId && this.shippingMethods.some(m => m.id === (cart as any).shippingMethodId || m._id === (cart as any).shippingMethodId)) {
          const matched = this.shippingMethods.find(m => m.id === (cart as any).shippingMethodId || m._id === (cart as any).shippingMethodId);
          if (matched) this.selectedShippingMethodId = matched.id;
        }
        // Tự động kiểm tra lại mã giảm giá nếu subtotal thay đổi
        if (this.appliedCoupon) {
          this.revalidateAppliedCoupon(cart);
        }
      } else {
        this.selectedItemIds.clear();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.cartSub) {
      this.cartSub.unsubscribe();
    }
  }

  // ─── SAFE STORAGE HELPERS (SSR-FRIENDLY) ───

  private getStorageItem(key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private setStorageItem(key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  private removeStorageItem(key: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  // ─── PHẦN 1: CHỌN SẢN PHẨM & CHECKBOX SELECTION ───

  private restoreSelectionFromStorage(): void {
    try {
      const saved = this.getStorageItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.selectedItemIds = new Set(parsed);
        }
      }
    } catch {
      // Bỏ qua lỗi parse storage
    }
  }

  private saveSelectionToStorage(): void {
    try {
      this.setStorageItem(this.storageKey, JSON.stringify(Array.from(this.selectedItemIds)));
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  private syncSelectionWithCart(cart: Cart): void {
    const currentItemIds = new Set(cart.items.map((i: any) => i.id));

    // Nếu storage có lưu ID, chỉ giữ lại các ID còn tồn tại
    if (this.selectedItemIds.size > 0) {
      for (const id of Array.from(this.selectedItemIds)) {
        if (!currentItemIds.has(id)) {
          this.selectedItemIds.delete(id);
        }
      }
    }

    // Nếu chưa có item nào được chọn, mặc định chọn tất cả sản phẩm hợp lệ
    if (this.selectedItemIds.size === 0) {
      cart.items.forEach((item: any) => {
        if (item.isSelected !== false && !this.isItemOutOfStock(item)) {
          this.selectedItemIds.add(item.id);
        }
      });
    }
    this.saveSelectionToStorage();
  }

  isSelected(id: string): boolean {
    return this.selectedItemIds.has(id);
  }

  toggleSelectItem(cartItem: any): void {
    if (this.isItemOutOfStock(cartItem)) return;

    const willSelect = !this.selectedItemIds.has(cartItem.id);
    if (willSelect) {
      this.selectedItemIds.add(cartItem.id);
    } else {
      this.selectedItemIds.delete(cartItem.id);
    }
    this.saveSelectionToStorage();

    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.toggleCartItemSelect(cartItem.id, willSelect, lang).subscribe();
    });

    if (this.latestCart && this.appliedCoupon) {
      this.revalidateAppliedCoupon(this.latestCart);
    }
  }

  isAllSelected(cart: Cart): boolean {
    const availableItems = (cart?.items || []).filter((i: any) => !this.isItemOutOfStock(i));
    if (availableItems.length === 0) return false;
    return availableItems.every((item: any) => this.selectedItemIds.has(item.id));
  }

  isIndeterminate(cart: Cart): boolean {
    const availableItems = (cart?.items || []).filter((i: any) => !this.isItemOutOfStock(i));
    if (availableItems.length === 0) return false;
    const selectedCount = availableItems.filter((item: any) => this.selectedItemIds.has(item.id)).length;
    return selectedCount > 0 && selectedCount < availableItems.length;
  }

  toggleSelectAll(cart: Cart): void {
    const availableItems = (cart?.items || []).filter((i: any) => !this.isItemOutOfStock(i));
    const allSelected = this.isAllSelected(cart);

    if (allSelected) {
      // Bỏ chọn toàn bộ
      this.selectedItemIds.clear();
    } else {
      // Chọn tất cả
      availableItems.forEach((item: any) => this.selectedItemIds.add(item.id));
    }
    this.saveSelectionToStorage();

    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.selectAllCartItems(!allSelected, lang).subscribe();
    });

    if (this.appliedCoupon) {
      this.revalidateAppliedCoupon(cart);
    }
  }

  getSelectedCount(cart: Cart): number {
    return (cart?.items || []).filter((item: any) => this.selectedItemIds.has(item.id)).length;
  }

  // ─── PHẦN 2: BIẾN THỂ SẢN PHẨM TRONG CART ───

  hasClassification(cartItem: any): boolean {
    const viData = cartItem?.item?.vi || cartItem?.item;
    const directFlag = Boolean(viData?.hasClassification ?? cartItem?.item?.hasClassification);
    return directFlag || this.getAvailableClassifications(cartItem).length > 0;
  }

  getAvailableClassifications(cartItem: any): string[] {
    const viData = cartItem?.item?.vi || cartItem?.item;
    let list: string[] = [];
    if (Array.isArray(viData?.classifications) && viData.classifications.length > 0) {
      list = viData.classifications;
    } else if (Array.isArray(cartItem?.item?.classifications) && cartItem.item.classifications.length > 0) {
      list = cartItem.item.classifications;
    }
    if (list.length === 0 && Array.isArray(cartItem?.item?.variants)) {
      const distinct = Array.from(
        new Set(cartItem.item.variants.map((v: any) => v.classification).filter(Boolean)),
      ) as string[];
      if (distinct.length > 0) list = distinct;
    }
    return list;
  }

  getSelectedClassification(cartItem: any): string | null {
    if (cartItem?.selectedClassification) return cartItem.selectedClassification;
    if (cartItem?.variant?.classification) return cartItem.variant.classification;
    const available = this.getAvailableClassifications(cartItem);
    return available.length > 0 ? available[0] : null;
  }

  hasColors(cartItem: any): boolean {
    const viData = cartItem?.item?.vi || cartItem?.item;
    const directFlag = Boolean(viData?.hasColors ?? cartItem?.item?.hasColors);
    return directFlag || this.getAvailableColors(cartItem).length > 0;
  }

  getAvailableColors(cartItem: any): { name: string; hex: string }[] {
    const viData = cartItem?.item?.vi || cartItem?.item;
    let list: { name: string; hex: string }[] = [];
    if (Array.isArray(viData?.colors) && viData.colors.length > 0) {
      list = viData.colors;
    } else if (Array.isArray(cartItem?.item?.colors) && cartItem.item.colors.length > 0) {
      list = cartItem.item.colors;
    }
    if (list.length === 0 && Array.isArray(cartItem?.item?.variants)) {
      const distinctNames = Array.from(
        new Set(cartItem.item.variants.map((v: any) => v.color).filter(Boolean)),
      ) as string[];
      if (distinctNames.length > 0) {
        list = distinctNames.map((name) => ({ name, hex: '#74070E' }));
      }
    }
    return list;
  }

  getSelectedColor(cartItem: any): string | null {
    if (cartItem?.selectedColor) return cartItem.selectedColor;
    if (cartItem?.variant?.color) return cartItem.variant.color;
    const available = this.getAvailableColors(cartItem);
    return available.length > 0 ? available[0].name : null;
  }

  hasSizes(cartItem: any): boolean {
    const viData = cartItem?.item?.vi || cartItem?.item;
    const directFlag = Boolean(viData?.hasSizes ?? cartItem?.item?.hasSizes);
    return directFlag || this.getAvailableSizes(cartItem).length > 0;
  }

  getAvailableSizes(cartItem: any): string[] {
    const viData = cartItem?.item?.vi || cartItem?.item;
    let list: string[] = [];
    if (Array.isArray(viData?.sizes) && viData.sizes.length > 0) {
      list = viData.sizes;
    } else if (Array.isArray(cartItem?.item?.sizes) && cartItem.item.sizes.length > 0) {
      list = cartItem.item.sizes;
    }
    if (list.length === 0 && Array.isArray(cartItem?.item?.variants)) {
      const distinct = Array.from(
        new Set(cartItem.item.variants.map((v: any) => v.size).filter(Boolean)),
      ) as string[];
      if (distinct.length > 0) list = distinct;
    }
    return list;
  }

  getSelectedSize(cartItem: any): string | null {
    if (cartItem?.selectedSize) return cartItem.selectedSize;
    if (cartItem?.variant?.size) return cartItem.variant.size;
    const available = this.getAvailableSizes(cartItem);
    return available.length > 0 ? available[0] : null;
  }

  onSelectClassification(cartItem: any, cls: string): void {
    this.onSelectOption(cartItem, 'classification', cls);
  }

  onSelectColor(cartItem: any, colorName: string): void {
    this.onSelectOption(cartItem, 'color', colorName);
  }

  onSelectSize(cartItem: any, sizeName: string): void {
    this.onSelectOption(cartItem, 'size', sizeName);
  }

  onSelectOption(
    cartItem: any,
    type: 'classification' | 'color' | 'size',
    value: string,
  ): void {
    if (this.updatingItemId) return;

    const currentCls = type === 'classification' ? value : this.getSelectedClassification(cartItem);
    const currentColor = type === 'color' ? value : this.getSelectedColor(cartItem);
    const currentSize = type === 'size' ? value : this.getSelectedSize(cartItem);

    const variants: any[] = Array.isArray(cartItem?.item?.variants) ? cartItem.item.variants : [];
    if (variants.length === 0) return;

    // Tìm variant khớp tốt nhất
    let matchedVariant = variants.find((v: any) => {
      const mClass = !this.hasClassification(cartItem) || !currentCls || v.classification === currentCls;
      const mColor = !this.hasColors(cartItem) || !currentColor || v.color === currentColor;
      const mSize = !this.hasSizes(cartItem) || !currentSize || v.size === currentSize;
      return mClass && mColor && mSize;
    });

    if (!matchedVariant) {
      if (type === 'classification') {
        matchedVariant = variants.find((v: any) => v.classification === value);
      } else if (type === 'color') {
        matchedVariant = variants.find((v: any) => v.color === value);
      } else if (type === 'size') {
        matchedVariant = variants.find((v: any) => v.size === value);
      }
    }

    if (!matchedVariant) {
      this.snackBar.open('Tùy chọn này hiện chưa có sẵn cho sản phẩm', 'Đóng', { duration: 2500 });
      return;
    }

    const newVarId = matchedVariant._id?.toString() || matchedVariant.id || matchedVariant.sku;
    if (newVarId === cartItem.variantId) return;

    this.updatingItemId = cartItem.id;
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store
        .updateCartVariant(
          cartItem.id,
          {
            variantId: newVarId,
            classification: matchedVariant.classification,
            color: matchedVariant.color,
            size: matchedVariant.size,
          },
          lang,
        )
        .subscribe({
          next: (res: any) => {
            this.updatingItemId = null;
            if (res && res.error) {
              this.snackBar.open('Cập nhật biến thể thất bại', 'Đóng', { duration: 2500 });
              return;
            }
            if (res?.capped) {
              this.snackBar.open(
                `Số lượng đã được tự động điều chỉnh về ${res.newQty} theo tồn kho của biến thể mới`,
                'Đóng',
                { duration: 3500 },
              );
            } else {
              this.snackBar.open('Đã đổi biến thể sản phẩm', 'Đóng', { duration: 2000 });
            }
            if (this.appliedCoupon && this.latestCart) {
              this.revalidateAppliedCoupon(this.latestCart);
            }
          },
          error: () => {
            this.updatingItemId = null;
            this.snackBar.open('Cập nhật biến thể thất bại', 'Đóng', { duration: 2500 });
          },
        });
    });
  }

  // ─── TÓM TẮT BIẾN THỂ & MODAL POPUP ───

  hasAnyVariants(cartItem: any): boolean {
    if (!cartItem) return false;
    const variants = cartItem?.item?.variants;
    if (Array.isArray(variants) && variants.length > 0) return true;
    if (cartItem.selectedClassification || cartItem.selectedColor || cartItem.selectedSize || cartItem.variant) return true;
    const item = cartItem?.item;
    if (item?.hasClassification || item?.hasColors || item?.hasSizes) return true;
    if (Array.isArray(item?.classifications) && item.classifications.length > 0) return true;
    if (Array.isArray(item?.colors) && item.colors.length > 0) return true;
    if (Array.isArray(item?.sizes) && item.sizes.length > 0) return true;
    return false;
  }

  getVariantSummary(cartItem: any): string {
    const parts: string[] = [];
    const cls = this.getSelectedClassification(cartItem);
    const color = this.getSelectedColor(cartItem);
    const size = this.getSelectedSize(cartItem);

    if (cls) parts.push(cls);
    if (color) parts.push(`Màu ${color}`);
    if (size) parts.push(`Size ${size}`);

    return parts.length > 0 ? parts.join('  ·  ') : 'Chọn phân loại, màu, kích cỡ';
  }

  openVariantModal(cartItem: any): void {
    if (!cartItem) return;
    this.editingCartItem = {
      ...cartItem,
      productId: cartItem.item?._id || cartItem.item?.id || (typeof cartItem.id === 'string' ? cartItem.id.split('_')[0] : ''),
      variantId: cartItem.variantId || cartItem.variant?._id || cartItem.variant?.sku || '',
      cartItemId: cartItem.id,
      selectedClassification: this.getSelectedClassification(cartItem),
      selectedColor: this.getSelectedColor(cartItem),
      selectedSize: this.getSelectedSize(cartItem),
      qty: cartItem.qty || 1
    };
    this.isVariantModalOpen = true;
  }

  closeVariantModal(): void {
    this.isVariantModalOpen = false;
    this.editingCartItem = null;
  }

  onVariantModalUpdated(): void {
    this.closeVariantModal();
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.getCart(lang);
      if (this.appliedCoupon && this.latestCart) {
        this.revalidateAppliedCoupon(this.latestCart);
      }
    });
  }

  updateModalVariant(): void {
    if (!this.editingCartItem) return;
    const variants: any[] = Array.isArray(this.editingCartItem?.item?.variants)
      ? this.editingCartItem.item.variants
      : [];

    if (variants.length === 0) {
      this.modalSelectedVariant = null;
      this.modalPrice = this.editingCartItem.price || 0;
      this.modalRegularPrice = this.editingCartItem.regularPrice || this.modalPrice;
      this.modalStock = this.getItemStock(this.editingCartItem);
      return;
    }

    // Match variant by classification, color, and size
    let matched = variants.find((v: any) => {
      const mClass = !this.hasClassification(this.editingCartItem) || !this.modalClassification || v.classification === this.modalClassification;
      const mColor = !this.hasColors(this.editingCartItem) || !this.modalColor || v.color === this.modalColor;
      const mSize = !this.hasSizes(this.editingCartItem) || !this.modalSize || v.size === this.modalSize;
      return mClass && mColor && mSize;
    });

    if (!matched) {
      matched = variants.find((v: any) => {
        const mClass = !this.modalClassification || v.classification === this.modalClassification;
        const mColor = !this.modalColor || v.color === this.modalColor;
        return mClass && mColor;
      });
    }

    if (!matched && variants.length > 0) {
      matched = variants[0];
    }

    this.modalSelectedVariant = matched;

    if (matched) {
      const vReg = Number(matched.price) || 0;
      const vDisc = Number(matched.discountPrice) || 0;
      if (vDisc > 0 && vDisc < vReg) {
        this.modalPrice = vDisc;
        this.modalRegularPrice = vReg;
      } else {
        this.modalPrice = vReg || this.editingCartItem.price;
        this.modalRegularPrice = vReg || this.editingCartItem.regularPrice;
      }

      this.modalStock = Math.max(0, Number(matched.stock) || 0);

      if (this.modalStock > 0 && this.modalQuantity > this.modalStock) {
        this.modalQuantity = this.modalStock;
      } else if (this.modalStock <= 0) {
        this.modalQuantity = 1;
      }

      if (this.modalStock <= 0) {
        this.modalError = 'Biến thể này hiện đã hết hàng, vui lòng chọn lựa chọn khác';
      } else {
        this.modalError = '';
      }
    } else {
      this.modalError = 'Không tìm thấy biến thể phù hợp';
    }
  }

  onModalSelectClassification(cls: string): void {
    this.modalClassification = cls;
    this.updateModalVariant();
  }

  onModalSelectColor(colorName: string): void {
    this.modalColor = colorName;
    this.updateModalVariant();
  }

  onModalSelectSize(sizeName: string): void {
    this.modalSize = sizeName;
    this.updateModalVariant();
  }

  increaseModalQuantity(): void {
    if (this.modalStock > 0 && this.modalQuantity < this.modalStock) {
      this.modalQuantity++;
    }
  }

  decreaseModalQuantity(): void {
    if (this.modalQuantity > 1) {
      this.modalQuantity--;
    }
  }

  onModalQuantityInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let target = parseInt(input.value, 10);
    if (isNaN(target) || target < 1) {
      target = 1;
    } else if (this.modalStock > 0 && target > this.modalStock) {
      target = this.modalStock;
      this.snackBar.open(`Tồn kho chỉ còn ${this.modalStock} sản phẩm`, 'Đóng', { duration: 2500 });
    }
    this.modalQuantity = target;
    input.value = String(target);
  }

  submitVariantModal(): void {
    if (!this.editingCartItem || !this.modalSelectedVariant) return;

    if (this.modalStock <= 0) {
      this.modalError = 'Biến thể này hiện đã hết hàng, không thể cập nhật';
      return;
    }

    const newVarId =
      this.modalSelectedVariant._id?.toString() ||
      this.modalSelectedVariant.id ||
      this.modalSelectedVariant.sku;
    const targetItemId = this.editingCartItem.id;
    const targetQty = this.modalQuantity;

    this.isModalSubmitting = true;
    this.modalError = '';

    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store
        .updateCartVariant(
          targetItemId,
          {
            variantId: newVarId,
            classification: this.modalSelectedVariant.classification,
            color: this.modalSelectedVariant.color,
            size: this.modalSelectedVariant.size,
          },
          lang,
        )
        .subscribe({
          next: (res: any) => {
            if (res && res.error) {
              this.isModalSubmitting = false;
              this.modalError = 'Cập nhật biến thể thất bại: ' + (res.error?.message || 'Lỗi server');
              return;
            }

            if (targetQty !== this.editingCartItem.qty) {
              this.store.updateCartQuantity(targetItemId, targetQty, lang).subscribe({
                next: () => {
                  this.finishModalSubmit();
                },
                error: () => {
                  this.finishModalSubmit();
                },
              });
            } else {
              this.finishModalSubmit();
            }
          },
          error: () => {
            this.isModalSubmitting = false;
            this.modalError = 'Cập nhật biến thể thất bại';
          },
        });
    });
  }

  private finishModalSubmit(): void {
    this.isModalSubmitting = false;
    this.closeVariantModal();
    this.snackBar.open('Đã cập nhật sản phẩm thành công', 'Đóng', { duration: 2500 });
    if (this.appliedCoupon && this.latestCart) {
      this.revalidateAppliedCoupon(this.latestCart);
    }
  }

  // ─── PHẦN 3: TĂNG / GIẢM / NHẬP SỐ LƯỢNG ───

  getItemStock(cartItem: any): number {
    if (cartItem?.stock !== undefined && cartItem.stock !== null && !isNaN(Number(cartItem.stock))) {
      const s = Number(cartItem.stock);
      if (s > 0) return s;
    }
    if (cartItem?.variant?.stock !== undefined && cartItem.variant.stock !== null && !isNaN(Number(cartItem.variant.stock))) {
      const s = Number(cartItem.variant.stock);
      if (s > 0) return s;
    }
    if (cartItem?.item?.quantity !== undefined && cartItem.item.quantity !== null && !isNaN(Number(cartItem.item.quantity))) {
      const s = Number(cartItem.item.quantity);
      if (s > 0) return s;
    }
    if (cartItem?.item?.vi?.quantity !== undefined && !isNaN(Number(cartItem.item.vi.quantity))) {
      const s = Number(cartItem.item.vi.quantity);
      if (s > 0) return s;
    }
    return 999;
  }

  isItemOutOfStock(cartItem: any): boolean {
    const stockStatus = cartItem?.item?.stock;
    if (stockStatus === 'out' || stockStatus === 'outOfStock' || stockStatus === 'unavailable') {
      return true;
    }
    if (cartItem?.variant && cartItem.variant.stock !== undefined && Number(cartItem.variant.stock) === 0) {
      return true;
    }
    if (cartItem?.stock !== undefined && Number(cartItem.stock) === 0 && (cartItem?.item?.quantity === 0 || cartItem?.item?.vi?.quantity === 0)) {
      return true;
    }
    return false;
  }

  increaseQuantity(cartItem: any): void {
    if (this.updatingItemId) return;
    const maxStock = this.getItemStock(cartItem);
    if (cartItem.qty >= maxStock) {
      this.snackBar.open(`Số lượng đã đạt giới hạn tồn kho (${maxStock})`, 'Đóng', { duration: 2500 });
      return;
    }

    this.updatingItemId = cartItem.id;
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.updateCartQuantity(cartItem.id, cartItem.qty + 1, lang).subscribe({
        next: (res: any) => {
          this.updatingItemId = null;
          if (res?.error) {
            this.snackBar.open('Cập nhật số lượng thất bại', 'Đóng', { duration: 2000 });
            return;
          }
          if (this.appliedCoupon && this.latestCart) {
            this.revalidateAppliedCoupon(this.latestCart);
          }
        },
        error: () => {
          this.updatingItemId = null;
          this.snackBar.open('Cập nhật số lượng thất bại', 'Đóng', { duration: 2000 });
        },
      });
    });
  }

  decreaseQuantity(cartItem: any): void {
    if (this.updatingItemId) return;
    if (cartItem.qty <= 1) {
      this.snackBar.open('Số lượng sản phẩm tối thiểu là 1', 'Đóng', { duration: 1500 });
      return;
    }

    this.updatingItemId = cartItem.id;
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.updateCartQuantity(cartItem.id, cartItem.qty - 1, lang).subscribe({
        next: (res: any) => {
          this.updatingItemId = null;
          if (res?.error) {
            this.snackBar.open('Cập nhật số lượng thất bại', 'Đóng', { duration: 2000 });
            return;
          }
          if (this.appliedCoupon && this.latestCart) {
            this.revalidateAppliedCoupon(this.latestCart);
          }
        },
        error: () => {
          this.updatingItemId = null;
          this.snackBar.open('Cập nhật số lượng thất bại', 'Đóng', { duration: 2000 });
        },
      });
    });
  }

  onQuantityInputChange(cartItem: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    let targetQty = parseInt(input.value, 10);
    const maxStock = this.getItemStock(cartItem);

    if (isNaN(targetQty) || targetQty < 1) {
      targetQty = 1;
      input.value = '1';
    } else if (maxStock > 0 && targetQty > maxStock) {
      targetQty = maxStock;
      input.value = String(maxStock);
      this.snackBar.open(`Tồn kho chỉ còn ${maxStock} sản phẩm`, 'Đóng', { duration: 2500 });
    }

    if (targetQty === cartItem.qty) return;

    this.updatingItemId = cartItem.id;
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.updateCartQuantity(cartItem.id, targetQty, lang).subscribe({
        next: (res: any) => {
          this.updatingItemId = null;
          if (res?.error) {
            input.value = String(cartItem.qty);
            this.snackBar.open('Không thể cập nhật số lượng', 'Đóng', { duration: 2000 });
            return;
          }
          if (this.appliedCoupon && this.latestCart) {
            this.revalidateAppliedCoupon(this.latestCart);
          }
        },
        error: () => {
          this.updatingItemId = null;
          input.value = String(cartItem.qty);
          this.snackBar.open('Không thể cập nhật số lượng', 'Đóng', { duration: 2000 });
        },
      });
    });
  }

  // ─── PHẦN 4: XÓA SẢN PHẨM ───

  removeSingleItem(cartItem: any): void {
    this.updatingItemId = cartItem.id;
    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.deleteCartItem(cartItem.id, lang).subscribe({
        next: (res: any) => {
          this.selectedItemIds.delete(cartItem.id);
          this.saveSelectionToStorage();
          this.updatingItemId = null;
          if (res?.error) {
            this.snackBar.open('Xóa sản phẩm thất bại', 'Đóng', { duration: 2000 });
            return;
          }
          this.snackBar.open('Đã xóa sản phẩm khỏi giỏ hàng', 'Đóng', { duration: 2000 });
          if (this.appliedCoupon && this.latestCart) {
            this.revalidateAppliedCoupon(this.latestCart);
          }
        },
        error: () => {
          this.updatingItemId = null;
          this.snackBar.open('Xóa sản phẩm thất bại', 'Đóng', { duration: 2000 });
        },
      });
    });
  }

  deleteSelectedItems(cart: Cart): void {
    const selectedIds = Array.from(this.selectedItemIds);
    if (selectedIds.length === 0) {
      this.snackBar.open('Chưa chọn sản phẩm nào để xóa', 'Đóng', { duration: 2000 });
      return;
    }

    this.lang$.pipe(take(1)).subscribe((lang) => {
      this.store.deleteCartItems(selectedIds, lang).subscribe({
        next: (res: any) => {
          this.selectedItemIds.clear();
          this.saveSelectionToStorage();
          if (res?.error) {
            this.snackBar.open('Xóa các sản phẩm thất bại', 'Đóng', { duration: 2000 });
            return;
          }
          this.snackBar.open(`Đã xóa ${selectedIds.length} sản phẩm`, 'Đóng', { duration: 2500 });
          this.store.getCart(lang);
          if (this.appliedCoupon && this.latestCart) {
            this.revalidateAppliedCoupon(this.latestCart);
          }
        },
        error: () => {
          this.snackBar.open('Xóa các sản phẩm thất bại', 'Đóng', { duration: 2000 });
        },
      });
    });
  }

  // ─── PHẦN 5 & 7: TÍNH TIỀN THEO SẢN PHẨM ĐƯỢC CHỌN ───

  getSelectedSubtotal(cart: Cart): number {
    if (!cart?.items?.length) return 0;
    return cart.items
      .filter((item: any) => this.selectedItemIds.has(item.id))
      .reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
  }

  getSelectedTotalQty(cart: Cart): number {
    if (!cart?.items?.length) return 0;
    return cart.items
      .filter((item: any) => this.selectedItemIds.has(item.id))
      .reduce((sum: number, item: any) => sum + item.qty, 0);
  }

  // ─── PHẦN 8: PHƯƠNG THỨC VẬN CHUYỂN LOGIC (DATABASE API) ───

  loadShippingMethods(): void {
    this.isLoadingShippingMethods = true;
    this.apiService.getShippingMethods().subscribe({
      next: (res: any) => {
        this.isLoadingShippingMethods = false;
        const methods = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        if (methods.length > 0) {
          this.shippingMethods = methods.map((m: any) => ({
            _id: m._id ? m._id.toString() : m.id,
            id: m._id ? m._id.toString() : (m.id || m.code),
            name: m.name,
            code: m.code,
            description: m.estimatedDeliveryTime || m.estimatedDays || m.description || '',
            fee: m.baseFee !== undefined ? m.baseFee : (m.baseCost !== undefined ? m.baseCost : 25000),
            baseFee: m.baseFee !== undefined ? m.baseFee : (m.baseCost !== undefined ? m.baseCost : 25000),
            estimatedDeliveryTime: m.estimatedDeliveryTime || m.estimatedDays || '',
            freeShippingCondition: m.freeShippingCondition || null,
          }));
          this.syncSelectedShippingMethod();
        }
      },
      error: () => {
        this.isLoadingShippingMethods = false;
      }
    });
  }

  private syncSelectedShippingMethod(): void {
    const saved = this.getStorageItem(this.shippingStorageKey);
    const hasSaved =
      saved &&
      this.shippingMethods.some(
        (m) => m.id === saved || m._id === saved || m.code === saved,
      );

    if (hasSaved) {
      const matched = this.shippingMethods.find(
        (m) => m.id === saved || m._id === saved || m.code === saved,
      );
      this.selectedShippingMethodId = matched ? matched.id : saved;
    } else if (this.shippingMethods.length > 0) {
      this.selectedShippingMethodId = this.shippingMethods[0].id;
    }
    this.saveShippingMethodToStorage();
  }

  private restoreShippingMethodFromStorage(): void {
    this.syncSelectedShippingMethod();
  }

  private saveShippingMethodToStorage(): void {
    try {
      if (this.selectedShippingMethodId) {
        this.setStorageItem(this.shippingStorageKey, this.selectedShippingMethodId);
      }
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  isSelectedShippingMethod(method: ShippingOption): boolean {
    if (!method || !this.selectedShippingMethodId) return false;
    return (
      this.selectedShippingMethodId === method.id ||
      this.selectedShippingMethodId === method._id ||
      this.selectedShippingMethodId === method.code
    );
  }

  selectShippingMethod(method: ShippingOption): void {
    if (!method) return;
    this.selectedShippingMethodId = method.id || method._id || method.code || '';
    this.saveShippingMethodToStorage();
  }

  getSelectedShippingMethod(): ShippingOption | undefined {
    if (!this.shippingMethods.length) return undefined;
    return (
      this.shippingMethods.find((m) => this.isSelectedShippingMethod(m)) ||
      this.shippingMethods[0]
    );
  }

  getShippingFee(cart: Cart): number {
    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal === 0 || !cart?.items?.length) return 0;
    const method = this.getSelectedShippingMethod();
    if (!method) return 0;

    // Kiểm tra điều kiện miễn phí ship nếu đơn hàng đạt hạn mức
    if (
      method.freeShippingCondition?.enabled &&
      method.freeShippingCondition.minimumOrderValue > 0 &&
      subtotal >= method.freeShippingCondition.minimumOrderValue
    ) {
      return 0;
    }

    return method.fee;
  }

  getDiscountAmount(cart: Cart): number {
    if (!this.appliedCoupon) return 0;
    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal <= 0) return 0;

    let discount = 0;
    if (this.appliedCoupon.discountType === 'PERCENTAGE') {
      discount = Math.round((subtotal * this.appliedCoupon.discountValue) / 100);
      if (this.appliedCoupon.discountAmount > 0 && discount > this.appliedCoupon.discountAmount) {
        discount = this.appliedCoupon.discountAmount;
      }
    } else {
      discount = this.appliedCoupon.discountValue;
    }
    return Math.min(discount, subtotal);
  }

  // ─── PHẦN 9: PHƯƠNG THỨC THANH TOÁN LOGIC (DATABASE API) ───

  loadPaymentMethods(): void {
    this.isLoadingPaymentMethods = true;
    this.apiService.getPaymentMethods().subscribe({
      next: (res: any) => {
        this.isLoadingPaymentMethods = false;
        const methods = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        // CHỈ hiển thị các phương thức có status === 'ACTIVE'
        this.paymentMethods = methods.filter((m: any) => m.status === 'ACTIVE');
        this.syncSelectedPaymentMethod();
      },
      error: () => {
        this.isLoadingPaymentMethods = false;
        this.paymentMethods = [];
        this.syncSelectedPaymentMethod();
      },
    });
  }

  private syncSelectedPaymentMethod(): void {
    const saved = this.getStorageItem(this.paymentStorageKey);
    const hasSaved =
      saved &&
      this.paymentMethods.some(
        (m) => m._id === saved || m.code === saved,
      );

    if (hasSaved) {
      const matched = this.paymentMethods.find(
        (m) => m._id === saved || m.code === saved,
      );
      this.selectedPaymentMethodId = matched ? (matched._id || matched.code) : saved;
    } else if (this.paymentMethods.length > 0) {
      // Ưu tiên chọn COD nếu có trong danh sách active, nếu không chọn phương thức đầu tiên
      const cod = this.paymentMethods.find((m) => m.code === 'COD');
      this.selectedPaymentMethodId = cod ? (cod._id || cod.code) : (this.paymentMethods[0]._id || this.paymentMethods[0].code);
    } else {
      this.selectedPaymentMethodId = '';
    }

    this.paymentMethodControl.setValue(this.selectedPaymentMethodId);
    if (this.selectedPaymentMethodId) {
      this.savePaymentMethodToStorage();
    }
  }

  private savePaymentMethodToStorage(): void {
    try {
      if (this.selectedPaymentMethodId) {
        this.setStorageItem(this.paymentStorageKey, this.selectedPaymentMethodId);
      }
    } catch {
      // Bỏ qua lỗi storage
    }
  }

  isSelectedPaymentMethod(method: PaymentMethod): boolean {
    if (!method || !this.selectedPaymentMethodId) return false;
    return (
      this.selectedPaymentMethodId === method._id ||
      this.selectedPaymentMethodId === method.code
    );
  }

  selectPaymentMethod(method: PaymentMethod): void {
    if (!method) return;
    this.selectedPaymentMethodId = method._id || method.code;
    this.paymentMethodControl.setValue(this.selectedPaymentMethodId);
    this.savePaymentMethodToStorage();
  }

  onPaymentMethodRadioChange(value: string): void {
    this.selectedPaymentMethodId = value;
    this.paymentMethodControl.setValue(value);
    this.savePaymentMethodToStorage();
  }

  getSelectedPaymentMethod(): PaymentMethod | undefined {
    if (!this.paymentMethods.length) return undefined;
    return (
      this.paymentMethods.find((m) => this.isSelectedPaymentMethod(m)) ||
      this.paymentMethods[0]
    );
  }

  getPaymentMethodIcon(method: PaymentMethod): string {
    if (!method) return 'payment';
    switch (method.paymentType) {
      case 'CASH':
        return 'local_atm';
      case 'PAYMENT_GATEWAY':
        return 'credit_card';
      case 'BANK_TRANSFER':
        return 'account_balance';
      case 'E_WALLET':
        return 'account_balance_wallet';
      default:
        return 'payment';
    }
  }

  calculateMethodFee(method: PaymentMethod | undefined, cart: Cart): number {
    if (!method?.transactionFee?.enabled) return 0;
    const subtotal = this.getSelectedSubtotal(cart);
    if (method.transactionFee.type === 'PERCENTAGE') {
      return Math.round((subtotal * method.transactionFee.value) / 100);
    }
    return method.transactionFee.value || 0;
  }

  getPaymentFee(cart: Cart): number {
    const method = this.getSelectedPaymentMethod();
    return this.calculateMethodFee(method, cart);
  }

  getFinalTotalForMethod(method: PaymentMethod, cart: Cart): number {
    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal === 0 || !cart?.items?.length) return 0;
    const shipping = this.getShippingFee(cart);
    const paymentFee = this.calculateMethodFee(method, cart);
    const discount = this.getDiscountAmount(cart);
    return Math.max(0, subtotal + shipping + paymentFee - discount);
  }

  getFinalTotal(cart: Cart): number {
    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal === 0 || !cart?.items?.length) return 0;
    const shipping = this.getShippingFee(cart);
    const paymentFee = this.getPaymentFee(cart);
    const discount = this.getDiscountAmount(cart);
    return Math.max(0, subtotal + shipping + paymentFee - discount);
  }

  isCardPaymentSelected(): boolean {
    const method = this.getSelectedPaymentMethod();
    if (!method) return false;
    return (
      method.code === 'STRIPE' ||
      method.code === 'CARD' ||
      method.paymentType === 'PAYMENT_GATEWAY'
    );
  }

  // ─── PHẦN 6: MÃ GIẢM GIÁ (COUPON) ───

  applyCoupon(cart: Cart): void {
    this.couponError = '';
    this.couponSuccess = '';

    const code = this.couponInput.trim().toUpperCase();
    if (!code) {
      this.couponError = 'Vui lòng nhập mã giảm giá';
      return;
    }

    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal === 0) {
      this.couponError = 'Vui lòng chọn ít nhất 1 sản phẩm trước khi áp dụng mã';
      return;
    }

    this.isApplyingCoupon = true;
    this.apiService.validateCoupon(code, subtotal).subscribe({
      next: (res: any) => {
        this.isApplyingCoupon = false;
        if (res.valid) {
          this.appliedCoupon = {
            code: res.code,
            description: res.description,
            discountType: res.discountType,
            discountValue: res.discountValue,
            discountAmount: res.discountAmount,
          };
          this.couponSuccess = res.message || `Đã áp dụng mã giảm giá ${res.code}`;
          this.snackBar.open(this.couponSuccess, 'Đóng', { duration: 3000 });
        } else {
          this.appliedCoupon = null;
          this.couponError = res.message || 'Mã giảm giá không hợp lệ hoặc không đủ điều kiện';
        }
      },
      error: () => {
        this.isApplyingCoupon = false;
        this.couponError = 'Lỗi kết nối khi kiểm tra mã giảm giá';
      }
    });
  }

  removeCoupon(): void {
    this.appliedCoupon = null;
    this.couponInput = '';
    this.couponError = '';
    this.couponSuccess = '';
    this.snackBar.open('Đã gỡ bỏ mã giảm giá', 'Đóng', { duration: 2000 });
  }

  private revalidateAppliedCoupon(cart: Cart): void {
    if (!this.appliedCoupon) return;
    const subtotal = this.getSelectedSubtotal(cart);
    if (subtotal <= 0) {
      this.appliedCoupon = null;
      this.couponError = 'Đã gỡ mã do không có sản phẩm nào được chọn';
      return;
    }

    this.apiService.validateCoupon(this.appliedCoupon.code, subtotal).subscribe({
      next: (res: any) => {
        if (res.valid) {
          this.appliedCoupon = {
            code: res.code,
            description: res.description,
            discountType: res.discountType,
            discountValue: res.discountValue,
            discountAmount: res.discountAmount,
          };
        } else {
          this.appliedCoupon = null;
          this.couponError = res.message || 'Đơn hàng không còn đủ điều kiện áp dụng mã';
        }
      }
    });
  }

  // ─── ĐỊA CHỈ & THÔNG TIN ĐẶT HÀNG ───

  private hasResolvedUserAddress = false;

  private cleanUnitName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/^(thành phố|tỉnh|quận|huyện|thị xã|phường|xã|thị trấn|tp\.|tp|tx\.|q\.|h\.|p\.|x\.|tt\.)\s+/i, '')
      .trim();
  }

  private autoFillUserData(): void {
    this.user$.pipe(take(1)).subscribe((user: User) => {
      if (user) {
        const patchData: any = {};
        if (user.fullName || user.name) {
          patchData.name = user.fullName || user.name;
        }
        if (user.email) {
          patchData.email = user.email;
        }
        if ((user as any).phoneNumber) {
          patchData.phone = (user as any).phoneNumber;
        }
        if (Object.keys(patchData).length > 0) {
          this.orderForm.patchValue(patchData);
        }

        // Pre-fill an toàn từ users.address nếu người dùng đã lưu địa chỉ mặc định
        const rawAddress = (user.address || '').trim();
        if (rawAddress && !this.hasResolvedUserAddress) {
          this.resolveAndPrefillUserAddress(rawAddress);
        }
      }
    });
  }

  private resolveAndPrefillUserAddress(rawAddress: string): void {
    if (!rawAddress) return;
    this.hasResolvedUserAddress = true;

    if (this.provinces && this.provinces.length > 0) {
      this.executeAddressParsing(rawAddress, this.provinces);
    } else {
      this.addressService.getProvinces().pipe(take(1)).subscribe({
        next: (provincesList) => {
          if (provincesList && provincesList.length > 0) {
            this.provinces = provincesList;
            this.executeAddressParsing(rawAddress, provincesList);
          } else {
            // Không tải được danh mục tỉnh: giữ nguyên rawAddress trong addressDetail
            if (!this.orderForm.get('addressDetail')?.value) {
              this.orderForm.patchValue({ addressDetail: rawAddress });
            }
          }
        },
        error: () => {
          if (!this.orderForm.get('addressDetail')?.value) {
            this.orderForm.patchValue({ addressDetail: rawAddress });
          }
        }
      });
    }
  }

  private executeAddressParsing(rawAddress: string, provincesList: AdministrativeUnit[]): void {
    const trimmed = (rawAddress || '').trim();
    if (!trimmed || !provincesList || provincesList.length === 0) return;

    // Không can thiệp nếu người dùng đã tự tay chọn tỉnh khác
    if (this.orderForm.get('provinceCode')?.value) return;

    const lowerAddr = trimmed.toLowerCase();

    // 1. Đối chiếu Tỉnh / Thành phố
    let matchedProvince: AdministrativeUnit | null = null;
    let matchedProvIdx = -1;
    let matchedProvLen = 0;

    for (const p of provincesList) {
      const full = p.name.toLowerCase();
      const clean = this.cleanUnitName(p.name);

      const aliases = [full, clean];
      if (clean === 'hồ chí minh') {
        aliases.push('tp.hcm', 'tphcm', 'tp hcm', 'sài gòn', 'sai gon');
      } else if (clean === 'thừa thiên huế') {
        aliases.push('huế');
      } else if (clean === 'bà rịa - vũng tàu') {
        aliases.push('bà rịa vũng tàu', 'vũng tàu');
      }

      for (const alias of aliases) {
        if (!alias || alias.length < 2) continue;
        const idx = lowerAddr.lastIndexOf(alias);
        if (idx !== -1) {
          const len = alias.length;
          if (idx > matchedProvIdx || (idx === matchedProvIdx && len > matchedProvLen)) {
            matchedProvIdx = idx;
            matchedProvLen = len;
            matchedProvince = p;
          }
        }
      }
    }

    // Nếu không khớp được Tỉnh/Thành phố:
    // KHÔNG đoán mò, giữ nguyên rawAddress trong addressDetail để user tham khảo, select để trống
    if (!matchedProvince || matchedProvIdx === -1) {
      if (!this.orderForm.get('addressDetail')?.value) {
        this.orderForm.patchValue({ addressDetail: trimmed });
      }
      return;
    }

    // Gán Tỉnh / Thành phố vào form
    this.orderForm.patchValue({
      provinceCode: matchedProvince.code,
      provinceName: matchedProvince.name,
    });

    // Phần chuỗi địa chỉ nằm trước Tỉnh/Thành phố
    const remainingAfterProv = trimmed.substring(0, matchedProvIdx).replace(/[,;\s\-]+$/, '').trim();

    this.isDistrictsLoading = true;
    this.addressService.getDistricts(matchedProvince.code).pipe(take(1)).subscribe({
      next: (districtsList) => {
        this.districts = districtsList || [];
        this.isDistrictsLoading = false;
        this.orderForm.get('districtCode')?.enable();

        if (!remainingAfterProv || this.districts.length === 0) {
          if (remainingAfterProv && !this.orderForm.get('addressDetail')?.value) {
            this.orderForm.patchValue({ addressDetail: remainingAfterProv });
          }
          return;
        }

        const lowerRemProv = remainingAfterProv.toLowerCase();
        let matchedDistrict: AdministrativeUnit | null = null;
        let matchedDistIdx = -1;
        let matchedDistLen = 0;

        for (const d of this.districts) {
          const fullD = d.name.toLowerCase();
          const cleanD = this.cleanUnitName(d.name);
          const aliasesD = [fullD, cleanD];

          for (const alias of aliasesD) {
            if (!alias || alias.length < 2) continue;
            const idx = lowerRemProv.lastIndexOf(alias);
            if (idx !== -1) {
              const len = alias.length;
              if (idx > matchedDistIdx || (idx === matchedDistIdx && len > matchedDistLen)) {
                matchedDistIdx = idx;
                matchedDistLen = len;
                matchedDistrict = d;
              }
            }
          }
        }

        // Nếu không khớp được Quận/Huyện:
        // Đưa phần còn lại vào addressDetail, để dropdown Quận/Huyện cho user chọn lại
        if (!matchedDistrict || matchedDistIdx === -1) {
          if (!this.orderForm.get('addressDetail')?.value) {
            this.orderForm.patchValue({ addressDetail: remainingAfterProv });
          }
          return;
        }

        // Gán Quận / Huyện vào form
        this.orderForm.patchValue({
          districtCode: matchedDistrict.code,
          districtName: matchedDistrict.name,
        });

        // Phần chuỗi địa chỉ nằm trước Quận/Huyện
        const remainingAfterDist = remainingAfterProv.substring(0, matchedDistIdx).replace(/[,;\s\-]+$/, '').trim();

        this.isWardsLoading = true;
        this.addressService.getWards(matchedDistrict.code).pipe(take(1)).subscribe({
          next: (wardsList) => {
            this.wards = wardsList || [];
            this.isWardsLoading = false;
            this.orderForm.get('wardCode')?.enable();

            if (!remainingAfterDist || this.wards.length === 0) {
              if (remainingAfterDist && !this.orderForm.get('addressDetail')?.value) {
                this.orderForm.patchValue({ addressDetail: remainingAfterDist });
              }
              return;
            }

            const lowerRemDist = remainingAfterDist.toLowerCase();
            let matchedWard: AdministrativeUnit | null = null;
            let matchedWardIdx = -1;
            let matchedWardLen = 0;

            for (const w of this.wards) {
              const fullW = w.name.toLowerCase();
              const cleanW = this.cleanUnitName(w.name);
              const aliasesW = [fullW, cleanW];

              for (const alias of aliasesW) {
                if (!alias || alias.length < 2) continue;
                const idx = lowerRemDist.lastIndexOf(alias);
                if (idx !== -1) {
                  const len = alias.length;
                  if (idx > matchedWardIdx || (idx === matchedWardIdx && len > matchedWardLen)) {
                    matchedWardIdx = idx;
                    matchedWardLen = len;
                    matchedWard = w;
                  }
                }
              }
            }

            if (matchedWard && matchedWardIdx !== -1) {
              this.orderForm.patchValue({
                wardCode: matchedWard.code,
                wardName: matchedWard.name,
              });

              // Phần còn lại trước Phường/Xã chính là số nhà, tên đường
              const detail = remainingAfterDist.substring(0, matchedWardIdx).replace(/[,;\s\-]+$/, '').trim();
              if (detail && !this.orderForm.get('addressDetail')?.value) {
                this.orderForm.patchValue({ addressDetail: detail });
              }
            } else {
              // Không khớp được Phường/Xã: đưa phần còn lại vào addressDetail để user chọn Phường/Xã
              if (!this.orderForm.get('addressDetail')?.value) {
                this.orderForm.patchValue({ addressDetail: remainingAfterDist });
              }
            }
          },
          error: () => {
            this.isWardsLoading = false;
            if (remainingAfterDist && !this.orderForm.get('addressDetail')?.value) {
              this.orderForm.patchValue({ addressDetail: remainingAfterDist });
            }
          }
        });
      },
      error: () => {
        this.isDistrictsLoading = false;
        if (remainingAfterProv && !this.orderForm.get('addressDetail')?.value) {
          this.orderForm.patchValue({ addressDetail: remainingAfterProv });
        }
      }
    });
  }

  loadProvinces(callback?: () => void): void {
    this.isProvincesLoading = true;
    this.provincesError = '';
    this.addressService.getProvinces().subscribe({
      next: (data) => {
        this.provinces = data || [];
        this.isProvincesLoading = false;
        if (callback) callback();
      },
      error: () => {
        this.provincesError = 'Không thể tải danh sách Tỉnh/Thành phố. Vui lòng thử lại.';
        this.isProvincesLoading = false;
      }
    });
  }

  onProvinceChange(code: number | string): void {
    const selected = this.provinces.find(p => String(p.code) === String(code));
    this.orderForm.patchValue({
      provinceName: selected ? selected.name : '',
      districtCode: '',
      districtName: '',
      wardCode: '',
      wardName: ''
    });

    this.districts = [];
    this.wards = [];
    this.orderForm.get('districtCode')?.disable();
    this.orderForm.get('wardCode')?.disable();
    this.districtsError = '';
    this.wardsError = '';

    if (code) {
      this.loadDistricts(code);
    }
  }

  loadDistricts(provinceCode: number | string): void {
    this.isDistrictsLoading = true;
    this.districtsError = '';
    this.addressService.getDistricts(provinceCode).subscribe({
      next: (data) => {
        this.districts = data || [];
        this.isDistrictsLoading = false;
        this.orderForm.get('districtCode')?.enable();
      },
      error: () => {
        this.districtsError = 'Không thể tải danh sách Quận/Huyện. Vui lòng thử lại.';
        this.isDistrictsLoading = false;
      }
    });
  }

  onDistrictChange(code: number | string): void {
    const selected = this.districts.find(d => String(d.code) === String(code));
    this.orderForm.patchValue({
      districtName: selected ? selected.name : '',
      wardCode: '',
      wardName: ''
    });

    this.wards = [];
    this.orderForm.get('wardCode')?.disable();
    this.wardsError = '';

    if (code) {
      this.loadWards(code);
    }
  }

  loadWards(districtCode: number | string): void {
    this.isWardsLoading = true;
    this.wardsError = '';
    this.addressService.getWards(districtCode).subscribe({
      next: (data) => {
        this.wards = data || [];
        this.isWardsLoading = false;
        this.orderForm.get('wardCode')?.enable();
      },
      error: () => {
        this.wardsError = 'Không thể tải danh sách Phường/Xã. Vui lòng thử lại.';
        this.isWardsLoading = false;
      }
    });
  }

  onWardChange(code: number | string): void {
    const selected = this.wards.find(w => String(w.code) === String(code));
    this.orderForm.patchValue({
      wardName: selected ? selected.name : ''
    });
  }

  goBack(): void {
    this.location.back();
  }

  scrollToTop(): void {
    this.store.updatePosition({ cartComponent: 0 });
  }

  // ─── PHẦN 9: TIẾN HÀNH ĐẶT HÀNG (CHECKOUT CHỈ GỬI SẢN PHẨM ĐÃ CHỌN) ───

  private buildOrderPayload(user: User | null, currency?: string, cart?: Cart) {
    const formValue = this.orderForm.getRawValue();
    const userToOrder = user ? { userId: user.id || (user as any)._id } : {};

    const provinceName = formValue.provinceName || '';
    const districtName = formValue.districtName || '';
    const wardName = formValue.wardName || '';
    const addressDetail = (formValue.addressDetail || '').trim();
    const fullAddress = [addressDetail, wardName, districtName, provinceName].filter(Boolean).join(', ');

    const shippingAddress = {
      fullName: (formValue.name || '').trim(),
      phone: (formValue.phone || '').trim(),
      address: fullAddress,
      addressDetail,
      provinceCode: String(formValue.provinceCode || ''),
      provinceName,
      province: provinceName,
      districtCode: String(formValue.districtCode || ''),
      districtName,
      district: districtName,
      wardCode: String(formValue.wardCode || ''),
      wardName,
      ward: wardName,
    };

    const addresses = [{
      name: shippingAddress.fullName,
      phone: shippingAddress.phone,
      city: provinceName,
      country: 'Việt Nam',
      line1: addressDetail,
      line2: [wardName, districtName].filter(Boolean).join(', '),
      zip: String(formValue.districtCode || '700000'),
      province: provinceName,
      district: districtName,
      ward: wardName,
    }];

    // Lọc danh sách ID các sản phẩm đã được chọn
    const selectedIds = Array.from(this.selectedItemIds);
    const subtotal = cart ? this.getSelectedSubtotal(cart) : 0;
    const discountAmount = cart ? this.getDiscountAmount(cart) : 0;
    const shippingMethod = this.getSelectedShippingMethod();
    const shippingFee = cart ? this.getShippingFee(cart) : (shippingMethod?.fee || 0);
    const paymentMethod = this.getSelectedPaymentMethod();
    const paymentFee = cart ? this.getPaymentFee(cart) : (this.calculateMethodFee(paymentMethod, cart) || 0);

    return {
      ...userToOrder,
      name: shippingAddress.fullName,
      email: (formValue.email || '').trim(),
      phone: shippingAddress.phone,
      customerPhone: shippingAddress.phone,
      notes: (formValue.notes || '').trim(),
      shippingAddress,
      addresses,
      selectedItemIds: selectedIds,
      couponCode: this.appliedCoupon ? this.appliedCoupon.code : '',
      couponDiscount: discountAmount,
      shippingMethodId: shippingMethod?._id || shippingMethod?.id || '',
      shippingMethodName: shippingMethod?.name || '',
      shippingFee,
      paymentMethodId: paymentMethod?._id || paymentMethod?.code || '',
      paymentMethodName: paymentMethod?.name || '',
      paymentFee,
      currency: currency || 'VND',
    };
  }

  payWithCard(payment: any): void {
    if (this.selectedItemIds.size === 0) {
      this.snackBar.open('Vui lòng chọn ít nhất 1 sản phẩm để thanh toán', 'Đóng', { duration: 3000 });
      return;
    }

    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    if (this.paymentMethodControl.invalid || !this.selectedPaymentMethodId) {
      this.snackBar.open('Vui lòng chọn phương thức thanh toán', 'Đóng', { duration: 3000 });
      return;
    }

    const selectedMethod = this.getSelectedPaymentMethod();
    this.user$.pipe(take(1)).subscribe((user: User) => {
      const orderPayload = this.buildOrderPayload(user, undefined, this.latestCart || undefined);
      const paymentRequest = {
        ...payment,
        ...orderPayload,
        paymentMethodId: selectedMethod?._id || selectedMethod?.code || '',
      };
      this.store.makeOrderWithPayment(paymentRequest);
    });
  }

  submit(currency: string): void {
    if (this.selectedItemIds.size === 0) {
      this.snackBar.open('Vui lòng chọn ít nhất 1 sản phẩm để thanh toán', 'Đóng', { duration: 3000 });
      return;
    }

    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    if (this.paymentMethodControl.invalid || !this.selectedPaymentMethodId) {
      this.snackBar.open('Vui lòng chọn phương thức thanh toán', 'Đóng', { duration: 3000 });
      return;
    }

    const selectedMethod = this.getSelectedPaymentMethod();
    this.user$.pipe(take(1)).subscribe((user: User) => {
      const orderRequest = this.buildOrderPayload(user, currency, this.latestCart || undefined);
      orderRequest.paymentMethodId = selectedMethod?._id || selectedMethod?.code || '';
      this.store.makeOrder(orderRequest);
      this.scrollToTop();
    });
  }
}
