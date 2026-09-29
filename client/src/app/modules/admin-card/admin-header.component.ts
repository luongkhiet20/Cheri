import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-admin-header',
    templateUrl: './admin-header.component.html',
    styleUrls: ['./admin-header.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [ReactiveFormsModule, FormsModule, NgIf]
})
export class AdminHeaderComponent {
  @Input() pageTitle = 'Dashboard';
  @Input() searchQuery = '';
  @Input() sidebarCollapsed = false;

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() notificationClick = new EventEmitter<void>();
  @Output() accountClick = new EventEmitter<void>();

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchQueryChange.emit(value);
  }

  onNotificationClick(): void {
    this.notificationClick.emit();
  }

  onAccountClick(): void {
    this.accountClick.emit();
  }
}
