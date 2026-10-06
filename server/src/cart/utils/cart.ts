import { Product } from '../../products/models/product.model';
import { CartModel } from './../models/cart.model';

export class Cart {
  items: Product[];

  constructor(previousCart: CartModel) {
    this.items = previousCart.items || [];
  }

  add = function (item: Product, id: string, options?: any): void {
    const qtyToAdd = Math.max(1, Math.floor(Number(options?.qty) || 1));
    const targetVarId = (options?.variantId !== undefined && options?.variantId !== null && options?.variantId !== '')
      ? String(options.variantId).trim()
      : null;
    const targetProdId = (item?._id || item?.id || (typeof id === 'string' ? id.split('_')[0] : '')).toString();

    const existingItem = this.items.find((cartItem: any) => {
      const itemProdId = (cartItem.item?._id || cartItem.item?.id || (typeof cartItem.id === 'string' ? cartItem.id.split('_')[0] : '')).toString();
      const itemVarId = (cartItem.variantId !== undefined && cartItem.variantId !== null && cartItem.variantId !== '')
        ? String(cartItem.variantId).trim()
        : null;

      // Identity chuẩn: Cùng productId VÀ Cùng variantId (bao gồm cả khi cả 2 cùng không có variant = null)
      const isSameProduct = Boolean(itemProdId && targetProdId && itemProdId === targetProdId);
      const isSameVariant = itemVarId === targetVarId;

      return (cartItem.id === id) || (isSameProduct && isSameVariant);
    });

    if (!existingItem) {
      this.items.push({
        item,
        id,
        qty: qtyToAdd,
        isSelected: true,
        variantId: targetVarId,
        selectedClassification: options?.selectedClassification || null,
        selectedColor: options?.selectedColor || null,
        selectedSize: options?.selectedSize || null,
        variant: options?.variant || null,
      });
    } else {
      existingItem.qty = (Number(existingItem.qty) || 0) + qtyToAdd;
      existingItem.id = id;
      if (targetVarId) {
        existingItem.variantId = targetVarId;
      }
      if (options?.variant && !existingItem.variant) {
        existingItem.variant = options.variant;
      }
      if (options?.selectedClassification && !existingItem.selectedClassification) {
        existingItem.selectedClassification = options.selectedClassification;
      }
      if (options?.selectedColor && !existingItem.selectedColor) {
        existingItem.selectedColor = options.selectedColor;
      }
      if (options?.selectedSize && !existingItem.selectedSize) {
        existingItem.selectedSize = options.selectedSize;
      }
    }
  };

  remove = function (id: string): void {
    this.items = this.items
      .map((cartItem) => {
        if (cartItem.id === id && cartItem.qty > 1) {
          cartItem.qty--;
        } else if (cartItem.id === id && cartItem.qty === 1) {
          cartItem = {};
        }
        return cartItem;
      })
      .filter((cartItem) => cartItem.id);
  };

  setQty = function (id: string, qty: number): void {
    const targetQty = Math.max(1, Math.floor(qty));
    this.items = this.items.map((cartItem) => {
      if (cartItem.id === id) {
        cartItem.qty = targetQty;
      }
      return cartItem;
    });
  };

  updateVariant = function (
    id: string,
    newVariantData: {
      variantId?: string;
      classification?: string;
      color?: string;
      size?: string;
      variant?: any;
      targetQty?: number;
    },
  ): void {
    const targetItem = this.items.find((ci: any) => ci.id === id);
    if (!targetItem) return;

    const prodId = targetItem.item?._id?.toString() || targetItem.item?.id;
    const newVarId = newVariantData.variantId;

    // Check if another item in cart already has the target variant
    const duplicateItem = this.items.find((ci: any) => {
      const otherProdId = ci.item?._id?.toString() || ci.item?.id;
      return ci.id !== id && otherProdId === prodId && ci.variantId === newVarId;
    });

    if (duplicateItem) {
      // Merge quantity into duplicateItem and remove targetItem
      duplicateItem.qty += newVariantData.targetQty || targetItem.qty;
      this.items = this.items.filter((ci: any) => ci.id !== id);
    } else {
      // Update targetItem in place
      targetItem.variantId = newVarId || targetItem.variantId;
      targetItem.selectedClassification =
        newVariantData.classification || targetItem.selectedClassification;
      targetItem.selectedColor = newVariantData.color || targetItem.selectedColor;
      targetItem.selectedSize = newVariantData.size || targetItem.selectedSize;
      targetItem.variant = newVariantData.variant || targetItem.variant;
      if (newVariantData.targetQty) {
        targetItem.qty = newVariantData.targetQty;
      }
    }
  };

  toggleSelect = function (id: string, isSelected: boolean): void {
    this.items = this.items.map((cartItem) => {
      if (cartItem.id === id) {
        cartItem.isSelected = Boolean(isSelected);
      }
      return cartItem;
    });
  };

  selectAll = function (isSelected: boolean): void {
    this.items = this.items.map((cartItem) => {
      cartItem.isSelected = Boolean(isSelected);
      return cartItem;
    });
  };

  removeItemCompletely = function (id: string): void {
    this.items = this.items.filter((cartItem) => cartItem.id !== id);
  };

  removeMultiple = function (ids: string[]): void {
    const idSet = new Set(ids);
    this.items = this.items.filter((cartItem) => !idSet.has(cartItem.id));
  };

  check = function (id: string): any {
    return this.items.find((cartItem) => cartItem.id === id);
  };
}
