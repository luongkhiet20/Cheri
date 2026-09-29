import { Component, Input } from '@angular/core';

import { Order } from '../../../../shared/models';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { AsyncPipe, DatePipe } from '@angular/common';
import { TranslatePipe } from '../../../../pipes/translate.pipe';
import { PriceFormatPipe } from '../../../../pipes/price.pipe';

@Component({
    selector: 'app-orders-list',
    templateUrl: './orders-list.component.html',
    styleUrls: ['./orders-list.component.css'],
    imports: [MatProgressBar, MatButton, RouterLink, AsyncPipe, DatePipe, TranslatePipe, PriceFormatPipe]
})
export class OrdersListComponent {

  @Input() orders: Order[];
  @Input() orderUrl: string;

  constructor() {
  }

}
