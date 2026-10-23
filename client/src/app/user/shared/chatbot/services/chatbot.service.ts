import { Injectable, Optional, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { ChatbotResponse } from '../models/chatbot.model';

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private apiService = inject(ApiService, { optional: true });
  private http = inject(HttpClient, { optional: true });

  /**
   * Send a chat message to Backend NestJS API
   */
  sendMessage(
    message: string,
    history: Array<{ sender: 'user' | 'store'; text: string }> = [],
    sessionId?: string,
    action?: string,
  ): Observable<ChatbotResponse> {
    if (this.apiService) {
      return this.apiService.sendChatMessage({ message, history, sessionId, action }).pipe(
        catchError((err) => {
          console.error('[ChatbotService] API error:', err);
          return of({
            reply: 'Dạ Chéri đang gặp chút sự cố kết nối. Nàng vui lòng thử lại sau giây lát nhé!',
            intent: 'general' as const,
          });
        }),
      );
    }

    if (this.http) {
      return this.http
        .post<ChatbotResponse>('/api/chat/message', {
          message,
          history,
          sessionId,
          action,
        })
        .pipe(
          catchError((err) => {
            console.error('[ChatbotService] HTTP error:', err);
            return of({
              reply: 'Dạ Chéri đang gặp chút sự cố kết nối. Nàng vui lòng thử lại sau giây lát nhé!',
              intent: 'general' as const,
            });
          }),
        );
    }

    // Fallback for SSR or offline unit tests
    return of({
      reply: 'Chào bạn! Chéri luôn sẵn sàng hỗ trợ bạn.',
      intent: 'general' as const,
    });
  }

  private getBaseUrl(): string {
    return this.apiService?.apiUrl || '';
  }

  /**
   * Request human staff connection - triggered ONLY on explicit button click
   */
  requestSupport(sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/request`;
    if (this.http) {
      return this.http.post(url, { sessionId, guestId });
    }
    return of({ success: false });
  }

  /**
   * Check if user/guest has an active open support session
   */
  getCurrentSupport(sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/current?sessionId=${encodeURIComponent(sessionId)}&guestId=${encodeURIComponent(guestId || '')}`;
    if (this.http) {
      return this.http.get(url);
    }
    return of({ success: false, hasActiveSupport: false });
  }

  /**
   * Get messages in support session
   */
  getSupportMessages(conversationId: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/messages?sessionId=${encodeURIComponent(sessionId)}&guestId=${encodeURIComponent(guestId || '')}`;
    if (this.http) {
      return this.http.get(url);
    }
    return of({ success: false, messages: [] });
  }

  /**
   * Send message to human staff
   */
  sendSupportMessage(conversationId: string, content: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/messages`;
    if (this.http) {
      return this.http.post(url, { content, sessionId, guestId });
    }
    return of({ success: false });
  }

  /**
   * Mark customer read
   */
  markSupportRead(conversationId: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/read`;
    if (this.http) {
      return this.http.patch(url, { sessionId, guestId });
    }
    return of({ success: false });
  }

  /**
   * Request support cancellation with 5-second undo grace period
   */
  requestCancelSupport(conversationId: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/cancel`;
    if (this.http) {
      return this.http.post(url, { sessionId, guestId });
    }
    return of({ success: false });
  }

  /**
   * Undo support cancellation within 5 seconds
   */
  undoCancelSupport(conversationId: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/cancel/undo`;
    if (this.http) {
      return this.http.post(url, { sessionId, guestId });
    }
    return of({ success: false });
  }

  /**
   * Finalize support cancellation when 5s countdown expires
   */
  finalizeCancelSupport(conversationId: string, sessionId: string, guestId?: string): Observable<any> {
    const url = `${this.getBaseUrl()}/api/chat/support/${conversationId}/cancel/finalize`;
    if (this.http) {
      return this.http.post(url, { sessionId, guestId });
    }
    return of({ success: false });
  }
}
