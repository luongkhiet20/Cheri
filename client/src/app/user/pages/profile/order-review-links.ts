import type { Order } from '../../shared/models';

export function getOrderReviewProducts(order: Order): Array<{ productId: string; title: string }> {
  if (!order) return [];
  // Match the audited backend precedence: modern lines replace the legacy cart.
  const lines = Array.isArray(order.items) && order.items.length > 0
    ? order.items.map(item => ({ id: item?.productId, title: item?.productSnapshot?.title }))
    : Array.isArray(order.cart?.items)
      ? order.cart.items.map(item => ({ id: item?.item?._id, title: item?.item?.vi?.title || item?.item?.title }))
      : [];
  const products = new Map<string, { productId: string; title: string }>();
  for (const line of lines) {
    if (typeof line.id !== 'string' || !/^[a-f\d]{24}$/i.test(line.id)) continue;
    const productId = line.id.toLowerCase();
    if (!products.has(productId)) {
      const title = typeof line.title === 'string' ? line.title.trim() : '';
      products.set(productId, { productId, title: title || 'Sản phẩm Cheri' });
    }
  }
  return [...products.values()];
}

export function canShowOrderReviewAction(order: Order): boolean {
  if (!order) return false;
  const normalize = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : '';
  const status = normalize(order.status);
  const payment = normalize(order.paymentStatus ?? (order as Order & { payment?: { status?: unknown } }).payment?.status);
  if (['CANCELLED', 'CANCELED', 'RETURNED'].includes(status) || payment === 'REFUNDED') return false;
  // A display hint on the owned-order list; the review API decides actual eligibility.
  return payment === 'PAID' || status === 'DELIVERED' || status === 'COMPLETED';
}
