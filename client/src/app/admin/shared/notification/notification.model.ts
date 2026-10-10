export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'cart';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number; // in milliseconds
  createdAt: number;
  isLeaving?: boolean;
}
