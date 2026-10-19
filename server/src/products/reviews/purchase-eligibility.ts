import { Types } from 'mongoose';
import type { ReviewOrder } from './review.types';

function canonicalId(value: unknown): string {
  const id = value instanceof Types.ObjectId ? value.toHexString() : value;
  return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? id.toLowerCase() : '';
}

export function normalizeReviewOrderStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function getReviewPaymentStatus(order: ReviewOrder): string {
  return normalizeReviewOrderStatus(order.paymentStatus ?? order.payment?.status);
}

export function getPurchasedProductIds(order: ReviewOrder): string[] {
  // Prefer modern items so a stale legacy cart cannot broaden purchase rights.
  const productIds = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map((item) => canonicalId(item?.productId))
    : Array.isArray(order.cart?.items)
      ? order.cart.items.map((item) => canonicalId(item?.item?._id))
      : [];
  return [...new Set(productIds.filter(Boolean))];
}

export function isReviewPurchaseEligible(order: ReviewOrder, userId: string, productId: string): boolean {
  const ownerId = canonicalId(userId);
  const purchasedProductId = canonicalId(productId);
  if (!order || !ownerId || !purchasedProductId) return false;
  if (canonicalId(order.userId) !== ownerId && canonicalId(order._user) !== ownerId) return false;
  if (!getPurchasedProductIds(order).includes(purchasedProductId)) return false;

  const status = normalizeReviewOrderStatus(order.status);
  const paymentStatus = getReviewPaymentStatus(order);
  if (['CANCELLED', 'CANCELED', 'RETURNED'].includes(status) || paymentStatus === 'REFUNDED') return false;
  return paymentStatus === 'PAID' || status === 'DELIVERED' || status === 'COMPLETED';
}
