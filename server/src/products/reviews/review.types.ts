import type { Types } from 'mongoose';

export interface ReviewOrder {
  userId?: unknown;
  _user?: unknown;
  status?: unknown;
  paymentStatus?: unknown;
  payment?: { status?: unknown } | null;
  items?: ReadonlyArray<{ productId?: unknown } | null> | null;
  cart?: { items?: ReadonlyArray<{ item?: { _id?: unknown } | null } | null> | null } | null;
}

export type ReviewSummary = { average: number | null; count: number };
export type PublicReview = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};
export type ReviewDraft = { rating: number; comment: string };
export type ReviewPage = {
  productId: string;
  summary: ReviewSummary;
  reviews: PublicReview[];
  page: number;
  pageSize: number;
  total: number;
};
export type ReviewEligibility = {
  productId: string;
  eligible: boolean;
  reason: 'ELIGIBLE' | 'NOT_PURCHASED';
  myReview: PublicReview | null;
};
export type ReviewSaveResult = ReviewPage & { myReview: PublicReview };
export type StoredReview = {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
};
