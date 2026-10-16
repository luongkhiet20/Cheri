import { take, switchMap, map } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, of, Subscription } from 'rxjs';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';

import { TranslateService } from '../../../../services/translate.service';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { MatInputModule } from '@angular/material/input';
import { NotificationService } from '../../../shared/notification/notification.service';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { accessTokenKey } from '../../../shared/constants';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule],
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
    private notify: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
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
        return;
      }
    }

    const errorParam = this.route.snapshot.queryParams['error'];
    if (errorParam) {
      switch (errorParam) {
        case 'oauth_cancelled':
        case 'access_denied':
          this.notify.info('Bạn đã hủy đăng ký bằng Google.');
          break;
        case 'oauth_window_failed':
          this.notify.error('Không thể mở cửa sổ xác thực Google. Vui lòng thử lại.');
          break;
        case 'oauth_denied':
          this.notify.warning('Xác thực Google chưa hoàn tất. Vui lòng thử lại nếu muốn tiếp tục.');
          break;
        case 'oauth_token_invalid':
          this.notify.error('Phiên xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
          break;
        case 'oauth_identity_failed':
          this.notify.error('Không thể lấy thông tin tài khoản Google. Vui lòng thử lại.');
          break;
        case 'email_taken':
          this.notify.warning('Email này đã được sử dụng. Vui lòng đăng nhập hoặc sử dụng phương thức phù hợp với tài khoản hiện có.');
          break;
        case 'oauth_network_failed':
          this.notify.error('Dịch vụ xác thực đang tạm thời không khả dụng. Vui lòng thử lại sau.');
          break;
        case 'create_failed':
          this.notify.error('Chưa thể tạo tài khoản Chéri. Vui lòng thử lại sau.');
          break;
        case 'oauth_failed':
        default:
          this.notify.error('Không thể xác thực tài khoản Google. Vui lòng thử lại.');
          break;
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

    const status = err?.status || err?.error?.statusCode || 0;
    const rawMsg = err?.error?.message || err?.message || '';
    const msgStr = typeof rawMsg === 'string' ? rawMsg.toLowerCase() : '';

    // Mất kết nối mạng
    if (status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      this.notify.error('Kết nối không ổn định. Vui lòng thử lại.');
      return;
    }

    // Email đã được sử dụng
    const isDuplicate =
      status === 409 ||
      msgStr.includes('đã được đăng ký') ||
      msgStr.includes('đã tồn tại') ||
      msgStr.includes('already exist');

    if (isDuplicate) {
      this.signUpForm.get('email')?.setErrors({ emailTaken: true });
      this.signUpForm.get('email')?.markAsTouched();
      this.cdr.markForCheck();
      this.notify.error('Email không thể sử dụng để đăng ký. Vui lòng thử đăng nhập hoặc khôi phục tài khoản.');
      return;
    }

    // Đăng ký cần xác minh email (nếu có chức năng xác minh)
    if (msgStr.includes('xác minh') || msgStr.includes('verification') || msgStr.includes('verify')) {
      this.notify.info('Vui lòng kiểm tra email để xác minh tài khoản.');
      return;
    }

    // Đăng ký thất bại do lỗi máy chủ hoặc lỗi chung
    this.notify.error('Không thể tạo tài khoản lúc này. Vui lòng thử lại sau.');
  }

  submit() {
    if (this.isSubmitting) {
      this.notify.info('Yêu cầu đang được xử lý. Vui lòng chờ trong giây lát.');
      return;
    }

    const emailCtrl = this.signUpForm.get('email');
    const passCtrl = this.signUpForm.get('password');
    const confirmPassCtrl = this.signUpForm.get('confirmPassword');
    const agreeTermsCtrl = this.signUpForm.get('agreeTerms');

    const emailVal = (emailCtrl?.value || '').trim();
    const passVal = passCtrl?.value || '';
    const confirmPassVal = confirmPassCtrl?.value || '';

    // 1. Bỏ trống trường bắt buộc
    if (!emailVal || !passVal || !confirmPassVal || !agreeTermsCtrl?.value) {
      this.notify.warning('Vui lòng điền đầy đủ thông tin bắt buộc.');
      if (!emailVal) emailCtrl?.markAsTouched();
      if (!passVal) passCtrl?.markAsTouched();
      if (!confirmPassVal) confirmPassCtrl?.markAsTouched();
      return;
    }

    // 2. Email sai định dạng
    const emailRegex = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailVal) || emailCtrl?.errors?.['emailFormatInvalid']) {
      this.notify.warning('Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.');
      emailCtrl?.markAsTouched();
      return;
    }

    // 3. Email đã được sử dụng
    if (emailCtrl?.errors?.['emailTaken']) {
      this.notify.error('Email không thể sử dụng để đăng ký. Vui lòng thử đăng nhập hoặc khôi phục tài khoản.');
      return;
    }

    // 4. Mật khẩu quá ngắn hoặc không đạt quy tắc
    if (passVal.length < 8 || passCtrl?.errors?.['minlength']) {
      this.notify.warning('Mật khẩu chưa đủ điều kiện. Vui lòng kiểm tra yêu cầu mật khẩu.');
      passCtrl?.markAsTouched();
      return;
    }

    // 5. Mật khẩu không đạt yêu cầu bảo mật
    if (passCtrl?.errors?.['weakPassword']) {
      this.notify.warning('Mật khẩu chưa đáp ứng yêu cầu bảo mật. Vui lòng kiểm tra lại.');
      passCtrl?.markAsTouched();
      return;
    }

    // 6. Xác nhận mật khẩu không khớp
    if (passVal !== confirmPassVal || this.signUpForm.errors?.['passwordMismatch']) {
      this.notify.warning('Mật khẩu xác nhận không khớp. Vui lòng nhập lại.');
      confirmPassCtrl?.markAsTouched();
      return;
    }

    // 7. Mất kết nối mạng
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify.error('Kết nối không ổn định. Vui lòng thử lại.');
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
        if (signupRes?.accessToken || signupRes?.token) {
          return of(signupRes);
        }
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

        this.store.storeUser(userToStore);
        this.apiService.currentUser$.next(userToStore);
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
        const targetLang = lang || 'vi';
        this.store.mergeGuestCartIfAny(targetLang);

        this.notify.success('Tạo tài khoản thành công. Chào mừng bạn đến với Chéri!');
        this.router.navigate(['/' + targetLang]);
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.handleRegistrationError(err);
      }
    });
  }

  signUpWithGoogle(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify.error('Kết nối không ổn định. Vui lòng thử lại.');
      return;
    }
    this.notify.info('Đang chuyển hướng tới cổng xác thực Google...');
    try {
      const backendBase = (this.apiService.apiUrl || '').replace(/\/+$/, '');
      window.location.href = `${backendBase}/api/auth/google`;
    } catch {
      this.notify.error('Không thể mở cửa sổ xác thực Google. Vui lòng thử lại.');
    }
  }

  signUpWithFacebook(): void {
    this.notify.info('Tính năng đăng ký bằng Facebook đang được kết nối...');
  }
}


