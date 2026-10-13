import { ReviewSummary } from './review.models';

const averageFormat = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatReviewSummary(summary: ReviewSummary): string {
  if (summary.count === 0 || summary.average === null) return 'Chưa có đánh giá';
  return `${averageFormat.format(summary.average)}/5 · ${summary.count} đánh giá`;
}

export function getStarFill(average: number | null, starIndex: number): number {
  if (average === null || !Number.isFinite(average)) return 0;
  return Math.max(0, Math.min(100, (average - starIndex) * 100));
}
