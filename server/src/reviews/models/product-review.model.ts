import { Document, Types } from 'mongoose';
import { ReviewStatus } from '../schemas/product-review.schema';

export interface ProductReview extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  userId: Types.ObjectId;
  orderId?: string | null;
  rating: number;
  comment: string;
  status: ReviewStatus;
  isVerifiedPurchase: boolean;
  userName: string;
  userAvatar: string;
  createdAt: Date;
  updatedAt: Date;
}
