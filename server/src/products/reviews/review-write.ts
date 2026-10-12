import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import type { PublicReview, ReviewDraft, ReviewSummary, StoredReview } from './review.types';

export function validateReviewDraft(input: unknown): ReviewDraft {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Đánh giá không hợp lệ');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== 'rating' && key !== 'comment') ||
      typeof value.rating !== 'number' || !Number.isInteger(value.rating) ||
      value.rating < 1 || value.rating > 5 || typeof value.comment !== 'string') {
    throw new BadRequestException('Đánh giá không hợp lệ');
  }
  const comment = value.comment.trim();
  if (comment.length < 1 || comment.length > 1000) {
    throw new BadRequestException('Nội dung đánh giá phải có từ 1 đến 1000 ký tự');
  }
  return { rating: value.rating, comment };
}

export function buildReviewUpdatePipeline(
  userId: Types.ObjectId,
  reviewId: Types.ObjectId,
  authorName: string,
  draft: ReviewDraft,
  now: Date,
): object[] {
  // Pipeline updates bypass Mongoose casting/validators. The service validates
  // drafts and supplies ObjectIds; literal values cannot become expressions.
  const owner = { $toLower: { $convert: { input: '$$review.userId', to: 'string', onError: '', onNull: '' } } };
  const canonicalOwner = { $literal: userId.toHexString() };
  return [
    {
      $set: {
        reviews: {
          $let: {
            vars: { reviews: { $ifNull: ['$reviews', []] } },
            in: {
              $let: {
                vars: {
                  existing: {
                    $arrayElemAt: [{ $filter: { input: '$$reviews', as: 'review', cond: { $eq: [owner, canonicalOwner] } } }, 0],
                  },
                },
                in: {
                  $concatArrays: [
                    { $filter: { input: '$$reviews', as: 'review', cond: { $ne: [owner, canonicalOwner] } } },
                    [{
                      _id: { $ifNull: ['$$existing._id', { $literal: reviewId }] },
                      userId: { $literal: userId },
                      authorName: { $literal: authorName },
                      rating: { $literal: draft.rating },
                      comment: { $literal: draft.comment },
                      createdAt: { $ifNull: ['$$existing.createdAt', { $literal: now }] },
                      updatedAt: { $literal: now },
                    }],
                  ],
                },
              },
            },
          },
        },
      },
    },
    {
      $set: {
        rating: { $cond: [{ $eq: [{ $size: '$reviews' }, 0] }, null, { $avg: '$reviews.rating' }] },
      },
    },
  ];
}

export function summarizeReviews(reviews: StoredReview[]): ReviewSummary {
  return {
    average: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null,
    count: reviews.length,
  };
}

export function toPublicReview(review: StoredReview): PublicReview {
  const authorName = typeof review.authorName === 'string' ? review.authorName.trim() : '';
  return {
    id: review._id.toString(),
    authorName: authorName && !authorName.includes('@') ? authorName : 'Khách hàng',
    rating: review.rating,
    comment: review.comment,
    createdAt: new Date(review.createdAt).toISOString(),
    updatedAt: new Date(review.updatedAt).toISOString(),
  };
}
