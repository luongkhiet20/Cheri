import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminJwtAuthGuard, RolesGuard } from '../auth/roles.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ReviewStatus } from './schemas/product-review.schema';

@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Tạo đánh giá mới (Yêu cầu đăng nhập & đã mua hàng thành công)
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createReview(@Req() req: any, @Body() dto: CreateReviewDto) {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    return this.reviewsService.createReview(userId, req.user, dto);
  }

  /**
   * Lấy danh sách đánh giá theo sản phẩm (Công khai)
   */
  @Get('product/:productId')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getReviewsByProduct(
    @Param('productId') productId: string,
    @Query() query: QueryReviewDto,
  ) {
    return this.reviewsService.getReviewsByProduct(productId, query);
  }

  /**
   * Thống kê đánh giá sản phẩm (Điểm trung bình, phân bố sao) (Công khai)
   */
  @Get('product/:productId/stats')
  async getProductReviewStats(@Param('productId') productId: string) {
    return this.reviewsService.getProductReviewStats(productId);
  }

  /**
   * Kiểm tra người dùng có đủ điều kiện đánh giá sản phẩm hay không (Yêu cầu đăng nhập)
   */
  @Get('check-eligible/:productId')
  @UseGuards(AuthGuard('jwt'))
  async checkEligibility(
    @Req() req: any,
    @Param('productId') productId: string,
    @Query('orderId') orderId?: string,
  ) {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    return this.reviewsService.checkEligibility(userId, req.user.email, productId, orderId);
  }

  /**
   * Chỉnh sửa đánh giá của người dùng
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateReview(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    return this.reviewsService.updateReview(id, userId, dto);
  }

  /**
   * Xóa đánh giá (Người dùng sở hữu hoặc Quản trị viên)
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteReview(@Req() req: any, @Param('id') id: string) {
    return this.reviewsService.deleteReview(id, req.user);
  }

  /**
   * Duyệt hoặc cập nhật trạng thái đánh giá bởi Quản trị viên
   */
  @Patch('admin/:id/status')
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  async updateStatusByAdmin(
    @Param('id') id: string,
    @Body('status') status: ReviewStatus,
  ) {
    return this.reviewsService.updateReviewStatusByAdmin(id, status);
  }
}
