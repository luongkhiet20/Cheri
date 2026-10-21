import { Component, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatbotStateService } from '../services/chatbot-state.service';
import { ChatbotWindowComponent } from '../chatbot-window/chatbot-window.component';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, ChatbotWindowComponent],
  templateUrl: './chatbot-widget.component.html',
  styleUrls: ['./chatbot-widget.component.css'],
})
export class ChatbotWidgetComponent {
  readonly state = inject(ChatbotStateService);
  private elementRef = inject(ElementRef);

  toggle(): void {
    this.state.toggle();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state.isOpen()) {
      this.state.close();
    }
  }
}
