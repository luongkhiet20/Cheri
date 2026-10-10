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
  private timers = new Map<string, any>();

  // Anti-duplicate tracker: stores key -> timestamp
  private recentMessages = new Map<string, number>();
  private readonly DEDUPE_WINDOW_MS = 1500;

  // Default display durations as requested
  private readonly DEFAULT_DURATIONS: Record<NotificationType, number> = {
    success: 4000,
    info: 4000,
    warning: 5000,
    error: 5000,
    cart: 2300
  };

  /**
   * Hiển thị Toast thêm giỏ hàng Chéri (2.3s)
   */
  cartSuccess(message: string = '✨Đã thêm sản phẩm vào giỏ✨', duration = 2300): string {
    // Tự động dismiss cart toast cũ nếu đang hiển thị để tránh chồng chéo
    const currentList = this.notificationsSubject.getValue();
    const existingCart = currentList.find(n => n.type === 'cart');
    if (existingCart) {
      this.dismiss(existingCart.id);
    }
    return this.show('cart', message, duration);
  }

  /**
   * Hiển thị thông báo thành công (4s)
   */
  success(message: string, duration?: number): string {
    return this.show('success', message, duration);
  }

  /**
   * Hiển thị thông báo lỗi (5s)
   */
  error(message: string, duration?: number): string {
    return this.show('error', message, duration);
  }

  /**
   * Hiển thị thông báo cảnh báo (5s)
   */
  warning(message: string, duration?: number): string {
    return this.show('warning', message, duration);
  }

  /**
   * Hiển thị thông báo thông tin (4s)
   */
  info(message: string, duration?: number): string {
    return this.show('info', message, duration);
  }

  /**
   * Core show method
   */
  show(type: NotificationType, message: string, customDuration?: number): string {
    if (!message || message.trim() === '') return '';

    const cleanMsg = message.trim();
    const dedupeKey = `${type}::${cleanMsg}`;
    const now = Date.now();

    // Check anti-duplicate within window
    const lastSent = this.recentMessages.get(dedupeKey);
    if (lastSent && now - lastSent < this.DEDUPE_WINDOW_MS) {
      return ''; // Ignore duplicate
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

    // Prepend new notification so it appears at the top
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
   * Start exit animation and remove from DOM after slide-up + fade-out
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
