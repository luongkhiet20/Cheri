import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../shared/models';
import { ApiService } from '../../../../services/api.service';
import { SignalStore } from '../../../../store/signal.store';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-profile-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-info.component.html',
  styleUrl: './profile-info.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileInfoComponent {
  private _user: User | null = null;

  @Input() set user(value: User | null) {
    this._user = value;
    if (value && !this.isSaving) {
      this.populateForm(value);
    }
  }
  get user(): User | null {
    return this._user;
  }

  @Output() profileUpdated = new EventEmitter<User>();

  // Form fields
  formName: string = '';
  formEmail: string = '';
  formPhone: string = '';
  formGender: string = '';
  formDateOfBirth: string = '';
  formAddress: string = '';
  formNewPassword: string = '';
  formConfirmPassword: string = '';

  // Giới hạn ngày sinh hợp lệ (không nhỏ hơn 01/01/1900 và không trong tương lai)
  readonly minBirthDate: string = '1900-01-01';
  get maxBirthDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Save state
  isSaving: boolean = false;
  saveSuccess: boolean = false;
  saveError: string = '';

  constructor(
    private apiService: ApiService,
    private store: SignalStore,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  formatDateForInput(dob: any): string {
    if (!dob) return '';
    if (typeof dob === 'string') {
      const trimmed = dob.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      return trimmed;
    }
    if (dob instanceof Date && !isNaN(dob.getTime())) {
      const yyyy = dob.getFullYear();
      const mm = String(dob.getMonth() + 1).padStart(2, '0');
      const dd = String(dob.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  }

  private getOrderAddress(shippingAddress: any): string {
    if (shippingAddress?.address) {
      const parts = [
        shippingAddress.address,
        shippingAddress.ward,
        shippingAddress.district,
        shippingAddress.province
      ].filter(Boolean);
      return parts.join(', ');
    }
    return '';
  }

  populateForm(user: any): void {
    if (!user) return;
    this.formName = (user.fullName || user.name || (user.email ? user.email.split('@')[0] : '')).trim();
    this.formEmail = user.email || '';
    this.formPhone = user.phoneNumber || user.phone || '';
    this.formGender = user.gender || '';
    this.formDateOfBirth = this.formatDateForInput(user.dateOfBirth);
    this.formAddress = user.address || (user.shippingAddress?.address ? this.getOrderAddress(user.shippingAddress) : '');
    this.cdr.markForCheck();
  }

  onSave(): void {
    this.saveSuccess = false;
    this.saveError = '';

    // Validate mật khẩu nếu người dùng muốn đổi
    if (this.formNewPassword || this.formConfirmPassword) {
      if (!this.formNewPassword || !this.formConfirmPassword) {
        this.saveError = 'Vui lòng nhập cả mật khẩu mới và xác nhận mật khẩu.';
        this.cdr.markForCheck();
        return;
      }
      if (this.formNewPassword !== this.formConfirmPassword) {
        this.saveError = 'Mật khẩu mới không khớp. Vui lòng kiểm tra lại.';
        this.cdr.markForCheck();
        return;
      }
      if (this.formNewPassword.length < 6) {
        this.saveError = 'Mật khẩu mới phải có ít nhất 6 ký tự.';
        this.cdr.markForCheck();
        return;
      }
    }

    // Validate ngày sinh (không cho phép ngày trong tương lai và không nhỏ hơn 01/01/1900)
    if (this.formDateOfBirth) {
      if (this.formDateOfBirth > this.maxBirthDate) {
        this.saveError = 'Ngày sinh không hợp lệ: Không được chọn ngày trong tương lai.';
        this.cdr.markForCheck();
        return;
      }
      if (this.formDateOfBirth < this.minBirthDate) {
        this.saveError = 'Ngày sinh không hợp lệ: Ngày sinh không được nhỏ hơn 01/01/1900.';
        this.cdr.markForCheck();
        return;
      }
    }

    const currentUser = this.user;
    if (!currentUser) {
      this.saveError = 'Không tìm thấy phiên đăng nhập, vui lòng đăng nhập lại.';
      this.cdr.markForCheck();
      return;
    }

    const payload: any = {
      fullName: this.formName?.trim() || undefined,
      name: this.formName?.trim() || undefined,
      phoneNumber: this.formPhone?.trim() ?? '',
      phone: this.formPhone?.trim() ?? '',
      gender: this.formGender ?? '',
      dateOfBirth: this.formDateOfBirth ?? '',
      address: this.formAddress?.trim() ?? '',
    };

    if (this.formNewPassword) {
      payload.password = this.formNewPassword;
    }

    this.isSaving = true;
    this.cdr.markForCheck();

    this.apiService.updateProfile(payload).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res?.error) {
          this.saveError = res.error?.message || (typeof res.error === 'string' ? res.error : 'Có lỗi xảy ra khi lưu thông tin.');
          this.cdr.markForCheck();
          return;
        }

        // Cập nhật store với dữ liệu người dùng thật vừa được lưu vào MongoDB
        const updatedUser = res.data || res;
        const mergedUser = { ...currentUser, ...updatedUser };
        this.store.storeUser(mergedUser);
        this.populateForm(mergedUser);

        this.formNewPassword = '';
        this.formConfirmPassword = '';
        this.saveSuccess = true;
        this.notify.success('✨Đã cập nhật thông tin tài khoản✨');
        this.profileUpdated.emit(mergedUser);
        this.cdr.markForCheck();

        setTimeout(() => {
          this.saveSuccess = false;
          this.cdr.markForCheck();
        }, 4000);
      },
      error: (err: any) => {
        this.isSaving = false;
        this.saveError = err?.error?.message || 'Có lỗi kết nối máy chủ. Vui lòng thử lại.';
        this.notify.error(`✨${this.saveError}✨`);
        this.cdr.markForCheck();
      }
    });
  }
}
