import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';

export interface ProductReviewResult {
  productId: string;
  orderId: string;
  rating: number;
  comment: string;
  review?: any;
}

@Component({
  selector: 'app-product-review-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-review-dialog.component.html',
  styleUrl: './product-review-dialog.component.css'
})
export class ProductReviewDialogComponent implements OnInit, OnChanges {
  @Input() order: any = null;
  @Input() selectedProductId?: string;
  @Input() isOpen: boolean = true;
  @Output() close = new EventEmitter<void>();
  @Output() reviewed = new EventEmitter<ProductReviewResult>();

  selectedProductIndex: number = 0;
  rating: number = 5;
  hoverRating: number = 0;
  comment: string = '';

  readonly maxCommentLength: number = 1000;
  readonly stars: number[] = [1, 2, 3, 4, 5];
  readonly ratingLabels: Record<number, string> = {
    1: 'Rất không hài lòng',
    2: 'Không hài lòng',
    3: 'Bình thường',
    4: 'Hài lòng',
    5: 'Rất hài lòng'
  };

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
    this.initSelectedProduct();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] || changes['selectedProductId']) {
      this.initSelectedProduct();
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

  get activeItem(): any {
    if (!this.orderItems.length) return null;
    return this.orderItems[this.selectedProductIndex] || this.orderItems[0];
  }

  private initSelectedProduct(): void {
    if (this.selectedProductId && this.orderItems.length > 0) {
      const idx = this.orderItems.findIndex(item => {
        const pId = item?.productId?._id || item?.productId || item?.productSnapshot?.id || item?.productSnapshot?._id || item?.id;
        return String(pId) === String(this.selectedProductId);
      });
      this.selectedProductIndex = idx >= 0 ? idx : 0;
    } else {
      this.selectedProductIndex = 0;
    }
  }

  selectProduct(index: number): void {
    if (this.isSubmitting) return;
    this.selectedProductIndex = index;
    this.validationError = '';
    this.errorMessage = '';
    this.successMessage = '';
  }

  onRate(star: number): void {
    if (this.isSubmitting) return;
    this.rating = star;
    this.validationError = '';
  }

  onStarHover(star: number): void {
    if (!this.isSubmitting) {
      this.hoverRating = star;
    }
  }

  onStarLeave(): void {
    this.hoverRating = 0;
  }

  getCurrentRatingLabel(): string {
    const val = this.hoverRating || this.rating;
    return this.ratingLabels[val] || '';
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

  onFilesSelected(event: Event): void {
    if (this.isSubmitting) return;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxFiles = 5;
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB

    for (let i = 0; i < input.files.length; i++) {
      if (this.selectedImages.length >= maxFiles) {
        this.validationError = `Chỉ được tải lên tối đa ${maxFiles} hình ảnh.`;
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

    if (!this.rating || this.rating < 1 || this.rating > 5) {
      this.validationError = 'Vui lòng chọn số sao đánh giá sản phẩm (từ 1 đến 5 sao).';
      return;
    }

    const trimmedComment = (this.comment || '').trim();
    if (!trimmedComment) {
      this.validationError = 'Vui lòng nhập nội dung đánh giá cảm nhận của bạn.';
      return;
    }

    if (trimmedComment.length < 3) {
      this.validationError = 'Nội dung đánh giá cần có ít nhất 3 ký tự.';
      return;
    }

    if (trimmedComment.length > this.maxCommentLength) {
      this.validationError = `Nội dung đánh giá không được vượt quá ${this.maxCommentLength} ký tự.`;
      return;
    }

    const targetItem = this.activeItem;
    const rawProductId = targetItem?.productId?._id || targetItem?.productId || targetItem?.productSnapshot?.id || targetItem?.productSnapshot?._id || targetItem?.id;

    if (!rawProductId) {
      this.errorMessage = 'Không xác định được mã sản phẩm cần đánh giá. Vui lòng thử lại sau.';
      return;
    }

    const targetOrderId = this.order?.orderId || this.order?._id;

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const payload = {
      productId: String(rawProductId),
      rating: Number(this.rating),
      comment: trimmedComment,
      orderId: targetOrderId ? String(targetOrderId) : undefined
    };

    this.apiService.createProductReview(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;

        if (res?.error) {
          this.errorMessage = typeof res.error === 'string'
            ? res.error
            : (res.error?.message || 'Có lỗi xảy ra khi gửi đánh giá. Vui lòng thử lại.');
          this.cdr.markForCheck();
          return;
        }

        this.successMessage = 'Gửi đánh giá thành công! Cảm ơn bạn đã đóng góp ý kiến cho Chéri.';
        this.reviewed.emit({
          productId: payload.productId,
          orderId: payload.orderId || '',
          rating: payload.rating,
          comment: payload.comment,
          review: res?.data || res
        });

        this.cdr.markForCheck();
        setTimeout(() => {
          this.close.emit();
        }, 1200);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }
}
