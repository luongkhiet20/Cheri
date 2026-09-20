import { take, switchMap, map } from 'rxjs/operators';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

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
      email     : ['', [Validators.required, Validators.email]],
      name      : [''],
      password  : ['', [Validators.required, Validators.minLength(6)]],
      agreeTerms: [false, Validators.requiredTrue]
    });
  }

  toggleShowPassword(): void {
    this.showRegPassword = !this.showRegPassword;
  }

  submit() {
    if (this.signUpForm.invalid) {
      return;
    }
    const { email, name, password } = this.signUpForm.value;
    this.apiService.signUp({ email, name, password }).pipe(
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
          this.snackBar.open(
            response?.error?.error?.message || 'Đăng ký thất bại. Email có thể đã tồn tại!',
            'Đóng',
            {
              duration: 4000,
              horizontalPosition: 'center',
              verticalPosition: 'bottom'
            }
          );
        }
      },
      error: () => {
        this.snackBar.open('Có lỗi xảy ra khi đăng ký. Vui lòng thử lại!', 'Đóng', {
          duration: 4000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom'
        });
      }
    });
  }
}
