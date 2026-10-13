export interface ReviewSummary { average: number | null; count: number; }
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewDraft { rating: number; comment: string; }
export interface ReviewPage {
  productId: string;
  summary: ReviewSummary;
  reviews: PublicReview[];
  page: number;
  pageSize: number;
  total: number;
}
export interface ReviewEligibility {
  productId: string;
  eligible: boolean;
  reason: 'ELIGIBLE' | 'NOT_PURCHASED';
  myReview: PublicReview | null;
}
export interface ReviewSaveResult extends ReviewPage { myReview: PublicReview; }
