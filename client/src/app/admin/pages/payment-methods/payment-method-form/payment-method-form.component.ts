import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';

interface PaymentMethodFormData {
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  description: string;
  paymentInfo: string;
}

@Component({
  selector: 'app-payment-method-form',
  standalone: false,
  templateUrl: './payment-method-form.component.html',
  styleUrls: ['./payment-method-form.component.css']
})
export class PaymentMethodFormComponent implements OnInit {
  isEditMode = false;
  methodId: string | null = null;
  isLoading = false;
  isSubmitting = false;

  formData: PaymentMethodFormData = {
    name: '',
    code: '',
    type: 'Online',
    isActive: true,
    description: '',
    paymentInfo: ''
  };

  errors: Record<string, string> = {};
  errorMessage = '';
  successMessage = '';

  readonly PAYMENT_TYPES: string[] = [
    'Online',
    'COD',
    'Chuyển khoản',
    'Ví điện tử',
    'Thẻ tín dụng / Ghi nợ'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.methodId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.methodId;

    if (this.isEditMode) {
      if (!this.methodId || this.methodId.trim() === '') {
        this.errorMessage = 'Mã định danh phương thức thanh toán không hợp lệ';
        return;
      }
      this.loadMethodDetail(this.methodId);
    }
  }

  loadMethodDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPaymentMethodById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const m = res.data;
          this.formData = {
            name: m.name || '',
            code: (m.code || '').toUpperCase(),
            type: m.type || m.paymentType || 'Online',
            isActive: m.isActive !== false,
            description: m.description || '',
            paymentInfo: m.paymentInfo || ''
          };
        } else {
          this.errorMessage = res.message || 'Không tìm thấy phương thức thanh toán';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin phương thức thanh toán từ máy chủ MongoDB';
        console.error('Error fetching payment method detail for edit:', err);
      }
    });
  }

  onCodeInput(): void {
    if (this.formData.code) {
      // Auto normalize uppercase and remove any whitespace
      this.formData.code = this.formData.code.toUpperCase().replace(/\s+/g, '');
    }
  }

  validate(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.formData.name || !this.formData.name.trim()) {
      this.errors['name'] = 'Tên phương thức thanh toán là bắt buộc';
      isValid = false;
    }

    if (!this.formData.code || !this.formData.code.trim()) {
      this.errors['code'] = 'Mã phương thức thanh toán là bắt buộc';
      isValid = false;
    } else {
      const cleanCode = this.formData.code.trim().toUpperCase();
      if (/\s/.test(cleanCode)) {
        this.errors['code'] = 'Mã không được chứa khoảng trắng';
        isValid = false;
      }
    }

    if (!this.formData.type || !this.formData.type.trim()) {
      this.errors['type'] = 'Loại thanh toán là bắt buộc';
      isValid = false;
    }

    return isValid;
  }

  onSubmit(): void {
    if (this.isSubmitting || this.isLoading) return;

    if (!this.validate()) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

    const payload = {
      name: this.formData.name.trim(),
      code: this.formData.code.trim().toUpperCase(),
      type: this.formData.type.trim(),
      isActive: Boolean(this.formData.isActive),
      description: (this.formData.description || '').trim(),
      paymentInfo: (this.formData.paymentInfo || '').trim()
    };

    if (this.isEditMode && this.methodId) {
      // Chỉnh sửa: PUT /api/payment-methods/:id
      this.apiService.updatePaymentMethod(this.methodId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Cập nhật phương thức thanh toán thành công';
            setTimeout(() => {
              this.router.navigate(['/admin/payment-methods', this.methodId]);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Cập nhật thất bại';
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật phương thức thanh toán lên máy chủ MongoDB';
          console.error('Update payment method error:', err);
        }
      });
    } else {
      // Thêm mới: POST /api/payment-methods
      this.apiService.createPaymentMethod(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Thêm phương thức thanh toán thành công';
            setTimeout(() => {
              this.router.navigate(['/admin/payment-methods']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Thêm phương thức thất bại';
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi tạo mới phương thức thanh toán trên MongoDB';
          console.error('Create payment method error:', err);
        }
      });
    }
  }

  onCancel(): void {
    if (this.isEditMode && this.methodId) {
      this.router.navigate(['/admin/payment-methods', this.methodId]);
    } else {
      this.router.navigate(['/admin/payment-methods']);
    }
  }
}
