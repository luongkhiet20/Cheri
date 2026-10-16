import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';

export interface CancelReturnRequestResult {
  orderId: string;
  requestId: string;
  reason: string;
  order?: any;
}

@Component({
  selector: 'app-order-return-cancel-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-return-cancel-dialog.component.html',
  styleUrl: './order-return-cancel-dialog.component.css'
})
export class OrderReturnCancelDialogComponent {
  @Input() order: any = null;
  @Input() returnRequest: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<CancelReturnRequestResult>();

  readonly cancelReasons: string[] = [
    'Tôi muốn giữ lại sản phẩm và không hoàn trả nữa.',
    'Tôi đã trao đổi và thống nhất phương án khác cùng Chéri.',
    'Tôi muốn tạo lại yêu cầu mới với thông tin chính xác hơn.',
    'Lý do khác.'
  ];

  selectedReason: string = this.cancelReasons[0];
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
      this.validationError = 'Vui lòng chọn một lý do hủy yêu cầu.';
      return;
    }

    if (this.isOtherSelected()) {
      const trimmed = (this.otherReason || '').trim();
      if (!trimmed) {
        this.validationError = 'Vui lòng nhập lý do cụ thể trước khi xác nhận.';
        return;
      }
      if (trimmed.length < 3) {
        this.validationError = 'Lý do hủy yêu cầu cần ít nhất 3 ký tự.';
        return;
      }
    }

    const targetOrderId = this.order?.orderId || this.order?._id;
    const targetReqId = this.returnRequest?.requestId || this.returnRequest?._id || 'latest';

    if (!targetOrderId || !targetReqId) {
      this.errorMessage = 'Không xác định được thông tin yêu cầu cần hủy. Vui lòng tải lại trang.';
      return;
    }

    const finalReason = this.isOtherSelected()
      ? `Lý do khác: ${this.otherReason.trim()}`
      : this.selectedReason;

    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.apiService.cancelReturnRequest(String(targetOrderId), String(targetReqId), { reason: finalReason }).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.error) {
          this.errorMessage = typeof res.error === 'string'
            ? res.error
            : (res.error?.message || 'Có lỗi xảy ra khi hủy yêu cầu. Vui lòng thử lại.');
          this.cdr.markForCheck();
          return;
        }

        const cancelReason = res?.data?.rejectionReason || 'Bạn đã yêu cầu hủy quy trình trả hàng hoàn tiền.';
        this.cancelled.emit({
          orderId: String(targetOrderId),
          requestId: String(targetReqId),
          reason: cancelReason,
          order: res?.order || res?.data || res
        });
        this.close.emit();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }
}
