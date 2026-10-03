import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import ProductSchema from './schemas/product.schema';
import CategorySchema from './schemas/category.schema';
import ProductVariantSchema from './schemas/product-variant.schema';

import { ImageSearchService } from './image-search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Category', schema: CategorySchema },
      {
        name: 'ProductVariant',
        schema: ProductVariantSchema,
        collection: 'product_variants',
      },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, ImageSearchService],
  exports: [MongooseModule, ProductsService, ImageSearchService],
})
export class ProductsModule {}
