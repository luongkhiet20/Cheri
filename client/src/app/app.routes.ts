import { Routes } from '@angular/router';

import { languages } from './shared/constants';
import { HomeComponent } from './user/home/home.component';
import { NotFoundComponent } from './user/not-found/not-found.component';
import { AuthGuard, AdminGuard } from './services/auth.guard';

const langRoutes = languages.map(lang => {
  return [
    { path: lang, component: HomeComponent },
    { path: lang + '/product', loadChildren: () => import('./user/product/product.module').then(m => m.ProductModule) },
    { path: lang + '/cart', loadChildren: () => import('./user/cart/cart.module').then(m => m.CartModule) },
    { path: lang + '/orders', loadChildren: () => import('./user/order/order.module').then(m => m.OrderModule), canActivate: [AuthGuard] },
    { path: lang + '/cheri', loadChildren: () => import('./user/cheri/routes').then(m => m.CHERI_ROUTER) },
    { path: lang + '/wishlist', loadComponent: () => import('./user/wishlist/wishlist').then(m => m.Wishlist) },
    { path: lang + '/wishlish', redirectTo: lang + '/wishlist', pathMatch: 'full' },
    { path: lang + '/profile', loadComponent: () => import('./user/profile/profile').then(m => m.Profile), canActivate: [AuthGuard] },
    { path: lang + '/authorize', loadChildren: () => import('./user/auth/routes').then(m => m.AUTH_ROUTER) },
  ]
});

export const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'profile', redirectTo: 'vi/profile', pathMatch: 'full' },
  { path: '404', component: NotFoundComponent },
  ...[].concat(...langRoutes),
  { path: 'jwtToken/:accessToken', loadComponent: () => import('./user/auth/jwtToken/jwtToken.component').then(mod => mod.JwtTokenComponent) },

  // ── Admin Routes ──────────────────────────────
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [AdminGuard]
  },

  { path: '**', redirectTo: '404' }
];
