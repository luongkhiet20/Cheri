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
  ): Observable<ChatbotResponse> {
    if (this.apiService) {
      return this.apiService.sendChatMessage({ message, history, sessionId }).pipe(
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

  // TODO: Add support for Server-Sent Events (SSE) streaming for real-time word-by-word typing
}
