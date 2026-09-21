import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { EditorModule } from '@tinymce/tinymce-angular';

import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// ── Shell & Overview ──
import { DashboardShellComponent } from './dashboard/dashboard-shell.component';
import { DashboardComponent } from './dashboard/dashboard.component';



// ── Existing feature components ──
import { ProductsEditComponent } from './products-edit/products-edit.component';
import { OrdersEditComponent } from './orders-edit/orders-edit.component';
import { OrderEditComponent } from './orders-edit/order-edit/order-edit.component';
import { TinyEditorComponent } from './tiny-editor.ts/tiny-editor.component';
import { AllProductsComponent } from './all-products/all-products.component';
import { PagesEditComponent } from './pages-edit/pages-edit.component';
import { CategoriesEditComponent } from './categories-edit/categories-edit.component';
import { ConfigEditComponent } from './config-edit/config-edit.component';
import { AccountsEditComponent } from './accounts-edit/accounts-edit.component';
import { PaymentsEditComponent } from './payments-edit/payments-edit';
import { ShipmentsEditComponent } from './shipments-edit/shipments-edit';
import { AdminCardComponent, AdminSidebarComponent, AdminHeaderComponent, AdminLayoutComponent } from './admin-card';

import { OrderComponentsModule } from '../components/order/components/order-components.module';
import { TranslatePipe } from '../pipes/translate.pipe';
import { PriceFormatPipe } from '../pipes/price.pipe';
import { ProductsListComponent } from '../shared/components/products-list/products-list.component';


const DASHBOARD_ROUTER: Routes = [
  {
    path: '',
    component: DashboardShellComponent,   // Shell: giữ AdminLayout + sidebar state
    children: [
      { path: '', component: DashboardComponent },
      { path: 'products', component: AllProductsComponent },
      { path: 'products/add', component: ProductsEditComponent },
      { path: 'products/edit', component: ProductsEditComponent },
      { path: 'products/edit/:id', component: ProductsEditComponent },
      { path: 'product-edit', component: ProductsEditComponent },
      { path: 'categories', component: CategoriesEditComponent },
      { path: 'orders', component: OrdersEditComponent },
      { path: 'orders/:id', component: OrderEditComponent },
      { path: 'accounts', component: AccountsEditComponent },
      { path: 'payments', component: PaymentsEditComponent },
      { path: 'shipping', component: ShipmentsEditComponent },
      { path: 'shipments', component: ShipmentsEditComponent },
      { path: 'pages', component: PagesEditComponent },
      { path: 'config', component: ConfigEditComponent },
      { path: 'inventory', component: AllProductsComponent },
      { path: 'all-products', component: AllProductsComponent }
    ]
  }
];

@NgModule({
  imports: [
    CommonModule,
    OrderComponentsModule,
    FormsModule,
    ReactiveFormsModule,
    TranslatePipe,
    PriceFormatPipe,
    RouterModule.forChild(DASHBOARD_ROUTER),
    EditorModule,
    MatButtonModule,
    MatInputModule,
    MatCardModule,
    MatProgressBarModule,
    MatTabsModule,
    MatRadioModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatCheckboxModule,
    MatSnackBarModule,
    ProductsListComponent
  ],
  declarations: [
    // Layout components
    AdminCardComponent,
    AdminSidebarComponent,
    AdminHeaderComponent,
    AdminLayoutComponent,

    // Shell & overview
    DashboardShellComponent,
    DashboardComponent,


    // Feature components (used inside sections)
    ProductsEditComponent,
    OrdersEditComponent,
    OrderEditComponent,
    AllProductsComponent,
    TinyEditorComponent,
    PagesEditComponent,
    CategoriesEditComponent,
    ConfigEditComponent,
    AccountsEditComponent,
    PaymentsEditComponent,
    ShipmentsEditComponent
  ],
  exports: [
    AdminCardComponent,
    AdminSidebarComponent,
    AdminHeaderComponent,
    AdminLayoutComponent
  ]
})
export class DashboardModule { }
