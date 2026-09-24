import * as mongoose from 'mongoose';
const { Schema } = mongoose;

const TranslationSchema = new Schema(
  {
    lang: {
      type: String,
      required: true,
      unique: true,
      enum: ['vi'],
      default: 'vi',
      trim: true,
    },
    keys: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'translations',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export default TranslationSchema;
