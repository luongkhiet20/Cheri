import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Cart } from './utils/cart';
import { GetCartChangeDto } from './dto/cart-change.dto';
import { ProductModel } from '../products/models/product.model';
import { CartModel } from './models/cart.model';
import { prepareCart, prepareProduct } from '../shared/utils/prepareUtils';

@Injectable()
export class CartService {
  constructor(@InjectModel('Product') private productModel: ProductModel) {}

  private extractProductId(id: string, cartItem?: any): string {
    if (cartItem?.item?._id) return cartItem.item._id.toString();
    if (cartItem?.item?.id) return cartItem.item.id.toString();
    if (id && id.includes('_')) return id.split('_')[0];
    return id;
  }

  async getCart(session, lang: string): Promise<CartModel> {
    const { cart, config } = session;
    const savedCart = cart || new Cart({ items: [] });
    return prepareCart(savedCart, lang, config);
  }

  async addToCart(
    session,
    getCartChangeDto: GetCartChangeDto,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const { id, variantId, classification, color, size } = getCartChangeDto;
    const newCart: Cart = new Cart(cart || {});

    const productId = this.extractProductId(id);
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const currentLang = lang || 'vi';
    const prepared = prepareProduct(product, currentLang, true);

    // 1. Chặn sản phẩm Ẩn (Case 3 & Case 4)
    if (!prepared.visibility) {
      throw new BadRequestException('Sản phẩm hiện đang tạm ẩn, không thể thêm vào giỏ hàng');
    }

    // 2. Chặn sản phẩm Hết hàng (Case 2 & Case 4)
    const isOut =
      prepared.quantity <= 0 ||
      prepared.stock === 'out' ||
      prepared.stock === 'outOfStock' ||
      prepared.stock === 'unavailable' ||
      prepared.stock === '0';
    if (isOut) {
      throw new BadRequestException('Sản phẩm đã hết hàng, không thể thêm vào giỏ hàng');
    }

    // Variant matching & stock check
    let resolvedVariant: any = null;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (variants.length > 0) {
      if (variantId) {
        resolvedVariant = variants.find(
          (v: any) =>
            v._id?.toString() === variantId ||
            v.id === variantId ||
            v.sku === variantId,
        );
      }
      if (!resolvedVariant && (classification || color || size)) {
        resolvedVariant = variants.find((v: any) => {
          const mClass = !classification || v.classification === classification;
          const mColor = !color || v.color === color;
          const mSize = !size || v.size === size;
          return mClass && mColor && mSize;
        });
      }
      if (!resolvedVariant) {
        resolvedVariant = variants[0];
      }
    }

    const maxStock = resolvedVariant
      ? Math.max(0, Number(resolvedVariant.stock) || 0)
      : (prepared.quantity || 0);

    const targetVarId = resolvedVariant
      ? (resolvedVariant._id?.toString() || resolvedVariant.id || resolvedVariant.sku)
      : null;

    // Check existing quantity
    const existingItem = (newCart.items || []).find((ci: any) => {
      const pId = this.extractProductId(ci.id, ci);
      return pId === productId && (targetVarId ? ci.variantId === targetVarId : true);
    });
    const currentQty = existingItem ? existingItem.qty : 0;
    if (currentQty + 1 > maxStock) {
      throw new BadRequestException(`Số lượng trong giỏ hàng đã đạt giới hạn tồn kho (${maxStock})`);
    }

    // Generate unique ID per product + variant
    const cartItemId = targetVarId ? `${productId}_${targetVarId}` : productId;

    newCart.add(product, cartItemId, {
      variantId: targetVarId,
      selectedClassification: resolvedVariant?.classification || classification || null,
      selectedColor: resolvedVariant?.color || color || null,
      selectedSize: resolvedVariant?.size || size || null,
      variant: resolvedVariant,
    });

    return { newCart, langCart: prepareCart(newCart, currentLang, config) };
  }

  async removeFromCart(
    session,
    getCartChangeDto: GetCartChangeDto,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const { id } = getCartChangeDto;
    const newCart = new Cart(cart || { items: [] });
    newCart.remove(id);
    return { newCart, langCart: prepareCart(newCart, lang || 'vi', config) };
  }

  async updateQuantity(
    session,
    id: string,
    qty: number,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });

    const cartItem: any = (newCart.items || []).find((ci: any) => ci.id === id);
    const productId = this.extractProductId(id, cartItem);

    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const currentLang = lang || 'vi';
    const prepared = prepareProduct(product, currentLang, true);

    let availableStock = prepared.quantity || 0;
    const varId = cartItem?.variantId;
    if (varId && Array.isArray(product.variants)) {
      const v = product.variants.find(
        (variant: any) =>
          variant._id?.toString() === varId ||
          variant.id === varId ||
          variant.sku === varId,
      );
      if (v && v.stock !== undefined) {
        availableStock = Math.max(0, Number(v.stock));
      }
    }

    let targetQty = Math.max(1, Math.floor(Number(qty) || 1));
    if (availableStock > 0 && targetQty > availableStock) {
      targetQty = availableStock;
    }

    newCart.setQty(id, targetQty);
    return { newCart, langCart: prepareCart(newCart, currentLang, config) };
  }

  async updateVariant(
    session,
    id: string,
    updateDto: {
      variantId?: string;
      classification?: string;
      color?: string;
      size?: string;
    },
    lang: string,
  ): Promise<{ newCart; langCart; capped: boolean; oldQty: number; newQty: number }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });

    const cartItem: any = (newCart.items || []).find((ci: any) => ci.id === id);
    if (!cartItem) {
      throw new NotFoundException('Sản phẩm không có trong giỏ hàng');
    }

    const productId = this.extractProductId(id, cartItem);
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    let matchedVariant: any = null;

    if (updateDto.variantId) {
      matchedVariant = variants.find(
        (v: any) =>
          v._id?.toString() === updateDto.variantId ||
          v.id === updateDto.variantId ||
          v.sku === updateDto.variantId,
      );
    }

    if (!matchedVariant) {
      matchedVariant = variants.find((v: any) => {
        const mClass =
          !updateDto.classification || v.classification === updateDto.classification;
        const mColor = !updateDto.color || v.color === updateDto.color;
        const mSize = !updateDto.size || v.size === updateDto.size;
        return mClass && mColor && mSize;
      });
    }

    if (!matchedVariant) {
      throw new BadRequestException('Tổ hợp biến thể không tồn tại hoặc không khả dụng');
    }

    const newStock = Math.max(0, Number(matchedVariant.stock) || 0);
    const oldQty = cartItem.qty || 1;
    let targetQty = oldQty;
    let capped = false;

    if (newStock > 0 && targetQty > newStock) {
      targetQty = newStock;
      capped = true;
    } else if (newStock <= 0) {
      targetQty = 1;
      capped = true;
    }

    const newVariantId = matchedVariant._id?.toString() || matchedVariant.id || matchedVariant.sku;

    newCart.updateVariant(id, {
      variantId: newVariantId,
      classification: matchedVariant.classification,
      color: matchedVariant.color,
      size: matchedVariant.size,
      variant: matchedVariant,
      targetQty,
    });

    return {
      newCart,
      langCart: prepareCart(newCart, lang || 'vi', config),
      capped,
      oldQty,
      newQty: targetQty,
    };
  }

  async toggleSelect(
    session,
    id: string,
    isSelected: boolean,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });
    newCart.toggleSelect(id, isSelected);
    return { newCart, langCart: prepareCart(newCart, lang || 'vi', config) };
  }

  async selectAll(
    session,
    isSelected: boolean,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });
    newCart.selectAll(isSelected);
    return { newCart, langCart: prepareCart(newCart, lang || 'vi', config) };
  }

  async deleteItem(
    session,
    id: string,
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });
    newCart.removeItemCompletely(id);
    return { newCart, langCart: prepareCart(newCart, lang || 'vi', config) };
  }

  async deleteMultiple(
    session,
    ids: string[],
    lang: string,
  ): Promise<{ newCart; langCart }> {
    const { cart, config } = session;
    const newCart = new Cart(cart || { items: [] });
    newCart.removeMultiple(ids || []);
    return { newCart, langCart: prepareCart(newCart, lang || 'vi', config) };
  }
}
