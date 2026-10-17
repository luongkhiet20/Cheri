import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { formatVND } from '../../../../pipes/price.pipe';

export interface ReturnRefundResult {
  orderId: string;
  returnRequest: any;
  order?: any;
}

interface ItemSelectionState {
  selected: boolean;
  returnQuantity: number;
}

@Component({
  selector: 'app-order-return-refund-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-return-refund-dialog.component.html',
  styleUrl: './order-return-refund-dialog.component.css'
})
export class OrderReturnRefundDialogComponent implements OnInit, OnChanges {
  @Input() order: any = null;
  @Input() isOpen: boolean = true;
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<ReturnRefundResult>();

  readonly returnReasons: string[] = [
    'Sản phẩm bị lỗi hoặc hư hỏng.',
    'Sản phẩm không đúng mô tả.',
    'Giao sai sản phẩm hoặc sai phân loại.',
    'Sản phẩm không đúng kích thước hoặc nhu cầu.',
    'Thiếu sản phẩm hoặc phụ kiện.',
    'Lý do khác.'
  ];

  selectedReason: string = '';
  otherReason: string = '';
  description: string = '';
  readonly maxDescLength: number = 500;

  refundMethod: string = 'ORIGINAL_PAYMENT';

  itemSelectionMap: Record<string, ItemSelectionState> = {};
  selectedImages: Array<{ file: File; preview: string; name: string }> = [];

  isSubmitting: boolean = false;
  validationError: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initItemSelection();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      this.initItemSelection();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.isSubmitting) {
      this.onClose();
    }
  }

  get orderItems(): any[] {
    return Array.isArray(this.order?.items) ? this.order.items : [];
  }

  private initItemSelection(): void {
    this.itemSelectionMap = {};
    if (this.orderItems.length > 0) {
      this.orderItems.forEach((item, index) => {
        const key = this.getItemKey(item, index);
        const maxQty = Number(item.quantity) || 1;
        // Mặc định chọn tất cả sản phẩm trong đơn
        this.itemSelectionMap[key] = {
          selected: true,
          returnQuantity: maxQty
        };
      });
    }
  }

  getItemKey(item: any, index: number): string {
    const pId = item?.productId?._id || item?.productId || item?.productSnapshot?.id || item?.productSnapshot?._id || item?.id;
    return pId ? String(pId) : `item_${index}`;
  }

  isItemSelected(item: any, index: number): boolean {
    const key = this.getItemKey(item, index);
    return Boolean(this.itemSelectionMap[key]?.selected);
  }

  toggleItemSelection(item: any, index: number): void {
    if (this.isSubmitting) return;
    const key = this.getItemKey(item, index);
    if (!this.itemSelectionMap[key]) {
      this.itemSelectionMap[key] = { selected: false, returnQuantity: 1 };
    }
    this.itemSelectionMap[key].selected = !this.itemSelectionMap[key].selected;
    this.validationError = '';
  }

  getItemReturnQty(item: any, index: number): number {
    const key = this.getItemKey(item, index);
    return this.itemSelectionMap[key]?.returnQuantity || 1;
  }

  changeItemReturnQty(item: any, index: number, delta: number): void {
    if (this.isSubmitting) return;
    const key = this.getItemKey(item, index);
    const max = Number(item.quantity) || 1;
    const current = this.getItemReturnQty(item, index);
    const next = Math.max(1, Math.min(max, current + delta));
    if (this.itemSelectionMap[key]) {
      this.itemSelectionMap[key].returnQuantity = next;
    }
  }

  onSelectReason(reason: string): void {
    if (this.isSubmitting) return;
    this.selectedReason = reason;
    this.validationError = '';
    this.errorMessage = '';
  }

  isOtherReason(): boolean {
    return this.selectedReason === 'Lý do khác.';
  }

  getItemImage(item: any): string {
    const img = item?.productSnapshot?.image || item?.image;
    if (img && typeof img === 'string') {
      if (img.startsWith('http') || img.startsWith('data:') || img.startsWith('/')) {
        return img;
      }
      return '/' + img;
    }
    return 'assets/images/placeholder.jpg';
  }

  getVariantText(item: any): string {
    const v = item?.productSnapshot?.variant;
    if (!v) return '';
    const parts: string[] = [];
    if (v.classification) parts.push(v.classification);
    if (v.color) parts.push(`Màu ${v.color}`);
    if (v.size) parts.push(`Size ${v.size}`);
    return parts.join(' · ');
  }

  formatAmount(val: number | undefined): string {
    if (!val && val !== 0) return '—';
    return formatVND(val);
  }

  formatDate(dateVal: any): string {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  onFilesSelected(event: Event): void {
    if (this.isSubmitting) return;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxFiles = 5;
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < input.files.length; i++) {
      if (this.selectedImages.length >= maxFiles) {
        this.validationError = `Chỉ được tải lên tối đa ${maxFiles} hình ảnh minh chứng.`;
        break;
      }
      const file = input.files[i];
      if (!allowedTypes.includes(file.type)) {
        this.validationError = 'Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG, PNG, WEBP).';
        continue;
      }
      if (file.size > maxSizeBytes) {
        this.validationError = `Ảnh "${file.name}" vượt quá dung lượng tối đa 5MB.`;
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImages.push({
          file,
          preview: e.target.result,
          name: file.name
        });
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }

    input.value = '';
  }

  removeImage(index: number): void {
    if (this.isSubmitting) return;
    this.selectedImages.splice(index, 1);
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

  onSubmit(): void {
    if (this.isSubmitting) return;

    this.validationError = '';
    this.errorMessage = '';
    this.successMessage = '';

    // 1. Kiểm tra sản phẩm được chọn
    const selectedItems: any[] = [];
    this.orderItems.forEach((item, index) => {
      const key = this.getItemKey(item, index);
      const state = this.itemSelectionMap[key];
      if (state && state.selected) {
        const pId = item?.productId?._id || item?.productId || item?.productSnapshot?.id || item?.productSnapshot?._id || item?.id;
        selectedItems.push({
          productId: String(pId),
          quantity: state.returnQuantity || 1
        });
      }
    });

    if (selectedItems.length === 0) {
      this.validationError = 'Vui lòng chọn ít nhất một sản phẩm cần trả hàng / hoàn tiền.';
      return;
    }

    // 2. Kiểm tra lý do
    if (!this.selectedReason) {
      this.validationError = 'Vui lòng chọn lý do yêu cầu trả hàng / hoàn tiền.';
      return;
    }

    if (this.isOtherReason()) {
      const trimmedOther = (this.otherReason || '').trim();
      if (!trimmedOther) {
        this.validationError = 'Vui lòng nhập lý do cụ thể trước khi gửi yêu cầu.';
        return;
      }
      if (trimmedOther.length < 3) {
        this.validationError = 'Lý do cụ thể cần ít nhất 3 ký tự.';
        return;
      }
    }

    // 3. Kiểm tra mô tả chi tiết
    const trimmedDesc = (this.description || '').trim();
    if (!trimmedDesc) {
      this.validationError = 'Vui lòng mô tả chi tiết tình trạng sản phẩm và lý do bạn muốn đổi/trả.';
      return;
    }

    if (trimmedDesc.length < 5) {
      this.validationError = 'Mô tả vấn đề cần ít nhất 5 ký tự để Chéri hỗ trợ bạn tốt nhất.';
      return;
    }

    const targetOrderId = this.order?.orderId || this.order?._id;
    if (!targetOrderId) {
      this.errorMessage = 'Không xác định được mã đơn hàng. Vui lòng thử lại sau.';
      return;
    }

    const finalReason = this.isOtherReason()
      ? `Lý do khác: ${this.otherReason.trim()}`
      : this.selectedReason;

    const basePayload = {
      reason: finalReason,
      description: trimmedDesc,
      items: selectedItems,
      refundMethod: this.refundMethod
    };

    this.isSubmitting = true;
    this.cdr.markForCheck();

    this.uploadImagesAndSubmit(String(targetOrderId), basePayload);
  }

  private async uploadImagesAndSubmit(targetOrderId: string, basePayload: any): Promise<void> {
    let finalImageUrls: string[] = [];

    // Nếu có ảnh được chọn, thử upload trực tiếp lên Cloudinary bằng chữ ký bảo mật
    if (this.selectedImages.length > 0) {
      try {
        const signRes: any = await firstValueFrom(this.apiService.getReturnUploadSignature());

        if (signRes && !signRes.error && signRes.signature) {
          const uploadPromises = this.selectedImages.map(img =>
            firstValueFrom(this.apiService.uploadToCloudinaryDirect(img.file, signRes))
          );

          const uploadResults: any[] = await Promise.all(uploadPromises);
          const failed = uploadResults.find(r => !r || r.error || !r.secure_url);

          if (failed) {
            throw new Error(failed?.error?.message || failed?.error || 'Không thể tải ảnh lên Cloudinary');
          }

          finalImageUrls = uploadResults.map(r => r.secure_url);
        } else {
          // Nếu không lấy được chữ ký, fallback sang mảng Base64 để backend upload
          finalImageUrls = this.selectedImages.map(img => img.preview);
        }
      } catch (uploadErr: any) {
        console.warn('[Direct Cloudinary Upload Warning] Fallback to backend processing:', uploadErr);
        // Fallback: Gửi mảng preview Data URI để backend xử lý tiếp
        finalImageUrls = this.selectedImages.map(img => img.preview);
      }
    }

    const payload = {
      ...basePayload,
      images: finalImageUrls
    };

    this.apiService.createReturnRequest(targetOrderId, payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;

        if (res?.error) {
          this.errorMessage = typeof res.error === 'string'
            ? res.error
            : (res.error?.message || 'Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
          this.cdr.markForCheck();
          return;
        }

        this.successMessage = res?.message || 'Yêu cầu trả hàng / hoàn tiền đã được tiếp nhận thành công!';
        this.submitted.emit({
          orderId: targetOrderId,
          returnRequest: res?.data || payload,
          order: res?.order || this.order
        });

        this.cdr.markForCheck();
        setTimeout(() => {
          this.close.emit();
        }, 1500);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }
}
