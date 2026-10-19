import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export interface InteractionDocument extends mongoose.Document {
  userId?: mongoose.Types.ObjectId | null;
  sessionId?: string | null;
  productId: mongoose.Types.ObjectId;
  variantId?: any;
  orderId?: string | null;
  eventType: string;
  timestamp: Date;
  isSynthetic: boolean;
  datasetType?: string;
  metadata?: any;
}

export const InteractionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    sessionId: { type: String, default: null, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    variantId: { type: Schema.Types.Mixed, default: null },
    orderId: { type: String, default: null, index: true },
    eventType: {
      type: String,
      required: true,
      enum: ['VIEW', 'CLICK', 'ADD_TO_CART', 'PURCHASE'],
      default: 'VIEW',
      index: true,
    },
    timestamp: { type: Date, default: Date.now, index: true },
    isSynthetic: { type: Boolean, default: false, index: true },
    datasetType: { type: String, default: 'real', index: true },
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

// Compound index to guarantee that a purchase event is never duplicated per order line
InteractionSchema.index(
  { orderId: 1, productId: 1, eventType: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { orderId: { $type: 'string' }, eventType: 'PURCHASE' },
  },
);
