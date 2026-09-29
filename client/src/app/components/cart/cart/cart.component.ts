import { toObservable } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { map, filter, take, withLatestFrom } from 'rxjs/operators';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Location, AsyncPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';

import { TranslateService } from '../../../services/translate.service';
import { Cart, User, Order } from '../../../shared/models';
import { SignalStore } from '../../../store/signal.store';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { ApiService } from '../../../services/api.service';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatStepper, MatStep, MatStepLabel, MatStepperNext, MatStepperPrevious } from '@angular/material/stepper';
import { MatFormField, MatLabel } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { MatIcon } from '@angular/material/icon';
import { CardComponent } from '../card/card.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PriceFormatPipe } from '../../../pipes/price.pipe';

@Component({
    selector: 'app-cart',
    templateUrl: './cart.component.html',
    styleUrls: ['./cart.component.css'],
    imports: [MatProgressBar, RouterLink, MatStepper, MatStep, ReactiveFormsModule, MatStepLabel, MatFormField, MatLabel, MatInput, MatButton, MatStepperNext, MatRadioGroup, FormsModule, MatRadioButton, MatIcon, MatStepperPrevious, CardComponent, AsyncPipe, DecimalPipe, TranslatePipe, PriceFormatPipe]
})
export class CartComponent {
  private store = inject(SignalStore);
  private selectors = inject(SignalStoreSelectors);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private location = inject(Location);
  private translate = inject(TranslateService);
  private api = inject(ApiService);

  cart$       : Observable<Cart>;
  lang$       : Observable<string>;
  order$      : Observable<Order>;
  user$       : Observable<User>;
  orderForm   : FormGroup;
  currency$   : Observable<string>;
  toggleCard = false;
  productUrl  : string;
  loading$    : Observable<boolean>;
  error$      : Observable<string>;

  // Phương thức thanh toán & vận chuyển từ DB
  activePaymentMethods = signal<any[]>([]);
  activeShippingMethods = signal<any[]>([]);
  selectedPaymentId = signal<string | null>(null);
  selectedShippingId = signal<string | null>(null);
  loadingMethods = signal(false);

  readonly component = 'cartComponent';

  constructor() {
    this.store.cleanError();
    this.lang$ = this.translate.getLang$();
    this.cart$ = toObservable(this.selectors.cart);
    this.order$ = toObservable(this.selectors.order).pipe(filter(order => !!order));
    this.user$ = toObservable(this.selectors.user);

    this.orderForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      country: ['', Validators.required],
      zip: ['', Validators.required],
      notes: ['']
    });

    this.currency$ = toObservable(this.selectors.currency);

    this.order$.pipe(
      filter(order => !!order),
      withLatestFrom(this.lang$),
      take(1))
      .subscribe(([order, lang]) => {
        this.router.navigate(['/' + lang + '/cart/summary'])
      });

    // Load các phương thức đang bật từ DB
    this.loadActiveMethods();
  }

  loadActiveMethods(): void {
    this.loadingMethods.set(true);
    this.api.getActivePaymentMethods().subscribe({
      next: (data: any) => {
        this.activePaymentMethods.set(Array.isArray(data) ? data : []);
        // Tự chọn phương thức đầu tiên
        if (this.activePaymentMethods().length > 0) {
          this.selectedPaymentId.set(this.activePaymentMethods()[0]._id);
        }
        this.loadingMethods.set(false);
      },
      error: () => this.loadingMethods.set(false),
    });
    this.api.getActiveShippingMethods().subscribe({
      next: (data: any) => {
        this.activeShippingMethods.set(Array.isArray(data) ? data : []);
        if (this.activeShippingMethods().length > 0) {
          this.selectedShippingId.set(this.activeShippingMethods()[0]._id);
        }
      },
    });
  }

  getPaymentTypeIcon(type: string): string {
    return { CASH: 'local_atm', E_WALLET: 'account_balance_wallet', GATEWAY: 'credit_card' }[type] || 'payment';
  }

  getSelectedPayment(): any {
    return this.activePaymentMethods().find(p => p._id === this.selectedPaymentId());
  }

  getSelectedShipping(): any {
    return this.activeShippingMethods().find(s => s._id === this.selectedShippingId());
  }

  goBack(): void {
    this.location.back();
  }

  removeFromCart(id: string): void {
    this.lang$.pipe(take(1)).subscribe(lang => {
      this.store.removeFromCart('?id=' + id + '&lang=' + lang);
    });
  }

  payWithCard(payment): void {
    this.user$.pipe(take(1)).subscribe((user: User) => {
      const userToOrder = user ? { userId: user.id } : {};
      const addresses = [{
        name        : this.orderForm.value.name,
        city        : this.orderForm.value.city,
        country     : this.orderForm.value.country,
        line1       : this.orderForm.value.address,
        line2       : '',
        zip         : this.orderForm.value.zip,
      }]
      const shipping = this.getSelectedShipping();
      const selectedPayment = this.getSelectedPayment();
      const paymentRequest = {
        ...payment,
        ...this.orderForm.value,
        ...userToOrder,
        addresses,
        shippingMethod: shipping ? { id: shipping._id, name: shipping.name, code: shipping.code, cost: shipping.baseCost } : undefined,
        paymentMethod: selectedPayment ? { id: selectedPayment._id, name: selectedPayment.name, code: selectedPayment.code } : undefined,
      };
      this.store.makeOrderWithPayment(paymentRequest);
    })
  }

  scrollToTop(): void {
    this.store.updatePosition({cartComponent: 0});
  }

  submit(currency: string): void {
    this.user$.pipe(take(1)).subscribe((user: User) => {
      const userToOrder = user ? { userId: user.id } : {};
      const addresses = [{
        name        : this.orderForm.value.name,
        city        : this.orderForm.value.city,
        country     : this.orderForm.value.country,
        line1       : this.orderForm.value.address,
        line2       : '',
        zip         : this.orderForm.value.zip,
      }];

      const shipping = this.getSelectedShipping();
      const selectedPayment = this.getSelectedPayment();
      const orderRequest = {
        ...this.orderForm.value,
        ...userToOrder,
        currency,
        addresses,
        shippingMethod: shipping ? { id: shipping._id, name: shipping.name, code: shipping.code, cost: shipping.baseCost } : undefined,
        paymentMethod: selectedPayment ? { id: selectedPayment._id, name: selectedPayment.name, code: selectedPayment.code } : undefined,
      };
      this.store.makeOrder(orderRequest);
      this.toggleCard = false;
      this.scrollToTop();
    })

  }
}
