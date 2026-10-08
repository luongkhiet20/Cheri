import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-coupon-detail',
  standalone: false,
  templateUrl: './coupon-detail.component.html',
  styleUrls: ['./coupon-detail.component.css']
})
export class CouponDetailComponent implements OnInit {
  couponId: string | null = null;
  coupon: any = null;

  isLoading = true;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Confirm dialog
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' | 'danger' = 'warning';
  dialogAction: 'toggle' | 'delete' = 'toggle';
  isProcessing = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.couponId = this.route.snapshot.paramMap.get('id');
    if (!this.couponId || this.couponId.trim() === '') {
      this.isNotFound = true;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadCoupon(this.couponId);
  }

  loadCoupon(id: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getCouponById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && res.data) {
          this.coupon = res.data;
        } else {
          this.isNotFound = true;
          this.errorMessage = res?.message || 'Không tìm thấy thông tin mã giảm giá.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.isNotFound = true;
        console.error('Lỗi khi tải chi tiết mã giảm giá:', err);
        this.errorMessage = err?.error?.message || 'Lỗi kết nối máy chủ. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }

  get remainingUsage(): number {
    if (!this.coupon) return 0;
    const limit = Number(this.coupon.usageLimit) || 0;
    const used = Number(this.coupon.usedCount) || 0;
    return Math.max(0, limit - used);
  }

  get discountTypeLabel(): string {
    if (!this.coupon) return '—';
    return this.coupon.discountType === 'PERCENTAGE' ? 'Phần trăm (%)' : 'Số tiền cố định';
  }

  get discountValueFormatted(): string {
    if (!this.coupon) return '—';
    if (this.coupon.discountType === 'PERCENTAGE') {
      return `${this.coupon.discountValue}%`;
    }
    return `${Number(this.coupon.discountValue).toLocaleString('vi-VN')} ₫`;
  }

  get maxDiscountFormatted(): string {
    if (!this.coupon) return '—';
    if (!this.coupon.maxDiscount || Number(this.coupon.maxDiscount) <= 0) {
      return 'Không giới hạn';
    }
    return `${Number(this.coupon.maxDiscount).toLocaleString('vi-VN')} ₫`;
  }

  get minOrderValueFormatted(): string {
    if (!this.coupon) return '—';
    if (!this.coupon.minOrderValue || Number(this.coupon.minOrderValue) <= 0) {
      return '0 ₫ (Không yêu cầu)';
    }
    return `${Number(this.coupon.minOrderValue).toLocaleString('vi-VN')} ₫`;
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/pages/coupons']);
  }

  onEdit(): void {
    if (!this.couponId) return;
    this.router.navigate(['/admin/pages/coupons', this.couponId, 'edit']);
  }

  onToggleStatus(): void {
    if (!this.coupon) return;
    const isActive = this.coupon.isActive !== false;
    this.dialogAction = 'toggle';
    this.confirmTitle = isActive ? 'Tắt mã giảm giá' : 'Bật mã giảm giá';
    this.confirmMessage = isActive
      ? `Bạn có chắc chắn muốn tắt mã "${this.coupon.code}"? Khách hàng sẽ không thể áp dụng mã này khi đặt hàng.`
      : `Bạn có muốn bật lại mã "${this.coupon.code}" cho khách hàng áp dụng?`;
    this.confirmLabel = isActive ? 'Tắt mã' : 'Bật mã';
    this.confirmVariant = isActive ? 'warning' : 'default';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onDelete(): void {
    if (!this.coupon) return;
    this.dialogAction = 'delete';
    this.confirmTitle = 'Xóa mã giảm giá';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa vĩnh viễn mã giảm giá "${this.coupon.code}"? Thao tác này không thể hoàn tác.`;
    this.confirmLabel = 'Xóa mã';
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  confirmDialogAction(): void {
    if (!this.couponId || isNaN(Date.parse(new Date().toString())) || this.isProcessing) return;

    this.isProcessing = true;

    if (this.dialogAction === 'toggle') {
      const targetState = !(this.coupon.isActive !== false);
      this.apiService.updateCouponStatus(this.couponId, targetState).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          if (res && res.success) {
            this.coupon.isActive = targetState;
            this.notificationService.success(res?.message || `Mã giảm giá đã được ${targetState ? 'bật' : 'tắt'}`);
          } else {
            this.notificationService.error(res?.message || 'Không thể cập nhật trạng thái.');
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          console.error('Lỗi khi bật/tắt mã giảm giá:', err);
          this.notificationService.error(err?.error?.message || 'Có lỗi xảy ra khi cập nhật trạng thái.');
          this.cdr.markForCheck();
        }
      });
    } else if (this.dialogAction === 'delete') {
      this.apiService.deleteCoupon(this.couponId).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.notificationService.success(res?.message || 'Xóa mã giảm giá thành công.');
          this.router.navigate(['/admin/pages/coupons']);
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          console.error('Lỗi khi xóa mã giảm giá:', err);
          this.notificationService.error(err?.error?.message || 'Có lỗi xảy ra khi xóa mã giảm giá.');
          this.cdr.markForCheck();
        }
      });
    }
  }

  cancelDialogAction(): void {
    this.confirmOpen = false;
    this.isProcessing = false;
    this.cdr.markForCheck();
  }
}
