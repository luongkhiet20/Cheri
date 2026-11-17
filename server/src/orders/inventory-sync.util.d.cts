export declare const RESERVED_ORDER_STATUSES: Set<string>;
export declare const UNRESERVED_OR_RELEASED_STATUSES: Set<string>;
export declare const LOW_STOCK_THRESHOLD: number;

export declare function isOrderHoldingReservation(order: any): boolean;
export declare function extractNormalizedOrderItems(order: any): any[];
export declare function groupOrderDemands(orderItems: any[]): any[];
export declare function findProductVariant(product: any, itemDemand: any): any;
export declare function calculateActiveReservationMaps(db: any, options?: any): Promise<{ prodReservedMap: Map<string, number>; variantReservedMap: Map<string, number>; activeOrders: any[] }>;
export declare function getVariantReservedCount(variantReservedMap: Map<string, number>, prodIdStr: string, v: any): number;
export declare function findProductById(db: any, productId: any, session?: any): Promise<any>;
export declare function checkOrderStockAvailability(db: any, order: any, session?: any): Promise<{ success: boolean; demands: any[] }>;
export declare function reserveOrderInventory(db: any, order: any, session?: any): Promise<any>;
export declare function releaseOrderInventory(db: any, order: any, session?: any): Promise<any>;
export declare function restoreOrderInventory(db: any, order: any, session?: any): Promise<any>;
export declare function buildInventoryList(db: any, session?: any): Promise<{ success: boolean; total: number; data: any[] }>;
export declare function buildInventoryDetail(db: any, productId: any, session?: any): Promise<{ success: boolean; message?: string; data?: any }>;

