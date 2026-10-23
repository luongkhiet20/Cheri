import { Injectable, signal, computed, inject } from '@angular/core';
import { ChatbotService } from './chatbot.service';
import { ChatMessage, ChatProductCard, ChatQuickReply } from '../models/chatbot.model';

@Injectable({
  providedIn: 'root',
})
export class ChatbotStateService {
  private chatbotService = inject(ChatbotService);

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly sessionId = signal<string>(`client_${Date.now()}`);

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

  toggle(): void {
    this.isOpen.update((v) => !v);
  }

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  clearMessages(): void {
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
      const userMessageId = this.nextMessageId++;
      const userMessage: ChatMessage = {
        id: userMessageId,
        sender: 'user',
        text: reply.label,
        timestamp: new Date(),
      };
      const storeMessageId = this.nextMessageId++;
      const storeMessage: ChatMessage = {
        id: storeMessageId,
        sender: 'store',
        text: 'Dạ Chéri đã nhận được yêu cầu kết nối! Chuyên viên chăm sóc khách hàng sẽ sẵn sàng hỗ trợ nàng qua Hotline 1900 6868 hoặc Fanpage Chéri trong ít phút nữa nhé. Nàng có cần Chéri hỗ trợ thêm thông tin gì trước không ạ?',
        timestamp: new Date(),
      };
      this.messages.update((list) => [...list, userMessage, storeMessage]);
      return;
    }

    if (reply.id === '2' || reply.icon === 'package' || reply.query.includes('đơn hàng')) {
      this.sendMessage(reply.query, 'CHECK_MY_ORDERS');
      return;
    }

    this.sendMessage(reply.query);
  }

  sendMessage(rawText: string, action?: string): void {
    const text = (rawText || '').trim();
    if (!text || this.isLoading()) return;

    const userMessageId = this.nextMessageId++;
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text,
      timestamp: new Date(),
    };

    // Append user message
    this.messages.update((list) => [...list, userMessage]);
    this.isLoading.set(true);

    const history = this.messages()
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
