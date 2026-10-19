import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import ProductSchema from './schemas/product.schema';
import CategorySchema from './schemas/category.schema';
import ProductVariantSchema from './schemas/product-variant.schema';
import OrderSchema from '../orders/schemas/order.schema';
import { ProductReviewsService } from './reviews/product-reviews.service';
import { ProductReviewsController } from './reviews/product-reviews.controller';
import { AuthModule } from '../auth/auth.module';

import { SmartSearchService } from './smart-search/smart-search.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Category', schema: CategorySchema },
      { name: 'Order', schema: OrderSchema },
      {
        name: 'ProductVariant',
        schema: ProductVariantSchema,
        collection: 'product_variants',
      },
    ]),
  ],
  controllers: [ProductsController, ProductReviewsController],
  providers: [ProductsService, SmartSearchService, ProductReviewsService],
  exports: [MongooseModule, ProductsService, SmartSearchService],
})
export class ProductsModule {}
