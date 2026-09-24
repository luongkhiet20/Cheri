import { AuthGuard } from '@nestjs/passport';
import {
  Controller,
  Get,
  Param,
  Query,
  ValidationPipe,
  Delete,
  UseGuards,
  Post,
  Body,
  Patch,
  Headers,
} from '@nestjs/common';

import { ProductsService } from './products.service';
import { GetProductsDto } from './dto/get-products';
import { ProductsWithPagination, Product } from './models/product.model';
import { GetProductDto } from './dto/get-product';
import { Category } from './models/category.model';
import { RolesGuard, AdminJwtAuthGuard } from '../auth/roles.guard';
import { GetUser } from '../auth/utils/get-user.decorator';
import { User } from '../auth/models/user.model';

@Controller('api/products')
export class ProductsController {
  constructor(private productService: ProductsService) {}

  @Get()
  getProducts(
    @Query(ValidationPipe) getProductsDto: GetProductsDto,
    @Headers('lang') lang: string,
  ): Promise<ProductsWithPagination> {
    return this.productService.getProducts(getProductsDto, lang);
  }

  @Get('/categories')
  getCategories(@Headers('lang') lang: string): Promise<Category[]> {
    return this.productService.getCategories(lang);
  }

  @Get('/search')
  getproductsTtitles(@Query('query') query: string): Promise<string[]> {
    return this.productService.getProductsTitles(query);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/all')
  getAllProducts(@Headers('lang') lang: string): Promise<Product[]> {
    return this.productService.getAllProducts(lang);
  }

  @Get('/:id/variants')
  getProductVariants(@Param('id') id: string): Promise<any> {
    return this.productService.getProductVariants(id);
  }

  @Get('/:name')
  getProductByName(
    @Query() getProductDto: GetProductDto,
    @Param('name') name: string,
  ): Promise<Product> {
    return this.productService.getProductByName(name, getProductDto);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/:name')
  deleteProductByName(@Param('name') name: string): Promise<void> {
    return this.productService.deleteProductByName(name);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/add')
  addProduct(@Body() productReq, @GetUser() user: User): Promise<void> {
    return this.productService.addProduct(productReq, user);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/edit')
  editProduct(@Body() productReq): Promise<void> {
    return this.productService.editProduct(productReq);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/import-csv')
  importCsvProducts(@Body() body: { products: any[] }, @GetUser() user: User): Promise<{ imported: number; errors: string[] }> {
    return this.productService.importProducts(body.products, user);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/categories/all')
  getAllCategories(@Headers('lang') lang: string): Promise<any> {
    return this.productService.getAllCategories(lang);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/categories/edit')
  editCategory(@Body() categoryReq): Promise<void> {
    return this.productService.editCategory(categoryReq);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/categories/:name')
  deleteCategoryByName(@Param('name') name: string): Promise<void> {
    return this.productService.deleteCategoryByName(name);
  }
}
