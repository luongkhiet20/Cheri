import { Routes } from '@angular/router';

import { languages } from './user/shared/constants';
import { HomeComponent } from './user/pages/home/home.component';
import { NotFoundComponent } from './user/pages/not-found/not-found.component';
import { AuthGuard, AdminGuard } from './services/auth.guard';

const langRoutes = languages.map(lang => {
  return [
    { path: lang, component: HomeComponent },
    { path: lang + '/product', loadChildren: () => import('./user/pages/product/product.module').then(m => m.ProductModule) },
    { path: lang + '/cart', loadChildren: () => import('./user/pages/cart/cart.module').then(m => m.CartModule) },
    { path: lang + '/orders', loadChildren: () => import('./user/pages/order/order.module').then(m => m.OrderModule), canActivate: [AuthGuard] },
    { path: lang + '/cheri', loadChildren: () => import('./user/pages/cheri/routes').then(m => m.CHERI_ROUTER) },
    { path: lang + '/wishlist', loadComponent: () => import('./user/pages/wishlist/wishlist').then(m => m.Wishlist) },
    { path: lang + '/wishlish', redirectTo: '/' + lang + '/wishlist', pathMatch: 'full' },
    { path: lang + '/profile', loadComponent: () => import('./user/pages/profile/profile').then(m => m.Profile), canActivate: [AuthGuard] },
    { path: lang + '/authorize', loadChildren: () => import('./user/pages/auth/routes').then(m => m.AUTH_ROUTER) },
    { path: lang + '/tracking', redirectTo: '/' + lang + '/orders', pathMatch: 'full' },
    { path: lang + '/ordering-guide', redirectTo: '/' + lang + '/cheri/ordering-guide', pathMatch: 'full' },
    { path: lang + '/faqs', redirectTo: '/' + lang + '/cheri/faqs', pathMatch: 'full' },
    { path: lang + '/return-policy', redirectTo: '/' + lang + '/cheri/return-policy', pathMatch: 'full' },
    { path: lang + '/warranty-policy', redirectTo: '/' + lang + '/cheri/warranty-policy', pathMatch: 'full' },
    { path: lang + '/privacy-policy', redirectTo: '/' + lang + '/cheri/privacy-policy', pathMatch: 'full' },
    { path: lang + '/shipping-policy', redirectTo: '/' + lang + '/cheri/shipping-policy', pathMatch: 'full' },
    { path: lang + '/virtual-try-on', redirectTo: '/' + lang + '/product/all', pathMatch: 'full' },
    { path: lang + '/about', redirectTo: '/' + lang + '/cheri/contact', pathMatch: 'full' },
    { path: lang + '/contact', redirectTo: '/' + lang + '/cheri/contact', pathMatch: 'full' },
  ]
});

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'profile', redirectTo: '/vi/profile', pathMatch: 'full' },
  { path: 'products', redirectTo: '/vi/product/all', pathMatch: 'full' },
  { path: 'product/all', redirectTo: '/vi/product/all', pathMatch: 'full' },
  { path: 'product', redirectTo: '/vi/product/all', pathMatch: 'full' },
  { path: 'cart', redirectTo: '/vi/cart', pathMatch: 'full' },
  { path: 'orders', redirectTo: '/vi/orders', pathMatch: 'full' },
  { path: 'wishlist', redirectTo: '/vi/wishlist', pathMatch: 'full' },
  { path: 'tracking', redirectTo: '/vi/orders', pathMatch: 'full' },
  { path: 'about', redirectTo: '/vi/cheri/contact', pathMatch: 'full' },
  { path: 'contact', redirectTo: '/vi/cheri/contact', pathMatch: 'full' },
  { path: 'cheri', redirectTo: '/vi/cheri/contact', pathMatch: 'full' },
  { path: 'authorize', redirectTo: '/vi/authorize/signin', pathMatch: 'full' },
  { path: '404', component: NotFoundComponent },
  ...[].concat(...langRoutes),
  { path: 'jwtToken/:accessToken', loadComponent: () => import('./user/pages/auth/jwtToken/jwtToken.component').then(mod => mod.JwtTokenComponent) },

  // ── Admin Routes ──────────────────────────────
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [AdminGuard]
  },

  { path: '**', redirectTo: '404' }
];
