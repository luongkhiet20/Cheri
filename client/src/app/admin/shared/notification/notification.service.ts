import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AdminNotification, NotificationType } from './notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new BehaviorSubject<AdminNotification[]>([]);
  public notifications$: Observable<AdminNotification[]> = this.notificationsSubject.asObservable();

  // Map to hold dismiss timers for each active notification
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  // Anti-duplicate tracker: stores key -> timestamp
  private recentMessages = new Map<string, number>();
  private readonly DEDUPE_WINDOW_MS = 1500;

  // Default display durations
  private readonly DEFAULT_DURATIONS: Record<NotificationType, number> = {
    success: 4000,
    error: 5000
  };

  /**
   * Hiển thị thông báo thành công (mặc định 4s)
   */
  success(message: string, duration?: number): string {
    return this.show('success', message, duration);
  }

  /**
   * Hiển thị thông báo lỗi / thất bại (mặc định 5s)
   */
  error(message: string, duration?: number): string {
    return this.show('error', message, duration);
  }

  /**
   * Core show method - Chuẩn hóa chỉ nhận 'success' hoặc 'error'
   */
  show(type: NotificationType, message: string, customDuration?: number): string {
    if (!message || message.trim() === '') return '';

    const cleanMsg = message.trim();
    const dedupeKey = `${type}::${cleanMsg}`;
    const now = Date.now();

    // Check anti-duplicate within window
    const lastSent = this.recentMessages.get(dedupeKey);
    if (lastSent && now - lastSent < this.DEDUPE_WINDOW_MS) {
      return ''; // Ignore duplicate spam
    }
    this.recentMessages.set(dedupeKey, now);

    // Clean up old dedupe keys periodically
    if (this.recentMessages.size > 50) {
      for (const [k, time] of this.recentMessages.entries()) {
        if (now - time > 5000) this.recentMessages.delete(k);
      }
    }

    const duration = customDuration ?? this.DEFAULT_DURATIONS[type] ?? 4000;
    const id = `notif_${now}_${Math.random().toString(36).substring(2, 9)}`;

    const newNotification: AdminNotification = {
      id,
      type,
      message: cleanMsg,
      duration,
      createdAt: now,
      isLeaving: false
    };

    // Prepend new notification so it appears at top
    const currentList = this.notificationsSubject.getValue();
    this.notificationsSubject.next([newNotification, ...currentList]);

    // Schedule auto-dismiss with independent timer
    const timer = setTimeout(() => {
      this.dismiss(id);
    }, duration);

    this.timers.set(id, timer);

    return id;
  }

  /**
   * Tạm dừng đếm ngược khi hover chuột
   */
  pauseTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /**
   * Tiếp tục đếm ngược khi rời chuột
   */
  resumeTimer(id: string, remainingMs = 2500): void {
    if (this.timers.has(id)) return;
    const currentList = this.notificationsSubject.getValue();
    if (!currentList.some(n => n.id === id && !n.isLeaving)) return;

    const timer = setTimeout(() => {
      this.dismiss(id);
    }, remainingMs);
    this.timers.set(id, timer);
  }

  /**
   * Bắt đầu animation thoát (250ms) và gỡ khỏi DOM
   */
  dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const currentList = this.notificationsSubject.getValue();
    const item = currentList.find(n => n.id === id);
    if (!item) return;

    // Mark as leaving to trigger exit transition
    item.isLeaving = true;
    this.notificationsSubject.next([...currentList]);

    // Remove from array after transition completes (250ms)
    setTimeout(() => {
      const updated = this.notificationsSubject.getValue().filter(n => n.id !== id);
      this.notificationsSubject.next(updated);
    }, 260);
  }

  /**
   * Clear all active notifications
   */
  clearAll(): void {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
    this.notificationsSubject.next([]);
  }
}
