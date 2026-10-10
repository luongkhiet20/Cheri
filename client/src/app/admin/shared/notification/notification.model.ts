export type NotificationType = 'success' | 'error';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  message: string;
  duration: number; // in milliseconds
  createdAt: number;
  isLeaving?: boolean;
}
