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
// import { join } from 'path';
// import { ServeStaticModule } from '@nestjs/serve-static';
// import { existsSync } from 'fs';

// const staticFile = existsSync(join(process.cwd(), 'dist/cheri/browser'))
//   ? join(process.cwd(), '/dist/cheri/browser')
//   : join(process.cwd(), 'public');

const defaultMongoUri =
  'mongodb+srv://tinhvttk24411_db_user:gZ7aJJyCWgYffiXa@cluster0.cbvni8r.mongodb.net/cheri?retryWrites=true&w=majority';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URI || defaultMongoUri),
    ProductsModule,
    CartModule,
    OrdersModule,
    TranslationsModule,
    AuthModule,
    AdminModule,
    CheriModule,
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
