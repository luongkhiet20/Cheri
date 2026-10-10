import { take, switchMap, map } from 'rxjs/operators';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
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
export class SignUpComponent implements OnDestroy {

  signUpForm: FormGroup;
  lang$: Observable<string>;
  lang = 'vi';
  private langSub?: Subscription;

  showRegPassword = false;

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
      email: ['', [Validators.required, Validators.email, this.gmailValidator]],
      name: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: [''],
      agreeTerms: [false, Validators.requiredTrue]
    }, { validators: this.passwordsMatchValidator });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
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
        if (error) {
          this.selectors.userState.update((state) => ({ ...state, loading: false }));
          const errMsg = error?.error?.message || error?.message || 'Đăng ký thất bại. Email có thể đã tồn tại!';
          this.snackBar.open(
            Array.isArray(errMsg) ? errMsg.join(', ') : errMsg,
            'Đóng',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom'
            }
          );
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
        this.selectors.userState.update((state) => ({ ...state, loading: false }));
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


