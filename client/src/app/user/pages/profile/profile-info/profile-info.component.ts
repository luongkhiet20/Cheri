import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
export class ProfileInfoComponent implements OnInit {
  private _user: User | null = null;

  @Input() set user(value: User | null) {
    this._user = value;
    if (value && !this.isSavingProfile) {
      this.populateForm(value);
    }
  }
  get user(): User | null {
    return this._user;
  }

  @Output() profileUpdated = new EventEmitter<User>();

  // Form Section 1: Hồ sơ
  formName: string = '';
  formEmail: string = '';
  formPhone: string = '';
  formGender: string = '';
  formDateOfBirth: string = '';
  formAddress: string = '';

  isSavingProfile: boolean = false;
  profileSuccess: boolean = false;
  profileError: string = '';

  // Form Section 2: Đổi mật khẩu (mặc định luôn luôn để trống)
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';

  isChangingPassword: boolean = false;
  passwordSuccess: boolean = false;
  passwordError: string = '';

  // Giới hạn ngày sinh hợp lệ (không nhỏ hơn 01/01/1900 và không trong tương lai)
  readonly minBirthDate: string = '1900-01-01';
  get maxBirthDate(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  constructor(
    private apiService: ApiService,
    private store: SignalStore,
    private notify: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Đảm bảo cả ba trường mật khẩu luôn luôn rỗng khi khởi tạo
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    if (this._user) {
      this.populateForm(this._user);
    }
  }

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
      const mm = String(dateMonth(dob)).padStart(2, '0');
      const dd = String(dob.getDate()).padStart(2, '0');
      return `${dob.getFullYear()}-${mm}-${dd}`;
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

    // Đảm bảo tuyệt đối cả ba trường mật khẩu không bao giờ nhận giá trị từ user object
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.cdr.markForCheck();
  }

  // ── XỬ LÝ LƯU HỒ SƠ (ĐỘC LẬP) ──
  onSaveProfile(): void {
    this.profileSuccess = false;
    this.profileError = '';

    // Validate ngày sinh
    if (this.formDateOfBirth) {
      if (this.formDateOfBirth > this.maxBirthDate) {
        this.profileError = 'Ngày sinh không hợp lệ: Không được chọn ngày trong tương lai.';
        this.cdr.markForCheck();
        return;
      }
      if (this.formDateOfBirth < this.minBirthDate) {
        this.profileError = 'Ngày sinh không hợp lệ: Ngày sinh không được nhỏ hơn 01/01/1900.';
        this.cdr.markForCheck();
        return;
      }
    }

    const currentUser = this.user;
    if (!currentUser) {
      this.profileError = 'Không tìm thấy phiên đăng nhập, vui lòng đăng nhập lại.';
      this.cdr.markForCheck();
      return;
    }

    // Payload chỉ chứa thông tin hồ sơ, tuyệt đối KHÔNG có password
    const payload: any = {
      fullName: this.formName?.trim() || undefined,
      name: this.formName?.trim() || undefined,
      phoneNumber: this.formPhone?.trim() ?? '',
      phone: this.formPhone?.trim() ?? '',
      gender: this.formGender ?? '',
      dateOfBirth: this.formDateOfBirth ?? '',
      address: this.formAddress?.trim() ?? '',
    };

    this.isSavingProfile = true;
    this.cdr.markForCheck();

    this.apiService.updateProfile(payload).subscribe({
      next: (res: any) => {
        this.isSavingProfile = false;
        if (res?.error) {
          this.profileError = res.error?.message || (typeof res.error === 'string' ? res.error : 'Có lỗi xảy ra khi lưu thông tin.');
          this.cdr.markForCheck();
          return;
        }

        const updatedUser = res.data || res;
        const mergedUser = { ...currentUser, ...updatedUser };
        this.store.storeUser(mergedUser);
        this.populateForm(mergedUser);

        this.profileSuccess = true;
        this.notify.success('✨Đã cập nhật thông tin hồ sơ thành công✨');
        this.profileUpdated.emit(mergedUser);
        this.cdr.markForCheck();

        setTimeout(() => {
          this.profileSuccess = false;
          this.cdr.markForCheck();
        }, 4000);
      },
      error: (err: any) => {
        this.isSavingProfile = false;
        this.profileError = err?.error?.message || 'Có lỗi kết nối máy chủ. Vui lòng thử lại.';
        this.notify.error(`✨${this.profileError}✨`);
        this.cdr.markForCheck();
      }
    });
  }

  // ── XỬ LÝ ĐỔI MẬT KHẨU (ĐỘC LẬP) ──
  onChangePassword(): void {
    this.passwordSuccess = false;
    this.passwordError = '';

    const curr = (this.currentPassword || '').trim();
    const next = (this.newPassword || '').trim();
    const conf = (this.confirmPassword || '').trim();

    // 1. Kiểm tra không bỏ trống trường nào
    if (!curr) {
      this.passwordError = 'Vui lòng nhập mật khẩu hiện tại.';
      this.cdr.markForCheck();
      return;
    }
    if (!next) {
      this.passwordError = 'Vui lòng nhập mật khẩu mới.';
      this.cdr.markForCheck();
      return;
    }
    if (!conf) {
      this.passwordError = 'Vui lòng nhập lại mật khẩu mới.';
      this.cdr.markForCheck();
      return;
    }

    // 2. Kiểm tra mật khẩu mới và xác nhận trùng khớp
    if (next !== conf) {
      this.passwordError = 'Mật khẩu mới và xác nhận mật khẩu không trùng khớp.';
      this.cdr.markForCheck();
      return;
    }

    // 3. Kiểm tra mật khẩu mới không trùng mật khẩu hiện tại
    if (curr === next) {
      this.passwordError = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.';
      this.cdr.markForCheck();
      return;
    }

    // 4. Kiểm tra độ dài mật khẩu mới theo chính sách
    if (next.length < 8) {
      this.passwordError = 'Mật khẩu mới phải có tối thiểu 8 ký tự.';
      this.cdr.markForCheck();
      return;
    }
    if (next.length > 100) {
      this.passwordError = 'Mật khẩu mới không được vượt quá 100 ký tự.';
      this.cdr.markForCheck();
      return;
    }

    this.isChangingPassword = true;
    this.cdr.markForCheck();

    this.apiService.changePassword({
      currentPassword: curr,
      newPassword: next,
    }).subscribe({
      next: (res: any) => {
        this.isChangingPassword = false;
        if (res?.error) {
          this.passwordError = res.error?.message || (typeof res.error === 'string' ? res.error : 'Đổi mật khẩu thất bại.');
          this.notify.error(`✨${this.passwordError}✨`);
          this.cdr.markForCheck();
          return;
        }

        // Xóa nội dung 3 trường mật khẩu sau khi đổi thành công
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess = true;
        this.notify.success('✨Đổi mật khẩu thành công✨');
        this.cdr.markForCheck();

        setTimeout(() => {
          this.passwordSuccess = false;
          this.cdr.markForCheck();
        }, 4000);
      },
      error: (err: any) => {
        this.isChangingPassword = false;
        this.passwordError = err?.error?.message || 'Có lỗi kết nối máy chủ. Vui lòng thử lại.';
        this.notify.error(`✨${this.passwordError}✨`);
        this.cdr.markForCheck();
      }
    });
  }
}

function dateMonth(date: Date): number {
  return date.getMonth() + 1;
}
