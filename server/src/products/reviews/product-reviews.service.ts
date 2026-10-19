import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { User } from '../../auth/models/user.model';
import type { Order } from '../../orders/models/order.model';
import type { Product } from '../models/product.model';
import { isReviewPurchaseEligible } from './purchase-eligibility';
import { buildReviewUpdatePipeline, summarizeReviews, toPublicReview, validateReviewDraft } from './review-write';
import type { ReviewDraft, ReviewEligibility, ReviewOrder, ReviewPage, ReviewSaveResult, StoredReview } from './review.types';

@Injectable()
export class ProductReviewsService {
  constructor(
    @InjectModel('Product') private readonly productModel: Model<Product>,
    @InjectModel('Order') private readonly orderModel: Model<Order>,
  ) {}

  async getPage(productId: string, page: number, pageSize: number): Promise<ReviewPage> {
    const id = this.productId(productId);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      throw new BadRequestException('Phân trang không hợp lệ');
    }
    const product = await this.visibleProduct(id, { _id: 1, reviews: 1 });
    return this.page(id, product.reviews ?? [], page, pageSize);
  }

  async getMine(productId: string, user: User): Promise<ReviewEligibility> {
    const id = this.productId(productId);
    const userId = this.authenticatedId(user);
    const product = await this.visibleProduct(id, { _id: 1, reviews: 1 });
    const eligible = await this.eligible(userId, id);
    const mine = (product.reviews ?? []).find((review) => review.userId.toString().toLowerCase() === userId.toHexString());
    return {
      productId: id.toHexString(),
      eligible,
      reason: eligible ? 'ELIGIBLE' : 'NOT_PURCHASED',
      myReview: mine ? toPublicReview(mine) : null,
    };
  }

  async saveMine(productId: string, user: User, draft: ReviewDraft): Promise<ReviewSaveResult> {
    const id = this.productId(productId);
    const userId = this.authenticatedId(user);
    const validated = validateReviewDraft(draft);
    // Only existence/visibility is read before the write, never a stale review array.
    await this.visibleProduct(id, { _id: 1 });
    if (!await this.eligible(userId, id)) {
      throw new ForbiddenException('Bạn chưa có đơn hàng đủ điều kiện đánh giá sản phẩm này');
    }
    const name = [user.fullName, user.name].find((value) => typeof value === 'string' && value.trim() && !value.includes('@'));
    const authorName = name ? name.trim() : 'Khách hàng';
    const updated = await this.productModel.findOneAndUpdate(
      this.visibleFilter(id),
      buildReviewUpdatePipeline(userId, new Types.ObjectId(), authorName, validated, new Date()),
      { returnDocument: 'after', projection: { _id: 1, reviews: 1 } },
    ).lean();
    if (!updated) throw new NotFoundException('Sản phẩm không khả dụng');
    const reviews = updated.reviews ?? [];
    const mine = reviews.find((review) => review.userId.toString().toLowerCase() === userId.toHexString());
    if (!mine) throw new Error('Atomic review update returned no saved review');
    return { ...this.page(id, reviews, 1, 10), myReview: toPublicReview(mine) };
  }

  private productId(value: unknown): Types.ObjectId {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
      throw new BadRequestException('ID sản phẩm không hợp lệ');
    }
    return new Types.ObjectId(value);
  }

  private authenticatedId(user: User): Types.ObjectId {
    const rawId: unknown = user?._id;
    const id = rawId instanceof Types.ObjectId ? rawId.toHexString() : rawId;
    if (typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) throw new UnauthorizedException();
    return new Types.ObjectId(id);
  }

  private visibleFilter(id: Types.ObjectId) {
    return { _id: id, visibility: { $ne: false }, 'vi.visibility': { $ne: false } };
  }

  private async visibleProduct(id: Types.ObjectId, projection: Record<string, number>) {
    const product = await this.productModel.findOne(this.visibleFilter(id), projection).lean();
    if (!product) throw new NotFoundException('Sản phẩm không khả dụng');
    return product;
  }

  private async eligible(userId: Types.ObjectId, productId: Types.ObjectId): Promise<boolean> {
    const ids = [userId, userId.toHexString()];
    // Native reads preserve legacy string IDs: Mongoose would cast both $in
    // alternatives to ObjectId for these schema paths and lose string matches.
    const orders = await this.orderModel.collection.find(
      { $or: [{ userId: { $in: ids } }, { _user: { $in: ids } }] },
      { projection: { userId: 1, _user: 1, status: 1, paymentStatus: 1, 'payment.status': 1, 'items.productId': 1, 'cart.items.item._id': 1 } },
    ).toArray();
    return orders.some((order) => isReviewPurchaseEligible(order as ReviewOrder, userId.toHexString(), productId.toHexString()));
  }

  private page(id: Types.ObjectId, reviews: StoredReview[], page: number, pageSize: number): ReviewPage {
    const sorted = [...reviews].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() || b._id.toString().localeCompare(a._id.toString()),
    );
    return {
      productId: id.toHexString(),
      summary: summarizeReviews(reviews),
      reviews: sorted.slice((page - 1) * pageSize, page * pageSize).map(toPublicReview),
      page,
      pageSize,
      total: reviews.length,
    };
  }
}
