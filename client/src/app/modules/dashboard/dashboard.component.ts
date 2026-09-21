import { Component, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';

import { TranslateService } from '../../services/translate.service';
import { Product, Order } from '../../shared/models';
import { SignalStore } from '../../store/signal.store';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';

export interface ChartBar {
  label: string;
  value: number;
  height: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  standalone: false
})
export class DashboardComponent {

  chartPeriod = 'week';

  lang$: Observable<string>;
  currency$: Signal<string>;
  allProducts$: Signal<Product[]>;
  orders$: Signal<Order[]>;

  constructor(
    private translate: TranslateService,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private router: Router
  ) {
    this.lang$ = this.translate.getLang$();
    this.currency$ = this.selectors.currency;
    this.allProducts$ = this.selectors.allProducts;
    this.orders$ = this.selectors.orders;
  }

  get recentOrders(): Order[] {
    return (this.orders$() ?? []).slice(0, 6);
  }

  get chartBars(): ChartBar[] {
    const days = this.chartPeriod === 'week'
      ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
      : ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const values = days.map(() => Math.floor(Math.random() * 80 + 20));
    const max = Math.max(...values);
    return days.map((label, i) => ({
      label,
      value: values[i],
      height: Math.round((values[i] / max) * 100)
    }));
  }

  getTotalRevenue(): number {
    return (this.orders$() ?? [])
      .filter(o => o.status === 'PAID' || o.status === 'COMPLETED')
      .reduce((sum, o) => sum + (o.amount ?? 0), 0);
  }

  getInStockCount(): number {
    return (this.allProducts$() ?? [])
      .filter(p => p.stock === 'inStock' || p.stock === 'in').length;
  }

  goToSection(key: string): void {
    const lang = this.translate.lang || 'vi';
    this.router.navigate([`/${lang}/dashboard/${key}`]);
  }
}
