import { take, switchMap, map } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { TranslateService } from '../../../../services/translate.service';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { accessTokenKey } from '../../../shared/constants';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignUpComponent implements OnInit, OnDestroy {

  signUpForm: FormGroup;
  lang$: Observable<string>;
  lang = 'vi';
  private langSub?: Subscription;

  showRegPassword = false;
  isSubmitting = false;

  constructor(
    private translate: TranslateService,
    private _fb: FormBuilder,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    private snackBar: MatSnackBar,
    private router: Router,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.lang$ = this.translate.getLang$();
    this.lang = this.translate.lang || 'vi';
    this.langSub = this.translate.getLang$().subscribe(lang => {
      this.lang = lang || 'vi';
      this.cdr.markForCheck();
    });

    this.signUpForm = this._fb.group({
      email: ['', [Validators.required, Validators.email, this.emailFormatValidator]],
      name: [''],
      password: ['', [Validators.required, Validators.minLength(8), this.passwordSecurityValidator.bind(this)]],
      confirmPassword: [''],
      agreeTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordsMatchValidator });

    // Khi người dùng sửa ô email, xóa lỗi trùng email trước đó và kiểm tra lại mật khẩu (để tránh trùng username)
    this.signUpForm.get('email')?.valueChanges.subscribe(() => {
      const emailCtrl = this.signUpForm.get('email');
      if (emailCtrl?.hasError('emailTaken')) {
        const errors = { ...emailCtrl.errors };
        delete errors['emailTaken'];
        emailCtrl.setErrors(Object.keys(errors).length ? errors : null);
      }
      this.signUpForm.get('password')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const currentUser = this.selectors.user();
      if (currentUser && (currentUser.email || currentUser.accessToken)) {
        this.router.navigate(['/' + (this.lang || 'vi')]);
      }
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  emailFormatValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const val = String(control.value).trim();
    // Tiêu chuẩn RFC 5322 regex chấp nhận Gmail cá nhân (@gmail.com), Google Workspace trường học (.edu, .edu.vn), doanh nghiệp (.com, .vn, .org,...)
    const emailRegex = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    return emailRegex.test(val) ? null : { emailFormatInvalid: true };
  }

  passwordSecurityValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const password = String(control.value);
    if (password.length < 8) {
      return null; // Đã có Validators.minLength(8) xử lý
    }

    const trimmed = password.trim();
    const lower = trimmed.toLowerCase();

    // Danh sách mật khẩu phổ biến hoặc dễ đoán
    const commonPasswords = new Set([
      '12345678', '123456789', '1234567890', '87654321', '01234567', '98765432',
      'password', 'passwords', 'password1', 'password12', 'password123', 'p@ssword', 'p@ssw0rd',
      'qwerty123', 'qwertyui', 'qwertyuiop', 'asdfghjk', 'zxcvbnm1',
      '11111111', '00000000', '12341234', '11223344',
      'admin123', 'administrator', 'iloveyou', 'iloveyou1', 'cheri123', 'cheri12345',
      'welcome1', 'welcome123', 'monkey123', 'dragon123', 'master123',
      'sunshine', 'princess', 'football', 'abcdefgh'
    ]);

    if (commonPasswords.has(lower)) {
      return {
        weakPassword: true,
        weakPasswordMsg: 'Mật khẩu quá đơn giản hoặc phổ biến (ví dụ: 12345678, password, qwerty123...). Vui lòng chọn mật khẩu khó đoán hơn.'
      };
    }

    // Chuỗi ký tự lặp lại giống hệt nhau (ví dụ: 11111111, aaaaaaaa)
    if (/^(.)\1+$/.test(trimmed)) {
      return {
        weakPassword: true,
        weakPasswordMsg: 'Mật khẩu không được chỉ gồm các ký tự lặp lại giống nhau. Vui lòng chọn mật khẩu đa dạng hơn.'
      };
    }

    // Dãy số liên tiếp tăng dần hoặc giảm dần
    const seqNumbers = '01234567890123456789';
    const revSeqNumbers = '98765432109876543210';
    if (lower.length >= 8 && (seqNumbers.includes(lower) || revSeqNumbers.includes(lower))) {
      return {
        weakPassword: true,
        weakPasswordMsg: 'Mật khẩu là chuỗi số liên tiếp dễ đoán. Vui lòng chọn mật khẩu khó đoán hơn.'
      };
    }

    // Kiểm tra trùng với username của email
    const emailVal = this.signUpForm?.get('email')?.value;
    if (emailVal) {
      const emailPrefix = String(emailVal).split('@')[0].toLowerCase().trim();
      if (emailPrefix.length >= 3 && (lower === emailPrefix || lower === `${emailPrefix}123`)) {
        return {
          weakPassword: true,
          weakPasswordMsg: 'Mật khẩu không nên trùng hoặc quá giống với tên tài khoản email của bạn.'
        };
      }
    }

    return null;
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

    if (!emailCtrl?.value) return 'Vui lòng nhập địa chỉ email';
    if (emailCtrl?.errors?.['emailTaken']) return 'Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.';
    if (emailCtrl?.invalid) return 'Email không đúng định dạng. Vui lòng nhập địa chỉ email hợp lệ (ví dụ: example@gmail.com, student@university.edu.vn)';
    if (passCtrl?.errors?.['required']) return 'Vui lòng nhập mật khẩu';
    if (passCtrl?.errors?.['minlength']) return 'Mật khẩu phải tối thiểu 8 ký tự';
    if (passCtrl?.errors?.['weakPassword']) {
      return passCtrl.errors['weakPasswordMsg'] || 'Mật khẩu quá đơn giản hoặc phổ biến. Vui lòng chọn mật khẩu an toàn hơn.';
    }
    if (this.signUpForm.errors?.['passwordMismatch']) return 'Mật khẩu nhập lại không khớp';
    if (!this.signUpForm.get('agreeTerms')?.value) return 'Vui lòng tích chọn Chấp nhận điều khoản sử dụng và Chính sách bảo mật';
    return '';
  }

  private handleRegistrationError(err: any): void {
    this.isSubmitting = false;
    this.selectors.userState.update((state) => ({ ...state, loading: false }));
    const rawMsg = err?.error?.message || err?.message || '';
    const status = err?.status || err?.error?.statusCode;

    const isDuplicate =
      status === 409 ||
      (typeof rawMsg === 'string' &&
        (rawMsg.includes('đã được đăng ký') ||
          rawMsg.includes('đã tồn tại') ||
          rawMsg.toLowerCase().includes('already exist')));

    if (isDuplicate) {
      this.signUpForm.get('email')?.setErrors({ emailTaken: true });
      this.signUpForm.get('email')?.markAsTouched();
      this.cdr.markForCheck();
      this.snackBar.open('Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.', 'Đóng', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
      return;
    }

    const errorMsg = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : (rawMsg || 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau!');

    this.snackBar.open(errorMsg, 'Đóng', {
      duration: 4500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }

  submit() {
    if (this.isSubmitting) {
      return;
    }
    if (this.signUpForm.invalid) {
      const emailCtrl = this.signUpForm.get('email');
      const passCtrl = this.signUpForm.get('password');

      if (!emailCtrl?.value) {
        this.snackBar.open('Vui lòng nhập địa chỉ email để đăng ký!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (emailCtrl?.errors?.['emailTaken']) {
        this.snackBar.open('Email này đã được đăng ký. Vui lòng sử dụng email khác hoặc đăng nhập.', 'Đóng', {
          duration: 4500,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (emailCtrl?.invalid) {
        this.snackBar.open('Email không đúng định dạng. Vui lòng nhập địa chỉ email hợp lệ (ví dụ: example@gmail.com, student@university.edu.vn)!', 'Đóng', {
          duration: 4500,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (passCtrl?.errors?.['required']) {
        this.snackBar.open('Vui lòng nhập mật khẩu!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (passCtrl?.errors?.['minlength']) {
        this.snackBar.open('Mật khẩu phải có tối thiểu 8 ký tự!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      } else if (passCtrl?.errors?.['weakPassword']) {
        this.snackBar.open(
          passCtrl.errors['weakPasswordMsg'] || 'Mật khẩu quá đơn giản hoặc phổ biến. Vui lòng chọn mật khẩu an toàn hơn!',
          'Đóng',
          {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          }
        );
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
    this.isSubmitting = true;
    const { email, name, password } = this.signUpForm.value;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const resolvedName = (name && String(name).trim()) || cleanEmail.split('@')[0];

    this.selectors.userState.update((state) => ({ ...state, loading: true }));

    this.apiService.signUp({ email: cleanEmail, name: resolvedName, fullName: resolvedName, password }).pipe(
      switchMap((signupRes: any) => {
        if (signupRes?.error) {
          return of({ error: signupRes.error });
        }
        // If signup already returned accessToken from backend
        if (signupRes?.accessToken || signupRes?.token) {
          return of(signupRes);
        }
        // Fallback: If backend didn't return token, sign in directly with credentials
        return this.apiService.signIn({ email: cleanEmail, password });
      }),
      switchMap((authRes: any) => {
        if (authRes?.error) {
          return of({ error: authRes.error });
        }

        const token = authRes?.accessToken || authRes?.token;
        if (token && isPlatformBrowser(this.platformId)) {
          localStorage.setItem(accessTokenKey, token);
        }

        const userToStore = {
          ...authRes,
          name: authRes?.name || resolvedName,
          fullName: authRes?.fullName || resolvedName,
          email: cleanEmail,
        };

        // 1. Update user state in SignalStore (immediately updates computed user$ in Header)
        this.store.storeUser(userToStore);

        // 2. Update ApiService currentUser$ observable
        this.apiService.currentUser$.next(userToStore);

        // 3. Preload user orders
        this.store.getUserOrders();

        return this.lang$.pipe(take(1), map((lang) => ({ user: userToStore, lang })));
      })
    ).subscribe({
      next: ({ user, lang, error }: any) => {
        this.isSubmitting = false;
        if (error) {
          this.handleRegistrationError(error);
          return;
        }

        this.signUpForm.reset();
        // Hợp nhất giỏ hàng khách vãng lai (nếu có) vào tài khoản User và xóa guest cart
        const targetLang = lang || 'vi';
        this.store.mergeGuestCartIfAny(targetLang);

        this.snackBar.open('Đăng ký tài khoản thành công!', 'Đóng', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });

        // 4. Navigate to Home after auth state is established
        this.router.navigate(['/' + targetLang]);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.handleRegistrationError(err);
      }
    });
  }

  signUpWithGoogle(): void {
    this.snackBar.open('Đang chuyển hướng tới cổng xác thực Google...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
    const backendBase = (this.apiService.apiUrl || '').replace(/\/+$/, '');
    window.location.href = `${backendBase}/api/auth/google`;
  }

  signUpWithFacebook(): void {
    this.snackBar.open('Tính năng đăng ký bằng Facebook đang được kết nối...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}


