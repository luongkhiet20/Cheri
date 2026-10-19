import { Body, Controller, Get, Param, Put, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../../auth/utils/get-user.decorator';
import { User } from '../../auth/models/user.model';
import { ProductReviewsService } from './product-reviews.service';
import { ReviewDto, ReviewPageDto } from './dto/review.dto';

const reviewValidation = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: false },
});

@Controller('api/products/:productId/reviews')
export class ProductReviewsController {
  constructor(private readonly reviews: ProductReviewsService) {}

  @Get()
  getPage(@Param('productId') productId: string, @Query(reviewValidation) query: ReviewPageDto) {
    return this.reviews.getPage(productId, query.page, query.pageSize);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMine(@Param('productId') productId: string, @GetUser() user: User) {
    return this.reviews.getMine(productId, user);
  }

  @Put('me')
  @UseGuards(AuthGuard('jwt'))
  saveMine(@Param('productId') productId: string, @GetUser() user: User, @Body(reviewValidation) draft: ReviewDto) {
    return this.reviews.saveMine(productId, user, draft);
  }
}
