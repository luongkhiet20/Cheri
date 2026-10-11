import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';

interface PaymentMethodFormData {
  name: string;
  code: string;
  type: string;
  isActive: boolean;
  description: string;
  paymentInfo: string;
  paymentProofImage: string;
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
    paymentInfo: '',
    paymentProofImage: ''
  };

  // Image management state
  imagePreviewUrl: string | null = null;
  imageUrlInput = '';
  isUploadingImage = false;
  imageError = '';
  selectedFileName = '';

  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Phương thức thanh toán', url: '/admin/payment-methods' },
    { label: 'Thêm phương thức' }
  ];

  errors: Record<string, string> = {};
  errorMessage = '';

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
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.methodId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.methodId;

    this.breadcrumbItems = [
      { label: 'Phương thức thanh toán', url: '/admin/payment-methods' },
      { label: this.isEditMode ? 'Chỉnh sửa phương thức' : 'Thêm phương thức' }
    ];

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
          const proofImg = m.paymentProofImage || m.proofImage || '';
          this.formData = {
            name: m.name || '',
            code: (m.code || '').toUpperCase(),
            type: m.type || m.paymentType || 'Online',
            isActive: m.isActive !== false,
            description: m.description || '',
            paymentInfo: m.paymentInfo || '',
            paymentProofImage: proofImg
          };
          this.imagePreviewUrl = proofImg || null;
          this.imageUrlInput = proofImg || '';
          this.breadcrumbItems = [
            { label: 'Phương thức thanh toán', url: '/admin/payment-methods' },
            { label: this.formData.name ? ('Chỉnh sửa: ' + this.formData.name) : 'Chỉnh sửa phương thức' }
          ];
        } else {
          this.errorMessage = res.message || 'Không tìm thấy phương thức thanh toán';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin phương thức thanh toán từ máy chủ MongoDB';
        console.error('Error fetching payment method detail for edit:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCodeInput(): void {
    if (this.formData.code) {
      // Auto normalize uppercase and remove any whitespace
      this.formData.code = this.formData.code.toUpperCase().replace(/\s+/g, '');
    }
    this.clearFieldError('code');
  }

  clearFieldError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
      if (Object.keys(this.errors).length === 0) {
        this.errorMessage = '';
      }
      this.cdr.markForCheck();
    }
  }

  scrollToFirstError(key: string): void {
    setTimeout(() => {
      let el: HTMLElement | null = null;

      // 1. Direct query by id, name, or field wrapper
      el = document.getElementById(`payment-${key}`)
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      // 2. Fallback to first .is-invalid element
      if (!el) {
        el = document.querySelector<HTMLElement>('.is-invalid');
      }

      if (el) {
        // Expand any collapsed ancestor details or hidden containers
        let parent: HTMLElement | null = el.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
            (parent as HTMLDetailsElement).open = true;
          }
          if (parent.hidden) {
            parent.hidden = false;
          }
          parent = parent.parentElement;
        }

        // Smooth scroll to the target element, centered in viewport
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find focusable interactive element
        let focusTarget: HTMLElement | null = null;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          focusTarget = el;
        } else {
          focusTarget = el.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button');
        }

        if (focusTarget && typeof focusTarget.focus === 'function') {
          setTimeout(() => {
            focusTarget?.focus({ preventScroll: true });
          }, 200);
        }
      }
    }, 50);
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

  // ── Image Handling (Upload, Preview, Replace, Remove) ──
  onImageFileSelected(event: any): void {
    const file: File = event.target?.files?.[0];
    if (!file) return;

    // 1. Validate MIME type & extension
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileNameLower.endsWith(ext));
    if (!file.type.startsWith('image/') && !hasValidExt) {
      this.imageError = 'Chỉ chấp nhận tệp hình ảnh (PNG, JPG, JPEG, WEBP, SVG)';
      this.cdr.markForCheck();
      return;
    }

    // 2. Validate max size 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      this.imageError = 'Kích thước tệp vượt quá 5MB. Vui lòng chọn tệp nhỏ hơn';
      this.cdr.markForCheck();
      return;
    }

    this.imageError = '';
    this.selectedFileName = file.name;

    // 3. Preview ngay lập tức trên giao diện
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreviewUrl = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);

    // 4. Upload lên máy chủ qua endpoint hiện có
    this.isUploadingImage = true;
    this.cdr.markForCheck();

    this.apiService.uploadPaymentProofImage(file).subscribe({
      next: (res: any) => {
        this.isUploadingImage = false;
        if (res && res.success && res.url) {
          // Chỉ lưu URL ảnh vào formData.paymentProofImage, không lưu base64 vào DB
          this.formData.paymentProofImage = res.url;
          this.imageUrlInput = res.url;
          this.imagePreviewUrl = res.url;
          this.imageError = '';
        } else {
          this.imageError = res?.message || 'Tải ảnh lên máy chủ không thành công';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isUploadingImage = false;
        this.imageError = err?.error?.message || 'Lỗi khi tải ảnh lên máy chủ';
        console.error('Upload proof image error:', err);
        this.cdr.markForCheck();
      }
    });

    event.target.value = '';
  }

  onApplyImageUrl(): void {
    const url = (this.imageUrlInput || '').trim();
    if (!url) {
      this.imageError = 'Vui lòng nhập đường dẫn URL hình ảnh hợp lệ';
      this.cdr.markForCheck();
      return;
    }

    this.imageError = '';
    this.formData.paymentProofImage = url;
    this.imagePreviewUrl = url;
    this.selectedFileName = '';
    this.cdr.markForCheck();
  }

  onRemoveImage(): void {
    this.formData.paymentProofImage = '';
    this.imagePreviewUrl = null;
    this.imageUrlInput = '';
    this.selectedFileName = '';
    this.imageError = '';
    this.cdr.markForCheck();
  }

  onSubmit(): void {
    if (this.isSubmitting || this.isLoading) return;

    if (!this.validate()) {
      const orderedCandidates: string[] = ['name', 'code', 'type'];
      const firstKey = orderedCandidates.find(k => this.errors[k]) || Object.keys(this.errors)[0];
      if (firstKey) {
        this.scrollToFirstError(firstKey);
      }
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const payload = {
      name: this.formData.name.trim(),
      code: this.formData.code.trim().toUpperCase(),
      type: this.formData.type.trim(),
      isActive: Boolean(this.formData.isActive),
      description: (this.formData.description || '').trim(),
      paymentInfo: (this.formData.paymentInfo || '').trim(),
      paymentProofImage: (this.formData.paymentProofImage || '').trim()
    };

    if (this.isEditMode && this.methodId) {
      // Chỉnh sửa: PUT /api/payment-methods/:id
      this.apiService.updatePaymentMethod(this.methodId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Cập nhật phương thức thanh toán thành công');
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/payment-methods', this.methodId]);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Cập nhật thất bại';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật phương thức thanh toán lên máy chủ MongoDB';
          this.notificationService.error(this.errorMessage);
          console.error('Update payment method error:', err);
          this.cdr.markForCheck();
        }
      });
    } else {
      // Thêm mới: POST /api/payment-methods
      this.apiService.createPaymentMethod(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Thêm phương thức thanh toán thành công');
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/payment-methods']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Thêm phương thức thất bại';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi tạo mới phương thức thanh toán trên MongoDB';
          this.notificationService.error(this.errorMessage);
          console.error('Create payment method error:', err);
          this.cdr.markForCheck();
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
