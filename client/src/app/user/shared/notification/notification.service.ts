import { Injectable, signal, OnDestroy } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface UserNotification {
  id: number;
  message: string;
  type: NotificationType;
  duration?: number;
}

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000
};

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private counter = 0;
  private timerRef: any = null;

  readonly notification = signal<UserNotification | null>(null);

  /**
   * Chuẩn hóa thông điệp theo loại thông báo:
   * - 'success': ✨Nội dung thông báo✨ (chuẩn hóa đúng một ký tự ✨ ở mỗi đầu, không trùng lặp)
   * - 'error' | 'warning' | 'info': Loại bỏ ký tự ✨ ở hai đầu nếu có
   */
  private formatMessage(content: string, type: NotificationType): string {
    if (!content) return '';
    let msg = content.trim();
    // Loại bỏ tất cả ký tự ✨ và khoảng trắng ở đầu và cuối
    msg = msg.replace(/^[✨\s]+/, '').replace(/[✨\s]+$/, '').trim();

    if (type === 'success') {
      return `✨${msg}✨`;
    }
    return msg;
  }

  show(message: string, type: NotificationType = 'info', duration?: number): void {
    if (!message) return;

    this.clearTimer();

    const formatted = this.formatMessage(message, type);
    const finalDuration = duration !== undefined ? duration : DEFAULT_DURATIONS[type];

    const item: UserNotification = {
      id: ++this.counter,
      message: formatted,
      type,
      duration: finalDuration
    };

    this.notification.set(item);

    if (finalDuration > 0 && typeof window !== 'undefined') {
      this.timerRef = setTimeout(() => {
        this.dismiss(item.id);
      }, finalDuration);
    }
  }

  success(message: string, duration: number = 3000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration: number = 5000): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration: number = 4000): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration: number = 3000): void {
    this.show(message, 'info', duration);
  }

  dismiss(targetId?: number): void {
    const current = this.notification();
    if (!current) return;

    if (targetId === undefined || current.id === targetId) {
      this.clearTimer();
      this.notification.set(null);
    }
  }

  private clearTimer(): void {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }
}
