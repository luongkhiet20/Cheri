import { Component, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, UserNotification } from './notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationComponent implements OnDestroy {
  constructor(public notifyService: NotificationService) {}

  get current(): UserNotification | null {
    return this.notifyService.notification();
  }

  getCleanMessage(message: string | null | undefined): string {
    if (!message) return '';
    return message.replace(/^[✨\s]+/, '').replace(/[✨\s]+$/, '').trim();
  }

  onClose(): void {
    this.notifyService.startDismiss();
  }

  ngOnDestroy(): void {
    this.notifyService.dismiss();
  }
}

export { NotificationComponent as Notification };
