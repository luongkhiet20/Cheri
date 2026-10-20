import { AfterViewChecked, Component, ElementRef, HostListener, Inject, OnDestroy, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../services/chat.service';
import { PriceFormatPipe } from '../../../pipes/price.pipe';
import { ChatMessage, ChatRequest, ChatResponse, ChatTurn } from './chat.models';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [FormsModule, RouterLink, PriceFormatPipe],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.css'],
})
export class ChatWidgetComponent implements AfterViewChecked, OnDestroy {
  readonly isOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([
    { id: 1, sender: 'store', text: '✨ Chào bạn! Chéri có thể gợi ý phối đồ hoặc giúp bạn tìm sản phẩm phù hợp. Bạn đang chuẩn bị cho dịp nào?' },
  ]);
  draft = '';
  private nextMessageId = 2;
  private shouldScroll = false;
  private composerElement?: ElementRef<HTMLTextAreaElement>;
  private chatHistory: ChatTurn[] = [];
  private pendingRequest?: ChatRequest;
  private activeRequest?: Subscription;
  readonly isSending = signal(false);
  readonly errorMessage = signal('');

  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

  @ViewChild('launcher') launcher?: ElementRef<HTMLButtonElement>;
  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') set composer(element: ElementRef<HTMLTextAreaElement> | undefined) {
    this.composerElement = element;
    if (this.isOpen()) element?.nativeElement.focus?.();
  }

  openChat(): void {
    this.isOpen.set(true);
    this.shouldScroll = true;
  }

  closeChat(): void {
    this.isOpen.set(false);
    this.launcher?.nativeElement.focus?.();
  }

  sendMessage(): void {
    const text = this.draft.trim();
    if (!text || text.length > 1000 || this.isSending() || this.pendingRequest) return;
    const request: ChatRequest = { message: text, history: this.chatHistory.slice(-10), lang: this.currentLanguage() };
    this.messages.update((messages) => [...messages, { id: this.nextMessageId++, sender: 'user', text }]);
    this.draft = '';
    this.shouldScroll = true;
    this.composerElement?.nativeElement.focus?.();
    this.requestReply(request);
  }

  retryMessage(): void {
    if (!this.pendingRequest || this.isSending()) return;
    this.requestReply(this.pendingRequest);
  }

  private requestReply(request: ChatRequest): void {
    if (this.isSending()) return;
    this.pendingRequest = request;
    this.errorMessage.set('');
    this.isSending.set(true);
    this.shouldScroll = true;
    this.activeRequest = this.chatService.send(request).subscribe({
      next: (response) => {
        const safeReply = this.validateResponse(response);
        if (!safeReply) {
          this.errorMessage.set('Chéri chưa thể xử lý phản hồi. Bạn thử lại nhé.');
          return;
        }
        this.messages.update((messages) => [...messages, {
          id: this.nextMessageId++, sender: 'store', text: safeReply.reply,
          products: safeReply.products,
        }]);
        const successfulHistory: ChatTurn[] = [...request.history,
          { role: 'user', text: request.message },
          { role: 'assistant', text: safeReply.reply },
        ];
        this.chatHistory = successfulHistory.slice(-10);
        this.pendingRequest = undefined;
        this.shouldScroll = true;
      },
      error: () => {
        this.errorMessage.set('Chéri chưa thể trả lời lúc này. Bạn thử lại nhé.');
        this.isSending.set(false);
        this.activeRequest = undefined;
      },
      complete: () => {
        this.isSending.set(false);
        this.activeRequest = undefined;
      },
    });
    if (this.activeRequest.closed) this.activeRequest = undefined;
  }

  private validateResponse(value: unknown): ChatResponse | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const response = value as ChatResponse;
    if (typeof response.reply !== 'string' || !response.reply.trim() || response.reply.length > 1000
      || !Array.isArray(response.products) || response.products.length > 3) return undefined;
    const products = response.products.filter((product) =>
      !!product && typeof product.id === 'string' && typeof product.title === 'string'
      && typeof product.path === 'string' && /^\/(vi|en)\/product\/[\p{L}\p{N}%_-]+$/u.test(product.path),
    ).map((product) => ({
      id: product.id,
      title: product.title.slice(0, 150),
      path: product.path,
      ...(typeof product.imageUrl === 'string' && /^https?:\/\//i.test(product.imageUrl)
        ? { imageUrl: product.imageUrl } : {}),
      ...(typeof product.price === 'number' && Number.isFinite(product.price) && product.price >= 0
        ? { price: product.price } : {}),
    }));
    return { reply: response.reply.trim(), products };
  }

  private currentLanguage(): 'vi' | 'en' {
    const path = typeof window === 'undefined' ? '' : window.location.pathname;
    return path.startsWith('/en/') ? 'en' : 'vi';
  }

  ngOnDestroy(): void {
    this.activeRequest?.unsubscribe();
  }

  onEnter(event: KeyboardEvent): void {
    if (event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.sendMessage();
  }

  @HostListener('keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeChat();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messageList) {
      const list = this.messageList.nativeElement;
      list.scrollTop = list.scrollHeight;
      this.shouldScroll = false;
    }
  }
}
