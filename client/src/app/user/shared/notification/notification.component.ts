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

  onClose(): void {
    this.notifyService.dismiss();
  }

  ngOnDestroy(): void {
    this.notifyService.dismiss();
  }
}

export { NotificationComponent as Notification };

