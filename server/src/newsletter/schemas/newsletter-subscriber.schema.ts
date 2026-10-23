import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export const NewsletterSubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['SUBSCRIBED', 'UNSUBSCRIBED'],
      default: 'SUBSCRIBED',
    },
    source: {
      type: String,
      default: 'FOOTER',
      trim: true,
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'newsletter_subscribers',
  },
);

NewsletterSubscriberSchema.index({ email: 1 }, { unique: true });

export default NewsletterSubscriberSchema;
