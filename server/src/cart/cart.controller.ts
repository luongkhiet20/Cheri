import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  ValidationPipe,
  Session,
  Headers,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';

import { CartService } from './cart.service';
import { GetCartChangeDto } from './dto/cart-change.dto';
import { CartModel } from './models/cart.model';
import { OptionalJwtAuthGuard } from '../auth/roles.guard';

@UseGuards(OptionalJwtAuthGuard)
@Controller('api/cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private async persistSession(session: any, newCart: any, guestCartId?: string): Promise<void> {
    if (!session) return;
    const key = guestCartId ? `cart_${guestCartId}` : 'cart';
    session[key] = newCart;
    session.cart = newCart;
    if (typeof session.save === 'function') {
      await new Promise<void>((resolve) => session.save(() => resolve()));
    }
  }

  @Get()
  getCart(
    @Req() req,
    @Session() session,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    return this.cartService.getCart(user, session, lang, guestCartId);
  }

  @Get('/add')
  async addToCart(
    @Req() req,
    @Session() session,
    @Query(ValidationPipe) getCartChangeDto: GetCartChangeDto,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const { newCart, langCart } = await this.cartService.addToCart(
      user,
      session,
      getCartChangeDto,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/remove')
  async removeFromCart(
    @Req() req,
    @Session() session,
    @Query(ValidationPipe) getCartChangeDto: GetCartChangeDto,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const { newCart, langCart } = await this.cartService.removeFromCart(
      user,
      session,
      getCartChangeDto,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/update-quantity')
  async updateQuantity(
    @Req() req,
    @Session() session,
    @Query('id') id: string,
    @Query('qty') qty: number,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const { newCart, langCart } = await this.cartService.updateQuantity(
      user,
      session,
      id,
      qty,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/update-variant')
  async updateVariant(
    @Req() req,
    @Session() session,
    @Query('id') id: string,
    @Query('variantId') variantId: string,
    @Query('classification') classification: string,
    @Query('color') color: string,
    @Query('size') size: string,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<{ cart: CartModel; capped: boolean; oldQty: number; newQty: number }> {
    const user = req.user || null;
    const result = await this.cartService.updateVariant(
      user,
      session,
      id,
      { variantId, classification, color, size },
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, result.newCart, guestCartId);
    }
    return {
      cart: result.langCart,
      capped: result.capped,
      oldQty: result.oldQty,
      newQty: result.newQty,
    };
  }

  @Get('/toggle-select')
  async toggleSelect(
    @Req() req,
    @Session() session,
    @Query('id') id: string,
    @Query('selected') selected: string,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const isSelected = selected === 'true' || selected === '1';
    const { newCart, langCart } = await this.cartService.toggleSelect(
      user,
      session,
      id,
      isSelected,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/select-all')
  async selectAll(
    @Req() req,
    @Session() session,
    @Query('selected') selected: string,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const isSelected = selected === 'true' || selected === '1';
    const { newCart, langCart } = await this.cartService.selectAll(
      user,
      session,
      isSelected,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/delete-item')
  async deleteItem(
    @Req() req,
    @Session() session,
    @Query('id') id: string,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const { newCart, langCart } = await this.cartService.deleteItem(
      user,
      session,
      id,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Get('/delete-items')
  async deleteItemsGet(
    @Req() req,
    @Session() session,
    @Query('ids') ids: string,
    @Headers('lang') lang: string,
    @Headers('x-guest-cart-id') guestCartId: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    const idList = ids ? ids.split(',').filter(Boolean) : [];
    const { newCart, langCart } = await this.cartService.deleteMultiple(
      user,
      session,
      idList,
      lang,
      guestCartId,
    );
    if (!user) {
      await this.persistSession(session, newCart, guestCartId);
    }
    return langCart;
  }

  @Post('/merge')
  async mergeCart(
    @Req() req,
    @Session() session,
    @Body() body: { items: any[] },
    @Headers('lang') lang: string,
  ): Promise<CartModel> {
    const user = req.user || null;
    if (!user) {
      throw new UnauthorizedException('Yêu cầu đăng nhập để hợp nhất giỏ hàng');
    }
    const mergedCart = await this.cartService.mergeCart(
      user,
      body.items || [],
      lang,
      session?.config,
    );
    return mergedCart;
  }
}
