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
  isEdit?: boolean;
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
  @Input() isEditMode: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() reviewed = new EventEmitter<ProductReviewResult>();

  selectedProductIndex: number = 0;
  rating: number = 5;
  hoverRating: number = 0;
  comment: string = '';
  currentReviewId: string | null = null;

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
  isCheckingEligibility: boolean = false;
  alreadyReviewed: boolean = false;
  isEligible: boolean = true;
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
    if (changes['order'] || changes['selectedProductId'] || changes['isEditMode']) {
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

  getProductId(item: any): string | null {
    if (!item) return null;
    const raw = item?.productId?._id || item?.productId?.id || item?.productId || item?.product?._id || item?.product?.id || item?.id || item?._id || item?.productSnapshot?.id || item?.productSnapshot?._id;
    return raw ? String(raw) : null;
  }

  getCleanOrderId(): string | undefined {
    const raw = this.order?.orderId || this.order?._id || this.order?.id;
    if (!raw) return undefined;
    return String(raw).replace(/^#/, '').trim();
  }

  isOrderDelivered(): boolean {
    if (!this.order) return false;
    const s = (this.order?.status || '').toUpperCase().trim();
    return ['DELIVERED', 'COMPLETED', 'ĐÃ GIAO', 'DA GIAO'].includes(s);
  }

  private initSelectedProduct(): void {
    this.alreadyReviewed = false;
    this.isEligible = true;
    this.validationError = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.currentReviewId = null;
    this.rating = 5;
    this.comment = '';

    if (this.selectedProductId && this.orderItems.length > 0) {
      const idx = this.orderItems.findIndex(item => {
        const pId = this.getProductId(item);
        return String(pId) === String(this.selectedProductId);
      });
      this.selectedProductIndex = idx >= 0 ? idx : 0;
    } else {
      this.selectedProductIndex = 0;
    }

    if (!this.isOrderDelivered()) {
      this.isEligible = false;
      this.errorMessage = 'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công.';
      this.cdr.markForCheck();
      return;
    }

    this.checkEligibilityForCurrentProduct();
  }

  selectProduct(index: number): void {
    if (this.isSubmitting) return;
    this.selectedProductIndex = index;
    this.validationError = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.alreadyReviewed = false;
    this.isEligible = true;
    this.currentReviewId = null;
    this.rating = 5;
    this.comment = '';

    if (!this.isOrderDelivered()) {
      this.isEligible = false;
      this.errorMessage = 'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công.';
      this.cdr.markForCheck();
      return;
    }

    this.checkEligibilityForCurrentProduct();
  }

  private checkEligibilityForCurrentProduct(): void {
    const pId = this.getProductId(this.activeItem);
    const ordId = this.getCleanOrderId();
    if (!pId) return;

    this.isCheckingEligibility = true;
    this.cdr.markForCheck();

    this.apiService.checkReviewEligibility(pId, ordId).subscribe({
      next: (res: any) => {
        this.isCheckingEligibility = false;
        if (this.isEditMode) {
          // CHẾ ĐỘ SỬA ĐÁNH GIÁ: Lấy và điền sẵn dữ liệu cũ từ MongoDB
          if (res?.existingReview) {
            const rev = res.existingReview;
            this.currentReviewId = rev._id ? String(rev._id) : (rev.id ? String(rev.id) : null);
            this.rating = Math.max(1, Math.min(5, Number(rev.rating) || 5));
            this.comment = rev.comment || '';
            this.alreadyReviewed = false; // Trong chế độ sửa, cho phép người dùng thay đổi và nhấn Lưu thay đổi
            this.isEligible = true;
            this.errorMessage = '';
          } else {
            this.currentReviewId = null;
            this.alreadyReviewed = false;
            this.isEligible = false;
            this.errorMessage = 'Không tìm thấy đánh giá trước đó của sản phẩm này trong cơ sở dữ liệu để chỉnh sửa.';
          }
        } else {
          // CHẾ ĐỘ ĐÁNH GIÁ MỚI
          if (res?.hasReviewed) {
            this.alreadyReviewed = true;
            this.errorMessage = res.reason || 'Bạn đã gửi đánh giá cho sản phẩm này trong đơn hàng rồi.';
          } else if (res?.canReview === false) {
            this.isEligible = false;
            this.errorMessage = res.reason || 'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công.';
          } else {
            this.alreadyReviewed = false;
            this.isEligible = true;
            if (this.errorMessage.includes('đánh giá') || this.errorMessage.includes('nhận hàng')) {
              this.errorMessage = '';
            }
          }
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isCheckingEligibility = false;
        this.errorMessage = err?.error?.message || err?.message || 'Không thể kiểm tra thông tin đánh giá. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  onRate(star: number): void {
    if (this.isSubmitting || (!this.isEditMode && this.alreadyReviewed)) return;
    this.rating = star;
    this.validationError = '';
  }

  onStarHover(star: number): void {
    if (!this.isSubmitting && (this.isEditMode || !this.alreadyReviewed)) {
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
    if (this.isSubmitting || this.alreadyReviewed) return;
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
    if (this.isSubmitting || this.alreadyReviewed) return;
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
    if (this.isSubmitting || (!this.isEditMode && this.alreadyReviewed)) return;

    this.validationError = '';
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.isOrderDelivered()) {
      this.errorMessage = 'Bạn chỉ có thể đánh giá sản phẩm sau khi đã mua và nhận hàng thành công.';
      return;
    }

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
    const rawProductId = this.getProductId(targetItem);

    if (!rawProductId) {
      this.errorMessage = 'Không xác định được mã sản phẩm cần đánh giá. Vui lòng thử lại sau.';
      return;
    }

    const cleanOrderId = this.getCleanOrderId();

    this.isSubmitting = true;
    this.cdr.markForCheck();

    if (this.isEditMode) {
      // ── SỬA ĐÁNH GIÁ (UPDATE REVIEW) ──
      if (!this.currentReviewId) {
        this.isSubmitting = false;
        this.errorMessage = 'Không xác định được mã đánh giá cần chỉnh sửa.';
        this.cdr.markForCheck();
        return;
      }

      this.apiService.updateProductReview(this.currentReviewId, {
        rating: Number(this.rating),
        comment: trimmedComment
      }).subscribe({
        next: (res: any) => {
          this.isSubmitting = false;

          if (res?.error) {
            this.errorMessage = typeof res.error === 'string'
              ? res.error
              : (res.error?.message || 'Có lỗi xảy ra khi cập nhật đánh giá. Vui lòng thử lại.');
            this.cdr.markForCheck();
            return;
          }

          this.successMessage = '✨Cập nhật đánh giá thành công!✨';
          this.reviewed.emit({
            productId: rawProductId,
            orderId: cleanOrderId || '',
            rating: Number(this.rating),
            comment: trimmedComment,
            review: res?.data || res,
            isEdit: true
          });

          this.cdr.markForCheck();
          setTimeout(() => {
            this.close.emit();
          }, 1000);
        },
        error: (err: any) => {
          this.isSubmitting = false;
          this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại.';
          this.cdr.markForCheck();
        }
      });
    } else {
      // ── TẠO ĐÁNH GIÁ MỚI (CREATE REVIEW) ──
      const payload = {
        productId: rawProductId,
        rating: Number(this.rating),
        comment: trimmedComment,
        orderId: cleanOrderId
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
          this.alreadyReviewed = true;
          this.reviewed.emit({
            productId: payload.productId,
            orderId: payload.orderId || '',
            rating: payload.rating,
            comment: payload.comment,
            review: res?.data || res,
            isEdit: false
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
}
