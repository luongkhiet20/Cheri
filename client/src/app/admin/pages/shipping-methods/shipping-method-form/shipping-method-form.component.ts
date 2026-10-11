import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';

interface ShippingMethodFormData {
  name: string;
  code: string;
  baseCost: number | null;
  estimatedDays: string;
  coverageArea: string;
  freeShippingThreshold: number | null;
  isActive: boolean;
  description: string;
}

@Component({
  selector: 'app-shipping-method-form',
  standalone: false,
  templateUrl: './shipping-method-form.component.html',
  styleUrls: ['./shipping-method-form.component.css']
})
export class ShippingMethodFormComponent implements OnInit {
  isEditMode = false;
  methodId: string | null = null;
  isLoading = false;
  isSubmitting = false;

  formData: ShippingMethodFormData = {
    name: '',
    code: '',
    baseCost: 30000,
    estimatedDays: '2–5 ngày làm việc',
    coverageArea: 'Toàn quốc',
    freeShippingThreshold: 500000,
    isActive: true,
    description: ''
  };

  errors: Record<string, string> = {};
  errorMessage = '';

  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Phương thức vận chuyển', url: '/admin/shipping-methods' },
    { label: 'Thêm phương thức' }
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
      { label: 'Phương thức vận chuyển', url: '/admin/shipping-methods' },
      { label: this.isEditMode ? 'Chỉnh sửa phương thức' : 'Thêm phương thức' }
    ];

    if (this.isEditMode) {
      if (!this.methodId || this.methodId.trim() === '') {
        this.errorMessage = 'Mã định danh phương thức vận chuyển không hợp lệ';
        this.cdr.markForCheck();
        return;
      }
      this.loadMethodDetail(this.methodId);
    }
  }

  loadMethodDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getShippingMethodById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const m = res.data;
          this.formData = {
            name: m.name || '',
            code: (m.code || '').toUpperCase(),
            baseCost: typeof m.baseCost === 'number' ? m.baseCost : 0,
            estimatedDays: m.estimatedDays || '',
            coverageArea: m.coverageArea || 'Toàn quốc',
            freeShippingThreshold: typeof m.freeShippingThreshold === 'number' ? m.freeShippingThreshold : 0,
            isActive: m.isActive !== false,
            description: m.description || ''
          };
          this.breadcrumbItems = [
            { label: 'Phương thức vận chuyển', url: '/admin/shipping-methods' },
            { label: this.formData.name ? ('Chỉnh sửa: ' + this.formData.name) : 'Chỉnh sửa phương thức' }
          ];
        } else {
          this.errorMessage = res.message || 'Không tìm thấy phương thức vận chuyển';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin phương thức vận chuyển từ máy chủ MongoDB';
        console.error('Error fetching shipping method detail for edit:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCodeInput(): void {
    if (this.formData.code) {
      // Auto normalize uppercase and replace whitespaces with underscore
      this.formData.code = this.formData.code.toUpperCase().replace(/\s+/g, '_');
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
      el = document.getElementById(`shipping-${key}`)
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      // 2. Specific key targets
      if (!el) {
        if (key === 'baseCost') {
          el = document.getElementById('shipping-base-cost');
        } else if (key === 'estimatedDays') {
          el = document.getElementById('shipping-estimated-days');
        } else if (key === 'freeShippingThreshold') {
          el = document.getElementById('shipping-free-threshold');
        }
      }

      // 3. Fallback to first .is-invalid element
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

    if (!this.formData.name || !this.formData.name.trim()) {
      this.errors['name'] = 'Tên phương thức vận chuyển là bắt buộc';
    }

    if (!this.formData.code || !this.formData.code.trim()) {
      this.errors['code'] = 'Mã phương thức vận chuyển là bắt buộc';
    }

    if (this.formData.baseCost === null || this.formData.baseCost === undefined || isNaN(Number(this.formData.baseCost))) {
      this.errors['baseCost'] = 'Phí vận chuyển cơ bản là bắt buộc và phải là số';
    } else if (Number(this.formData.baseCost) < 0) {
      this.errors['baseCost'] = 'Phí vận chuyển cơ bản không được âm';
    }

    if (!this.formData.estimatedDays || !this.formData.estimatedDays.trim()) {
      this.errors['estimatedDays'] = 'Thời gian giao hàng dự kiến là bắt buộc';
    }

    if (this.formData.freeShippingThreshold !== null && this.formData.freeShippingThreshold !== undefined) {
      if (isNaN(Number(this.formData.freeShippingThreshold))) {
        this.errors['freeShippingThreshold'] = 'Mức đơn hàng miễn phí vận chuyển phải là số';
      } else if (Number(this.formData.freeShippingThreshold) < 0) {
        this.errors['freeShippingThreshold'] = 'Mức đơn hàng miễn phí vận chuyển không được âm';
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.validate()) {
      const orderedCandidates: string[] = ['name', 'code', 'baseCost', 'estimatedDays', 'freeShippingThreshold'];
      const firstKey = orderedCandidates.find(k => this.errors[k]) || Object.keys(this.errors)[0];
      if (firstKey) {
        this.scrollToFirstError(firstKey);
      }
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;

    const payload = {
      name: this.formData.name.trim(),
      code: this.formData.code.trim().toUpperCase().replace(/\s+/g, '_'),
      baseCost: Number(this.formData.baseCost),
      estimatedDays: this.formData.estimatedDays.trim(),
      coverageArea: this.formData.coverageArea ? this.formData.coverageArea.trim() : 'Toàn quốc',
      freeShippingThreshold: Number(this.formData.freeShippingThreshold) || 0,
      isActive: Boolean(this.formData.isActive),
      description: this.formData.description ? this.formData.description.trim() : ''
    };

    if (this.isEditMode && this.methodId) {
      // Chỉnh sửa: PUT /api/shipping-methods/:id
      this.apiService.updateShippingMethod(this.methodId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Cập nhật phương thức vận chuyển thành công');
            setTimeout(() => {
              this.router.navigate(['/admin/shipping-methods', this.methodId]);
            }, 800);
          } else {
            this.errorMessage = res.message || 'Cập nhật thất bại';
            this.notificationService.error(this.errorMessage);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Có lỗi xảy ra khi lưu vào MongoDB. Vui lòng kiểm tra lại.';
          this.notificationService.error(this.errorMessage);
          console.error('Update shipping method error:', err);
          this.cdr.markForCheck();
        }
      });
    } else {
      // Thêm mới: POST /api/shipping-methods
      this.apiService.createShippingMethod(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Thêm phương thức vận chuyển thành công');
            setTimeout(() => {
              this.router.navigate(['/admin/shipping-methods']);
            }, 800);
          } else {
            this.errorMessage = res.message || 'Thêm mới thất bại';
            this.notificationService.error(this.errorMessage);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Có lỗi xảy ra khi tạo document mới trong MongoDB. Vui lòng kiểm tra lại.';
          this.notificationService.error(this.errorMessage);
          console.error('Create shipping method error:', err);
          this.cdr.markForCheck();
        }
      });
    }
  }

  onCancel(): void {
    if (this.isEditMode && this.methodId) {
      this.router.navigate(['/admin/shipping-methods', this.methodId]);
    } else {
      this.router.navigate(['/admin/shipping-methods']);
    }
  }
}
