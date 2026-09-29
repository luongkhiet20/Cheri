import { Component } from '@angular/core';
import { OrderDetailComponent } from '../../../components/order/components/order-detail/order-detail.component';

@Component({
    selector: 'app-order-edit',
    templateUrl: './order-edit.component.html',
    styleUrls: ['./order-edit.component.css'],
    imports: [OrderDetailComponent]
})
export class OrderEditComponent {

  constructor() { }
}
