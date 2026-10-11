import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrdersController } from './orders.controller';
import OrderSchema from './schemas/order.schema';
import ShippingMethodSchema from './schemas/shipping-method.schema';
import PaymentMethodSchema from './schemas/payment-method.schema';
import { AuthModule } from '../auth/auth.module';
import { OrdersService } from './orders.service';
import { ConfigModule } from '@nestjs/config';
import TranslationSchema from '../translations/schemas/translation.schema';
import { ProductVariantSchema } from '../products/schemas/product-variant.schema';
import ProductSchema from '../products/schemas/product.schema';
import UserSchema from '../auth/schemas/user.schema';
import CouponSchema from './schemas/coupon.schema';

import CategorySchema from '../products/schemas/category.schema';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([
      { name: 'Order', schema: OrderSchema },
      { name: 'ShippingMethod', schema: ShippingMethodSchema },
      { name: 'PaymentMethod', schema: PaymentMethodSchema },
      { name: 'Translation', schema: TranslationSchema },
      { name: 'ProductVariant', schema: ProductVariantSchema },
      { name: 'Product', schema: ProductSchema },
      { name: 'Category', schema: CategorySchema },
      { name: 'User', schema: UserSchema },
      { name: 'Coupon', schema: CouponSchema },
    ]),
    AuthModule,
  ],
  controllers: [OrdersController, DashboardController],
  providers: [OrdersService],
  exports: [MongooseModule],
})
export class OrdersModule {}
