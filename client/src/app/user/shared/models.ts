import { languages } from './constants';

export interface Translations {
  lang: string;
  keys: {
    [key: string]: string;
  }
  _id?: string;
}

export interface Product {
  _id?                : string;
  id?                 : string;
  sku?                : string;
  title               : string;
  titleUrl            : string;
  description         : string;
  descriptionFull     : string[];
  tags                : string[];
  regularPrice        : number;
  salePrice           : number;
  visibility          : boolean;
  onSale              : boolean;
  stock               : string;
  stockDate?          : string;
  shipping?           : string;
  shippingCost?       : number;
  productType?        : string;
  hasColors?          : boolean;
  colors?             : { name: string; hex: string }[];
  hasSizes?           : boolean;
  sizes?              : string[];
  hasClassification?  : boolean;
  categoryLevel1?     : string | string[];
  categoryLevel2?     : string;
  quantity?           : number;
  variants?           : ProductVariant[];
  mainImage           : { url: string; name: string };
  images              : string[];
  _user?              : any;
  dateAdded?          : any;
  createdAt?          : Date | string;
  updatedAt?          : Date | string;
  [key: string]       : any;
}

export interface ProductVariant {
  _id?                : string;
  productId?          : string;
  sku                 : string;
  color?              : string;
  size?               : string;
  classification?     : string;
  attributes?         : { [key: string]: string };
  price               : number;
  discountPrice?      : number;
  stock               : number;
  isActive?           : boolean;
  status?             : boolean;
  createdAt?          : Date | string;
  updatedAt?          : Date | string;
}

export interface Cart {
  totalQty    : number;
  totalPrice  : number;
  shippingCost?: number;
  shippingLimit?: number;
  shippingType?: string;
  items       : {
    id? : string;
    item: Product;
    price: number;
    qty  : number;
  }[];
}

export interface Category {
  titleUrl      : string;
  title?        : string;
  description?  : string;
  visibility?   : boolean;
  mainImage?    : { url: string; name: string; type?: boolean };
  subCategories?: string[];
  position      : number;
  [lang: string]: any | { title?: string; description?: string; visibility?: boolean };
}

export interface Pagination {
  total     : number;
  limit?    : number;
  page      : number;
  pages     : number;
  range?    : number[];
}

export interface User {
  email       : string;
  id?         : string;
  _id?        : string;
  name?       : string;
  fullName?   : string;
  phoneNumber?: string;
  address?    : string;
  gender?     : string;
  dateOfBirth?: Date | string;
  avatar?     : string;
  roles?      : string[];
  role?       : string;
  status?     : boolean;
  images?     : string[];
  description?: string;
  cart?       : any;
  accessToken?: string;
  createdAt?  : Date | string;
  updatedAt?  : Date | string;
}

export interface Address {
  name: string;
  line1: string;
  line2: string;
  city: string;
  zip: string;
  country: string;
  region?: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPING = 'SHIPPING',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export interface ShippingMethod {
  _id?: string;
  name: string;
  code: string;
  baseFee: number;
  estimatedDeliveryTime: string;
  deliveryScope: string;
  deliveryAreas?: string[];
  freeShippingCondition?: {
    enabled: boolean;
    minimumOrderValue: number;
    description: string;
  };
  status: string;
  description?: string;
}

export interface PaymentMethod {
  _id?: string;
  name: string;
  code: string;
  paymentType: string;
  description?: string;
  transactionFee?: {
    enabled: boolean;
    type: string;
    value: number;
  };
  logo?: string;
  status: string;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  ward?: string;
  district?: string;
  province?: string;
}

export interface Order {
  _id?: string;
  orderId: string;
  _user?: string;
  customerEmail: string;
  customerPhone?: string;
  status: string;
  paymentStatus?: string;
  notes?: string;
  items?: {
    productId: string;
    variantId?: string;
    productSnapshot: {
      title: string;
      sku: string;
      image?: string;
      variant?: { color?: string; size?: string; classification?: string };
    };
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[];
  shippingAddress?: ShippingAddress;
  shippingMethodId?: string;
  shippingMethodSnapshot?: { name: string; code: string; fee: number; estimatedDeliveryTime?: string };
  shippingFee?: number;
  trackingNumber?: string;
  paymentMethodId?: string;
  paymentMethodSnapshot?: { name: string; code: string; paymentType: string; paymentFee: number };
  transactionId?: string;
  paymentFee?: number;
  paidAt?: Date | string;
  refundedAmount?: number;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  couponCode?: string;
  couponDiscount?: number;
  totalAmount?: number;
  currency?: string;
  statusHistory?: { status: string; updatedAt: Date; updatedBy?: string; note?: string }[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Legacy fields (backward compat)
  amount?: number;
  dateAdded?: any;
  description?: string;
  type?: string;
  outcome?: any;
  cart?: any;
  addresses?: any[];
  amount_refunded?: number;
}

export interface Page {
  _id?                : string;
  titleUrl            : string;
  dateAdded?          : Date;
  [lang: string]      : any | { title?: string; contentHTML?: string };
}

export interface Theme {
  _id?                : string;
  titleUrl            : string;
  dateAdded?          : Date;
  active              : boolean;
  styles: any | {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    mainBackground: string;
    freeShippingPromo: string;
    promoSlideBackground: string;
    promoSlideVideo: string;
    promoSlideBackgroundPosition: string;
    promo: string;
    logo: string;
  };
}

export interface Config {
  _id?                : string;
  titleUrl            : string;
  dateAdded?          : Date;
  active              : boolean;
  [lang: string]      : any | {
    shippingCost: {
      basic: { cost: number; limit: number; },
      extended: { cost: number; limit: number; }
    }
  }
}
