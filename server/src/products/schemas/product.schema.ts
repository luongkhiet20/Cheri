import * as mongoose from 'mongoose';
const { Schema } = mongoose;
import * as paginate from '../../shared/utils/paginate';
import { languages } from '../../shared/constans';

const getProductLangInfo = (): { [lang: string]: any } => {
  return languages.reduce(
    (prev, lang) => ({
      ...prev,
      [lang]: {
        title: String,
        description: String,
        descriptionFull: [],
        regularPrice: Number,
        salePrice: Number,
        onSale: Boolean,
        stock: String,
        stockDate: String,
        visibility: Boolean,
        shipping: String,
        shippingCost: Number,
        productType: String,
        hasColors: Boolean,
        colors: [],
        hasSizes: Boolean,
        sizes: [],
        hasClassification: Boolean,
        categoryLevel1: Schema.Types.Mixed,
        categoryLevel2: String,
        quantity: Number,
      },
    }),
    {},
  );
};

const ProductSchema = new Schema(
  {
    id: String,
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    title: { type: String, trim: true },
    titleUrl: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: { type: String, default: '' },
    descriptionFull: [],
    tags: [String],
    categoryLevel1: [String],
    images: [String],
    mainImage: {
      url: { type: String, trim: true, required: true },
      name: { type: String, trim: true },
    },
    hasColors: { type: Boolean, default: false },
    hasSizes: { type: Boolean, default: false },
    hasClassification: { type: Boolean, default: false },
    colors: [],
    sizes: [String],
    regularPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    visibility: { type: Boolean, default: true },
    _user: { type: Schema.Types.ObjectId, ref: 'User' },
    rating: { type: Number, default: 5 },
    dateAdded: { type: Date, default: Date.now },
    ...getProductLangInfo(),
  },
  {
    timestamps: true,
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

ProductSchema.plugin(paginate.pagination);

export default ProductSchema;
