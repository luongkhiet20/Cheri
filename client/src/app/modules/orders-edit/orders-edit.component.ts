import { Component, OnInit, OnDestroy, Signal } from '@angular/core';
import { Observable, Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

import { TranslateService } from '../../services/translate.service';
import { Order, Cart, Product } from '../../shared/models';
import { SignalStore } from '../../store/signal.store';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-orders-edit',
  templateUrl: './orders-edit.component.html',
  styleUrls: ['./orders-edit.component.css'],
  standalone: false
})
export class OrdersEditComponent implements OnInit, OnDestroy {
  readonly component = 'ordersEdit';

  orders$: Signal<Order[]>;
  lang$: Observable<string>;
  private ordersSub: Subscription;

  orders: Order[] = [];
  filteredOrders: Order[] = [];

  // Toolbar & Search
  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'table';

  // Checkbox selection
  selectedOrderKeys: Set<string> = new Set<string>();
  isDeleting: boolean = false;

  // Filter panel
  isFilterOpen: boolean = false;
  filterStatus: 'all' | 'PAID' | 'COMPLETED' | 'PENDING' | 'CANCELLED' = 'all';
  filterType: 'all' | 'cod' | 'stripe' = 'all';
  sortBy: 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' = 'date-desc';

  // Modal / Detail state
  selectedOrderForDetail: Order | null = null;
  editStatus: string = '';
  isSavingStatus: boolean = false;

  constructor(
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    public translate: TranslateService,
    private apiService: ApiService
  ) {
    this.lang$ = this.translate.getLang$();
    this.orders$ = this.selectors.orders;
  }

  ngOnInit(): void {
    this.store.getOrders();
    this.ordersSub = toObservable(this.selectors.orders).subscribe((orders) => {
      this.orders = orders || [];
      // Clean up deleted keys
      const currentKeys = new Set(this.orders.map((o) => this.getOrderKey(o)));
      for (const k of Array.from(this.selectedOrderKeys)) {
        if (!currentKeys.has(k)) {
          this.selectedOrderKeys.delete(k);
        }
      }
      this.filterOrders();
    });
  }

  ngOnDestroy(): void {
    this.ordersSub?.unsubscribe();
  }

  // ── Search & Filter ──
  onSearchChange(): void {
    this.filterOrders();
  }

  toggleFilterMenu(): void {
    this.isFilterOpen = !this.isFilterOpen;
  }

  hasActiveFilters(): boolean {
    return (
      this.filterStatus !== 'all' ||
      this.filterType !== 'all' ||
      this.sortBy !== 'date-desc'
    );
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterStatus !== 'all') count++;
    if (this.filterType !== 'all') count++;
    if (this.sortBy !== 'date-desc') count++;
    return count;
  }

  resetFilters(): void {
    this.filterStatus = 'all';
    this.filterType = 'all';
    this.sortBy = 'date-desc';
    this.filterOrders();
  }

  onFilterChange(): void {
    this.filterOrders();
  }

  filterOrders(): void {
    if (!this.orders) {
      this.filteredOrders = [];
      return;
    }

    let result = [...this.orders];

    // Search query filter
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter((order) => {
        const orderId = (order.orderId || '').toLowerCase();
        const mongoId = (order._id || '').toLowerCase();
        const email = (order.customerEmail || '').toLowerCase();
        const type = (order.type || '').toLowerCase();
        const notes = (order.notes || order.description || '').toLowerCase();
        const status = (order.status || '').toLowerCase();
        const productNames = this.getOrderProductNames(order).toLowerCase();

        return (
          orderId.includes(q) ||
          mongoId.includes(q) ||
          email.includes(q) ||
          type.includes(q) ||
          notes.includes(q) ||
          status.includes(q) ||
          productNames.includes(q)
        );
      });
    }

    // Status filter
    if (this.filterStatus !== 'all') {
      result = result.filter((o) => (o.status || '').toUpperCase() === this.filterStatus);
    }

    // Payment Type filter
    if (this.filterType !== 'all') {
      result = result.filter((o) => (o.type || '').toLowerCase() === this.filterType.toLowerCase());
    }

    // Sorting
    result.sort((a, b) => {
      if (this.sortBy === 'date-desc') {
        const da = new Date(a.dateAdded || 0).getTime();
        const db = new Date(b.dateAdded || 0).getTime();
        return db - da;
      }
      if (this.sortBy === 'date-asc') {
        const da = new Date(a.dateAdded || 0).getTime();
        const db = new Date(b.dateAdded || 0).getTime();
        return da - db;
      }
      if (this.sortBy === 'amount-desc') {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (this.sortBy === 'amount-asc') {
        return (a.amount || 0) - (b.amount || 0);
      }
      return 0;
    });

    this.filteredOrders = result;
  }

  // ── Checkbox Selection ──
  getOrderKey(order: Order): string {
    return (order.orderId || order._id || '').toString();
  }

  isSelected(order: Order): boolean {
    return this.selectedOrderKeys.has(this.getOrderKey(order));
  }

  toggleSelect(order: Order, event: Event): void {
    event.stopPropagation();
    const key = this.getOrderKey(order);
    if (this.selectedOrderKeys.has(key)) {
      this.selectedOrderKeys.delete(key);
    } else {
      this.selectedOrderKeys.add(key);
    }
  }

  isAllSelected(): boolean {
    if (!this.filteredOrders.length) return false;
    return this.filteredOrders.every((o) => this.selectedOrderKeys.has(this.getOrderKey(o)));
  }

  isPartiallySelected(): boolean {
    if (!this.filteredOrders.length) return false;
    const selectedCount = this.filteredOrders.filter((o) =>
      this.selectedOrderKeys.has(this.getOrderKey(o))
    ).length;
    return selectedCount > 0 && selectedCount < this.filteredOrders.length;
  }

  toggleSelectAll(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      for (const o of this.filteredOrders) {
        this.selectedOrderKeys.add(this.getOrderKey(o));
      }
    } else {
      for (const o of this.filteredOrders) {
        this.selectedOrderKeys.delete(this.getOrderKey(o));
      }
    }
  }

  // ── Actions: Delete & Bulk Delete ──
  deleteSelectedOrders(): void {
    if (this.selectedOrderKeys.size === 0) return;
    const count = this.selectedOrderKeys.size;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa ${count} đơn hàng đã chọn không? Thao tác này không thể hoàn tác.`);
    if (!confirmed) return;

    this.isDeleting = true;
    const deleteObservables = Array.from(this.selectedOrderKeys).map((id) =>
      this.apiService.deleteOrder(id).pipe(catchError((err) => of(err)))
    );

    forkJoin(deleteObservables).subscribe(() => {
      this.selectedOrderKeys.clear();
      this.isDeleting = false;
      this.store.getOrders();
    });
  }

  deleteOrder(order: Order, event?: Event): void {
    if (event) event.stopPropagation();
    const orderId = order.orderId || order._id;
    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa đơn hàng #${orderId} không?`);
    if (!confirmed) return;

    this.apiService.deleteOrder(orderId).subscribe(() => {
      this.selectedOrderKeys.delete(this.getOrderKey(order));
      this.store.getOrders();
    });
  }

  // ── Actions: Status Toggle ──
  isOrderVisible(order: Order): boolean {
    const status = (order.status || '').toUpperCase();
    return status === 'PAID' || status === 'COMPLETED';
  }

  toggleOrderStatus(order: Order, event?: Event): void {
    if (event) event.stopPropagation();
    const current = (order.status || '').toUpperCase();
    const newStatus = (current === 'PAID' || current === 'COMPLETED') ? 'PENDING' : 'PAID';

    this.apiService.updateOrder({ orderId: order.orderId, status: newStatus }).subscribe(() => {
      order.status = newStatus as any;
      this.store.getOrders();
    });
  }

  // ── Actions: Detail & Edit Modal ──
  openOrderDetail(order: Order, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedOrderForDetail = order;
    this.editStatus = (order.status || 'PENDING').toUpperCase();
  }

  closeOrderDetail(): void {
    this.selectedOrderForDetail = null;
    this.editStatus = '';
  }

  saveOrderStatus(): void {
    if (!this.selectedOrderForDetail) return;
    this.isSavingStatus = true;
    const orderId = this.selectedOrderForDetail.orderId;
    this.apiService.updateOrder({ orderId: orderId, status: this.editStatus }).subscribe({
      next: () => {
        this.selectedOrderForDetail.status = this.editStatus as any;
        this.isSavingStatus = false;
        this.closeOrderDetail();
        this.store.getOrders();
      },
      error: () => {
        this.isSavingStatus = false;
        this.closeOrderDetail();
        this.store.getOrders();
      }
    });
  }

  onRefresh(): void {
    this.store.getOrders();
  }

  // ── Helpers ──
  getOrderCartItems(order: Order): any[] {
    if (!order?.cart?.items) return [];
    if (Array.isArray(order.cart.items)) {
      return order.cart.items;
    }
    return Object.values(order.cart.items);
  }

  getOrderProductNames(order: Order): string {
    const items = this.getOrderCartItems(order);
    if (!items.length) return order.notes || 'Đơn hàng thông thường';
    return items
      .map((it) => it.item?.title || it.item?.['vi']?.title || it.title || 'Sản phẩm')
      .join(', ');
  }

  getOrderFirstImage(order: Order): string | null {
    const items = this.getOrderCartItems(order);
    for (const it of items) {
      if (it.item?.mainImage?.url) return it.item.mainImage.url;
      if (it.item?.images?.length) return it.item.images[0];
      if (it.mainImage?.url) return it.mainImage.url;
    }
    return null;
  }

  getOrderTotalQty(order: Order): number {
    if (order?.cart?.totalQty !== undefined) return order.cart.totalQty;
    const items = this.getOrderCartItems(order);
    return items.reduce((sum, it) => sum + (it.qty || 1), 0);
  }

  getOrderAddressText(order: Order): string {
    if (!order?.addresses || !order.addresses.length) return '';
    const addr = order.addresses[0] as any;
    if (typeof addr === 'string') return addr;
    const parts = [addr.address, addr.city, addr.country].filter(Boolean);
    return parts.join(', ');
  }

  getCustomerDisplay(order: Order): string {
    if (order.customerEmail) return order.customerEmail;
    if (order.addresses?.length) {
      const addr = order.addresses[0] as any;
      if (addr.fullName || addr.name) return addr.fullName || addr.name;
    }
    return 'Khách hàng';
  }
}
