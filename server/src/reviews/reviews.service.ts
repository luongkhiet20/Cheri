import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { ProductReview } from './models/product-review.model';
import { ReviewStatus } from './schemas/product-review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { OrderStatus } from '../orders/schemas/order.schema';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectModel('ProductReview')
    private readonly reviewModel: Model<ProductReview>,
    @InjectModel('Product')
    private readonly productModel: Model<any>,
    @InjectModel('Order')
    private readonly orderModel: Model<any>,
  ) {}

  /**
   * Tìm sản phẩm thực tế theo ObjectId, titleUrl (slug), hoặc id
   */
  async resolveProduct(productIdOrSlug: string): Promise<any> {
    if (!productIdOrSlug) {
      throw new BadRequestException('ID hoặc slug sản phẩm không hợp lệ');
    }

    let product = await this.productModel.findOne({ titleUrl: productIdOrSlug }).lean();
    if (!product && isValidObjectId(productIdOrSlug)) {
      product = await this.productModel.findById(productIdOrSlug).lean();
    }
    if (!product) {
      product = await this.productModel.findOne({ id: productIdOrSlug }).lean();
    }

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm: ${productIdOrSlug}`);
    }

    return product;
  }

  /**
   * Xây dựng bộ lọc tìm đơn hàng đã giao thành công (DELIVERED / COMPLETED)
   */
  private buildDeliveredOrderFilter(
    userObjectId: Types.ObjectId,
    userEmail: string,
    productObjectId: Types.ObjectId,
    orderId?: string,
  ): any {
    const normalizedEmail = (userEmail || '').toLowerCase().trim();
    const userConditions: any[] = [
      { userId: userObjectId },
      { userId: String(userObjectId) },
      { _user: userObjectId },
      { _user: String(userObjectId) },
    ];
    if (normalizedEmail) {
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      userConditions.push(
        { customerEmail: normalizedEmail },
        { customerEmail: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
        { 'customer.email': normalizedEmail },
        { 'customer.email': { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
      );
    }

    const filter: any = {
      $or: userConditions,
      status: {
        $in: [
          OrderStatus.DELIVERED,
          'DELIVERED',
          'delivered',
          'Delivered',
          'COMPLETED',
          'completed',
          'Completed',
          'Đã giao',
          'đã giao',
          'ĐÃ GIAO',
          'Da giao',
          'da giao',
        ],
      },
      'items.productId': { $in: [productObjectId, String(productObjectId)] },
    };

    if (orderId) {
      const cleanOrderId = orderId.trim().replace(/^#/, '').trim();
      const escapedOrderId = cleanOrderId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const orderIdConditions: any[] = [
        { orderId: cleanOrderId },
        { orderId: orderId.trim() },
        { orderId: { $regex: new RegExp(`^#?${escapedOrderId}$`, 'i') } },
      ];
      if (isValidObjectId(cleanOrderId)) {
        orderIdConditions.push(
          { _id: new Types.ObjectId(cleanOrderId) },
          { _id: cleanOrderId },
        );
      }
      filter.$and = [{ $or: orderIdConditions }];
    }

    return filter;
  }

  /**
   * Tạo đánh giá sản phẩm mới
   */
  async createReview(userId: string, user: any, dto: CreateReviewDto): Promise<ProductReview> {
    const product = await this.resolveProduct(dto.productId);
    const productObjectId = new Types.ObjectId(product._id);
    const userObjectId = new Types.ObjectId(userId);
    const userEmail = (user?.email || '').toLowerCase().trim();

    // 1. Xác minh mua hàng: Kiểm tra đơn hàng thuộc về user có chứa sản phẩm và đã giao thành công (DELIVERED / COMPLETED)
    const orderFilter = this.buildDeliveredOrderFilter(
      userObjectId,
      userEmail,
      productObjectId,
      dto.orderId,
    );

    const matchedOrder = await this.orderModel.findOne(orderFilter).lean();
    if (!matchedOrder) {
      throw new ForbiddenException(
        'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công',
      );
    }

    // 1.5. Kiểm tra đơn hàng có yêu cầu đổi trả đang tồn tại không
    const returnReqs = Array.isArray((matchedOrder as any).returnRequests)
      ? (matchedOrder as any).returnRequests
      : ((matchedOrder as any).returnRequest ? [(matchedOrder as any).returnRequest] : []);
    const inactiveReturnStatuses = ['CANCELLED', 'CANC', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'REJ'];
    const hasActiveReturn = returnReqs.some((r: any) => {
      const st = (r?.status || '').toUpperCase().trim();
      return st && !inactiveReturnStatuses.includes(st);
    });
    if (hasActiveReturn) {
      throw new BadRequestException('Đơn hàng đã có yêu cầu trả hàng / hoàn tiền, không thể gửi đánh giá.');
    }

    const canonicalOrderId = (matchedOrder as any)?.orderId || (dto.orderId ? dto.orderId.trim().replace(/^#/, '').trim() : null);

    // 2. Chống gửi đánh giá trùng: không cho phép gửi nhiều đánh giá cho cùng một sản phẩm trong cùng một đơn hàng
    const duplicateFilter: any = {
      productId: productObjectId,
      $or: [
        { userId: userObjectId },
        { userId: String(userObjectId) },
      ],
    };
    if (canonicalOrderId) {
      duplicateFilter.orderId = canonicalOrderId;
    }

    const existing = await this.reviewModel.findOne(duplicateFilter).lean();
    if (existing) {
      throw new ConflictException('Bạn đã gửi đánh giá cho sản phẩm này rồi');
    }

    // 3. Tạo review mới
    const review = new this.reviewModel({
      productId: productObjectId,
      userId: userObjectId,
      orderId: canonicalOrderId,
      rating: Math.round(Number(dto.rating)),
      comment: dto.comment.trim(),
      userName: user?.fullName || user?.name || 'Khách hàng Chéri',
      userAvatar: user?.avatar || '',
      isVerifiedPurchase: true,
      status: ReviewStatus.APPROVED, // Mặc định duyệt cho khách hàng đã xác thực nhận hàng
    });

    const saved = await review.save();

    // 4. Cập nhật lại rating trung bình của sản phẩm
    await this.recalculateProductRating(productObjectId);

    // 5. Đánh dấu đơn hàng đã được đánh giá thành công
    if ((matchedOrder as any)?._id) {
      try {
        await this.orderModel.updateOne(
          { _id: (matchedOrder as any)._id },
          { $set: { isReviewed: true, reviewedAt: new Date() } },
        );
      } catch (err: any) {
        this.logger.warn(`Failed to set isReviewed on order ${(matchedOrder as any)._id}: ${err.message}`);
      }
    }

    return saved;
  }

  /**
   * Lấy danh sách đánh giá theo sản phẩm (phân trang, lọc sao, sắp xếp)
   */
  async getReviewsByProduct(
    productIdOrSlug: string,
    query: QueryReviewDto,
  ): Promise<{
    reviews: ProductReview[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const product = await this.resolveProduct(productIdOrSlug);
    const productObjectId = new Types.ObjectId(product._id);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter: any = {
      productId: productObjectId,
      status: ReviewStatus.APPROVED,
    };

    if (query.rating && query.rating >= 1 && query.rating <= 5) {
      filter.rating = Number(query.rating);
    }

    let sort: any = { createdAt: -1 };
    if (query.sortBy === 'oldest') {
      sort = { createdAt: 1 };
    } else if (query.sortBy === 'highest') {
      sort = { rating: -1, createdAt: -1 };
    } else if (query.sortBy === 'lowest') {
      sort = { rating: 1, createdAt: -1 };
    }

    const [reviews, total] = await Promise.all([
      this.reviewModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.reviewModel.countDocuments(filter),
    ]);

    return {
      reviews: reviews as any,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Thống kê đánh giá của sản phẩm: Điểm trung bình, số lượng, phân bố 1-5 sao
   */
  async getProductReviewStats(productIdOrSlug: string): Promise<{
    averageRating: number;
    reviewCount: number;
    distribution: { [star: number]: { count: number; percentage: number } };
  }> {
    const product = await this.resolveProduct(productIdOrSlug);
    const productObjectId = new Types.ObjectId(product._id);

    const stats = await this.reviewModel.aggregate([
      {
        $match: {
          productId: productObjectId,
          status: ReviewStatus.APPROVED,
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const distribution: { [star: number]: { count: number; percentage: number } } = {
      1: { count: 0, percentage: 0 },
      2: { count: 0, percentage: 0 },
      3: { count: 0, percentage: 0 },
      4: { count: 0, percentage: 0 },
      5: { count: 0, percentage: 0 },
    };

    let totalReviews = 0;
    let totalScore = 0;

    for (const item of stats) {
      const star = Number(item._id);
      if (star >= 1 && star <= 5) {
        distribution[star].count = item.count;
        totalReviews += item.count;
        totalScore += star * item.count;
      }
    }

    if (totalReviews > 0) {
      for (let star = 1; star <= 5; star++) {
        distribution[star].percentage = Math.round(
          (distribution[star].count / totalReviews) * 100,
        );
      }
    }

    const averageRating =
      totalReviews > 0 ? Math.round((totalScore / totalReviews) * 10) / 10 : 5.0;

    return {
      averageRating,
      reviewCount: totalReviews,
      distribution,
    };
  }

  /**
   * Kiểm tra điều kiện đánh giá của người dùng hiện tại đối với sản phẩm
   */
  /**
   * Kiểm tra điều kiện đánh giá của người dùng hiện tại đối với sản phẩm (và đơn hàng cụ thể nếu có)
   */
  async checkEligibility(
    userId: string,
    userEmail: string,
    productIdOrSlug: string,
    orderId?: string,
  ): Promise<{
    canReview: boolean;
    hasReviewed: boolean;
    existingReview: ProductReview | null;
    reason?: string;
  }> {
    const product = await this.resolveProduct(productIdOrSlug);
    const productObjectId = new Types.ObjectId(product._id);
    const userObjectId = new Types.ObjectId(userId);
    const cleanOrderId = orderId ? orderId.trim().replace(/^#/, '').trim() : undefined;

    // 1. Kiểm tra đã có review chưa
    const reviewFilter: any = {
      productId: productObjectId,
      $or: [
        { userId: userObjectId },
        { userId: String(userObjectId) },
      ],
    };
    if (cleanOrderId) {
      reviewFilter.orderId = cleanOrderId;
    }

    let existingReview = await this.reviewModel.findOne(reviewFilter).lean();

    if (!existingReview && cleanOrderId) {
      existingReview = await this.reviewModel.findOne({
        productId: productObjectId,
        $or: [
          { userId: userObjectId },
          { userId: String(userObjectId) },
        ],
      }).lean();
    }

    if (existingReview) {
      return {
        canReview: false,
        hasReviewed: true,
        existingReview: existingReview as any,
        reason: 'Bạn đã đánh giá sản phẩm này',
      };
    }

    // 2. Kiểm tra xem có đơn hàng DELIVERED nào không
    const orderFilter = this.buildDeliveredOrderFilter(
      userObjectId,
      userEmail,
      productObjectId,
      cleanOrderId,
    );

    const matchedOrder = await this.orderModel.findOne(orderFilter).lean();

    if (!matchedOrder) {
      return {
        canReview: false,
        hasReviewed: false,
        existingReview: null,
        reason: 'Bạn chỉ có thể đánh giá sau khi đã mua và nhận sản phẩm thành công',
      };
    }

    if ((matchedOrder as any).isReviewed) {
      return {
        canReview: false,
        hasReviewed: true,
        existingReview: null,
        reason: 'Đơn hàng này đã được đánh giá thành công',
      };
    }

    // Kiểm tra đơn hàng có yêu cầu đổi trả đang tồn tại không
    const returnReqs = Array.isArray((matchedOrder as any).returnRequests)
      ? (matchedOrder as any).returnRequests
      : ((matchedOrder as any).returnRequest ? [(matchedOrder as any).returnRequest] : []);
    const inactiveReturnStatuses = ['CANCELLED', 'CANC', 'CANCELLED_BY_CUSTOMER', 'REJECTED', 'REJ'];
    const hasActiveReturn = returnReqs.some((r: any) => {
      const st = (r?.status || '').toUpperCase().trim();
      return st && !inactiveReturnStatuses.includes(st);
    });
    if (hasActiveReturn) {
      return {
        canReview: false,
        hasReviewed: false,
        existingReview: null,
        reason: 'Đơn hàng đã có yêu cầu trả hàng / hoàn tiền, không thể đánh giá',
      };
    }

    return {
      canReview: true,
      hasReviewed: false,
      existingReview: null,
    };
  }

  /**
   * Lấy chi tiết đánh giá theo ID (yêu cầu đăng nhập, chỉ chủ nhân hoặc quản trị viên)
   */
  async getReviewById(reviewId: string, userId: string, user?: any): Promise<ProductReview> {
    if (!isValidObjectId(reviewId)) {
      throw new BadRequestException('ID đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findById(reviewId).lean();
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const userRoles: string[] = user?.roles || (user?.role ? [user.role] : []);
    const isAdmin = userRoles.some(
      (r) => typeof r === 'string' && ['admin', 'super-admin'].includes(r.toLowerCase()),
    );

    if (!isAdmin && review.userId.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đánh giá này');
    }

    return review as any;
  }

  /**
   * Chỉnh sửa đánh giá của người dùng
   */
  async updateReview(
    reviewId: string,
    userId: string,
    dto: UpdateReviewDto,
  ): Promise<ProductReview> {
    if (!isValidObjectId(reviewId)) {
      throw new BadRequestException('ID đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    // Quyền: chỉ chủ nhân của đánh giá mới được sửa
    if (review.userId.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa đánh giá này');
    }

    if (dto.rating !== undefined) {
      review.rating = Math.round(Number(dto.rating));
    }
    if (dto.comment !== undefined) {
      review.comment = dto.comment.trim();
    }

    const saved = await review.save();
    await this.recalculateProductRating(review.productId);
    return saved;
  }

  /**
   * Xóa đánh giá (Người dùng xóa review của mình hoặc Admin xóa bất kỳ)
   */
  async deleteReview(reviewId: string, user: any): Promise<{ success: boolean; message: string }> {
    if (!isValidObjectId(reviewId)) {
      throw new BadRequestException('ID đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    const userId = user._id ? user._id.toString() : user.id;
    const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
    const isAdmin = userRoles.some(
      (r) => typeof r === 'string' && ['admin', 'super-admin'].includes(r.toLowerCase()),
    );

    if (!isAdmin && review.userId.toString() !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa đánh giá này');
    }

    const productId = review.productId;
    await this.reviewModel.findByIdAndDelete(reviewId);
    await this.recalculateProductRating(productId);

    return { success: true, message: 'Đã xóa đánh giá thành công' };
  }

  /**
   * Duyệt hoặc cập nhật trạng thái đánh giá bởi Quản trị viên
   */
  async updateReviewStatusByAdmin(
    reviewId: string,
    status: ReviewStatus,
  ): Promise<ProductReview> {
    if (!isValidObjectId(reviewId)) {
      throw new BadRequestException('ID đánh giá không hợp lệ');
    }

    const review = await this.reviewModel.findById(reviewId);
    if (!review) {
      throw new NotFoundException('Không tìm thấy đánh giá');
    }

    review.status = status;
    const saved = await review.save();
    await this.recalculateProductRating(review.productId);
    return saved;
  }

  /**
   * Tính lại rating trung bình và cập nhật vào collection products
   */
  private async recalculateProductRating(productId: Types.ObjectId): Promise<void> {
    try {
      const result = await this.reviewModel.aggregate([
        {
          $match: {
            productId,
            status: ReviewStatus.APPROVED,
          },
        },
        {
          $group: {
            _id: '$productId',
            avgRating: { $sum: '$rating' },
            count: { $sum: 1 },
          },
        },
      ]);

      if (result && result.length > 0 && result[0].count > 0) {
        const avg = Math.round((result[0].avgRating / result[0].count) * 10) / 10;
        await this.productModel.updateOne({ _id: productId }, { rating: avg });
      } else {
        // Nếu không còn review nào, đặt về 5 mặc định
        await this.productModel.updateOne({ _id: productId }, { rating: 5 });
      }
    } catch (err) {
      // Không để lỗi tính rating làm gián đoạn transaction chính
      console.error('Lỗi khi tính lại rating sản phẩm:', err);
    }
  }
}
