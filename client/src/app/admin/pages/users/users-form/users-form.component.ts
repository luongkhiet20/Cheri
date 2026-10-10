import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

interface UserFormData {
  email: string;
  password?: string;
  roles: string[];
  status: boolean;
  fullName: string;
  name: string;
  phoneNumber: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  avatar: string;
  description: string;
}

@Component({
  selector: 'app-users-form',
  standalone: false,
  templateUrl: './users-form.component.html',
  styleUrls: ['./users-form.component.css']
})
export class UsersFormComponent implements OnInit {
  isEditMode = false;
  userId: string | null = null;
  isLoading = false;
  isSubmitting = false;

  formData: UserFormData = {
    email: '',
    password: '',
    roles: ['user'],
    status: true,
    fullName: '',
    name: '',
    phoneNumber: '',
    gender: 'Nam',
    dateOfBirth: '',
    address: '',
    avatar: '',
    description: ''
  };

  errors: Record<string, string> = {};
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.userId;

    if (this.isEditMode) {
      if (!this.userId || this.userId.trim() === '') {
        this.errorMessage = 'Mã tài khoản (ID) không hợp lệ';
        return;
      }
      this.loadUserDetail(this.userId);
    }
  }

  loadUserDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getUserById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const u = res.data;
          this.formData = {
            email: u.email || '',
            roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['user'],
            status: u.status !== false,
            fullName: u.fullName || u.name || '',
            name: u.name || '',
            phoneNumber: u.phoneNumber || u.phone || '',
            gender: u.gender || 'Nam',
            dateOfBirth: u.dateOfBirth ? u.dateOfBirth.slice(0, 10) : '',
            address: u.address || '',
            avatar: u.avatar || '',
            description: u.description || ''
          };
        } else {
          this.errorMessage = res.message || 'Không tìm thấy thông tin tài khoản';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin tài khoản từ máy chủ';
        console.error('Error fetching user detail for edit:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onRoleChange(role: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    const currentRoles = new Set(this.formData.roles || []);
    if (isChecked) {
      currentRoles.add(role);
    } else {
      currentRoles.delete(role);
    }
    // Ensure at least one role remains
    if (currentRoles.size === 0) {
      currentRoles.add('user');
    }
    this.formData.roles = Array.from(currentRoles);
    if (this.formData.roles.length > 0) {
      this.clearFieldError('roles');
    }
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

  isRoleSelected(role: string): boolean {
    return Array.isArray(this.formData.roles) && this.formData.roles.includes(role);
  }

  validate(): boolean {
    this.errors = {};
    let isValid = true;

    // Validate email
    if (!this.formData.email || !this.formData.email.trim()) {
      this.errors['email'] = 'Email là bắt buộc';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.formData.email.trim())) {
        this.errors['email'] = 'Email không đúng định dạng';
        isValid = false;
      }
    }

    // Validate password (required only in add mode)
    if (!this.isEditMode) {
      if (!this.formData.password || this.formData.password.length < 6) {
        this.errors['password'] = 'Mật khẩu là bắt buộc và phải có ít nhất 6 ký tự';
        isValid = false;
      }
    }

    // Validate roles
    if (!this.formData.roles || this.formData.roles.length === 0) {
      this.errors['roles'] = 'Vui lòng chọn ít nhất một vai trò';
      isValid = false;
    }

    return isValid;
  }

  scrollToFirstError(key: string): void {
    setTimeout(() => {
      let el: HTMLElement | null = null;

      // 1. Direct query by id, name, or field wrapper
      el = document.getElementById(`user-${key}`)
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      // 2. Specific key targets
      if (!el && key === 'roles') {
        el = document.getElementById('field-roles') || document.querySelector<HTMLElement>('.checkbox-group');
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

  onSubmit(): void {
    if (this.isSubmitting || this.isLoading) return;

    if (!this.validate()) {
      const orderedCandidates: string[] = ['email', 'password', 'roles'];
      const firstKey = orderedCandidates.find(k => this.errors[k]) || Object.keys(this.errors)[0];
      if (firstKey) {
        this.scrollToFirstError(firstKey);
      }
      this.cdr.markForCheck();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    if (this.isEditMode && this.userId) {
      // Edit User -> PUT /api/users/:id
      const payload = {
        email: this.formData.email.trim(),
        roles: this.formData.roles,
        status: Boolean(this.formData.status),
        fullName: this.formData.fullName.trim(),
        name: this.formData.name.trim() || this.formData.fullName.trim(),
        phoneNumber: this.formData.phoneNumber.trim(),
        gender: this.formData.gender,
        dateOfBirth: this.formData.dateOfBirth,
        address: this.formData.address.trim(),
        avatar: this.formData.avatar.trim(),
        description: this.formData.description.trim()
      };

      this.apiService.updateUser(this.userId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Cập nhật tài khoản thành công');
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/users', this.userId]);
            }, 500);
          } else {
            this.errorMessage = res.message || 'Cập nhật thất bại';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật tài khoản lên máy chủ';
          this.notificationService.error(this.errorMessage);
          console.error('Update user error:', err);
          this.cdr.markForCheck();
        }
      });
    } else {
      // Add User -> POST /api/users
      const payload = {
        email: this.formData.email.trim(),
        password: this.formData.password,
        roles: this.formData.roles,
        status: Boolean(this.formData.status),
        fullName: this.formData.fullName.trim(),
        name: this.formData.name.trim() || this.formData.fullName.trim() || this.formData.email.trim().split('@')[0],
        phoneNumber: this.formData.phoneNumber.trim(),
        gender: this.formData.gender,
        dateOfBirth: this.formData.dateOfBirth,
        address: this.formData.address.trim(),
        avatar: this.formData.avatar.trim(),
        description: this.formData.description.trim()
      };

      this.apiService.createUser(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Thêm tài khoản thành công');
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/users']);
            }, 500);
          } else {
            this.errorMessage = res.message || 'Thêm tài khoản thất bại';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi tạo mới tài khoản';
          this.notificationService.error(this.errorMessage);
          console.error('Create user error:', err);
          this.cdr.markForCheck();
        }
      });
    }
  }

  onCancel(): void {
    if (this.isEditMode && this.userId) {
      this.router.navigate(['/admin/users', this.userId]);
    } else {
      this.router.navigate(['/admin/users']);
    }
  }
}

export { UsersFormComponent as AccountFormComponent };
