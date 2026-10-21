import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  NgZone,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatQuickReply } from '../../models/chatbot.model';

@Component({
  selector: 'app-chatbot-quick-replies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chatbot-quick-replies.component.html',
  styleUrls: ['./chatbot-quick-replies.component.css'],
})
export class ChatbotQuickRepliesComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) replies: ChatQuickReply[] = [];
  @Input() disabled = false;
  @Output() selectReply = new EventEmitter<ChatQuickReply>();

  @ViewChild('scrollTrack') scrollTrack?: ElementRef<HTMLDivElement>;

  private ngZone = inject(NgZone);
  private isPaused = false;
  private animId: number | null = null;

  onSelect(reply: ChatQuickReply): void {
    if (this.disabled) return;
    this.selectReply.emit(reply);
  }

  onPause(): void {
    this.isPaused = true;
  }

  onResume(): void {
    this.isPaused = false;
  }

  ngAfterViewInit(): void {
    this.startAutoScroll();
  }

  private startAutoScroll(): void {
    this.ngZone.runOutsideAngular(() => {
      const step = () => {
        if (!this.isPaused && this.scrollTrack) {
          const el = this.scrollTrack.nativeElement;
          const firstList = el.querySelector('.quick-replies-list') as HTMLElement;
          if (firstList) {
            const listWidth = firstList.offsetWidth;
            el.scrollLeft += 0.55;
            if (el.scrollLeft >= listWidth) {
              el.scrollLeft -= listWidth;
            }
          }
        }
        this.animId = requestAnimationFrame(step);
      };
      this.animId = requestAnimationFrame(step);
    });
  }

  ngOnDestroy(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }
}

