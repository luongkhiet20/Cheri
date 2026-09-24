import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-account',
  standalone: false,
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss']
})
export class AccountComponent implements OnInit, OnDestroy {
  isLoading = true;
  activeTab: 'overview' | 'edit' | 'password' = 'overview';

  // Profile data from backend
  profile: any = null;

  // Edit personal info form
  editForm = {
    fullName: '',
    email: '',
    phone: ''
  };
  editErrors: { [key: string]: string } = {};
  isSavingProfile = false;

  // Change password form
  passwordForm = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  passwordErrors: { [key: string]: string } = {};
  isSavingPassword = false;
  showCurrentPass = false;
  showNewPass = false;
  showConfirmPass = false;

  // Avatar upload
  isAvatarModalOpen = false;
  avatarPreview: string | null = null;
  avatarUrlInput = '';
  avatarError = '';
  isUploadingAvatar = false;

  // Alerts
  successMessage = '';
  errorMessage = '';
  private messageTimer: any = null;
  private routeSub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.determineActiveTabFromUrl();
    this.loadProfile();

    this.routeSub = this.route.url.subscribe(() => {
      this.determineActiveTabFromUrl();
    });
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }

  private determineActiveTabFromUrl(): void {
    const path = this.router.url;
    if (path.includes('/password')) {
      this.activeTab = 'password';
    } else if (path.includes('/edit')) {
      this.activeTab = 'edit';
    } else {
      this.activeTab = 'overview';
    }
  }

  setTab(tab: 'overview' | 'edit' | 'password'): void {
    this.activeTab = tab;
    this.clearAlerts();

    // Update browser URL without reloading
    let newUrl = '/admin/account';
    if (tab === 'edit') newUrl = '/admin/account/edit';
    if (tab === 'password') newUrl = '/admin/account/password';
    this.location.go(newUrl);
  }

  loadProfile(): void {
    this.isLoading = true;
    this.clearAlerts();

    this.apiService.getAccountProfile().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res && res.success && res.data) {
          this.setProfileData(res.data);
        } else {
          this.showError('Không thể tải thông tin tài khoản từ hệ thống.');
        }
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Error loading account profile:', err);
        this.showError(err?.error?.message || 'Lỗi kết nối khi tải hồ sơ tài khoản từ MongoDB.');
      }
    });
  }

  private setProfileData(data: any): void {
    this.profile = data;
    this.editForm = {
      fullName: data.fullName || data.name || '',
      email: data.email || '',
      phone: data.phone || data.phoneNumber || ''
    };
  }

  // ── KHU VỰC B: CHỈNH SỬA THÔNG TIN CÁ NHÂN ─────────
  validateEditForm(): boolean {
    this.editErrors = {};
    let isValid = true;

    // Họ và tên: Bắt buộc, không được rỗng
    if (!this.editForm.fullName || !this.editForm.fullName.trim()) {
      this.editErrors['fullName'] = 'Vui lòng nhập họ và tên.';
      isValid = false;
    }

    // Email: Bắt buộc, đúng định dạng
    if (!this.editForm.email || !this.editForm.email.trim()) {
      this.editErrors['email'] = 'Vui lòng nhập email.';
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.editForm.email.trim())) {
        this.editErrors['email'] = 'Email không hợp lệ (ví dụ: admin@cheri.vn).';
        isValid = false;
      }
    }

    // Số điện thoại: Không bắt buộc, nhưng nếu có phải hợp lệ
    if (this.editForm.phone && this.editForm.phone.trim()) {
      const phoneRegex = /^[0-9+() -]{8,15}$/;
      if (!phoneRegex.test(this.editForm.phone.trim())) {
        this.editErrors['phone'] = 'Số điện thoại không hợp lệ (từ 8 đến 15 chữ số).';
        isValid = false;
      }
    }

    return isValid;
  }

  onSaveProfile(): void {
    if (!this.validateEditForm()) {
      return;
    }

    this.isSavingProfile = true;
    this.clearAlerts();

    const payload = {
      fullName: this.editForm.fullName.trim(),
      email: this.editForm.email.trim(),
      phone: this.editForm.phone ? this.editForm.phone.trim() : ''
    };

    this.apiService.updateAccountProfile(payload).subscribe({
      next: (res: any) => {
        this.isSavingProfile = false;
        if (res && res.success && res.data) {
          this.setProfileData(res.data);
          this.showSuccess('Đã lưu thay đổi thông tin cá nhân thành công.');
        } else {
          this.showError(res?.message || 'Không thể cập nhật thông tin.');
        }
      },
      error: (err) => {
        this.isSavingProfile = false;
        console.error('Error updating profile:', err);
        const msg = err?.error?.message || 'Không thể cập nhật thông tin tài khoản.';
        this.showError(msg);
      }
    });
  }

  resetEditForm(): void {
    if (this.profile) {
      this.editForm = {
        fullName: this.profile.fullName || this.profile.name || '',
        email: this.profile.email || '',
        phone: this.profile.phone || this.profile.phoneNumber || ''
      };
      this.editErrors = {};
      this.clearAlerts();
    }
  }

  // ── KHU VỰC C: ĐỔI MẬT KHẨU ────────────────────────
  validatePasswordForm(): boolean {
    this.passwordErrors = {};
    let isValid = true;

    // Mật khẩu hiện tại: Bắt buộc
    if (!this.passwordForm.currentPassword) {
      this.passwordErrors['currentPassword'] = 'Vui lòng nhập mật khẩu hiện tại.';
      isValid = false;
    }

    // Mật khẩu mới: Bắt buộc, >= 6 ký tự
    if (!this.passwordForm.newPassword) {
      this.passwordErrors['newPassword'] = 'Vui lòng nhập mật khẩu mới.';
      isValid = false;
    } else if (this.passwordForm.newPassword.length < 6) {
      this.passwordErrors['newPassword'] = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
      isValid = false;
    } else if (this.passwordForm.currentPassword && this.passwordForm.newPassword === this.passwordForm.currentPassword) {
      this.passwordErrors['newPassword'] = 'Mật khẩu mới không được trùng với mật khẩu cũ.';
      isValid = false;
    }

    // Xác nhận mật khẩu: Bắt buộc, khớp với mk mới
    if (!this.passwordForm.confirmPassword) {
      this.passwordErrors['confirmPassword'] = 'Vui lòng xác nhận mật khẩu mới.';
      isValid = false;
    } else if (this.passwordForm.newPassword !== this.passwordForm.confirmPassword) {
      this.passwordErrors['confirmPassword'] = 'Xác nhận mật khẩu mới không khớp.';
      isValid = false;
    }

    return isValid;
  }

  onSavePassword(): void {
    if (!this.validatePasswordForm()) {
      return;
    }

    this.isSavingPassword = true;
    this.clearAlerts();

    const payload = {
      currentPassword: this.passwordForm.currentPassword,
      newPassword: this.passwordForm.newPassword,
      confirmPassword: this.passwordForm.confirmPassword
    };

    this.apiService.changeAccountPassword(payload).subscribe({
      next: (res: any) => {
        this.isSavingPassword = false;
        if (res && res.success) {
          this.passwordForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          };
          this.passwordErrors = {};
          this.showSuccess('Đổi mật khẩu thành công! Mật khẩu mới đã được cập nhật an toàn.');
        } else {
          this.showError(res?.message || 'Không thể đổi mật khẩu.');
        }
      },
      error: (err) => {
        this.isSavingPassword = false;
        console.error('Error changing password:', err);
        const msg = err?.error?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ.';
        this.showError(msg);
      }
    });
  }

  // ── THAY ĐỔI AVATAR ────────────────────────────────
  openAvatarModal(): void {
    this.isAvatarModalOpen = true;
    this.avatarPreview = this.profile?.avatar || null;
    this.avatarUrlInput = '';
    this.avatarError = '';
  }

  closeAvatarModal(): void {
    this.isAvatarModalOpen = false;
    this.avatarPreview = null;
    this.avatarUrlInput = '';
    this.avatarError = '';
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Check image type
    if (!file.type.startsWith('image/')) {
      this.avatarError = 'Chỉ chấp nhận tệp hình ảnh (JPG, PNG, GIF, WEBP).';
      return;
    }

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError = 'Kích thước ảnh không được vượt quá 5MB.';
      return;
    }

    this.avatarError = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.avatarPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  onAvatarUrlChange(): void {
    if (this.avatarUrlInput && this.avatarUrlInput.trim()) {
      this.avatarPreview = this.avatarUrlInput.trim();
      this.avatarError = '';
    }
  }

  onSaveAvatar(): void {
    const newAvatar = this.avatarPreview || this.avatarUrlInput.trim();
    if (!newAvatar) {
      this.avatarError = 'Vui lòng chọn ảnh từ thiết bị hoặc nhập URL ảnh hợp lệ.';
      return;
    }

    this.isUploadingAvatar = true;
    this.avatarError = '';

    this.apiService.uploadAccountAvatar(newAvatar).subscribe({
      next: (res: any) => {
        this.isUploadingAvatar = false;
        if (res && res.success && res.data) {
          this.setProfileData(res.data);
          this.closeAvatarModal();
          this.showSuccess('Cập nhật ảnh đại diện thành công!');
        } else {
          this.avatarError = res?.message || 'Không thể lưu ảnh đại diện.';
        }
      },
      error: (err) => {
        this.isUploadingAvatar = false;
        console.error('Error uploading avatar:', err);
        this.avatarError = err?.error?.message || 'Lỗi khi tải ảnh đại diện lên máy chủ.';
      }
    });
  }

  // ── HELPERS ────────────────────────────────────────
  get userInitial(): string {
    const name = this.profile?.fullName || this.profile?.name || this.profile?.username || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  formatDate(dateStr: any): string {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    this.errorMessage = '';
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.successMessage = '';
    }, 6000);
  }

  private showError(msg: string): void {
    this.errorMessage = msg;
    this.successMessage = '';
    if (this.messageTimer) clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.errorMessage = '';
    }, 8000);
  }

  clearAlerts(): void {
    this.successMessage = '';
    this.errorMessage = '';
    if (this.messageTimer) clearTimeout(this.messageTimer);
  }
}
