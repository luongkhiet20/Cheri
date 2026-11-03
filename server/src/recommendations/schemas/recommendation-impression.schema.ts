import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export interface RecommendationImpressionDocument extends mongoose.Document {
  userKey: string;
  userId?: mongoose.Types.ObjectId | null;
  sessionId?: string | null;
  productId: mongoose.Types.ObjectId;
  currentProductId?: string | null;
  recommendationContextId?: string | null;
  strategy: string;
  shownAt: Date;
}

export const RecommendationImpressionSchema = new Schema(
  {
    userKey: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    currentProductId: { type: String, default: null, index: true },
    recommendationContextId: { type: String, default: null, index: true },
    strategy: {
      type: String,
      default: 'ml_bootstrap_model',
      index: true,
    },
    shownAt: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'recommendation_impressions',
    timestamps: false,
  },
);

RecommendationImpressionSchema.index({ recommendationContextId: 1, shownAt: -1 });
RecommendationImpressionSchema.index({ userKey: 1, shownAt: -1 });
RecommendationImpressionSchema.index({ sessionId: 1, shownAt: -1 });
RecommendationImpressionSchema.index({ userId: 1, shownAt: -1 });

