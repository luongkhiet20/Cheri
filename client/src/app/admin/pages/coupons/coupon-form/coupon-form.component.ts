import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

interface CouponFormData {
  code: string;
  description: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number | null;
  maxDiscount: number | null;
  minOrderValue: number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  isActive: boolean;
}

@Component({
  selector: 'app-coupon-form',
  standalone: false,
  templateUrl: './coupon-form.component.html',
  styleUrls: ['./coupon-form.component.css']
})
export class CouponFormComponent implements OnInit {
  isEditMode = false;
  couponId: string | null = null;
  isLoading = false;
  isSubmitting = false;

  formData: CouponFormData = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscount: 50000,
    minOrderValue: 100000,
    startDate: '',
    endDate: '',
    usageLimit: 100,
    isActive: true
  };

  usedCount = 0; // Displayed info only in edit mode, not editable

  errors: Record<string, string> = {};
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.couponId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.couponId;

    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);

    this.formData.startDate = this.formatDateForInput(today);
    this.formData.endDate = this.formatDateForInput(nextMonth);

    if (this.isEditMode && this.couponId) {
      this.loadCoupon(this.couponId);
    }
  }

  private formatDateForInput(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadCoupon(id: string): void {
    this.isLoading = true;
    this.apiService.getCouponById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && res.data) {
          const c = res.data;
          this.formData = {
            code: c.code || '',
            description: c.description || '',
            discountType: c.discountType === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
            discountValue: c.discountValue != null ? c.discountValue : 0,
            maxDiscount: c.maxDiscount != null ? c.maxDiscount : 0,
            minOrderValue: c.minOrderValue != null ? c.minOrderValue : 0,
            startDate: this.formatDateForInput(c.startDate),
            endDate: this.formatDateForInput(c.endDate),
            usageLimit: c.usageLimit != null ? c.usageLimit : 1,
            isActive: c.isActive !== false
          };
          this.usedCount = Number(c.usedCount) || 0;
        } else {
          this.errorMessage = res?.message || 'Không tìm thấy thông tin mã giảm giá.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải thông tin mã giảm giá:', err);
        this.errorMessage = err?.error?.message || 'Không thể kết nối đến máy chủ.';
        this.cdr.markForCheck();
      }
    });
  }

  onCodeInput(val: string): void {
    this.formData.code = (val || '').toUpperCase().trim();
    this.clearFieldError('code');
  }

  clearFieldError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
      this.cdr.markForCheck();
    }
  }

  validate(): boolean {
    this.errors = {};

    if (!this.formData.code || this.formData.code.trim() === '') {
      this.errors['code'] = 'Mã giảm giá là bắt buộc';
    }

    if (this.formData.discountType !== 'PERCENTAGE' && this.formData.discountType !== 'FIXED') {
      this.errors['discountType'] = 'Vui lòng chọn loại giảm giá hợp lệ';
    }

    if (this.formData.discountValue === null || this.formData.discountValue === undefined || this.formData.discountValue <= 0) {
      this.errors['discountValue'] = 'Giá trị giảm phải lớn hơn 0';
    } else if (this.formData.discountType === 'PERCENTAGE' && this.formData.discountValue > 100) {
      this.errors['discountValue'] = 'Phần trăm giảm giá không được vượt quá 100%';
    }

    if (this.formData.discountType === 'PERCENTAGE' && this.formData.maxDiscount !== null && this.formData.maxDiscount < 0) {
      this.errors['maxDiscount'] = 'Giảm tối đa không được âm';
    }

    if (this.formData.minOrderValue !== null && this.formData.minOrderValue < 0) {
      this.errors['minOrderValue'] = 'Giá trị đơn tối thiểu không được âm';
    }

    if (!this.formData.startDate) {
      this.errors['startDate'] = 'Ngày bắt đầu là bắt buộc';
    }

    if (!this.formData.endDate) {
      this.errors['endDate'] = 'Ngày hết hạn là bắt buộc';
    } else if (this.formData.startDate && new Date(this.formData.startDate) >= new Date(this.formData.endDate)) {
      this.errors['endDate'] = 'Ngày hết hạn phải sau ngày bắt đầu';
    }

    if (this.formData.usageLimit === null || this.formData.usageLimit === undefined || this.formData.usageLimit <= 0) {
      this.errors['usageLimit'] = 'Số lượt sử dụng tối đa phải lớn hơn 0';
    } else if (this.isEditMode && this.formData.usageLimit < this.usedCount) {
      this.errors['usageLimit'] = `Số lượt sử dụng tối đa không được nhỏ hơn số lượt đã dùng (${this.usedCount})`;
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    if (!this.validate()) {
      this.errorMessage = 'Vui lòng kiểm tra và sửa các lỗi trong biểu mẫu';
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload: any = {
      code: this.formData.code.trim().toUpperCase(),
      description: (this.formData.description || '').trim(),
      discountType: this.formData.discountType,
      discountValue: Number(this.formData.discountValue),
      maxDiscount: this.formData.discountType === 'PERCENTAGE' ? (Number(this.formData.maxDiscount) || 0) : 0,
      minOrderValue: Number(this.formData.minOrderValue) || 0,
      startDate: new Date(this.formData.startDate).toISOString(),
      endDate: new Date(this.formData.endDate).toISOString(),
      usageLimit: Number(this.formData.usageLimit),
      isActive: this.formData.isActive
    };

    if (this.isEditMode && this.couponId) {
      this.apiService.updateCoupon(this.couponId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res && res.success) {
            this.notificationService.success('Cập nhật mã giảm giá thành công');
            this.router.navigate(['/admin/pages/coupons', this.couponId]);
          } else {
            this.errorMessage = res?.message || 'Không thể cập nhật mã giảm giá';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Lỗi khi cập nhật mã giảm giá:', err);
          this.errorMessage = err?.error?.message || 'Có lỗi xảy ra khi cập nhật mã giảm giá';
          this.cdr.markForCheck();
        }
      });
    } else {
      this.apiService.createCoupon(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res && res.success) {
            this.notificationService.success('Thêm mã giảm giá mới thành công');
            this.router.navigate(['/admin/pages/coupons']);
          } else {
            this.errorMessage = res?.message || 'Không thể tạo mã giảm giá';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error('Lỗi khi tạo mã giảm giá:', err);
          this.errorMessage = err?.error?.message || 'Có lỗi xảy ra khi tạo mã giảm giá';
          this.cdr.markForCheck();
        }
      });
    }
  }

  onCancel(): void {
    if (this.isEditMode && this.couponId) {
      this.router.navigate(['/admin/pages/coupons', this.couponId]);
    } else {
      this.router.navigate(['/admin/pages/coupons']);
    }
  }
}
