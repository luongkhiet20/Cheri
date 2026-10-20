import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ChatRequest, ChatResponse } from '../user/shared/chat-widget/chat.models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private readonly http: HttpClient, private readonly storefront: ApiService) {}

  send(request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.storefront.apiUrl}/api/chat`, {
      message: request.message.trim(),
      history: request.history.slice(-10).map(({ role, text }) => ({ role, text })),
      lang: request.lang,
    });
  }
}
