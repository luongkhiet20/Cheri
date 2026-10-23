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
  @Input() iconType: 'accept' | 'return' | 'close' | 'danger' | 'warning' | 'info' | null = null;
  @Input() isLoading: boolean = false;
  @Input() errorMessage: string | null = null;
  @Input() autoCloseOnConfirm: boolean = true;

  @Output() confirmed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  get confirmBtnClass(): string {
    return this.variant === 'danger' ? 'btn btn-primary btn-danger-solid'
         : this.variant === 'warning' ? 'btn btn-primary btn-warning-solid'
         : 'btn btn-primary';
  }

  onConfirm(): void {
    if (this.isLoading) return;
    this.confirmed.emit();
    this.confirm.emit();
    if (this.autoCloseOnConfirm) {
      this.closed.emit();
      this.close.emit();
    }
  }

  onCancel(): void {
    if (this.isLoading) return;
    this.cancelled.emit();
    this.cancel.emit();
    this.closed.emit();
    this.close.emit();
  }

  onOverlayClick(): void {
    if (this.isLoading) return;
    this.cancelled.emit();
    this.cancel.emit();
    this.closed.emit();
    this.close.emit();
  }
}
