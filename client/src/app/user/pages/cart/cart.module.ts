import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatStepperModule } from '@angular/material/stepper';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { CartComponent } from './cart/cart.component';
import { CardComponent } from './card/card.component';
import { SummaryComponent } from './summary/summary.component';
import { CartVariantPopupComponent } from './cart-variant-popup/cart-variant-popup.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PriceFormatPipe } from '../../../pipes/price.pipe';
import { OrderInfoComponent } from '../../shared/order-info/order-info.component';

@NgModule({
  declarations: [
    CartComponent,
    CardComponent,
    SummaryComponent,
    CartVariantPopupComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    PriceFormatPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    MatRadioModule,
    MatStepperModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    OrderInfoComponent,
    RouterModule.forChild([
      { path: '', component: CartComponent },
      { path: 'summary', component: SummaryComponent }
    ]),
  ],
  providers: []
})
export class CartModule { }
