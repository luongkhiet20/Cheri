import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { TranslationsModule } from './translations/translations.module';
import { AdminModule } from './admin/admin.module';
import { CheriModule } from './cheri/cheri.module';
import { ConfigModule } from '@nestjs/config';
import { ShippingModule } from './shipping/shipping.module';
import { PaymentModule } from './payment/payment.module';
// import { join } from 'path';
// import { ServeStaticModule } from '@nestjs/serve-static';
// import { existsSync } from 'fs';

// const staticFile = existsSync(join(process.cwd(), 'dist/cheri/browser'))
//   ? join(process.cwd(), '/dist/cheri/browser')
//   : join(process.cwd(), 'public');

// ❌ KHÔNG hardcode credentials ở đây — đọc từ file .env
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error(
    '❌ Thiếu biến môi trường MONGO_URI!\n'
    + '   Hãy tạo file .env từ .env.example và điền MONGO_URI vào.'
  );
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(mongoUri),
    ProductsModule,
    CartModule,
    OrdersModule,
    TranslationsModule,
    AuthModule,
    AdminModule,
    CheriModule,
    ShippingModule,
    PaymentModule,
    // ServeStaticModule.forRoot({
    //   rootPath: staticFile,
    //   exclude: ['/api'],
    // }),
  ],
  exports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
