import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService } from './notification.service';
import { AdminNotification } from './notification.model';

@Component({
  selector: 'app-admin-notification',
  standalone: false,
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificationComponent implements OnInit, OnDestroy {
  notifications: AdminNotification[] = [];
  private sub?: Subscription;

  constructor(
    public notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.notificationService.notifications$.subscribe((list) => {
      this.notifications = list;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onDismiss(id: string): void {
    this.notificationService.dismiss(id);
  }

  trackById(_index: number, item: AdminNotification): string {
    return item.id;
  }
}
