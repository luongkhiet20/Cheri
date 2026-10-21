import { Component, Input, Output, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chatbot-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-input.component.html',
  styleUrls: ['./chatbot-input.component.css'],
})
export class ChatbotInputComponent {
  @Input() disabled = false;
  @Input() placeholder = 'Nhắn tin cho Chéri... (Nhấn Enter để gửi)';
  @Output() sendMessage = new EventEmitter<string>();

  @ViewChild('composer') composerRef?: ElementRef<HTMLTextAreaElement>;

  draft = '';

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  submit(): void {
    const trimmed = this.draft.trim();
    if (!trimmed || this.disabled) return;
    this.sendMessage.emit(trimmed);
    this.draft = '';
    // Reset textarea height if needed
    if (this.composerRef?.nativeElement) {
      this.composerRef.nativeElement.style.height = 'auto';
    }
  }

  focus(): void {
    this.composerRef?.nativeElement?.focus();
  }
}
