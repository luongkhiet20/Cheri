import { Routes } from '@angular/router';



import { languages } from './shared/constants';
import { HomeComponent } from './components/home/home.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { AuthGuard, AdminGuard } from './services/auth.guard';

const langRoutes = languages.map(lang => {
  return [
    { path: lang + '/product', loadChildren: () => import('./components/product/product.module').then(m => m.ProductModule) },
    { path: lang + '/cart', loadChildren: () => import('./components/cart/cart.module').then(m => m.CartModule) },
    { path: lang + '/orders', loadChildren: () => import('./components/order/order.module').then(m => m.OrderModule), canActivate: [AuthGuard] },
    { path: lang + '/dashboard', loadChildren: () => import('./modules/dashboard.module').then(m => m.DashboardModule), canActivate: [AdminGuard] },
    { path: lang + '/admin', redirectTo: lang + '/dashboard', pathMatch: 'full' },
    { path: lang + '/cheri', loadChildren: () => import('./components/cheri/routes').then(m => m.CHERI_ROUTER) },
    { path: lang + '/wishlist', loadComponent: () => import('./components/wishlist/wishlist').then(m => m.Wishlist) },
    { path: lang + '/wishlish', redirectTo: lang + '/wishlist', pathMatch: 'full' },
    { path: lang + '/authorize', loadChildren: () => import('./components/auth/routes').then(m => m.AUTH_ROUTER) },
  ]
});

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'dashboard', redirectTo: 'vi/dashboard', pathMatch: 'full' },
  { path: 'admin', redirectTo: 'vi/dashboard', pathMatch: 'full' },
  { path: '404', component: NotFoundComponent },
  ...[].concat(...langRoutes),
  { path: 'jwtToken/:accessToken', loadComponent: () => import('./components/auth/jwtToken/jwtToken.component').then(mod => mod.JwtTokenComponent) },
  { path: '**', redirectTo: '404' }
];
