import {
  Controller,
  Get,
  Query,
  ValidationPipe,
  Session,
  Headers,
} from '@nestjs/common';

import { CartService } from './cart.service';
import { GetCartChangeDto } from './dto/cart-change.dto';
import { CartModel } from './models/cart.model';

@Controller('api/cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private async persistSession(session: any, newCart: any): Promise<void> {
    session.cart = newCart;
    if (session && typeof session.save === 'function') {
      await new Promise<void>((resolve) => session.save(() => resolve()));
    }
  }

  @Get()
  getCart(
    @Session() session,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    return this.cartService.getCart(session, lang);
  }

  @Get('/add')
  async addToCart(
    @Session() session,
    @Query(ValidationPipe) getCartChangeDto: GetCartChangeDto,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const { newCart, langCart } = await this.cartService.addToCart(
      session,
      getCartChangeDto,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/remove')
  async removeFromCart(
    @Session() session,
    @Query(ValidationPipe) getCartChangeDto: GetCartChangeDto,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const { newCart, langCart } = await this.cartService.removeFromCart(
      session,
      getCartChangeDto,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/update-quantity')
  async updateQuantity(
    @Session() session,
    @Query('id') id: string,
    @Query('qty') qty: number,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const { newCart, langCart } = await this.cartService.updateQuantity(
      session,
      id,
      qty,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/update-variant')
  async updateVariant(
    @Session() session,
    @Query('id') id: string,
    @Query('variantId') variantId: string,
    @Query('classification') classification: string,
    @Query('color') color: string,
    @Query('size') size: string,
    @Headers('lang') lang: string,
  ): Promise<{ cart: CartModel; capped: boolean; oldQty: number; newQty: number }> {
    const result = await this.cartService.updateVariant(
      session,
      id,
      { variantId, classification, color, size },
      lang,
    );
    await this.persistSession(session, result.newCart);
    return {
      cart: result.langCart,
      capped: result.capped,
      oldQty: result.oldQty,
      newQty: result.newQty,
    };
  }

  @Get('/toggle-select')
  async toggleSelect(
    @Session() session,
    @Query('id') id: string,
    @Query('selected') selected: string,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const isSelected = selected === 'true' || selected === '1';
    const { newCart, langCart } = await this.cartService.toggleSelect(
      session,
      id,
      isSelected,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/select-all')
  async selectAll(
    @Session() session,
    @Query('selected') selected: string,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const isSelected = selected === 'true' || selected === '1';
    const { newCart, langCart } = await this.cartService.selectAll(
      session,
      isSelected,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/delete-item')
  async deleteItem(
    @Session() session,
    @Query('id') id: string,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const { newCart, langCart } = await this.cartService.deleteItem(
      session,
      id,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }

  @Get('/delete-items')
  async deleteItemsGet(
    @Session() session,
    @Query('ids') ids: string,
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const idList = ids ? ids.split(',').filter(Boolean) : [];
    const { newCart, langCart } = await this.cartService.deleteMultiple(
      session,
      idList,
      lang,
    );
    await this.persistSession(session, newCart);
    return langCart;
  }
}
