import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ChatMessage, ChatProductCard } from '../../models/chatbot.model';
import { ChatbotProductCardComponent } from '../chatbot-product-card/chatbot-product-card.component';

@Component({
  selector: 'app-chatbot-message',
  standalone: true,
  imports: [CommonModule, RouterModule, ChatbotProductCardComponent],
  templateUrl: './chatbot-message.component.html',
  styleUrls: ['./chatbot-message.component.css'],
})
export class ChatbotMessageComponent {
  @Input({ required: true }) message!: ChatMessage;
  @Output() retry = new EventEmitter<ChatMessage>();
  @Output() authAction = new EventEmitter<void>();
  @Output() productClick = new EventEmitter<ChatProductCard>();

  onRetry(): void {
    this.retry.emit(this.message);
  }

  onAuth(): void {
    this.authAction.emit();
  }

  onProductClick(p: ChatProductCard): void {
    this.productClick.emit(p);
  }
}
