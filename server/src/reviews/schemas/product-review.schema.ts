import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

const ProductReviewSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: Object.values(ReviewStatus),
      default: ReviewStatus.APPROVED,
      index: true,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    userName: {
      type: String,
      default: '',
      trim: true,
    },
    userAvatar: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'product_reviews',
  },
);

// Ràng buộc duy nhất: Một người dùng chỉ được đánh giá 1 lần cho 1 sản phẩm
ProductReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Index hỗ trợ tìm kiếm và phân trang theo sản phẩm và trạng thái
ProductReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });

export default ProductReviewSchema;
