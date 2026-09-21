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
        categoryLevel1: String,
        categoryLevel2: String,
        quantity: Number,
        variants: [],
      },
    }),
    {},
  );
};

const ProductSchema = new Schema(
  {
    id: String,
    titleUrl: String,
    mainImage: {
      url: { type: String, trim: true },
      name: { type: String, trim: true },
    },
    images: [],
    tags: [],
    _user: { type: Schema.Types.ObjectId, ref: 'user' },
    dateAdded: Date,
    ...getProductLangInfo(),
  },
  {
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

ProductSchema.plugin(paginate.pagination);

export default ProductSchema;
