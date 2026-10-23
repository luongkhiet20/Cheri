import { Injectable, signal, computed, inject } from '@angular/core';
import { ChatbotService } from './chatbot.service';
import { ChatMessage, ChatProductCard, ChatQuickReply, ChatMode } from '../models/chatbot.model';

@Injectable({
  providedIn: 'root',
})
export class ChatbotStateService {
  private chatbotService = inject(ChatbotService);

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly sessionId = signal<string>(`client_${Date.now()}`);

  // Human support states
  readonly chatMode = signal<ChatMode>('AI');
  readonly supportConversationId = signal<string | null>(null);
  readonly supportStatus = signal<string | null>(null);
  readonly isRequestingSupport = signal(false);
  private supportPollTimer: any = null;
  private knownSupportMessageIds = new Set<string>();

  // Support cancellation states
  readonly isCancelPending = signal(false);
  readonly isCancelling = signal(false);
  readonly isUndoing = signal(false);
  readonly cancelCountdown = signal(5);
  private cancelTimer: any = null;

  readonly quickReplies = signal<ChatQuickReply[]>([
    { id: '1', label: 'Đầm hot nhất', query: 'Gợi ý cho mình các mẫu đầm hot nhất đợt này', icon: 'sparkles' },
    { id: '2', label: 'Tra cứu đơn hàng', query: 'Kiểm tra tình trạng đơn hàng của mình', icon: 'package' },
    { id: '3', label: 'Chính sách đổi trả', query: 'Chính sách đổi trả của Chéri như thế nào?', icon: 'refresh' },
    { id: '4', label: 'Tư vấn chọn size', query: 'Hướng dẫn mình cách chọn size đầm chuẩn', icon: 'ruler' },
    { id: '5', label: 'Liên hệ nhân viên hỗ trợ', query: 'Tôi muốn liên hệ nhân viên hỗ trợ', icon: 'headset' },
  ]);

  readonly messages = signal<ChatMessage[]>([
    {
      id: 1,
      sender: 'store',
      text: 'Chào nàng! Chéri có thể hỗ trợ nàng tìm kiếm trang phục, so sánh mẫu, tư vấn chính sách hay kiểm tra đơn hàng?',
      timestamp: new Date(),
    },
  ]);

  private nextMessageId = 2;

  private getGuestId(): string {
    if (typeof localStorage !== 'undefined') {
      let gid = localStorage.getItem('cheri_guest_cart_id') || localStorage.getItem('cheri_guest_chat_id');
      if (!gid) {
        gid = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        localStorage.setItem('cheri_guest_chat_id', gid);
      }
      return gid;
    }
    return 'guest_' + this.sessionId();
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.isOpen.set(true);
    if (this.chatMode() === 'HUMAN_SUPPORT') {
      this.startSupportPolling();
    } else {
      this.chatbotService.getCurrentSupport(this.sessionId(), this.getGuestId()).subscribe({
        next: (res: any) => {
          if (res && res.hasActiveSupport && res.conversation) {
            this.supportConversationId.set(res.conversation._id);
            this.supportStatus.set(res.conversation.status);
            this.chatMode.set('HUMAN_SUPPORT');

            const cancelReq = res.conversation.cancelRequest;
            if (cancelReq && cancelReq.status === 'PENDING') {
              const remainingMs = new Date(cancelReq.expiresAt).getTime() - Date.now();
              const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
              if (remainingSec > 0) {
                this.startCancelCountdown(remainingSec, new Date(cancelReq.expiresAt));
              } else {
                this.finalizeCancellation();
              }
            }

            this.startSupportPolling();
          }
        },
      });
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.stopSupportPolling();
  }

  clearMessages(): void {
    this.knownSupportMessageIds.clear();
    this.messages.set([
      {
        id: this.nextMessageId++,
        sender: 'store',
        text: 'Cuộc trò chuyện đã được làm mới. Chéri có thể hỗ trợ gì cho nàng tiếp theo ạ?',
        timestamp: new Date(),
      },
    ]);
  }

  selectQuickReply(reply: ChatQuickReply): void {
    if (reply.id === '5' || reply.icon === 'headset') {
      this.triggerSupportRequest(reply.label);
      return;
    }

    if (reply.id === '2' || reply.icon === 'package' || reply.query.includes('đơn hàng')) {
      this.sendMessage(reply.query, 'CHECK_MY_ORDERS');
      return;
    }

    this.sendMessage(reply.query);
  }

  triggerSupportRequest(label: string = 'Liên hệ nhân viên hỗ trợ'): void {
    if (this.isRequestingSupport()) return;
    if (this.chatMode() === 'HUMAN_SUPPORT' && this.supportConversationId()) {
      // Đang trong phiên hỗ trợ, thông báo khách tiếp tục nhắn tin
      return;
    }

    this.isRequestingSupport.set(true);
    const guestId = this.getGuestId();

    this.chatbotService.requestSupport(this.sessionId(), guestId).subscribe({
      next: (res: any) => {
        this.isRequestingSupport.set(false);
        if (res && res.success && res.conversation) {
          const conv = res.conversation;
          this.supportConversationId.set(conv._id);
          this.supportStatus.set(conv.status);
          this.chatMode.set('HUMAN_SUPPORT');

          const userMsg: ChatMessage = {
            id: this.nextMessageId++,
            sender: 'user',
            text: label,
            timestamp: new Date(),
          };

          this.messages.update((list) => [...list, userMsg]);
          this.startSupportPolling();
        } else {
          this.showSupportError();
        }
      },
      error: () => {
        this.isRequestingSupport.set(false);
        this.showSupportError();
      },
    });
  }

  private showSupportError(): void {
    const errorMsg: ChatMessage = {
      id: this.nextMessageId++,
      sender: 'store',
      text: 'Dạ kết nối với nhân viên hỗ trợ chưa thành công. Nàng vui lòng thử lại nhé!',
      timestamp: new Date(),
    };
    this.messages.update((list) => [...list, errorMsg]);
  }

  private detectSystemEvent(content: string): string {
    const text = (content || '').toLowerCase();
    if (text.includes('yêu cầu hủy') || text.includes('hủy kết nối với nhân viên')) return 'CANCEL_REQUESTED';
    if (text.includes('hoàn tác')) return 'CANCEL_UNDONE';
    if (text.includes('đã hủy kết nối')) return 'CANCEL_COMPLETED';
    if (text.includes('kết nối') || text.includes('chờ')) return 'SUPPORT_REQUESTED';
    if (text.includes('tham gia') || text.includes('sẵn sàng')) return 'ADMIN_JOINED';
    if (text.includes('rời') || text.includes('kết thúc')) return 'ADMIN_LEFT';
    return 'SUPPORT_REQUESTED';
  }

  stopCancelTimer(): void {
    if (this.cancelTimer) {
      clearInterval(this.cancelTimer);
      this.cancelTimer = null;
    }
  }

  startCancelCountdown(seconds: number, expiresAt?: Date): void {
    this.stopCancelTimer();
    this.isCancelPending.set(true);
    this.cancelCountdown.set(seconds);

    // Ensure CANCEL_REQUESTED message exists in list
    const hasCancelMsg = this.messages().some(
      (m) => m.systemEvent === 'CANCEL_REQUESTED'
    );
    if (!hasCancelMsg) {
      const cancelMsg: ChatMessage = {
        id: this.nextMessageId++,
        sender: 'system',
        senderType: 'SYSTEM',
        systemEvent: 'CANCEL_REQUESTED',
        text: '✨ Bạn đã yêu cầu hủy kết nối với nhân viên hỗ trợ, Chéri sẽ chuyển bạn về AI Assistant sau 5 giây. ✨',
        timestamp: new Date(),
        cancelExpiresAt: expiresAt,
      };
      this.messages.update((list) => [...list, cancelMsg]);
    }

    this.cancelTimer = setInterval(() => {
      const cur = this.cancelCountdown();
      if (cur > 1) {
        this.cancelCountdown.set(cur - 1);
      } else {
        this.stopCancelTimer();
        this.cancelCountdown.set(0);
        this.finalizeCancellation();
      }
    }, 1000);
  }

  cancelSupport(): void {
    if (this.isCancelling() || this.isCancelPending()) return;
    const convId = this.supportConversationId();
    if (!convId) return;

    this.isCancelling.set(true);
    this.chatbotService.requestCancelSupport(convId, this.sessionId(), this.getGuestId()).subscribe({
      next: (res: any) => {
        this.isCancelling.set(false);
        if (res && res.success) {
          const remaining = res.remainingSeconds ?? 5;
          const expiresAt = res.expiresAt ? new Date(res.expiresAt) : new Date(Date.now() + remaining * 1000);
          this.startCancelCountdown(remaining, expiresAt);
        }
      },
      error: (err) => {
        this.isCancelling.set(false);
        console.error('[ChatbotStateService] Lỗi gửi yêu cầu hủy hỗ trợ:', err);
      },
    });
  }

  undoCancelSupport(): void {
    if (this.isUndoing()) return;
    const convId = this.supportConversationId();
    if (!convId) return;

    this.isUndoing.set(true);
    this.chatbotService.undoCancelSupport(convId, this.sessionId(), this.getGuestId()).subscribe({
      next: (res: any) => {
        this.isUndoing.set(false);
        if (res && res.success) {
          this.stopCancelTimer();
          this.isCancelPending.set(false);

          const undoMsg: ChatMessage = {
            id: this.nextMessageId++,
            sender: 'system',
            senderType: 'SYSTEM',
            systemEvent: 'CANCEL_UNDONE',
            text: '✨ Đã hoàn tác yêu cầu hủy, Chéri sẽ tiếp tục kết nối bạn với nhân viên hỗ trợ nhé! ✨',
            timestamp: new Date(),
          };
          this.messages.update((list) => [...list, undoMsg]);
        }
      },
      error: (err) => {
        this.isUndoing.set(false);
        console.error('[ChatbotStateService] Lỗi hoàn tác yêu cầu hủy:', err);
      },
    });
  }

  finalizeCancellation(): void {
    this.stopCancelTimer();
    this.isCancelPending.set(false);
    const convId = this.supportConversationId();

    if (convId) {
      this.chatbotService.finalizeCancelSupport(convId, this.sessionId(), this.getGuestId()).subscribe({
        next: () => {
          this.completeCancelSession();
        },
        error: () => {
          this.completeCancelSession();
        },
      });
    } else {
      this.completeCancelSession();
    }
  }

  private completeCancelSession(): void {
    // Add completion system message if not already present
    const hasCompleteMsg = this.messages().some(
      (m) => m.systemEvent === 'CANCEL_COMPLETED'
    );
    if (!hasCompleteMsg) {
      const completeMsg: ChatMessage = {
        id: this.nextMessageId++,
        sender: 'system',
        senderType: 'SYSTEM',
        systemEvent: 'CANCEL_COMPLETED',
        text: '✨ Đã hủy kết nối với nhân viên hỗ trợ, Chéri AI Assistant đã sẵn sàng hỗ trợ bạn! ✨',
        timestamp: new Date(),
      };
      this.messages.update((list) => [...list, completeMsg]);
    }
    this.handleSupportClosed();
  }

  startSupportPolling(): void {
    this.stopSupportPolling();

    const poll = () => {
      const convId = this.supportConversationId();
      if (!convId || this.chatMode() !== 'HUMAN_SUPPORT' || !this.isOpen()) return;

      this.chatbotService.getSupportMessages(convId, this.sessionId(), this.getGuestId()).subscribe({
        next: (res: any) => {
          if (res && res.success && Array.isArray(res.messages)) {
            let hasNewAdminMsg = false;

            for (const m of res.messages) {
              const msgId = m._id ? m._id.toString() : '';
              if (!msgId || this.knownSupportMessageIds.has(msgId)) continue;
              this.knownSupportMessageIds.add(msgId);

              if (m.senderType === 'ADMIN') {
                hasNewAdminMsg = true;
                this.messages.update((list) => [
                  ...list,
                  {
                    id: this.nextMessageId++,
                    sender: 'store',
                    senderType: 'ADMIN',
                    text: m.content,
                    timestamp: new Date(m.createdAt || Date.now()),
                  },
                ]);
              } else if (m.senderType === 'SYSTEM') {
                const sysEvt = m.systemEvent || this.detectSystemEvent(m.content);
                this.messages.update((list) => [
                  ...list,
                  {
                    id: this.nextMessageId++,
                    sender: 'system',
                    senderType: 'SYSTEM',
                    systemEvent: sysEvt,
                    text: m.content,
                    timestamp: new Date(m.createdAt || Date.now()),
                  },
                ]);
              } else if (m.senderType === 'CUSTOMER') {
                // Đảm bảo không trùng tin nhắn đã gửi trước đó
                const alreadyExists = this.messages().some(
                  (existing) => existing.sender === 'user' && existing.text === m.content
                );
                if (!alreadyExists) {
                  this.messages.update((list) => [
                    ...list,
                    {
                      id: this.nextMessageId++,
                      sender: 'user',
                      senderType: 'CUSTOMER',
                      text: m.content,
                      timestamp: new Date(m.createdAt || Date.now()),
                    },
                  ]);
                }
              }
            }

            if (hasNewAdminMsg) {
              this.chatbotService.markSupportRead(convId, this.sessionId(), this.getGuestId()).subscribe();
            }

            // Đồng bộ trạng thái cancelRequest từ Server nếu có
            if (res.conversation) {
              this.supportStatus.set(res.conversation.status);

              const cancelReq = res.conversation.cancelRequest;
              if (cancelReq && cancelReq.status === 'PENDING' && res.conversation.status !== 'CLOSED') {
                if (!this.isCancelPending()) {
                  const remainingMs = new Date(cancelReq.expiresAt).getTime() - Date.now();
                  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
                  if (remainingSec > 0) {
                    this.startCancelCountdown(remainingSec, new Date(cancelReq.expiresAt));
                  } else {
                    this.finalizeCancellation();
                  }
                }
              } else if (cancelReq && cancelReq.status === 'UNDONE' && this.isCancelPending()) {
                this.stopCancelTimer();
                this.isCancelPending.set(false);
              }

              // Đồng bộ xong tin nhắn mới kiểm tra trạng thái CLOSED để chuyển về AI
              if (res.conversation.status === 'CLOSED') {
                this.handleSupportClosed();
              }
            }
          }
        },
      });
    };

    // Gọi ngay lần đầu lập tức để không có độ trễ
    poll();
    // Sau đó lặp lại mỗi 3 giây
    this.supportPollTimer = setInterval(poll, 3000);
  }

  stopSupportPolling(): void {
    if (this.supportPollTimer) {
      clearInterval(this.supportPollTimer);
      this.supportPollTimer = null;
    }
  }

  handleSupportClosed(): void {
    this.stopCancelTimer();
    this.isCancelPending.set(false);
    this.stopSupportPolling();
    this.chatMode.set('AI');
    this.supportConversationId.set(null);
    this.supportStatus.set('CLOSED');
  }

  sendMessage(rawText: string, action?: string): void {
    const text = (rawText || '').trim();
    if (!text || this.isLoading()) return;

    // Phân tách luồng: Nếu đang trong chế độ HUMAN_SUPPORT
    if (this.chatMode() === 'HUMAN_SUPPORT') {
      const convId = this.supportConversationId();
      if (!convId) {
        this.chatMode.set('AI');
      } else {
        const userMessageId = this.nextMessageId++;
        const userMessage: ChatMessage = {
          id: userMessageId,
          sender: 'user',
          text,
          timestamp: new Date(),
        };
        this.messages.update((list) => [...list, userMessage]);
        this.isLoading.set(true);

        this.chatbotService.sendSupportMessage(convId, text, this.sessionId(), this.getGuestId()).subscribe({
          next: () => {
            this.isLoading.set(false);
          },
          error: () => {
            this.isLoading.set(false);
            const errorMessage: ChatMessage = {
              id: this.nextMessageId++,
              sender: 'store',
              text: 'Dạ tin nhắn gửi đi chưa thành công. Nàng vui lòng bấm thử lại giúp Chéri nhé!',
              isError: true,
              failedText: text,
              timestamp: new Date(),
            };
            this.messages.update((list) => [...list, errorMessage]);
          },
        });
        return;
      }
    }

    // Chế độ AI mặc định (không can thiệp, giữ nguyên logic hiện tại)
    const userMessageId = this.nextMessageId++;
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    this.messages.update((list) => [...list, userMessage]);
    this.isLoading.set(true);

    const history = this.messages()
      .filter((m): m is ChatMessage & { sender: 'user' | 'store' } => m.sender === 'user' || m.sender === 'store')
      .slice(-6)
      .map((m) => ({ sender: m.sender, text: m.text }));

    this.chatbotService.sendMessage(text, history, this.sessionId(), action).subscribe({
      next: (res: any) => {
        const payload = res?.data || res;
        const rawOrders = payload?.orders || res?.orders;
        const orders = Array.isArray(rawOrders) ? rawOrders : (rawOrders ? [rawOrders] : undefined);
        const rawProducts = payload?.products || res?.products;
        const products = Array.isArray(rawProducts) ? rawProducts : (rawProducts ? [rawProducts] : undefined);

        const storeMessage: ChatMessage = {
          id: this.nextMessageId++,
          sender: 'store',
          text: payload?.reply || res?.reply || '',
          products,
          orders,
          requiresAuth: payload?.requiresAuth ?? res?.requiresAuth,
          timestamp: new Date(),
        };
        this.messages.update((list) => [...list, storeMessage]);
        this.isLoading.set(false);
      },
      error: () => {
        const errorMessage: ChatMessage = {
          id: this.nextMessageId++,
          sender: 'store',
          text: 'Dạ Chéri đang gặp chút sự cố kết nối. Nàng vui lòng bấm nút thử lại giúp Chéri nhé!',
          isError: true,
          failedText: text,
          timestamp: new Date(),
        };
        this.messages.update((list) => [...list, errorMessage]);
        this.isLoading.set(false);
      },
    });
  }

  retryMessage(failedMsg: ChatMessage): void {
    if (!failedMsg.failedText) return;
    this.messages.update((list) => list.filter((m) => m.id !== failedMsg.id));
    this.sendMessage(failedMsg.failedText);
  }
}
