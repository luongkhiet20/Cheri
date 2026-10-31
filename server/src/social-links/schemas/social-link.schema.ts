import * as mongoose from 'mongoose';
const { Schema } = mongoose;

export const SocialPlatformEnum = ['TIKTOK', 'INSTAGRAM', 'FACEBOOK'] as const;
export type SocialPlatformType = (typeof SocialPlatformEnum)[number];

export const SocialLinkSchema = new Schema(
  {
    platform: {
      type: String,
      required: true,
      unique: true,
      enum: SocialPlatformEnum,
      uppercase: true,
      trim: true,
    },
    url: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: 'social_links',
  },
);

SocialLinkSchema.index({ platform: 1 }, { unique: true });

export default SocialLinkSchema;

