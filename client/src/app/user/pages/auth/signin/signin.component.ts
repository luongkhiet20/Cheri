import { toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectorRef, Component, OnInit, Signal, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';

import { TranslateService } from '../../../../services/translate.service';
import { User } from '../../../shared/models';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
  imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule, MatSnackBarModule]
})
export class SignInComponent implements OnInit {
  signInForm: FormGroup;
  lang$: Observable<string>;
  loading$: Observable<boolean>;
  sendRequest$ = signal(false);
  user$: Signal<User>;

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

  get isAdminUser(): boolean {
    return checkIsAdmin(this.currentLoggedUser);
  }

  constructor(
    private translate: TranslateService,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
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
  }

  ngOnInit(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    this.isRequestingAdmin = Boolean(returnUrl && returnUrl.startsWith('/admin'));
    this.currentLoggedUser = this.selectors.user();

    if (this.currentLoggedUser && (this.currentLoggedUser.email || this.currentLoggedUser.accessToken)) {
      if (checkIsAdmin(this.currentLoggedUser)) {
        const target = this.isRequestingAdmin ? returnUrl : '/admin';
        this.router.navigateByUrl(target);
      } else if (!this.isRequestingAdmin) {
        this.router.navigateByUrl(returnUrl || '/');
      }
    }
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
        this.snackBar.open(response.message, 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
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
      this.snackBar.open('Mật khẩu xác nhận không khớp.', 'Đóng', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
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
          this.snackBar.open(response.message, 'Đóng', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
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
    this.snackBar.open(message, 'Đóng', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  submit() {
    if (this.signInForm.invalid) {
      return;
    }
    const credentials = this.signInForm.value;
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
        if (isDeniedAdmin) {
          this.snackBar.open('Tài khoản này không có quyền Quản trị viên (Admin). Vui lòng đăng nhập bằng tài khoản Admin!', 'Đóng', {
            duration: 5000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
          this.signInForm.get('password')?.reset();
          return;
        }

        if (user && !user.error && (user.accessToken || user.email)) {
          this.signInForm.reset();
          this.store.mergeGuestCartIfAny(lang || 'vi');

          const isAdmin = checkIsAdmin(user);

          if (isRequestingAdmin) {
            const target = returnUrl || '/admin';
            this.router.navigateByUrl(target);
          } else {
            if (isAdmin) {
              this.router.navigateByUrl('/admin');
            } else {
              const target = (returnUrl && !returnUrl.startsWith('/admin')) ? returnUrl : '/';
              this.router.navigateByUrl(target);
            }
          }
        } else {
          this.snackBar.open('Đăng nhập thất bại. Vui lòng kiểm tra lại email hoặc mật khẩu!', 'Đóng', {
            duration: 4000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
        }
      },
      error: () => {
        this.selectors.userState.update((state) => ({ ...state, loading: false }));
        this.snackBar.open('Đăng nhập thất bại. Vui lòng thử lại sau!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
    });
  }

  signInWithGoogle(): void {
    this.snackBar.open('Đang kết nối cổng đăng nhập Google...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
    window.location.href = '/api/auth/google';
  }

  signInWithFacebook(): void {
    this.snackBar.open('Đang kết nối cổng đăng nhập Facebook...', 'Đóng', {
      duration: 3500,
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
  }
}