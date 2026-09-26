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
    const { id } = getCartChangeDto;
    const newCart: Cart = new Cart(cart || {});

    const product = await this.productModel.findById(id);
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
    const isOut = prepared.quantity <= 0 || prepared.stock === 'out' || prepared.stock === 'outOfStock' || prepared.stock === 'unavailable' || prepared.stock === '0';
    if (isOut) {
      throw new BadRequestException('Sản phẩm đã hết hàng, không thể thêm vào giỏ hàng');
    }

    // 3. Chặn số lượng yêu cầu vượt quá tồn kho thực tế
    const currentItem: any = newCart.check(id);
    const currentQty = currentItem ? currentItem.qty : 0;
    if (currentQty + 1 > prepared.quantity) {
      throw new BadRequestException(`Số lượng trong giỏ hàng đã đạt giới hạn tồn kho (${prepared.quantity})`);
    }

    newCart.add(product, id);
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
    try {
      const product = await this.productModel.findById(id);

      if (!product) {
        const itIsInCart = newCart.check(id);

        if (itIsInCart) {
          const emptyCart = new Cart({ items: [] });
          return { newCart: emptyCart, langCart: emptyCart };
        }
      }
      newCart.remove(id);
      return { newCart, langCart: prepareCart(newCart, lang, config) };
    } catch {
      return { newCart, langCart: prepareCart(newCart, lang, config) };
    }
  }
}
