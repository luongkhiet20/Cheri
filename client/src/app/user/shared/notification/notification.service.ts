import { Injectable, signal, OnDestroy } from '@angular/core';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface UserNotification {
  id: number;
  message: string;
  type: NotificationType;
  duration?: number;
  isLeaving?: boolean;
}

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 2800, // 2.5 - 3s mặc định
  error: 4500,
  warning: 3500,
  info: 2800
};

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private counter = 0;
  private timerRef: any = null;
  private leaveTimerRef: any = null;

  readonly notification = signal<UserNotification | null>(null);

  constructor() {
    this.checkPendingNotification();
  }

  private checkPendingNotification(): void {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('cheri_pending_notify');
        if (raw) {
          sessionStorage.removeItem('cheri_pending_notify');
          const parsed = JSON.parse(raw);
          if (parsed && parsed.message) {
            setTimeout(() => {
              this.show(parsed.message, parsed.type || 'info', parsed.duration);
            }, 300);
          }
        }
      } catch {}
    }
  }

  setPending(message: string, type: NotificationType = 'info', duration?: number): void {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('cheri_pending_notify', JSON.stringify({ message, type, duration }));
      } catch {}
    }
  }

  /**
   * Chuẩn hóa nội dung thông điệp: loại bỏ các ký tự ✨ và khoảng trắng thừa ở hai đầu
   */
  private formatMessage(content: string, _type: NotificationType): string {
    if (!content) return '';
    const msg = content.trim();
    return msg.replace(/^[✨\s]+/, '').replace(/[✨\s]+$/, '').trim();
  }

  show(message: string, type: NotificationType = 'info', duration?: number): void {
    if (!message) return;

    this.clearAllTimers();

    const formatted = this.formatMessage(message, type);
    const finalDuration = duration !== undefined ? duration : DEFAULT_DURATIONS[type];

    const item: UserNotification = {
      id: ++this.counter,
      message: formatted,
      type,
      duration: finalDuration,
      isLeaving: false
    };

    this.notification.set(item);

    if (finalDuration > 0 && typeof window !== 'undefined') {
      this.timerRef = setTimeout(() => {
        this.startDismiss(item.id);
      }, finalDuration);
    }
  }

  success(message: string, duration: number = 2800): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration: number = 4500): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration: number = 3500): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration: number = 2800): void {
    this.show(message, 'info', duration);
  }

  /**
   * Kích hoạt hiệu ứng biến mất trước khi gỡ khỏi DOM (trượt lên và mờ dần)
   */
  startDismiss(targetId?: number): void {
    const current = this.notification();
    if (!current) return;

    if (targetId !== undefined && current.id !== targetId) {
      return;
    }

    if (current.isLeaving) {
      return;
    }

    this.clearTimer();

    this.notification.set({
      ...current,
      isLeaving: true
    });

    if (typeof window !== 'undefined') {
      this.leaveTimerRef = setTimeout(() => {
        this.dismiss(current.id);
      }, 280);
    } else {
      this.dismiss(current.id);
    }
  }

  /**
   * Đóng và gỡ bỏ thông báo ngay lập tức
   */
  dismiss(targetId?: number): void {
    const current = this.notification();
    if (!current) return;

    if (targetId === undefined || current.id === targetId) {
      this.clearAllTimers();
      this.notification.set(null);
    }
  }

  private clearTimer(): void {
    if (this.timerRef) {
      clearTimeout(this.timerRef);
      this.timerRef = null;
    }
  }

  private clearLeaveTimer(): void {
    if (this.leaveTimerRef) {
      clearTimeout(this.leaveTimerRef);
      this.leaveTimerRef = null;
    }
  }

  private clearAllTimers(): void {
    this.clearTimer();
    this.clearLeaveTimer();
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }
}
