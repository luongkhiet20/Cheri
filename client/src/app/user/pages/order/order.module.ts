import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';

import { OrderComponent } from './order.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { PriceFormatPipe } from '../../../pipes/price.pipe';

@NgModule({
  declarations: [
    OrderComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    PriceFormatPipe,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule,
    RouterModule.forChild([
      { path: '', component: OrderComponent },
      { path: ':id', component: OrderComponent }
    ]),
  ],
  exports: [
    OrderComponent
  ]
})
export class OrderModule { }
