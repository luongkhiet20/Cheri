import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: false,
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent {
  @Input() isOpen: boolean = false;
  @Input() title: string = 'Xác nhận';
  @Input() message: string = 'Bạn có chắc chắn muốn thực hiện thao tác này không?';
  @Input() confirmLabel: string = 'Xác nhận';
  @Input() cancelLabel: string = 'Hủy';
  @Input() variant: 'danger' | 'warning' | 'default' = 'default';

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  get confirmBtnClass(): string {
    return this.variant === 'danger' ? 'btn btn-primary btn-danger-solid'
         : this.variant === 'warning' ? 'btn btn-primary btn-warning-solid'
         : 'btn btn-primary';
  }

  onConfirm(): void { this.confirmed.emit(); this.closed.emit(); }
  onCancel(): void  { this.cancelled.emit(); this.closed.emit(); }
  onOverlayClick(): void { this.cancelled.emit(); this.closed.emit(); }
}
