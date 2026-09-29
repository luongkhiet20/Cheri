declare const Stripe: any;

import { Component, Input, EventEmitter, PLATFORM_ID, ViewChild, ElementRef, OnInit, Output, inject } from '@angular/core';
import { isPlatformServer, DOCUMENT, AsyncPipe } from '@angular/common';
import { take } from 'rxjs/operators';
import { BehaviorSubject } from 'rxjs';

import { EnvConfigurationService } from '../../../services/env-configuration.service';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { TranslatePipe } from '../../../pipes/translate.pipe';


@Component({
    selector: 'app-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.css'],
    imports: [ReactiveFormsModule, FormsModule, MatButton, MatProgressBar, AsyncPipe, TranslatePipe]
})

export class CardComponent implements OnInit {
  private envConfigurationService = inject(EnvConfigurationService);
  private _document = inject<Document>(DOCUMENT);
  private _platformId = inject<Object>(PLATFORM_ID);


  @Input() price: number;
  @Input() currency: string;
  @Input() loading: boolean;

  @Output() scrollToTop = new EventEmitter();
  @Output() payWithCardEmit = new EventEmitter();
  @ViewChild('cardElement') cardElement: ElementRef;

  stripe; // : stripe.Stripe;
  card;
  cardErrorSub$ = new BehaviorSubject('INVALID');
  loadingPayment = false;

  ngOnInit() {
    if (!isPlatformServer(this._platformId) && typeof Stripe !== 'object') {
      const parentElement: HTMLElement = this._document.querySelector('head') as HTMLElement;
      const scriptEl: any = this._document.createElement('script') as HTMLElement;
      scriptEl.setAttribute('type', 'text/javascript');
      scriptEl.setAttribute('src', 'https://js.stripe.com/v3/');
      parentElement.appendChild(scriptEl);
      scriptEl.onload = (event: Event) => {
        this._setHandler();
      }
    } else if (typeof Stripe === 'object') {
      this._setHandler();
    }
  }

  async handleForm(e) {
    e.preventDefault();
    this.loadingPayment = true;

    this.stripe.createToken(this.card).then((result) => {
      if (result.error) {
        this.cardErrorSub$.next(result.error.message);
        this.loadingPayment = false;
      } else {
        this.cardErrorSub$.next('');
        this.stripeTokenHandler(result.token);
        this.scrollToTop.emit();
        this.loadingPayment = false;
      }
    });
  }


  private stripeTokenHandler(token) {
    const payment = { token: token, amount: this.price, currency: this.currency };
    this.payWithCardEmit.emit(payment);
  }

  private _setHandler() {
    this.envConfigurationService.getConfigType$('FE_STRIPE_PUBLISHABLE_KEY').pipe(take(1))
      .subscribe(stripePublishableKey => {
        this.stripe = Stripe(stripePublishableKey);
        const elements = this.stripe.elements();

        this.card = elements.create('card');
        this.card.mount(this.cardElement.nativeElement);

        this.card.addEventListener('change', ({ error, complete }) => {
          const cardError = error && error.message ? error.message : (complete ? '' : 'INVALID');
          this.cardErrorSub$.next(cardError);
        });
      })
  }


}
