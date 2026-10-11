export function getTrackingIdentifierFromQuery(params: Record<string, unknown>): string | null;
export function hasSensitiveTrackingQueryParams(params: Record<string, unknown>): boolean;
export function findOwnedTrackingOrder<T extends Record<string, any>>(orders: T[], identifier: string): T | null;
