import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';
import UserSchema from '../auth/schemas/user.schema';

@Module({
  imports: [
    ProductsModule,
    AuthModule,
    MongooseModule.forFeature([{ name: 'User', schema: UserSchema }]),
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
