import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';

import { Cart } from './utils/cart';
import { GetCartChangeDto } from './dto/cart-change.dto';
import { ProductModel } from '../products/models/product.model';
import { CartModel } from './models/cart.model';
import { User } from '../auth/models/user.model';
import { prepareCart, prepareProduct } from '../shared/utils/prepareUtils';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    @InjectModel('Product') private productModel: ProductModel,
    @InjectModel('User') private userModel: Model<User>,
  ) {}

  private extractProductId(id: string, cartItem?: any): string {
    if (cartItem?.item?._id) return cartItem.item._id.toString();
    if (cartItem?.item?.id) return cartItem.item.id.toString();
    if (id && id.includes('_')) return id.split('_')[0];
    return id;
  }

  // ─── USER CART PERSISTENCE (MONGODB users.cart.items) ─────────────────────

  private async getUserCart(user: User): Promise<Cart> {
    const dbUser: any = await this.userModel.findById(user._id).lean();
    const rawItems = (dbUser?.cart?.items || []).filter((i: any) => i && i.productId);
    if (!rawItems.length) {
      return new Cart({ items: [] });
    }

    const productIds = rawItems
      .map((i: any) => i.productId?.toString())
      .filter((id: string) => id && isValidObjectId(id));

    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .lean();
    const prodMap = new Map(products.map((p: any) => [p._id.toString(), p]));

    const cartItems: any[] = [];
    for (const raw of rawItems) {
      const prodId = raw.productId?.toString();
      const product: any = prodMap.get(prodId);
      if (!product) continue;

      const variants = Array.isArray(product.variants) ? product.variants : [];
      let variant: any = null;
      const rawVarId = (raw.variantId !== undefined && raw.variantId !== null && raw.variantId !== '')
        ? raw.variantId.toString().trim()
        : null;

      if (rawVarId && variants.length > 0) {
        variant = variants.find(
          (v: any) =>
            (v._id && v._id.toString() === rawVarId) ||
            v.id === rawVarId ||
            v.sku === rawVarId,
        );
      }

      if (!variant && (raw.selectedClassification || raw.selectedColor || raw.selectedSize)) {
        variant = variants.find((v: any) => {
          const mClass = !raw.selectedClassification || v.classification === raw.selectedClassification;
          const mColor = !raw.selectedColor || v.color === raw.selectedColor;
          const mSize = !raw.selectedSize || v.size === raw.selectedSize;
          return mClass && mColor && mSize;
        });
      }

      if (!variant && variants.length > 0 && !rawVarId) {
        variant = variants[0];
      }

      const targetVarId = variant
        ? (variant._id?.toString() || variant.id || variant.sku)
        : rawVarId;
      const normalizedTargetVarId = targetVarId ? String(targetVarId).trim() : null;
      const cartItemId = normalizedTargetVarId ? `${prodId}_${normalizedTargetVarId}` : prodId;
      const quantityToAdd = Math.max(1, Number(raw.quantity) || 1);

      // Deduplicate: gộp số lượng nếu đã tồn tại cùng productId + cùng variantId
      const existing = cartItems.find((ci: any) => {
        const ciProdId = this.extractProductId(ci.id, ci);
        const ciVarId = (ci.variantId !== undefined && ci.variantId !== null && ci.variantId !== '')
          ? String(ci.variantId).trim()
          : null;
        return (ci.id === cartItemId) || (ciProdId === prodId && ciVarId === normalizedTargetVarId);
      });

      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + quantityToAdd;
      } else {
        cartItems.push({
          item: product,
          id: cartItemId,
          qty: quantityToAdd,
          isSelected: raw.isSelected !== false,
          variantId: normalizedTargetVarId,
          selectedClassification: variant?.classification || raw.selectedClassification || null,
          selectedColor: variant?.color || raw.selectedColor || null,
          selectedSize: variant?.size || raw.selectedSize || null,
          variant: variant || null,
        });
      }
    }

    return new Cart({ items: cartItems });
  }

  private async saveUserCart(user: User, cart: Cart): Promise<void> {
    const dbItems: any[] = [];
    for (const ci of (cart.items || [])) {
      const prodId = this.extractProductId(ci.id, ci);
      const varId = (ci.variantId !== undefined && ci.variantId !== null && ci.variantId !== '')
        ? String(ci.variantId).trim()
        : null;
      const qty = Math.max(1, Number(ci.qty) || 1);

      const existing = dbItems.find(
        (di: any) => {
          const diProdId = di.productId?.toString();
          const diVarId = (di.variantId !== undefined && di.variantId !== null && di.variantId !== '')
            ? String(di.variantId).trim()
            : null;
          return diProdId === prodId && diVarId === varId;
        },
      );
      if (existing) {
        existing.quantity += qty;
      } else {
        dbItems.push({
          productId: isValidObjectId(prodId) ? new Types.ObjectId(prodId) : prodId,
          variantId: varId,
          quantity: qty,
          selectedClassification: ci.selectedClassification || null,
          selectedColor: ci.selectedColor || null,
          selectedSize: ci.selectedSize || null,
        });
      }
    }

    await this.userModel.findByIdAndUpdate(user._id, {
      $set: { 'cart.items': dbItems },
    });
  }

  // ─── GUEST CART PERSISTENCE (SESSION / ISOLATED STORAGE) ───────────────────

  private getGuestCart(session: any, guestCartId?: string): Cart {
    const key = guestCartId ? `cart_${guestCartId}` : 'cart';
    const raw = session ? (session[key] || session.cart) : null;
    return new Cart(raw || { items: [] });
  }

  private setGuestCart(session: any, newCart: Cart, guestCartId?: string): void {
    if (!session) return;
    const key = guestCartId ? `cart_${guestCartId}` : 'cart';
    session[key] = newCart;
    session.cart = newCart;
  }

  // ─── CART OPERATIONS ──────────────────────────────────────────────────────

  async getCart(
    user: User | null,
    session: any,
    lang: string,
    guestCartId?: string,
  ): Promise<CartModel> {
    const config = session?.config;
    const currentLang = lang || 'vi';

    if (user) {
      console.log(`[Cart] identity: user:${user._id} | auth state: authenticated | userId: ${user._id} | source: users.cart`);
      const userCart = await this.getUserCart(user);
      console.log(`[Cart] items: ${userCart.items?.length || 0} items for user:${user._id}`);
      return prepareCart(userCart, currentLang, config);
    }

    console.log(`[Cart] identity: guest:${guestCartId || 'anonymous'} | auth state: guest | guestCartId: ${guestCartId || 'session'} | source: guest storage/session`);
    const guestCart = this.getGuestCart(session, guestCartId);
    console.log(`[Cart] items: ${guestCart.items?.length || 0} items for guest:${guestCartId || 'session'}`);
    return prepareCart(guestCart, currentLang, config);
  }

  async addToCart(
    user: User | null,
    session: any,
    getCartChangeDto: GetCartChangeDto,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;
    const { id, variantId, classification, color, size } = getCartChangeDto;
    const currentLang = lang || 'vi';

    const productId = this.extractProductId(id);
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const prepared = prepareProduct(product, currentLang, true);

    // 1. Chặn sản phẩm Ẩn
    if (!prepared.visibility) {
      throw new BadRequestException('Sản phẩm hiện đang tạm ẩn, không thể thêm vào giỏ hàng');
    }

    // 2. Chặn sản phẩm Hết hàng
    const isOut =
      prepared.stock === 'out' ||
      prepared.stock === 'outOfStock' ||
      prepared.stock === 'unavailable' ||
      prepared.stock === '0' ||
      (typeof prepared.quantity === 'number' && prepared.quantity <= 0);
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

    let maxStock = 999;
    if (resolvedVariant) {
      const vStock = resolvedVariant.stock !== undefined ? resolvedVariant.stock : resolvedVariant.quantity;
      if (vStock !== undefined && vStock !== null && vStock !== '' && !isNaN(Number(vStock))) {
        maxStock = Math.max(0, Number(vStock));
      }
    } else {
      if (prepared.quantity !== undefined && prepared.quantity !== null && !isNaN(Number(prepared.quantity))) {
        maxStock = Math.max(0, Number(prepared.quantity));
      }
    }

    if (maxStock <= 0) {
      throw new BadRequestException('Sản phẩm đã hết hàng, không thể thêm vào giỏ hàng');
    }

    const qtyToAdd = Math.max(1, Math.floor(Number(getCartChangeDto.qty) || 1));
    const targetVarId = resolvedVariant
      ? (resolvedVariant._id?.toString() || resolvedVariant.id || resolvedVariant.sku)
      : null;
    const normalizedTargetVarId = targetVarId ? String(targetVarId).trim() : null;

    // Load active cart based on user identity
    let activeCart: Cart;
    if (user) {
      console.log(`[Cart] addToCart | identity: user:${user._id} | auth state: authenticated | source: users.cart`);
      activeCart = await this.getUserCart(user);
    } else {
      console.log(`[Cart] addToCart | identity: guest:${guestCartId || 'anonymous'} | auth state: guest | source: guest storage/session`);
      activeCart = this.getGuestCart(session, guestCartId);
    }

    const cartItemId = normalizedTargetVarId ? `${productId}_${normalizedTargetVarId}` : productId;

    // Check existing quantity using strict productId + variantId identity
    const existingItem = (activeCart.items || []).find((ci: any) => {
      const pId = this.extractProductId(ci.id, ci);
      const ciVarId = (ci.variantId !== undefined && ci.variantId !== null && ci.variantId !== '')
        ? String(ci.variantId).trim()
        : null;
      return (ci.id === cartItemId) || (pId === productId && ciVarId === normalizedTargetVarId);
    });
    const currentQty = existingItem ? (Number(existingItem.qty) || 0) : 0;
    if (currentQty + qtyToAdd > maxStock) {
      throw new BadRequestException(`Số lượng trong giỏ hàng đã đạt giới hạn tồn kho (${maxStock})`);
    }

    activeCart.add(product, cartItemId, {
      variantId: normalizedTargetVarId,
      selectedClassification: resolvedVariant?.classification || classification || null,
      selectedColor: resolvedVariant?.color || color || null,
      selectedSize: resolvedVariant?.size || size || null,
      variant: resolvedVariant,
      qty: qtyToAdd,
    });

    // Save cart to respective storage
    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, currentLang, config) };
  }

  async removeFromCart(
    user: User | null,
    session: any,
    getCartChangeDto: GetCartChangeDto,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;
    const { id } = getCartChangeDto;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    activeCart.remove(id);

    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, lang || 'vi', config) };
  }

  async updateQuantity(
    user: User | null,
    session: any,
    id: string,
    qty: number,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    const cartItem: any = (activeCart.items || []).find((ci: any) => ci.id === id);
    const productId = this.extractProductId(id, cartItem);

    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }

    const currentLang = lang || 'vi';
    const prepared = prepareProduct(product, currentLang, true);

    let availableStock = (prepared.quantity !== undefined && prepared.quantity !== null && !isNaN(Number(prepared.quantity)))
      ? Number(prepared.quantity)
      : 999;
    const varId = cartItem?.variantId;
    if (varId && Array.isArray(product.variants)) {
      const v = product.variants.find(
        (variant: any) =>
          variant._id?.toString() === varId ||
          variant.id === varId ||
          variant.sku === varId,
      );
      if (v) {
        const vStock = v.stock !== undefined ? v.stock : v.quantity;
        if (vStock !== undefined && vStock !== null && vStock !== '' && !isNaN(Number(vStock))) {
          availableStock = Math.max(0, Number(vStock));
        }
      }
    }

    let targetQty = Math.max(1, Math.floor(Number(qty) || 1));
    if (availableStock > 0 && targetQty > availableStock) {
      targetQty = availableStock;
    }

    activeCart.setQty(id, targetQty);

    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, currentLang, config) };
  }

  async updateVariant(
    user: User | null,
    session: any,
    id: string,
    updateDto: {
      variantId?: string;
      classification?: string;
      color?: string;
      size?: string;
    },
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel; capped: boolean; oldQty: number; newQty: number }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    const cartItem: any = (activeCart.items || []).find((ci: any) => ci.id === id);
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

    const vStock = matchedVariant.stock !== undefined ? matchedVariant.stock : matchedVariant.quantity;
    const newStock = (vStock !== undefined && vStock !== null && vStock !== '' && !isNaN(Number(vStock)))
      ? Math.max(0, Number(vStock))
      : 999;
    const oldQty = cartItem.qty || 1;
    let targetQty = oldQty;
    let capped = false;

    if (newStock > 0 && targetQty > newStock) {
      targetQty = newStock;
      capped = true;
    }

    const newVariantId = matchedVariant._id?.toString() || matchedVariant.id || matchedVariant.sku;

    activeCart.updateVariant(id, {
      variantId: newVariantId,
      classification: matchedVariant.classification,
      color: matchedVariant.color,
      size: matchedVariant.size,
      variant: matchedVariant,
      targetQty,
    });

    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return {
      newCart: activeCart,
      langCart: prepareCart(activeCart, lang || 'vi', config),
      capped,
      oldQty,
      newQty: targetQty,
    };
  }

  async toggleSelect(
    user: User | null,
    session: any,
    id: string,
    isSelected: boolean,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    activeCart.toggleSelect(id, isSelected);

    if (!user) {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, lang || 'vi', config) };
  }

  async selectAll(
    user: User | null,
    session: any,
    isSelected: boolean,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    activeCart.selectAll(isSelected);

    if (!user) {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, lang || 'vi', config) };
  }

  async deleteItem(
    user: User | null,
    session: any,
    id: string,
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    activeCart.removeItemCompletely(id);

    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, lang || 'vi', config) };
  }

  async deleteMultiple(
    user: User | null,
    session: any,
    ids: string[],
    lang: string,
    guestCartId?: string,
  ): Promise<{ newCart: Cart; langCart: CartModel }> {
    const config = session?.config;

    let activeCart: Cart;
    if (user) {
      activeCart = await this.getUserCart(user);
    } else {
      activeCart = this.getGuestCart(session, guestCartId);
    }

    activeCart.removeMultiple(ids || []);

    if (user) {
      await this.saveUserCart(user, activeCart);
    } else {
      this.setGuestCart(session, activeCart, guestCartId);
    }

    return { newCart: activeCart, langCart: prepareCart(activeCart, lang || 'vi', config) };
  }

  // ─── MERGE GUEST CART INTO USER CART UPON LOGIN ───────────────────────────

  async mergeCart(
    user: User,
    guestItems: any[],
    lang: string,
    config?: any,
  ): Promise<CartModel> {
    console.log(`[Cart] MERGE: Merging ${guestItems?.length || 0} guest items into user:${user._id}`);
    const currentLang = lang || 'vi';
    const userCart = await this.getUserCart(user);

    if (Array.isArray(guestItems) && guestItems.length > 0) {
      for (const gItem of guestItems) {
        const rawPId = gItem.productId || gItem.id || gItem.item?._id || gItem.item?.id;
        const pId = this.extractProductId(String(rawPId || ''), gItem);
        if (!pId) continue;

        const product = await this.productModel.findById(pId);
        if (!product) continue;

        const prepared = prepareProduct(product, currentLang, true);
        if (!prepared.visibility) continue;

        const variants = Array.isArray(product.variants) ? product.variants : [];
        let matchedVariant: any = null;
        const rawVarId = gItem.variantId ? gItem.variantId.toString() : null;

        if (rawVarId && variants.length > 0) {
          matchedVariant = variants.find(
            (v: any) =>
              (v._id && v._id.toString() === rawVarId) ||
              v.id === rawVarId ||
              v.sku === rawVarId,
          );
        }
        if (
          !matchedVariant &&
          (gItem.selectedClassification || gItem.selectedColor || gItem.selectedSize)
        ) {
          matchedVariant = variants.find((v: any) => {
            const mClass =
              !gItem.selectedClassification ||
              v.classification === gItem.selectedClassification;
            const mColor = !gItem.selectedColor || v.color === gItem.selectedColor;
            const mSize = !gItem.selectedSize || v.size === gItem.selectedSize;
            return mClass && mColor && mSize;
          });
        }

        let maxStock = 999;
        if (matchedVariant) {
          const vStock = matchedVariant.stock !== undefined ? matchedVariant.stock : matchedVariant.quantity;
          if (vStock !== undefined && vStock !== null && vStock !== '' && !isNaN(Number(vStock))) {
            maxStock = Math.max(0, Number(vStock));
          }
        } else if (prepared.quantity !== undefined && prepared.quantity !== null && !isNaN(Number(prepared.quantity))) {
          maxStock = Math.max(0, Number(prepared.quantity));
        }

        const targetVarId = matchedVariant
          ? (matchedVariant._id?.toString() || matchedVariant.id || matchedVariant.sku)
          : rawVarId;
        const cartItemId = targetVarId ? `${pId}_${targetVarId}` : pId;
        const addQty = Math.max(1, Number(gItem.quantity || gItem.qty) || 1);

        // So khớp chính xác: productId + variantId
        const existing = (userCart.items || []).find((ci: any) => {
          const cProdId = this.extractProductId(ci.id, ci);
          const cVarId = ci.variantId ? ci.variantId.toString() : null;
          const targetVarStr = targetVarId ? targetVarId.toString() : null;
          return cProdId === pId && cVarId === targetVarStr;
        });

        if (existing) {
          const newQty = existing.qty + addQty;
          existing.qty = maxStock > 0 ? Math.min(maxStock, newQty) : newQty;
        } else {
          const finalQty = maxStock > 0 ? Math.min(maxStock, addQty) : addQty;
          (userCart.items as any[]).push({
            item: product,
            id: cartItemId,
            qty: finalQty,
            isSelected: true,
            variantId: targetVarId,
            selectedClassification: matchedVariant?.classification || gItem.selectedClassification || null,
            selectedColor: matchedVariant?.color || gItem.selectedColor || null,
            selectedSize: matchedVariant?.size || gItem.selectedSize || null,
            variant: matchedVariant || null,
          });
        }
      }

      await this.saveUserCart(user, userCart);
    }

    console.log(`[Cart] MERGE complete. Total items in user:${user._id} cart: ${userCart.items?.length || 0}`);
    return prepareCart(userCart, currentLang, config);
  }
}
