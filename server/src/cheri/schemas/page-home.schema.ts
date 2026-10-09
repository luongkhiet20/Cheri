import * as mongoose from 'mongoose';
const { Schema } = mongoose;

const PageHomeSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      default: 'home_page',
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    version: {
      type: Number,
      default: 1,
    },
    sections: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false,
    collection: 'pages_home',
  },
);

PageHomeSchema.index({ key: 1, status: 1 }, { unique: true });

export default PageHomeSchema;
