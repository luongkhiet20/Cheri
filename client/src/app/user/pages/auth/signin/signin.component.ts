import { toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, Component, Injector, OnDestroy, OnInit, Signal, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subscription, of } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';

import { TranslateService } from '../../../../services/translate.service';
import { User } from '../../../shared/models';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { NotificationService } from '../../../shared/notification/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { accessTokenKey } from '../../../shared/constants';
import { checkIsAdmin } from '../../../../services/auth.guard';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule]
})
export class SignInComponent implements OnInit, OnDestroy {
  signInForm: FormGroup;
  lang$: Observable<string>;
  loading$: Observable<boolean>;
  sendRequest$ = signal(false);
  user$: Signal<User>;
  private userSub?: Subscription;

  isForgotPassword = false;
  forgotStep: 'request' | 'verify' | 'reset' = 'request';
  showLoginPassword = false;
  forgotEmail = '';
  forgotOtp = '';
  newPassword = '';
  confirmNewPassword = '';
  resetToken = '';
  isPasswordResetBusy = false;

  isRequestingAdmin = false;
  currentLoggedUser: any = null;
  isSubmitting = false;

  get isAdminUser(): boolean {
    return checkIsAdmin(this.currentLoggedUser);
  }

  constructor(
    private translate: TranslateService,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    private fb: FormBuilder,
    private notify: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {
    this.lang$ = this.translate.getLang$();
    this.loading$ = toObservable(this.selectors.authLoading);
    this.user$ = this.selectors.user;

    this.signInForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      agreeTerms: [false]
    });

    this.userSub = toObservable(this.selectors.user).subscribe((user) => {
      const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem(accessTokenKey));
      if (hasToken && user && (user.email || user.accessToken)) {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'];
        if (this.isRequestingAdmin) {
          if (checkIsAdmin(user)) {
            this.router.navigateByUrl(returnUrl || '/admin');
          }
        } else {
          const defaultHome = '/' + (this.translate.lang || 'vi');
          const target = this.getSafeReturnUrl(returnUrl, defaultHome);
          this.router.navigateByUrl(target);
        }
      }
    });
  }

  ngOnInit(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    const sessionParam = this.route.snapshot.queryParams['session'];
    const errorParam = this.route.snapshot.queryParams['error'];

    if (sessionParam === 'expired') {
      this.notify.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (errorParam) {
      switch (errorParam) {
        case 'oauth_cancelled':
        case 'access_denied':
          this.notify.info('Bạn đã hủy đăng nhập bằng Google.');
          break;
        case 'oauth_window_failed':
          this.notify.error('Không thể mở cửa sổ xác thực Google. Vui lòng thử lại.');
          break;
        case 'oauth_denied':
          this.notify.warning('Xác thực Google chưa hoàn tất. Vui lòng thử lại.');
          break;
        case 'oauth_token_invalid':
          this.notify.error('Phiên xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
          break;
        case 'oauth_identity_failed':
          this.notify.error('Không thể xác minh tài khoản Google. Vui lòng thử lại.');
          break;
        case 'account_locked':
          this.notify.error('Không thể đăng nhập vào tài khoản này. Vui lòng liên hệ bộ phận hỗ trợ.');
          break;
        case 'no_account':
          this.notify.info('Bạn chưa có tài khoản Chéri. Vui lòng đăng ký trước khi đăng nhập.');
          break;
        case 'oauth_network_failed':
          this.notify.error('Dịch vụ xác thực đang tạm thời không khả dụng. Vui lòng thử lại sau.');
          break;
        case 'oauth_failed':
        default:
          this.notify.error('Đăng nhập chưa thành công. Vui lòng thử lại sau.');
          break;
      }
    }

    this.isRequestingAdmin = Boolean(returnUrl && returnUrl.startsWith('/admin'));
    const hasLocalToken = typeof window !== 'undefined' && Boolean(localStorage.getItem(accessTokenKey));

    if (sessionParam === 'expired' || !hasLocalToken) {
      this.currentLoggedUser = null;
      if (this.selectors.user()) {
        this.store.storeUser(null);
      }
    } else {
      this.currentLoggedUser = this.selectors.user();
    }

    if (hasLocalToken && this.currentLoggedUser && (this.currentLoggedUser.email || this.currentLoggedUser.accessToken)) {
      if (this.isRequestingAdmin) {
        if (checkIsAdmin(this.currentLoggedUser)) {
          this.router.navigateByUrl(returnUrl || '/admin');
        }
      } else {
        const defaultHome = '/' + (this.translate.lang || 'vi');
        const target = this.getSafeReturnUrl(returnUrl, defaultHome);
        this.router.navigateByUrl(target);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  private getSafeReturnUrl(url: string | null | undefined, fallback: string): string {
    if (!url || typeof url !== 'string') {
      return fallback;
    }
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('/') || cleanUrl.startsWith('//')) {
      return fallback;
    }
    const lower = cleanUrl.toLowerCase();
    if (
      lower.includes('/authorize') ||
      lower.includes('/signin') ||
      lower.includes('/signup') ||
      lower.includes('/login') ||
      lower.includes('/register') ||
      lower.includes('/jwttoken') ||
      lower.startsWith('/admin')
    ) {
      return fallback;
    }
    return cleanUrl;
  }

  togglePasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  setIsForgotPassword(val: boolean): void {
    this.isForgotPassword = val;
    if (val) {
      this.forgotStep = 'request';
      this.forgotEmail = this.signInForm.get('email')?.value || '';
      this.forgotOtp = '';
      this.newPassword = '';
      this.confirmNewPassword = '';
      this.resetToken = '';
    }
  }

  onForgotSubmit(): void {
    const email = this.forgotEmail.trim();
    if (this.isPasswordResetBusy || !email) {
      return;
    }

    this.isPasswordResetBusy = true;
    this.apiService.requestPasswordReset(email).subscribe({
      next: (response) => {
        this.isPasswordResetBusy = false;
        this.forgotEmail = email;
        this.forgotStep = 'verify';
        this.cdr.detectChanges();
        this.notify.success(`✨${response.message || 'Đã gửi mã xác minh đặt lại mật khẩu'}✨`);
      },
      error: (error: unknown) => {
        this.isPasswordResetBusy = false;
        this.cdr.detectChanges();
        this.showPasswordResetError(
          error,
          'Không thể gửi mã xác minh. Vui lòng thử lại sau.',
        );
      },
    });
  }

  onVerifyResetOtp(): void {
    if (this.isPasswordResetBusy || !/^\d{6}$/.test(this.forgotOtp)) {
      return;
    }

    this.isPasswordResetBusy = true;
    this.apiService
      .verifyPasswordResetOtp(this.forgotEmail, this.forgotOtp)
      .subscribe({
        next: (response) => {
          this.isPasswordResetBusy = false;
          this.resetToken = response.resetToken;
          this.forgotStep = 'reset';
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.isPasswordResetBusy = false;
          this.cdr.detectChanges();
          this.showPasswordResetError(
            error,
            'Mã xác minh không hợp lệ hoặc đã hết hạn.',
          );
        },
      });
  }

  onResetPassword(): void {
    if (this.isPasswordResetBusy || this.newPassword.length < 8) {
      return;
    }

    if (this.newPassword !== this.confirmNewPassword) {
      this.notify.warning('✨Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại✨');
      return;
    }

    this.isPasswordResetBusy = true;
    this.apiService
      .resetPassword(this.forgotEmail, this.resetToken, this.newPassword)
      .subscribe({
        next: (response) => {
          this.isPasswordResetBusy = false;
          this.signInForm.patchValue({ email: this.forgotEmail });
          this.isForgotPassword = false;
          this.forgotStep = 'request';
          this.forgotOtp = '';
          this.newPassword = '';
          this.confirmNewPassword = '';
          this.resetToken = '';
          this.cdr.detectChanges();
          this.notify.success(`✨${response.message || 'Đặt lại mật khẩu thành công'}✨`);
        },
        error: (error: unknown) => {
          this.isPasswordResetBusy = false;
          this.cdr.detectChanges();
          this.showPasswordResetError(
            error,
            'Không thể đặt lại mật khẩu. Vui lòng thử lại.',
          );
        },
      });
  }

  private showPasswordResetError(error: unknown, fallback: string): void {
    const message =
      error instanceof HttpErrorResponse &&
        typeof error.error?.message === 'string'
        ? error.error.message
        : fallback;
    this.notify.error(`✨${message}✨`);
  }

  submit() {
    if (this.isSubmitting) {
      this.notify.info('Yêu cầu đang được xử lý. Vui lòng chờ trong giây lát.');
      return;
    }

    const emailCtrl = this.signInForm.get('email');
    const passCtrl = this.signInForm.get('password');
    const emailVal = (emailCtrl?.value || '').trim();
    const passVal = passCtrl?.value || '';

    // 1. Bỏ trống email
    if (!emailVal) {
      this.notify.warning('Vui lòng nhập địa chỉ email.');
      emailCtrl?.markAsTouched();
      return;
    }

    // 2. Email sai định dạng
    const emailRegex = /^[a-zA-Z0-9]+([._%+-][a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-][a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(emailVal) || emailCtrl?.invalid) {
      this.notify.warning('Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.');
      emailCtrl?.markAsTouched();
      return;
    }

    // 3. Bỏ trống mật khẩu
    if (!passVal) {
      this.notify.warning('Vui lòng nhập mật khẩu.');
      passCtrl?.markAsTouched();
      return;
    }

    // 4. Mất kết nối mạng
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify.error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      return;
    }

    this.isSubmitting = true;
    const credentials = {
      ...this.signInForm.value,
      email: emailVal
    };
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    const isRequestingAdmin = Boolean(returnUrl && returnUrl.startsWith('/admin'));

    this.selectors.userState.update((state) => ({ ...state, loading: true }));

    this.apiService.signIn(credentials).pipe(
      switchMap((response: any) => {
        const isAdmin = checkIsAdmin(response);

        if (isRequestingAdmin && !isAdmin) {
          this.selectors.userState.update((state) => ({ ...state, loading: false }));
          return of({ user: response, isDeniedAdmin: true });
        }

        if (response && response.accessToken) {
          localStorage.setItem(accessTokenKey, response.accessToken);
        }
        this.selectors.userState.update((state) => ({ ...state, user: response, loading: false }));
        this.store.getUser();
        return this.lang$.pipe(take(1), map(lang => ({ user: response, lang, isDeniedAdmin: false })));
      })
    ).subscribe({
      next: ({ user, lang, isDeniedAdmin }: any) => {
        this.isSubmitting = false;
        if (isDeniedAdmin) {
          this.notify.error('Tài khoản này không có quyền Quản trị viên (Admin).');
          this.signInForm.get('password')?.reset();
          return;
        }

        if (user && !user.error && (user.accessToken || user.email)) {
          this.signInForm.reset();
          this.store.mergeGuestCartIfAny(lang || 'vi');
          this.notify.success('Chào mừng bạn đến với Chéri!');

          if (isRequestingAdmin) {
            const target = returnUrl || '/admin';
            this.router.navigateByUrl(target);
          } else {
            const defaultHome = '/' + (lang || 'vi');
            const target = this.getSafeReturnUrl(returnUrl, defaultHome);
            this.router.navigateByUrl(target);
          }
        } else {
          this.notify.error('Email hoặc mật khẩu không chính xác. Vui lòng thử lại.');
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.selectors.userState.update((state) => ({ ...state, loading: false }));

        const status = err?.status || 0;
        const rawMsg = String(err?.error?.message || err?.message || '').toLowerCase();

        // Mất kết nối mạng
        if (status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          this.notify.error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
          return;
        }

        // Đăng nhập quá nhiều lần, bị giới hạn (429 Rate limit)
        if (status === 429 || rawMsg.includes('quá nhiều lần') || rawMsg.includes('too many')) {
          this.notify.warning('Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.');
          return;
        }

        // Máy chủ gặp sự cố
        if (status >= 500) {
          this.notify.error('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
          return;
        }

        // Tài khoản bị khóa hoặc vô hiệu hóa
        if (rawMsg.includes('bị khóa') || rawMsg.includes('ngừng hoạt động') || rawMsg.includes('disabled') || rawMsg.includes('blocked')) {
          this.notify.error('Không thể đăng nhập. Vui lòng liên hệ bộ phận hỗ trợ.');
          return;
        }

        // Tài khoản chưa xác minh email (nếu có)
        if (rawMsg.includes('xác minh email') || rawMsg.includes('verify email') || rawMsg.includes('chưa xác minh')) {
          this.notify.warning('Vui lòng xác minh email trước khi đăng nhập.');
          return;
        }

        // Mặc định lỗi đăng nhập: Không tiết lộ email có tồn tại hay không theo OWASP
        this.notify.error('Email hoặc mật khẩu không chính xác. Vui lòng thử lại.');
      }
    });
  }

  signInWithGoogle(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.notify.error('Không thể kết nối đến máy chủ. Vui lòng thử lại.');
      return;
    }
    this.notify.info('Đang kết nối cổng đăng nhập Google...');
    try {
      const backendBase = (this.apiService.apiUrl || '').replace(/\/+$/, '');
      window.location.href = `${backendBase}/api/auth/google`;
    } catch {
      this.notify.error('Không thể mở cửa sổ xác thực Google. Vui lòng thử lại.');
    }
  }

  signInWithFacebook(): void {
    this.notify.info('Tính năng đăng nhập Facebook đang được kết nối...');
  }
}