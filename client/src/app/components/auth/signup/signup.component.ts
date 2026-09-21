import { take, switchMap, map } from 'rxjs/operators';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';

import { TranslateService } from '../../../services/translate.service';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SignalStore } from '../../../store/signal.store';
import { ApiService } from '../../../services/api.service';

@Component({
    selector: 'app-signup',
    templateUrl: './signup.component.html',
    styleUrls: ['./signup.component.css'],
    imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule, MatSnackBarModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpComponent {

  signUpForm: FormGroup;
  lang$: Observable<string>;

  showRegPassword = false;

  constructor(
    private translate: TranslateService,
    private _fb: FormBuilder,
    private store: SignalStore,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.lang$ = this.translate.getLang$();

    this.signUpForm = this._fb.group({
      email          : ['', [Validators.required, Validators.email, this.gmailValidator]],
      name           : [''],
      password       : ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
      agreeTerms     : [false, Validators.requiredTrue]
    }, { validators: this.passwordsMatchValidator });
  }

  gmailValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const val = String(control.value).trim().toLowerCase();
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return gmailRegex.test(val) ? null : { gmailInvalid: true };
  }

  passwordsMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    if (confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }
    return null;
  }

  toggleShowPassword(): void {
    this.showRegPassword = !this.showRegPassword;
  }

  getSubmitButtonTitle(): string {
    const emailCtrl = this.signUpForm.get('email');
    const passCtrl = this.signUpForm.get('password');

    if (!emailCtrl?.value) return 'Vui lòng nhập địa chỉ Gmail';
    if (emailCtrl?.invalid) return 'Email phải đúng định dạng Gmail (@gmail.com)';
    if (passCtrl?.invalid) return 'Mật khẩu phải tối thiểu 6 ký tự';
    if (this.signUpForm.errors?.['passwordMismatch']) return 'Mật khẩu nhập lại không khớp';
    if (!this.signUpForm.get('agreeTerms')?.value) return 'Vui lòng tích chọn Chấp nhận điều khoản sử dụng và Chính sách bảo mật';
    return '';
  }

  submit() {
    if (this.signUpForm.invalid) {
      const emailCtrl = this.signUpForm.get('email');
      const passCtrl = this.signUpForm.get('password');

      if (!emailCtrl?.value) {
        this.snackBar.open('Vui lòng nhập địa chỉ Gmail để đăng ký!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (emailCtrl?.invalid) {
        this.snackBar.open('Email phải đúng định dạng Gmail (@gmail.com) mới được đăng ký!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (passCtrl?.invalid) {
        this.snackBar.open('Mật khẩu phải tối thiểu 6 ký tự!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (this.signUpForm.errors?.['passwordMismatch']) {
        this.snackBar.open('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (!this.signUpForm.get('agreeTerms')?.value) {
        this.snackBar.open('Vui lòng tích chọn "Chấp nhận điều khoản sử dụng và Chính sách bảo mật" để tạo tài khoản!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else {
        this.snackBar.open('Vui lòng điền đầy đủ và chính xác thông tin đăng ký!', 'Đóng', {
          duration: 3500,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
      return;
    }
    const { email, name, password } = this.signUpForm.value;
    const cleanEmail = String(email || '').trim().toLowerCase();

    this.apiService.signUp({ email: cleanEmail, name, fullName: name, password }).pipe(
      switchMap((response: any) => {
        return this.lang$.pipe(take(1), map(lang => ({ response, lang })));
      })
    ).subscribe({
      next: ({ response, lang }) => {
        if (!response?.error) {
          this.signUpForm.reset();
          this.snackBar.open('Đăng ký tài khoản thành công!', 'Đóng', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
          this.router.navigate(['/']);
        } else {
          const errMsg = response?.error?.error?.message || response?.error?.message || 'Đăng ký thất bại. Email có thể đã tồn tại!';
          this.snackBar.open(
            Array.isArray(errMsg) ? errMsg.join(', ') : errMsg,
            'Đóng',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom'
            }
          );
        }
      },
      error: (err: any) => {
        const errorMsg = err?.error?.message || err?.message || 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại!';
        this.snackBar.open(
          Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg,
          'Đóng',
          {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          }
        );
      }
    });
  }

  signUpWithGoogle(): void {
    this.snackBar.open('Đang chuyển hướng tới cổng xác thực Google...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
    window.location.href = '/api/auth/google';
  }

  signUpWithFacebook(): void {
    this.snackBar.open('Tính năng đăng ký bằng Facebook đang được kết nối...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}


