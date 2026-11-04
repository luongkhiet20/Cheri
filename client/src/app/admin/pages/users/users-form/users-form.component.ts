import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { checkIsAdmin } from '../../../../services/auth.guard';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import {
  PERMISSION_GROUPS,
  ALL_STAFF_PERMISSIONS,
  PermissionGroup,
  PermissionModule,
} from '../../../shared/constants/permissions.catalog';

interface UserFormData {
  email: string;
  password?: string;
  roles: string[];
  permissions?: string[];
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

  // Vai trò được chọn: 'user' | 'staff' | 'admin'
  selectedRole: 'user' | 'staff' | 'admin' = 'user';
  // Quyền hạn nhân viên được chọn
  selectedPermissions: Set<string> = new Set<string>();
  // Danh sách vai trò cũ của Admin (ví dụ ['user', 'admin']) để bảo toàn khi chỉnh sửa
  originalAdminRoles: string[] = [];

  readonly permissionGroups: PermissionGroup[] = PERMISSION_GROUPS;

  formData: UserFormData = {
    email: '',
    password: '',
    roles: ['user'],
    permissions: [],
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

  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý tài khoản', url: '/admin/users' },
    { label: 'Thêm tài khoản' }
  ];

  get viewerIsAdmin(): boolean {
    return checkIsAdmin(this.selectors.user());
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService,
    private selectors: SignalStoreSelectors
  ) { }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.userId;

    this.breadcrumbItems = [
      { label: 'Quản lý tài khoản', url: '/admin/users' },
      { label: this.isEditMode ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản' }
    ];

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

          // Nhận diện vai trò hiện tại
          const rawRoles: any = u.roles || (u.role ? [u.role] : []);
          const rolesArray: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
            .map((r: any) => typeof r === 'string' ? r.toLowerCase().trim() : '');

          const isAdmin = rolesArray.some(r => r === 'admin' || r === 'superadmin' || r === 'super-admin') || u.isAdmin === true;
          const isStaff = rolesArray.includes('staff');

          if (isAdmin) {
            this.selectedRole = 'admin';
            this.originalAdminRoles = Array.isArray(u.roles) ? [...u.roles] : ['admin'];
          } else if (isStaff) {
            this.selectedRole = 'staff';
          } else {
            this.selectedRole = 'user';
          }

          // Nạp permissions hiện có từ MongoDB
          const loadedPermissions = Array.isArray(u.permissions) ? u.permissions : [];
          this.selectedPermissions = new Set<string>(loadedPermissions);

          this.formData = {
            email: u.email || '',
            roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['user'],
            permissions: loadedPermissions,
            status: u.status !== false,
            fullName: u.fullName || u.name || '',
            name: u.name || '',
            phoneNumber: u.phoneNumber || u.phone || '',
            gender: u.gender || 'Nam',
            dateOfBirth: u.dateOfBirth ? String(u.dateOfBirth).slice(0, 10) : '',
            address: u.address || '',
            avatar: u.avatar || '',
            description: u.description || ''
          };

          const userName = this.formData.fullName || this.formData.name || this.formData.email || '';
          this.breadcrumbItems = [
            { label: 'Quản lý tài khoản', url: '/admin/users' },
            { label: userName ? ('Chỉnh sửa: ' + userName) : 'Chỉnh sửa tài khoản' }
          ];
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

  onRoleChange(role: 'user' | 'staff' | 'admin'): void {
    this.selectedRole = role;
    if (this.errors['roles']) {
      delete this.errors['roles'];
    }
    this.cdr.markForCheck();
  }

  // Quản lý Checkbox phân quyền
  hasPermission(key: string): boolean {
    return this.selectedPermissions.has(key);
  }

  togglePermission(key: string): void {
    if (this.selectedPermissions.has(key)) {
      this.selectedPermissions.delete(key);
    } else {
      this.selectedPermissions.add(key);
    }
    this.cdr.markForCheck();
  }

  isModuleFullySelected(module: PermissionModule): boolean {
    if (!module.permissions || module.permissions.length === 0) return false;
    return module.permissions.every(p => this.selectedPermissions.has(p.key));
  }

  isModuleIndeterminate(module: PermissionModule): boolean {
    if (!module.permissions || module.permissions.length === 0) return false;
    const selectedCount = module.permissions.filter(p => this.selectedPermissions.has(p.key)).length;
    return selectedCount > 0 && selectedCount < module.permissions.length;
  }

  getModuleSelectedCount(module: PermissionModule): number {
    if (!module.permissions) return 0;
    return module.permissions.filter(p => this.selectedPermissions.has(p.key)).length;
  }

  toggleModulePermissions(module: PermissionModule): void {
    const fullySelected = this.isModuleFullySelected(module);
    if (fullySelected) {
      // Bỏ toàn bộ quyền của module
      for (const p of module.permissions) {
        this.selectedPermissions.delete(p.key);
      }
    } else {
      // Chọn tất cả quyền của module
      for (const p of module.permissions) {
        this.selectedPermissions.add(p.key);
      }
    }
    this.cdr.markForCheck();
  }

  selectAllPermissions(): void {
    for (const key of ALL_STAFF_PERMISSIONS) {
      this.selectedPermissions.add(key);
    }
    this.cdr.markForCheck();
  }

  clearAllPermissions(): void {
    this.selectedPermissions.clear();
    this.cdr.markForCheck();
  }

  getSelectedCount(): number {
    return this.selectedPermissions.size;
  }

  getTotalCount(): number {
    return ALL_STAFF_PERMISSIONS.length;
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
    if (!this.selectedRole) {
      this.errors['roles'] = 'Vui lòng chọn vai trò cho tài khoản';
      isValid = false;
    }

    return isValid;
  }

  scrollToFirstError(key: string): void {
    setTimeout(() => {
      let el: HTMLElement | null = null;

      el = document.getElementById(`user-${key}`)
        || document.getElementById(key)
        || document.querySelector<HTMLElement>(`[name="${key}"]`)
        || document.getElementById(`field-${key}`);

      if (!el && key === 'roles') {
        el = document.getElementById('field-roles') || document.querySelector<HTMLElement>('.radio-group');
      }

      if (!el) {
        el = document.querySelector<HTMLElement>('.is-invalid');
      }

      if (el) {
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

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

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

    // Ánh xạ vai trò chính xác
    let resolvedRoles: string[];
    let resolvedPermissions: string[] = [];

    if (this.selectedRole === 'admin') {
      resolvedRoles = this.originalAdminRoles.length > 0 ? this.originalAdminRoles : ['admin'];
      resolvedPermissions = [];
    } else if (this.selectedRole === 'staff') {
      resolvedRoles = ['staff'];
      resolvedPermissions = Array.from(this.selectedPermissions);
    } else {
      resolvedRoles = ['user'];
      resolvedPermissions = [];
    }

    const payload: any = {
      email: this.formData.email.trim(),
      roles: resolvedRoles,
      permissions: resolvedPermissions,
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

    if (!this.isEditMode) {
      payload.password = this.formData.password;
    }

    if (this.isEditMode && this.userId) {
      // Edit User -> PUT /api/users/:id
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
