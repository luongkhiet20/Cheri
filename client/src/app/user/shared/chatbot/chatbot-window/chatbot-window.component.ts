import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotStateService } from '../services/chatbot-state.service';
import { ChatbotMessageComponent } from '../components/chatbot-message/chatbot-message.component';
import { ChatbotTypingComponent } from '../components/chatbot-typing/chatbot-typing.component';
import { ChatbotQuickRepliesComponent } from '../components/chatbot-quick-replies/chatbot-quick-replies.component';
import { ChatbotInputComponent } from '../components/chatbot-input/chatbot-input.component';
import { ChatMessage, ChatProductCard, ChatOrderCard, ChatQuickReply } from '../models/chatbot.model';

@Component({
  selector: 'app-chatbot-window',
  standalone: true,
  imports: [
    CommonModule,
    ChatbotMessageComponent,
    ChatbotTypingComponent,
    ChatbotQuickRepliesComponent,
    ChatbotInputComponent,
  ],
  templateUrl: './chatbot-window.component.html',
  styleUrls: ['./chatbot-window.component.css'],
})
export class ChatbotWindowComponent implements AfterViewChecked {
  readonly state = inject(ChatbotStateService);

  @ViewChild('messageScrollContainer') messageScrollContainer?: ElementRef<HTMLDivElement>;
  @ViewChild(ChatbotInputComponent) inputComponent?: ChatbotInputComponent;

  private shouldScroll = true;

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  scrollToBottom(): void {
    const el = this.messageScrollContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }

  onSendMessage(text: string): void {
    this.shouldScroll = true;
    this.state.sendMessage(text);
  }

  onSelectQuickReply(reply: ChatQuickReply): void {
    this.shouldScroll = true;
    this.state.selectQuickReply(reply);
  }

  onProductClick(product: ChatProductCard): void {
    // If on mobile (screen <= 480px), close chatbot window so user sees product detail page immediately
    if (typeof window !== 'undefined' && window.innerWidth <= 480) {
      this.state.close();
    }
  }

  onOrderClick(order: ChatOrderCard): void {
    // On mobile or smaller screens, close chatbot window so user sees the tracking view clearly
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      this.state.close();
    }
  }

  onRetry(message: ChatMessage): void {

    this.shouldScroll = true;
    this.state.retryMessage(message);
  }

  onClose(): void {
    this.state.close();
  }

  onClear(): void {
    this.state.clearMessages();
  }
}
