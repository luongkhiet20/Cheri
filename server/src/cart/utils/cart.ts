import { Product } from '../../products/models/product.model';
import { CartModel } from './../models/cart.model';

export class Cart {
  items: Product[];

  constructor(previousCart: CartModel) {
    this.items = previousCart.items || [];
  }

  add = function (item: Product, id: string, options?: any): void {
    const variantId = options?.variantId || null;
    const existingItem = this.items.find((cartItem: any) => {
      const matchId = cartItem.id === id;
      const matchVariant = variantId ? cartItem.variantId === variantId : true;
      return matchId || (cartItem.item?._id?.toString() === item?._id?.toString() && cartItem.variantId === variantId);
    });

    if (!existingItem) {
      this.items.push({
        item,
        id,
        qty: 1,
        isSelected: true,
        variantId,
        selectedClassification: options?.selectedClassification || null,
        selectedColor: options?.selectedColor || null,
        selectedSize: options?.selectedSize || null,
        variant: options?.variant || null,
      });
    } else {
      existingItem.qty++;
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
