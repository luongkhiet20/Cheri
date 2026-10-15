import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export interface InteractionDocument extends mongoose.Document {
  userId?: mongoose.Types.ObjectId | null;
  sessionId?: string | null;
  productId: mongoose.Types.ObjectId;
  variantId?: any;
  eventType: string;
  timestamp: Date;
  isSynthetic: boolean;
  metadata?: any;
}

export const InteractionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: Schema.Types.Mixed, default: null },
    eventType: { type: String, required: true, enum: ['VIEW'], default: 'VIEW' },
    timestamp: { type: Date, default: Date.now, index: true },
    isSynthetic: { type: Boolean, default: false, index: true },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({ isSynthetic: false, source: 'web_client' }),
    },
  },
  {
    collection: 'user_interactions',
    timestamps: false,
  },
);
