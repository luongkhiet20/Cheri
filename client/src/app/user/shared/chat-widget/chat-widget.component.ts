import { AfterViewChecked, Component, ElementRef, HostListener, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  id: number;
  sender: 'store' | 'user';
  text: string;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chat-widget.component.html',
  styleUrls: ['./chat-widget.component.css'],
})
export class ChatWidgetComponent implements AfterViewChecked {
  readonly isOpen = signal(false);
  readonly messages = signal<ChatMessage[]>([
    { id: 1, sender: 'store', text: 'Chào bạn! Bạn đang tìm một món đồ cho dịp nào? Hãy thử để lại lời nhắn nhé.' },
  ]);
  draft = '';
  private nextMessageId = 2;
  private shouldScroll = false;
  private composerElement?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('launcher') launcher?: ElementRef<HTMLButtonElement>;
  @ViewChild('messageList') messageList?: ElementRef<HTMLDivElement>;
  @ViewChild('composer') set composer(element: ElementRef<HTMLTextAreaElement> | undefined) {
    this.composerElement = element;
    if (this.isOpen()) element?.nativeElement.focus?.();
  }
  public elementRef?: ElementRef<HTMLElement>;

  constructor() {
    try {
      this.elementRef = inject(ElementRef);
    } catch {
      // Bỏ qua khi khởi tạo trực tiếp trong unit test không có injection context
    }
  }

  openChat(): void {
    this.isOpen.set(true);
    this.shouldScroll = true;
  }

  closeChat(restoreFocus = true): void {
    this.isOpen.set(false);
    if (restoreFocus) {
      this.launcher?.nativeElement.focus?.();
    }
  }

  sendMessage(): void {
    const text = this.draft.trim();
    if (!text || text.length > 1000) return;
    this.messages.update((messages) => [...messages, { id: this.nextMessageId++, sender: 'user', text }]);
    this.draft = '';
    this.shouldScroll = true;
    this.composerElement?.nativeElement.focus?.();
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

  @HostListener('document:pointerdown', ['$event'])
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent | PointerEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node | null;
    if (!target) return;
    const hostEl = this.elementRef?.nativeElement;
    if (hostEl) {
      const isInside = typeof event.composedPath === 'function'
        ? event.composedPath().includes(hostEl)
        : hostEl.contains(target);
      if (isInside) return;
    }
    this.closeChat(false);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messageList) {
      const list = this.messageList.nativeElement;
      list.scrollTop = list.scrollHeight;
      this.shouldScroll = false;
    }
  }
}
