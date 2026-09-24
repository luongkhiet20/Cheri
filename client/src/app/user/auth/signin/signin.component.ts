import { toObservable } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, OnInit, Signal, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';

import { TranslateService } from '../../../services/translate.service';
import { User } from '../../../shared/models';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { Router, RouterLink } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { ApiService } from '../../../services/api.service';
import { accessTokenKey } from '../../../shared/constants';
import { checkIsAdmin } from '../../../services/auth.guard';

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

  constructor(
    private translate: TranslateService,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private router: Router
  ) {
    this.lang$ = this.translate.getLang$();
    this.loading$ = toObservable(this.selectors.authLoading);
    this.user$ = this.selectors.user;

    this.signInForm = this.fb.group({
      email     : ['', [Validators.required, Validators.email]],
      password  : ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const currentUser = this.selectors.user();
    if (checkIsAdmin(currentUser)) {
      this.router.navigate(['/admin']);
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
    this.selectors.userState.update((state) => ({ ...state, loading: true }));

    this.apiService.signIn(credentials).pipe(
      switchMap((response: any) => {
        if (response && response.accessToken) {
          localStorage.setItem(accessTokenKey, response.accessToken);
        }
        this.selectors.userState.update((state) => ({ ...state, user: response, loading: false }));
        return this.lang$.pipe(take(1), map(lang => ({ user: response, lang })));
      })
    ).subscribe({
      next: ({ user, lang }) => {
        if (user && !user.error && (user.accessToken || user.email)) {
          this.signInForm.reset();
          if (checkIsAdmin(user)) {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/' + lang]);
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

