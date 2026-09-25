import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-payment-method-detail',
  standalone: false,
  templateUrl: './payment-method-detail.component.html',
  styleUrls: ['./payment-method-detail.component.css']
})
export class PaymentMethodDetailComponent implements OnInit {
  methodId: string | null = null;
  method: any = null;

  isLoading = true;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Confirm dialog for status toggle
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' = 'warning';
  isStatusUpdating = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.methodId = this.route.snapshot.paramMap.get('id');
    if (!this.methodId || this.methodId.trim() === '') {
      this.isNotFound = true;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadMethod(this.methodId);
  }

  loadMethod(id: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getPaymentMethodById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.method = res.data;
        } else {
          this.isNotFound = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404 || err.status === 400) {
          this.isNotFound = true;
        } else {
          this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin phương thức thanh toán';
        }
        console.error('Error fetching payment method detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/payment-methods']);
  }

  onEdit(): void {
    if (!this.methodId) return;
    this.router.navigate(['/admin/payment-methods', this.methodId, 'edit']);
  }

  onToggleStatusClick(): void {
    if (!this.method || !this.methodId) return;

    const isActive = this.method.isActive !== false;
    if (isActive) {
      this.confirmTitle = 'Tắt phương thức thanh toán';
      this.confirmMessage = `Bạn có chắc chắn muốn tắt phương thức "${this.method.name}" không? Khách hàng sẽ không thể lựa chọn phương thức này.`;
      this.confirmLabel = 'Tắt';
      this.confirmVariant = 'warning';
    } else {
      this.confirmTitle = 'Bật phương thức thanh toán';
      this.confirmMessage = `Bạn có chắc chắn muốn kích hoạt phương thức "${this.method.name}" không?`;
      this.confirmLabel = 'Bật';
      this.confirmVariant = 'default';
    }
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmStatusChange(): void {
    if (!this.method || !this.methodId || this.isStatusUpdating) return;

    const currentActive = this.method.isActive !== false;
    const newActive = !currentActive;
    this.isStatusUpdating = true;
    this.cdr.markForCheck();

    this.apiService.updatePaymentMethodStatus(this.methodId, newActive).subscribe({
      next: (res) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        if (res.success) {
          this.successMessage = res.message || (newActive ? 'Đã bật phương thức thanh toán' : 'Đã tắt phương thức thanh toán');
          this.loadMethod(this.methodId!);
          setTimeout(() => this.successMessage = '', 4000);
        } else {
          this.errorMessage = res.message || 'Thao tác không thành công';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái';
        console.error('Status change error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelStatusChange(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }
}
