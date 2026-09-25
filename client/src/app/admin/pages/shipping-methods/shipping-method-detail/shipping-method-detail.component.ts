import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-shipping-method-detail',
  standalone: false,
  templateUrl: './shipping-method-detail.component.html',
  styleUrls: ['./shipping-method-detail.component.css']
})
export class ShippingMethodDetailComponent implements OnInit {
  methodId: string | null = null;
  method: any = null;

  isLoading = true;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Confirm dialog for status toggle or delete
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

    this.apiService.getShippingMethodById(id).subscribe({
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
          this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin phương thức vận chuyển';
        }
        console.error('Error fetching shipping method detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/shipping-methods']);
  }

  onEdit(): void {
    if (!this.methodId) return;
    this.router.navigate(['/admin/shipping-methods', this.methodId, 'edit']);
  }

  onToggleStatusClick(): void {
    if (!this.method || !this.methodId) return;

    this.dialogAction = 'toggle';
    const isActive = this.method.isActive !== false;
    if (isActive) {
      this.confirmTitle = 'Tắt phương thức vận chuyển';
      this.confirmMessage = `Bạn có chắc chắn muốn tắt phương thức "${this.method.name}" không?`;
      this.confirmLabel = 'Tắt';
      this.confirmVariant = 'warning';
    } else {
      this.confirmTitle = 'Bật phương thức vận chuyển';
      this.confirmMessage = `Bạn có chắc chắn muốn bật phương thức "${this.method.name}" không?`;
      this.confirmLabel = 'Bật';
      this.confirmVariant = 'default';
    }
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onDeleteClick(): void {
    if (!this.method || !this.methodId) return;

    this.dialogAction = 'delete';
    this.confirmTitle = 'Xóa phương thức vận chuyển';
    this.confirmMessage = 'Bạn có chắc muốn xóa phương thức vận chuyển này?';
    this.confirmLabel = 'Xóa';
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmDialog(): void {
    if (!this.method || !this.methodId || this.isProcessing) return;

    if (this.dialogAction === 'toggle') {
      const currentActive = this.method.isActive !== false;
      const targetActive = !currentActive;
      this.isProcessing = true;

      this.apiService.updateShippingMethodStatus(this.methodId, targetActive).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          if (res.success && res.data) {
            this.method = res.data;
            this.successMessage = res.message || `Đã ${targetActive ? 'bật' : 'tắt'} phương thức vận chuyển thành công`;
            setTimeout(() => {
              this.successMessage = '';
              this.cdr.markForCheck();
            }, 4000);
          } else {
            this.errorMessage = res.message || 'Không thể cập nhật trạng thái';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái trong MongoDB';
          this.cdr.markForCheck();
        }
      });
    } else if (this.dialogAction === 'delete') {
      this.isProcessing = true;
      this.apiService.deleteShippingMethod(this.methodId).subscribe({
        next: (res) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          if (res.success) {
            this.router.navigate(['/admin/shipping-methods']);
          } else {
            this.errorMessage = res.message || 'Không thể xóa phương thức vận chuyển';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isProcessing = false;
          this.confirmOpen = false;
          this.errorMessage = err.error?.message || 'Lỗi khi xóa phương thức vận chuyển';
          this.cdr.markForCheck();
        }
      });
    }
  }

  onCancelDialog(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return '0 đ';
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value));
  }
}
