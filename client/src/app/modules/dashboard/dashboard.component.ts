import { Component, OnDestroy, Signal, AfterViewInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';

import { TranslateService } from '../../services/translate.service';
import { Product, Order } from '../../shared/models';
import { SignalStore } from '../../store/signal.store';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';
import { toObservable } from '@angular/core/rxjs-interop';
import { accessTokenKey } from '../../shared/constants';
import { NavItem, DEFAULT_NAV_ITEMS } from '../admin-card';

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
export class DashboardComponent implements AfterViewInit, OnDestroy {

  readonly component = 'dashboard';

  // ── State ──
  sidebarCollapsed = false;
  activeSection = 'overview';
  chartPeriod = 'week';
  searchQuery = '';
  productAction = '';
  productToEditTitleUrl: string;

  // ── Signals / Observables ──
  lang$: Observable<string>;
  currency$: Signal<string>;
  allProducts$: Signal<Product[]>;
  orders$: Signal<Order[]>;
  allProductsTitles$: Observable<string[]>;

  // ── Nav items from shared admin models ──
  navItems: NavItem[] = DEFAULT_NAV_ITEMS;

  // ── Derived data ──
  get currentPageTitle(): string {
    return this.navItems.find(n => n.key === this.activeSection)?.label ?? 'Dashboard';
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

  // ── Subscriptions ──
  private langSub: Subscription;
  private routeSub: Subscription;

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

    this.allProductsTitles$ = toObservable(this.selectors.allProducts).pipe(
      map((products: Product[]) => products.map(p => p.titleUrl))
    );

    this.langSub = this.lang$.subscribe(() => {
      this.store.getAllProducts();
      this.store.getOrders();
    });
  }

  ngAfterViewInit(): void { /* no tab group needed */ }

  // ── Actions ──
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  setSection(key: string): void {
    this.activeSection = key;
    this.productAction = '';
    this.scrollToTop();
  }

  getProducts(): void {
    this.store.getAllProducts();
  }

  onAddNewProduct(): void {
    this.productToEditTitleUrl = '';
    this.productAction = 'add';
    this.scrollToTop();
  }

  onEditProduct(titleUrl: string): void {
    this.productToEditTitleUrl = titleUrl;
    this.productAction = 'edit';
    this.scrollToTop();
  }

  onChangeTab(tab: number): void {
    if (tab === 0) this.productAction = '';
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

  goToDashboard(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.activeSection = 'overview';
    this.productAction = '';
    this.scrollToTop();
  }

  scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(accessTokenKey);
      } catch (e) {}
    }
    this.store.storeUser(null);
    const lang = this.translate?.lang ? `/${this.translate.lang}` : '/';
    this.router.navigate([lang]);
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }
}
