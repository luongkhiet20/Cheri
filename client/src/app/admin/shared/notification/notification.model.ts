export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number; // in milliseconds
  createdAt: number;
  isLeaving?: boolean;
}
