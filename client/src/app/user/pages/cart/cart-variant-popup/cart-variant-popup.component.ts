import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SignalStore } from '../../../../store/signal.store';

@Component({
  selector: 'app-cart-variant-popup',
  templateUrl: './cart-variant-popup.component.html',
  styleUrls: ['./cart-variant-popup.component.css'],
  standalone: false
})
export class CartVariantPopupComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() cartItem: any = null;
  @Input() currency: string | null = 'đ';
  @Input() lang: string = 'vi';

  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  modalClassification = '';
  modalColor = '';
  modalSize = '';
  modalQuantity = 1;
  modalPrice = 0;
  modalRegularPrice = 0;
  modalStock = 0;
  modalSelectedVariant: any = null;
  modalError = '';
  isModalSubmitting = false;

  constructor(
    private store: SignalStore,
    private snackBar: MatSnackBar,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.isOpen && this.cartItem) {
      this.initModalData();
    }
  }

  private initModalData(): void {
    if (!this.cartItem) return;

    this.modalClassification = this.getSelectedClassification();
    this.modalColor = this.getSelectedColor();
    this.modalSize = this.getSelectedSize();
    this.modalQuantity = this.cartItem.qty || 1;
    this.modalError = '';
    this.isModalSubmitting = false;

    this.updateModalVariant();
  }

  getSelectedClassification(): string {
    return (
      this.cartItem?.selectedClassification ||
      this.cartItem?.variant?.classification ||
      ''
    );
  }

  getSelectedColor(): string {
    return (
      this.cartItem?.selectedColor ||
      this.cartItem?.variant?.color ||
      ''
    );
  }

  getSelectedSize(): string {
    return (
      this.cartItem?.selectedSize ||
      this.cartItem?.variant?.size ||
      ''
    );
  }

  hasClassification(): boolean {
    const p = this.cartItem?.item;
    if (!p) return false;
    if (p.hasClassification !== undefined) return !!p.hasClassification;
    return Array.isArray(p.classifications) && p.classifications.length > 0;
  }

  hasColors(): boolean {
    const p = this.cartItem?.item;
    if (!p) return false;
    if (p.hasColors !== undefined) return !!p.hasColors;
    return Array.isArray(p.colors) && p.colors.length > 0;
  }

  hasSizes(): boolean {
    const p = this.cartItem?.item;
    if (!p) return false;
    if (p.hasSizes !== undefined) return !!p.hasSizes;
    return Array.isArray(p.sizes) && p.sizes.length > 0;
  }

  getAvailableClassifications(): string[] {
    const p = this.cartItem?.item;
    if (!p) return [];
    if (Array.isArray(p.classifications) && p.classifications.length > 0) {
      return p.classifications;
    }
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    const set = new Set<string>();
    for (const v of variants) {
      if (v.classification) set.add(v.classification);
    }
    return Array.from(set);
  }

  getAvailableColors(): { name: string; hex?: string }[] {
    const p = this.cartItem?.item;
    if (!p) return [];
    if (Array.isArray(p.colors) && p.colors.length > 0) {
      return p.colors.map((c: any) =>
        typeof c === 'string'
          ? { name: c, hex: '#74070E' }
          : { name: c.name || c.color || '', hex: c.hex || '#74070E' },
      );
    }
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    const map = new Map<string, string>();
    for (const v of variants) {
      if (v.color && !map.has(v.color)) {
        map.set(v.color, v.colorHex || '#74070E');
      }
    }
    return Array.from(map.entries()).map(([name, hex]) => ({ name, hex }));
  }

  getAvailableSizes(): string[] {
    const p = this.cartItem?.item;
    if (!p) return [];
    if (Array.isArray(p.sizes) && p.sizes.length > 0) {
      return p.sizes;
    }
    const variants: any[] = Array.isArray(p.variants) ? p.variants : [];
    const set = new Set<string>();
    for (const v of variants) {
      if (v.size) set.add(v.size);
    }
    return Array.from(set);
  }

  updateModalVariant(): void {
    if (!this.cartItem) return;
    const variants: any[] = Array.isArray(this.cartItem?.item?.variants)
      ? this.cartItem.item.variants
      : [];

    if (variants.length === 0) {
      this.modalSelectedVariant = this.cartItem?.variant || null;
      this.modalPrice = this.cartItem?.price || 0;
      this.modalRegularPrice = this.cartItem?.regularPrice || this.modalPrice;
      this.modalStock = Math.max(0, Number(this.cartItem?.stock) || 0);
      return;
    }

    // Match variant by classification, color, and size
    let matched = variants.find((v: any) => {
      const mClass =
        !this.hasClassification() ||
        !this.modalClassification ||
        v.classification === this.modalClassification;
      const mColor =
        !this.hasColors() || !this.modalColor || v.color === this.modalColor;
      const mSize =
        !this.hasSizes() || !this.modalSize || v.size === this.modalSize;
      return mClass && mColor && mSize;
    });

    if (!matched) {
      matched = variants.find((v: any) => {
        const mClass =
          !this.modalClassification ||
          v.classification === this.modalClassification;
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
        this.modalPrice = vReg || this.cartItem.price;
        this.modalRegularPrice = vReg || this.cartItem.regularPrice;
      }

      this.modalStock = Math.max(0, Number(matched.stock) || 0);

      if (this.modalStock > 0 && this.modalQuantity > this.modalStock) {
        this.modalQuantity = this.modalStock;
      } else if (this.modalStock <= 0) {
        this.modalQuantity = 1;
      }

      if (this.modalStock <= 0) {
        this.modalError =
          'Biến thể này hiện đã hết hàng, vui lòng chọn lựa chọn khác';
      } else {
        this.modalError = '';
      }
    } else {
      this.modalError = 'Không tìm thấy biến thể phù hợp';
    }
  }

  onSelectClassification(cls: string): void {
    this.modalClassification = cls;
    this.updateModalVariant();
  }

  onSelectColor(colorName: string): void {
    this.modalColor = colorName;
    this.updateModalVariant();
  }

  onSelectSize(sizeName: string): void {
    this.modalSize = sizeName;
    this.updateModalVariant();
  }

  increaseQuantity(): void {
    if (this.modalStock > 0 && this.modalQuantity < this.modalStock) {
      this.modalQuantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.modalQuantity > 1) {
      this.modalQuantity--;
    }
  }

  onQuantityInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let target = parseInt(input.value, 10);
    if (isNaN(target) || target < 1) {
      target = 1;
    } else if (this.modalStock > 0 && target > this.modalStock) {
      target = this.modalStock;
      this.snackBar.open(
        `Tồn kho chỉ còn ${this.modalStock} sản phẩm`,
        'Đóng',
        { duration: 2500 },
      );
    }
    this.modalQuantity = target;
    input.value = String(target);
  }

  onCancel(): void {
    this.modalError = '';
    this.isModalSubmitting = false;
    this.close.emit();
  }

  onSubmit(): void {
    if (!this.cartItem || !this.modalSelectedVariant) return;

    if (this.modalStock <= 0) {
      this.modalError = 'Biến thể này hiện đã hết hàng, không thể cập nhật';
      return;
    }

    const newVarId =
      this.modalSelectedVariant._id?.toString() ||
      this.modalSelectedVariant.id ||
      this.modalSelectedVariant.sku;
    const targetItemId = this.cartItem.id;
    const targetQty = this.modalQuantity;

    this.isModalSubmitting = true;
    this.modalError = '';

    const lang = this.lang || 'vi';

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
            this.modalError =
              'Cập nhật biến thể thất bại: ' +
              (res.error?.message || 'Lỗi server');
            return;
          }

          if (targetQty !== this.cartItem.qty) {
            this.store.updateCartQuantity(targetItemId, targetQty, lang).subscribe({
              next: () => {
                this.finishSubmit();
              },
              error: () => {
                this.finishSubmit();
              },
            });
          } else {
            this.finishSubmit();
          }
        },
        error: () => {
          this.isModalSubmitting = false;
          this.modalError = 'Có lỗi xảy ra khi cập nhật biến thể vào giỏ hàng';
        },
      });
  }

  private finishSubmit(): void {
    const lang = this.lang || 'vi';
    this.store.getCart(lang);
    this.isModalSubmitting = false;
    this.modalError = '';
    this.snackBar.open('Đã cập nhật sản phẩm trong giỏ hàng', 'Đóng', {
      duration: 2500,
    });
    this.updated.emit();
    this.close.emit();
  }
}
