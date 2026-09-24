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
      { name: 'User', schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [MongooseModule],
})
export class OrdersModule {}
