import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { PriceFormatPipe } from '../pipes/price.pipe';
import { PermissionGuard } from '../services/auth.guard';

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
import { NotificationPopupComponent } from './shared/notification-popup/notification-popup.component';
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
import { UpdateOrderStatusComponent } from './pages/orders/update-order-status/update-order-status.component';
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
import { HomeComponent } from './pages/pages/home-about/home/home.component';
import { AboutComponent } from './pages/pages/home-about/about/about.component';
import { createAdminPagesRoutes } from './pages/pages/pages.routes';
import { AccountComponent } from './pages/account/account.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { CouponsComponent } from './pages/coupons/coupons.component';
import { CouponFormComponent } from './pages/coupons/coupon-form/coupon-form.component';
import { CouponDetailComponent } from './pages/coupons/coupon-detail/coupon-detail.component';
import { MessagesComponent } from './pages/messages/messages.component';
import { ConversationListComponent } from './pages/messages/conversation-list/conversation-list.component';
import { ChatPanelComponent } from './pages/messages/chat-panel/chat-panel.component';
import { CustomerProfileComponent } from './pages/messages/customer-profile/customer-profile.component';
import { ReviewsComponent } from './pages/reviews/reviews.component';
import { NewsletterSubscribersComponent } from './pages/newsletter-subscribers/newsletter-subscribers.component';
import { NewsletterExportCsvComponent } from './pages/newsletter-subscribers/newsletter-export-csv/newsletter-export-csv.component';
import { SocialLinksComponent } from './pages/social-links/social-links.component';
import { AdminUnauthorizedComponent } from './pages/unauthorized/admin-unauthorized.component';

const routes: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', component: DashboardComponent, canActivate: [PermissionGuard], data: { permission: 'dashboard:view' } },
      { path: 'dashboard', component: DashboardComponent, canActivate: [PermissionGuard], data: { permission: 'dashboard:view' } },
      { path: 'products', component: ProductsComponent, canActivate: [PermissionGuard], data: { permission: 'products:view' } },
      { path: 'products/add', component: ProductFormComponent, canActivate: [PermissionGuard], data: { permission: 'products:create' } },
      { path: 'products/:id', component: ProductDetailComponent, canActivate: [PermissionGuard], data: { permission: 'products:view' } },
      { path: 'products/:id/edit', component: ProductFormComponent, canActivate: [PermissionGuard], data: { permission: 'products:update' } },
      { path: 'categories', component: CategoriesComponent, canActivate: [PermissionGuard], data: { permission: 'categories:view' } },
      { path: 'categories/add', component: CategoryFormComponent, canActivate: [PermissionGuard], data: { permission: 'categories:manage' } },
      { path: 'categories/:id/edit', component: CategoryFormComponent, canActivate: [PermissionGuard], data: { permission: 'categories:manage' } },
      { path: 'orders', component: OrdersComponent, canActivate: [PermissionGuard], data: { permission: 'orders:view' } },
      { path: 'orders/add', component: OrderFormComponent, canActivate: [PermissionGuard], data: { permission: 'orders:view' } },
      { path: 'orders/:id/status', component: UpdateOrderStatusComponent, canActivate: [PermissionGuard], data: { permission: 'orders:update_status' } },
      { path: 'orders/:id/edit', component: UpdateOrderStatusComponent, canActivate: [PermissionGuard], data: { permission: 'orders:update' } },
      { path: 'orders/:id', component: OrderDetailComponent, canActivate: [PermissionGuard], data: { permission: 'orders:view' } },
      { path: 'pages/coupons', component: CouponsComponent, canActivate: [PermissionGuard], data: { permission: 'coupons:view' } },
      { path: 'pages/coupons/new', component: CouponFormComponent, canActivate: [PermissionGuard], data: { permission: 'coupons:manage' } },
      { path: 'pages/coupons/:id', component: CouponDetailComponent, canActivate: [PermissionGuard], data: { permission: 'coupons:view' } },
      { path: 'pages/coupons/:id/edit', component: CouponFormComponent, canActivate: [PermissionGuard], data: { permission: 'coupons:manage' } },
      { path: 'coupons', redirectTo: 'pages/coupons', pathMatch: 'full' },
      { path: 'coupons/new', redirectTo: 'pages/coupons/new', pathMatch: 'full' },
      { path: 'coupons/:id', redirectTo: 'pages/coupons/:id', pathMatch: 'full' },
      { path: 'coupons/:id/edit', redirectTo: 'pages/coupons/:id/edit', pathMatch: 'full' },
      { path: 'marketing/subscribers', component: NewsletterSubscribersComponent, canActivate: [PermissionGuard], data: { permission: 'subscribers:view' } },
      { path: 'newsletter-subscribers', component: NewsletterSubscribersComponent, canActivate: [PermissionGuard], data: { permission: 'subscribers:view' } },
      { path: 'pages/subscribers', component: NewsletterSubscribersComponent, canActivate: [PermissionGuard], data: { permission: 'subscribers:view' } },
      { path: 'subscribers', redirectTo: 'marketing/subscribers', pathMatch: 'full' },
      { path: 'payment-methods', component: PaymentMethodsComponent, canActivate: [PermissionGuard], data: { permission: 'payment_methods:view' } },
      { path: 'payment-methods/add', component: PaymentMethodFormComponent, canActivate: [PermissionGuard], data: { permission: 'payment_methods:manage' } },
      { path: 'payment-methods/:id', component: PaymentMethodDetailComponent, canActivate: [PermissionGuard], data: { permission: 'payment_methods:view' } },
      { path: 'payment-methods/:id/edit', component: PaymentMethodFormComponent, canActivate: [PermissionGuard], data: { permission: 'payment_methods:manage' } },
      { path: 'shipping-methods', component: ShippingMethodsComponent, canActivate: [PermissionGuard], data: { permission: 'shipping_methods:view' } },
      { path: 'shipping-methods/add', component: ShippingMethodFormComponent, canActivate: [PermissionGuard], data: { permission: 'shipping_methods:manage' } },
      { path: 'shipping-methods/:id', component: ShippingMethodDetailComponent, canActivate: [PermissionGuard], data: { permission: 'shipping_methods:view' } },
      { path: 'shipping-methods/:id/edit', component: ShippingMethodFormComponent, canActivate: [PermissionGuard], data: { permission: 'shipping_methods:manage' } },
      { path: 'users', component: UsersComponent, canActivate: [PermissionGuard], data: { permission: 'users:view' } },
      { path: 'users/add', component: UsersFormComponent, canActivate: [PermissionGuard], data: { permission: 'users:create' } },
      { path: 'users/:id', component: UsersDetailComponent, canActivate: [PermissionGuard], data: { permission: 'users:view' } },
      { path: 'users/:id/edit', component: UsersFormComponent, canActivate: [PermissionGuard], data: { permission: 'users:update' } },
      { path: 'inventory', component: InventoryComponent, canActivate: [PermissionGuard], data: { permission: 'inventory:view' } },
      { path: 'inventory/import', component: InventoryImportComponent, canActivate: [PermissionGuard], data: { permission: 'inventory:import' } },
      { path: 'inventory/:id', component: InventoryDetailComponent, canActivate: [PermissionGuard], data: { permission: 'inventory:view' } },
      { path: 'inventory/:id/edit', component: InventoryImportComponent, canActivate: [PermissionGuard], data: { permission: 'inventory:update' } },
      ...createAdminPagesRoutes({
        home: HomeComponent,
        about: AboutComponent,
        policies: PoliciesComponent,
        policyForm: PolicyFormComponent,
        policyEdit: PolicyEditComponent
      }),
      { path: 'account', component: AccountComponent },
      { path: 'settings', component: SettingsComponent, canActivate: [PermissionGuard], data: { permission: 'settings:view' } },
      { path: 'messages', component: MessagesComponent, canActivate: [PermissionGuard], data: { permission: 'messages:view' } },
      { path: 'reviews', component: ReviewsComponent, canActivate: [PermissionGuard], data: { permission: 'reviews:view' } },
      { path: 'social-links', component: SocialLinksComponent, canActivate: [PermissionGuard], data: { permission: 'cms:social_links' } },
      { path: 'unauthorized', component: AdminUnauthorizedComponent },
      { path: 'no-permission', redirectTo: 'unauthorized', pathMatch: 'full' },
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
    NotificationPopupComponent,
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
    UpdateOrderStatusComponent,
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
    MessagesComponent,
    ConversationListComponent,
    ChatPanelComponent,
    CustomerProfileComponent,
    ReviewsComponent,
    NewsletterSubscribersComponent,
    NewsletterExportCsvComponent,
    SocialLinksComponent,
    AdminUnauthorizedComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DragDropModule,
    PriceFormatPipe,
    RouterModule.forChild(routes),
  ],
  exports: [
    AdminBreadcrumbComponent,
    NotificationPopupComponent,
  ]
})
export class AdminModule { }
export { BreadcrumbItem } from './shared/admin-breadcrumb/admin-breadcrumb.component';
