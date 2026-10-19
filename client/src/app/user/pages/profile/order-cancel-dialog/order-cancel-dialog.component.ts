import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';

export interface CancelOrderResult {
  orderId: string;
  reason: string;
  reasonDetail?: string;
  order?: any;
}

@Component({
  selector: 'app-order-cancel-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-cancel-dialog.component.html',
  styleUrl: './order-cancel-dialog.component.css'
})
export class OrderCancelDialogComponent {
  @Input() order: any = null;
  @Input() isOpen: boolean = true;
  @Output() close = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<CancelOrderResult>();

  readonly cancelReasons: string[] = [
    'Tôi muốn thay đổi sản phẩm hoặc phân loại.',
    'Tôi muốn thay đổi địa chỉ hoặc thông tin nhận hàng.',
    'Tôi muốn thay đổi phương thức thanh toán.',
    'Tôi đặt nhầm đơn hàng.',
    'Tôi không còn nhu cầu mua sản phẩm.',
    'Tôi muốn đặt lại đơn hàng với thông tin khác.',
    'Lý do khác.'
  ];

  selectedReason: string = '';
  otherReason: string = '';
  isSubmitting: boolean = false;
  errorMessage: string = '';
  validationError: string = '';

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  onSelectReason(reason: string): void {
    if (this.isSubmitting) return;
    this.selectedReason = reason;
    this.validationError = '';
    this.errorMessage = '';
  }

  isOtherSelected(): boolean {
    return this.selectedReason === 'Lý do khác.';
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.isSubmitting) return;
    const target = event.target as HTMLElement;
    if (target.classList.contains('dialog-backdrop')) {
      this.onClose();
    }
  }

  onClose(): void {
    if (this.isSubmitting) return;
    this.close.emit();
  }

  onConfirmCancel(): void {
    if (this.isSubmitting) return;

    this.validationError = '';
    this.errorMessage = '';

    if (!this.selectedReason) {
      this.validationError = 'Vui lòng chọn một lý do hủy đặt hàng.';
      return;
    }

    if (this.isOtherSelected()) {
      const trimmed = (this.otherReason || '').trim();
      if (!trimmed) {
        this.validationError = 'Vui lòng nhập lý do cụ thể trước khi xác nhận.';
        return;
      }
      if (trimmed.length < 3) {
        this.validationError = 'Lý do hủy đơn cần ít nhất 3 ký tự.';
        return;
      }
    }

    const cancelPayload = {
      reason: this.selectedReason,
      reasonDetail: this.isOtherSelected() ? this.otherReason.trim() : undefined
    };
    const targetOrderId = this.order?.orderId || this.order?._id;

    if (!targetOrderId) {
      this.errorMessage = 'Không xác định được mã đơn hàng. Vui lòng thử lại sau.';
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.apiService.cancelOrder(targetOrderId, cancelPayload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.error) {
          this.errorMessage = typeof res.error === 'string'
            ? res.error
            : (res.error?.message || 'Có lỗi xảy ra khi hủy đơn hàng. Vui lòng thử lại.');
          this.cdr.markForCheck();
          return;
        }

        // Hủy thành công: đóng popup, phát sự kiện cập nhật
        this.cancelled.emit({
          orderId: targetOrderId,
          reason: cancelPayload.reason,
          reasonDetail: cancelPayload.reasonDetail,
          order: res?.order || res?.data || res
        });
        this.close.emit();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }
}

export { OrderCancelDialogComponent as OrderCancelDialog };
