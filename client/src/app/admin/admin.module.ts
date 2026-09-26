import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Layout
import { AdminLayout } from './layout/admin-layout/admin-layout';
import { AdminHeaderComponent } from './layout/admin-header/admin-header.component';
import { AdminSidebarComponent } from './layout/admin-sidebar/admin-sidebar.component';

// Shared
import { AdminToolbarComponent } from './shared/admin-toolbar/admin-toolbar.component';
import { AdminSearchComponent } from './shared/admin-search/admin-search.component';
import { AdminFilterComponent } from './shared/admin-filter/admin-filter.component';
import { AdminTableComponent } from './shared/admin-table/admin-table.component';
import { AdminPaginationComponent } from './shared/admin-pagination/admin-pagination.component';
import { AdminStatusBadgeComponent } from './shared/admin-status-badge/admin-status-badge.component';
import { AdminActionButtonsComponent } from './shared/admin-action-buttons/admin-action-buttons.component';
import { AdminCardComponent } from './shared/admin-card/admin-card.component';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { LoadingStateComponent } from './shared/loading-state/loading-state.component';
import { EmptyStateComponent } from './shared/empty-state/empty-state.component';

// Pages
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { ProductFormComponent } from './pages/products/product-form/product-form.component';
import { ProductDetailComponent } from './pages/products/product-detail/product-detail.component';
import { ProductCsvModalComponent } from './pages/products/product-csv-modal/product-csv-modal.component';
import { CategoriesComponent } from './pages/categories/categories.component';
import { CategoryFormComponent } from './pages/categories/category-form/category-form.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { OrderDetailComponent } from './pages/orders/order-detail/order-detail.component';
import { PaymentMethodsComponent } from './pages/payment-methods/payment-methods.component';
import { PaymentMethodFormComponent } from './pages/payment-methods/payment-method-form/payment-method-form.component';
import { PaymentMethodDetailComponent } from './pages/payment-methods/payment-method-detail/payment-method-detail.component';
import { ShippingMethodsComponent } from './pages/shipping-methods/shipping-methods.component';
import { ShippingMethodFormComponent } from './pages/shipping-methods/shipping-method-form/shipping-method-form.component';
import { ShippingMethodDetailComponent } from './pages/shipping-methods/shipping-method-detail/shipping-method-detail.component';
import { UsersComponent } from './pages/users/users.component';
import { UsersFormComponent } from './pages/users/users-form/users-form.component';
import { UsersDetailComponent } from './pages/users/users-detail/users-detail.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { InventoryImportComponent } from './pages/inventory/inventory-import/inventory-import.component';
import { PagesComponent } from './pages/pages/pages.component';
import { PageFormComponent } from './pages/pages/page-form/page-form.component';
import { PageDetailComponent } from './pages/pages/page-detail/page-detail.component';
import { AccountComponent } from './pages/account/account.component';
import { SettingsComponent } from './pages/settings/settings.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', component: DashboardComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'products/add', component: ProductFormComponent },
      { path: 'products/:id', component: ProductDetailComponent },
      { path: 'products/:id/edit', component: ProductFormComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'categories/add', component: CategoryFormComponent },
      { path: 'categories/:id/edit', component: CategoryFormComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'orders/:id', component: OrderDetailComponent },
      { path: 'payment-methods', component: PaymentMethodsComponent },
      { path: 'payment-methods/add', component: PaymentMethodFormComponent },
      { path: 'payment-methods/:id', component: PaymentMethodDetailComponent },
      { path: 'payment-methods/:id/edit', component: PaymentMethodFormComponent },
      { path: 'shipping-methods', component: ShippingMethodsComponent },
      { path: 'shipping-methods/add', component: ShippingMethodFormComponent },
      { path: 'shipping-methods/:id', component: ShippingMethodDetailComponent },
      { path: 'shipping-methods/:id/edit', component: ShippingMethodFormComponent },
      { path: 'users', component: UsersComponent },
      { path: 'users/add', component: UsersFormComponent },
      { path: 'users/:id', component: UsersDetailComponent },
      { path: 'users/:id/edit', component: UsersFormComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'inventory/import', component: InventoryImportComponent },
      { path: 'pages', component: PagesComponent },
      { path: 'pages/add', component: PageFormComponent },
      { path: 'pages/:id', component: PageDetailComponent },
      { path: 'pages/:id/edit', component: PageFormComponent },
      { path: 'account', component: AccountComponent },
      { path: 'settings', component: SettingsComponent },
    ]
  }
];

@NgModule({
  declarations: [
    // Layout
    AdminLayout,
    AdminHeaderComponent,
    AdminSidebarComponent,
    // Shared
    AdminToolbarComponent,
    AdminSearchComponent,
    AdminFilterComponent,
    AdminTableComponent,
    AdminPaginationComponent,
    AdminStatusBadgeComponent,
    AdminActionButtonsComponent,
    AdminCardComponent,
    ConfirmDialogComponent,
    LoadingStateComponent,
    EmptyStateComponent,
    // Pages
    DashboardComponent,
    ProductsComponent,
    ProductFormComponent,
    ProductDetailComponent,
    ProductCsvModalComponent,
    CategoriesComponent,
    CategoryFormComponent,
    OrdersComponent,
    OrderDetailComponent,
    PaymentMethodsComponent,
    PaymentMethodFormComponent,
    PaymentMethodDetailComponent,
    ShippingMethodsComponent,
    ShippingMethodFormComponent,
    ShippingMethodDetailComponent,
    UsersComponent,
    UsersFormComponent,
    UsersDetailComponent,
    InventoryComponent,
    InventoryImportComponent,
    PagesComponent,
    PageFormComponent,
    PageDetailComponent,
    AccountComponent,
    SettingsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
  ]
})
export class AdminModule {}
