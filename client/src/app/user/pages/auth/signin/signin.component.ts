import { toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, OnInit, Signal, signal } from '@angular/core';
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
import { SignalStore } from '../../../../store/signal.store';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { ApiService } from '../../../../services/api.service';
import { accessTokenKey } from '../../../shared/constants';
import { checkIsAdmin } from '../../../../services/auth.guard';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrls: ['./signin.component.css'],
  imports: [CommonModule, TranslatePipe, RouterLink, MatInputModule, FormsModule, ReactiveFormsModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignInComponent implements OnInit {
  signInForm: FormGroup;
  lang$: Observable<string>;
  loading$: Observable<boolean>;
  sendRequest$ = signal(false);
  user$: Signal<User>;

  isForgotPassword = false;
  showLoginPassword = false;
  forgotEmail = '';

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
    private route: ActivatedRoute
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
        // Đã là Admin hợp lệ -> chuyển thẳng vào trang quản trị
        const target = this.isRequestingAdmin ? returnUrl : '/admin';
        this.router.navigateByUrl(target);
      } else if (!this.isRequestingAdmin) {
        // Là User thường và KHÔNG yêu cầu đăng nhập Admin -> chuyển về trang chủ /
        this.router.navigateByUrl(returnUrl || '/');
      }
      // NẾU LÀ USER THƯỜNG NHƯNG ĐANG YÊU CẦU ĐĂNG NHẬP ADMIN (this.isRequestingAdmin === true):
      // -> KHÔNG điều hướng đi đâu cả, giữ nguyên form đăng nhập để User nhập tài khoản Admin!
    }
  }

  togglePasswordVisibility(): void {
    this.showLoginPassword = !this.showLoginPassword;
  }

  setIsForgotPassword(val: boolean): void {
    this.isForgotPassword = val;
  }

  onForgotSubmit(): void {
    if (this.forgotEmail) {
      this.snackBar.open(`Đã gửi link đặt lại mật khẩu tới ${this.forgotEmail}`, 'Đóng', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
      this.isForgotPassword = false;
      this.forgotEmail = '';
    }
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

        // Nếu đang ở luồng đăng nhập Admin nhưng tài khoản nhập vào KHÔNG phải Admin:
        // Không lưu token này đè vào phiên quản trị!
        if (isRequestingAdmin && !isAdmin) {
          this.selectors.userState.update((state) => ({ ...state, loading: false }));
          return of({ user: response, isDeniedAdmin: true });
        }

        // Đăng nhập hợp lệ (Admin thành công hoặc đăng nhập User thông thường):
        if (response && response.accessToken) {
          localStorage.setItem(accessTokenKey, response.accessToken);
        }
        this.selectors.userState.update((state) => ({ ...state, user: response, loading: false }));
        // Lập tức gọi getUser() để đồng bộ toàn bộ state người dùng
        this.store.getUser();
        return this.lang$.pipe(take(1), map(lang => ({ user: response, lang, isDeniedAdmin: false })));
      })
    ).subscribe({
      next: ({ user, lang, isDeniedAdmin }: any) => {
        if (isDeniedAdmin) {
          // Từ chối quyền quản trị, giữ nguyên ở form đăng nhập để thử lại
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
          // Hợp nhất giỏ hàng khách vãng lai (nếu có) vào tài khoản User và xóa guest cart
          this.store.mergeGuestCartIfAny(lang || 'vi');

          const isAdmin = checkIsAdmin(user);

          if (isRequestingAdmin) {
            // Admin đăng nhập thành công: chuyển tới trang quản trị
            const target = returnUrl || '/admin';
            this.router.navigateByUrl(target);
          } else {
            // Khách hàng thông thường: không chuyển đến /admin kể cả khi URL có query returnUrl quản trị
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
    // Gọi endpoint Google OAuth của Backend
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

