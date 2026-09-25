import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

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
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
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

  onSubmit(): void {
    if (this.isSubmitting || this.isLoading) return;

    if (!this.validate()) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';
    this.successMessage = '';

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
            this.successMessage = 'Cập nhật tài khoản thành công';
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/users', this.userId]);
            }, 500);
          } else {
            this.errorMessage = res.message || 'Cập nhật thất bại';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật tài khoản lên máy chủ';
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
            this.successMessage = 'Thêm tài khoản thành công';
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/users']);
            }, 500);
          } else {
            this.errorMessage = res.message || 'Thêm tài khoản thất bại';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi tạo mới tài khoản';
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
