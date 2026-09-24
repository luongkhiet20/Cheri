import { Document, Model, Types } from 'mongoose';

export interface Product extends Document {
  _id: any;
  id?: string;
  sku?: string;
  title: string;
  description: string;
  descriptionFull: string[];
  tags: string[];
  categoryLevel1?: string[];
  regularPrice: number;
  salePrice: number;
  titleUrl: string;
  onSale?: boolean;
  stock?: string;
  quantity?: number;
  visibility: boolean;
  shipping?: string;
  mainImage: { url: string; name: string };
  images: string[];
  hasColors?: boolean;
  colors?: any[];
  hasSizes?: boolean;
  sizes?: string[];
  hasClassification?: boolean;
  rating?: number;
  _user?: Types.ObjectId | string;
  dateAdded?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  variants?: any[];
  [key: string]: any;
}

export interface PaginateOptions {
  sort: string;
  price: string;
  page: number;
  limit: number;
  lang: string;
}

export interface ProductModel extends Model<Product> {
  paginate(query: any, options: PaginateOptions);
}

export interface ProductsWithPagination {
  all: Product[];
  total: number;
  limit: number;
  page: number;
  pages: number;
}
