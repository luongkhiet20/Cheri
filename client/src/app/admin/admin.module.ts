import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';

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
import { NotificationComponent } from './shared/notification/notification.component';
import { AdminBreadcrumbComponent } from './shared/admin-breadcrumb/admin-breadcrumb.component';

// Pages
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ProductsComponent } from './pages/products/products.component';
import { ProductFormComponent } from './pages/products/product-form/product-form.component';
import { ProductDetailComponent } from './pages/products/product-detail/product-detail.component';
import { ProductCsvModalComponent } from './pages/products/product-csv-modal/product-csv-modal.component';
import { CategoriesComponent } from './pages/categories/categories.component';
import { CategoryFormComponent } from './pages/categories/category-form/category-form.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { OrderFormComponent } from './pages/orders/order-form/order-form.component';
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
import { InventoryDetailComponent } from './pages/inventory/inventory-detail/inventory-detail.component';
import { InventoryImportComponent } from './pages/inventory/inventory-import/inventory-import.component';
import { PoliciesComponent } from './pages/pages/policies/policies.component';
import { PolicyFormComponent } from './pages/pages/policies/policy-form/policy-form.component';
import { PolicyEditComponent } from './pages/pages/policies/policy-edit/policy-edit.component';
import { HomeComponent } from './pages/pages/home/home.component';
import { AboutComponent } from './pages/pages/about/about';
import { createAdminPagesRoutes } from './pages/pages/pages.routes';
import { AccountComponent } from './pages/account/account.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { CouponsComponent } from './pages/coupons/coupons.component';
import { CouponFormComponent } from './pages/coupons/coupon-form/coupon-form.component';
import { CouponDetailComponent } from './pages/coupons/coupon-detail/coupon-detail.component';

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
      { path: 'orders/add', component: OrderFormComponent },
      { path: 'orders/:id/edit', component: OrderFormComponent },
      { path: 'orders/:id', component: OrderDetailComponent },
      { path: 'pages/coupons', component: CouponsComponent },
      { path: 'pages/coupons/new', component: CouponFormComponent },
      { path: 'pages/coupons/:id', component: CouponDetailComponent },
      { path: 'pages/coupons/:id/edit', component: CouponFormComponent },
      { path: 'coupons', redirectTo: 'pages/coupons', pathMatch: 'full' },
      { path: 'coupons/new', redirectTo: 'pages/coupons/new', pathMatch: 'full' },
      { path: 'coupons/:id', redirectTo: 'pages/coupons/:id', pathMatch: 'full' },
      { path: 'coupons/:id/edit', redirectTo: 'pages/coupons/:id/edit', pathMatch: 'full' },
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
      { path: 'inventory/:id', component: InventoryDetailComponent },
      { path: 'inventory/:id/edit', component: InventoryImportComponent },
      ...createAdminPagesRoutes({
        home: HomeComponent,
        about: AboutComponent,
        policies: PoliciesComponent,
        policyForm: PolicyFormComponent,
        policyEdit: PolicyEditComponent
      }),
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
    NotificationComponent,
    AdminBreadcrumbComponent,
    // Pages
    DashboardComponent,
    ProductsComponent,
    ProductFormComponent,
    ProductDetailComponent,
    ProductCsvModalComponent,
    CategoriesComponent,
    CategoryFormComponent,
    OrdersComponent,
    OrderFormComponent,
    OrderDetailComponent,
    CouponsComponent,
    CouponFormComponent,
    CouponDetailComponent,
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
    InventoryDetailComponent,
    InventoryImportComponent,
    PoliciesComponent,
    PolicyFormComponent,
    PolicyEditComponent,
    HomeComponent,
    AboutComponent,
    AccountComponent,
    SettingsComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    RouterModule.forChild(routes),
  ],
  exports: [
    AdminBreadcrumbComponent,
  ]
})
export class AdminModule { }
export { BreadcrumbItem } from './shared/admin-breadcrumb/admin-breadcrumb.component';
