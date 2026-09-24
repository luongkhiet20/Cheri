import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import ProductSchema from './schemas/product.schema';
import CategorySchema from './schemas/category.schema';
import ProductVariantSchema from './schemas/product-variant.schema';

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
  providers: [ProductsService],
  exports: [MongooseModule, ProductsService],
})
export class ProductsModule {}
