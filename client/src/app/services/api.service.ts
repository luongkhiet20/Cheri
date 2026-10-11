import { toObservable } from '@angular/core/rxjs-interop';
import { WindowService } from './window.service';
import { catchError, map, tap } from 'rxjs/operators';
import { Inject, Injectable, Optional, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { environment } from '../../environments/environment';
import { Translations } from '../user/shared/models';
import { accessTokenKey } from '../user/shared/constants';
import { SignalStoreSelectors } from '../store/signal.store.selectors';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  apiUrl = environment.apiUrl;
  ranNumber = 0;
  private currentLang = 'vi';
  currentUser$ = new BehaviorSubject<any>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly _window: WindowService,
    @Optional() @Inject('serverUrl') protected serverUrl: string,
    @Inject(PLATFORM_ID)
    private platformId: Object,
  ) {
    this.initAuthTracking();

    if (environment.production) {
      if (isPlatformServer(this.platformId)) {
        this.apiUrl = this.serverUrl || '';
      }

      if (isPlatformBrowser(this.platformId)) {
        this.apiUrl = this._window.location.origin || '';
      }
    }
  }

  public getOrCreateGuestCartId(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      let guestId = localStorage.getItem('cheri_guest_cart_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        localStorage.setItem('cheri_guest_cart_id', guestId);
      }
      return guestId;
    } catch {
      return '';
    }
  }

  public getGuestCartLocal(): any[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const saved = localStorage.getItem('cheri_guest_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }

  public saveGuestCartLocal(cartData: any): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const token = localStorage.getItem(accessTokenKey);
      // Chỉ lưu vào guest storage khi người dùng CHƯA đăng nhập
      if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
        return;
      }
      if (cartData && Array.isArray(cartData.items)) {
        const items = cartData.items.map((ci: any) => ({
          productId: ci.item?._id || ci.item?.id || (ci.id && ci.id.includes('_') ? ci.id.split('_')[0] : ci.id),
          variantId: ci.variantId || null,
          quantity: ci.qty || 1,
          selectedClassification: ci.selectedClassification || null,
          selectedColor: ci.selectedColor || null,
          selectedSize: ci.selectedSize || null,
        }));
        localStorage.setItem('cheri_guest_cart', JSON.stringify(items));
      }
    } catch {}
  }

  public clearGuestCartLocal(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem('cheri_guest_cart');
      localStorage.removeItem('cheri_guest_cart_id');
    } catch {}
  }

  public getRequestOptions() {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const accessToken = localStorage.getItem(accessTokenKey);
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined' && accessToken.trim() !== '') {
        headers = headers.set('Authorization', 'Bearer ' + accessToken);
      } else {
        const guestId = this.getOrCreateGuestCartId();
        if (guestId) {
          headers = headers.set('x-guest-cart-id', guestId);
        }
      }
    }
    headers = headers.set('lang', this.currentLang || 'vi');
    return { headers, withCredentials: true };
  }

  getConfig() {
    const configUrl = this.apiUrl + '/api/cheri/config';
    return this.http.get(configUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getUser() {
    const userUrl = this.apiUrl + '/api/auth';
    return this.http.get(userUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getUsers(params?: { page?: number; limit?: number; pageSize?: number; search?: string; role?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.pageSize) httpParams = httpParams.set('limit', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.role) httpParams = httpParams.set('role', params.role);
      if (params.status !== undefined && params.status !== '') httpParams = httpParams.set('status', params.status);
    }
    const usersUrl = this.apiUrl + '/api/auth/users';
    return this.http.get(usersUrl, { ...this.getRequestOptions(), params: httpParams }).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  createUser(userData: any): Observable<any> {
    const usersUrl = this.apiUrl + '/api/auth/users';
    return this.http.post(usersUrl, userData, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  updateUser(id: string, userData: any): Observable<any> {
    const usersUrl = this.apiUrl + `/api/auth/users/${id}`;
    return this.http.put(usersUrl, userData, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  updateProfile(userData: any): Observable<any> {
    const profileUrl = this.apiUrl + '/api/auth/profile';
    return this.http.put(profileUrl, userData, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: any) => of({ error: error?.error || error })),
    );
  }

  uploadAvatar(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('avatar', file);
    const avatarUrl = this.apiUrl + '/api/auth/avatar';
    return this.http.post(avatarUrl, formData, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: any) => of({ error: error?.error || error })),
    );
  }

  deleteUser(id: string): Observable<any> {
    const usersUrl = this.apiUrl + `/api/auth/users/${id}`;
    return this.http.delete(usersUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  signIn(req) {
    const sendContact = this.apiUrl + '/api/auth/signin';
    return this.http.post(sendContact, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  signUp(req) {
    const sendContact = this.apiUrl + '/api/auth/signup';
    return this.http.post(sendContact, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  signOut() {
    const signOutUrl = this.apiUrl + '/api/auth/signout';
    return this.http.post(signOutUrl, {}, this.getRequestOptions()).pipe(
      catchError(() => of({ success: true }))
    );
  }

  searchByImage(file: File, keyword?: string): Observable<any> {
    const formData = new FormData();
    formData.append('image', file);
    if (keyword) {
      formData.append('keyword', keyword);
    }
    const searchImageUrl = this.apiUrl + '/api/products/search/image';
    return this.http.post(searchImageUrl, formData, { withCredentials: true }).pipe(
      catchError((error: any) => of({ error: error?.error?.message || error?.message || 'Lỗi tìm kiếm hình ảnh' }))
    );
  }

  getProducts(req: any = {}): Observable<any> {
    const lang = req.lang || 'vi';
    const page = req.page !== undefined ? req.page : 1;
    const sort = req.sort || 'newest';
    const { category, maxPrice, minPrice, stock, rating, search, productIds, imageSearch, pageSize } = req;
    const catStr = Array.isArray(category) ? category.join(',') : (category || '');
    const addCategory = catStr ? { category: catStr } : {};
    const categoryQuery = catStr ? '&category=' + encodeURIComponent(catStr) : '';
    const priceQuery = maxPrice ? '&maxPrice=' + maxPrice : '';
    const minPriceQuery = minPrice ? '&minPrice=' + minPrice : '';
    const stockQuery = stock && stock !== 'all' ? '&stock=' + stock : '';
    const ratStr = Array.isArray(rating) ? rating.join(',') : (rating !== undefined && rating !== null ? String(rating) : '');
    const ratingQuery = ratStr && ratStr !== '0' ? '&rating=' + encodeURIComponent(ratStr) : '';
    const searchQuery = search ? '&search=' + encodeURIComponent(search) : '';
    const productIdsQuery = productIds ? '&productIds=' + encodeURIComponent(productIds) : '';
    const imageSearchQuery = imageSearch ? '&imageSearch=' + encodeURIComponent(imageSearch) : '';
    const pageSizeQuery = pageSize ? '&pageSize=' + pageSize : '';
    const productsUrl = this.apiUrl + '/api/products?lang=' + lang + '&page=' + page + '&sort=' + sort + categoryQuery + priceQuery + minPriceQuery + stockQuery + ratingQuery + searchQuery + productIdsQuery + imageSearchQuery + pageSizeQuery + '&scope=user';
    return this.http.get(productsUrl, this.getRequestOptions()).pipe(
      map((data: any) => {
        const productList = (data?.all || data?.data || (Array.isArray(data) ? data : [])).map((product: any) => ({
          ...product,
          tags: (product.tags || []).filter(Boolean).map((cat: string) => cat.toLowerCase()),
        }));
        return {
          success: true,
          data: productList,
          products: productList,
          pagination: data?.pagination || { total: productList.length, page: page, pageSize: pageSize || 20 },
          maxPrice: data?.maxPrice,
          minPrice: data?.minPrice,
          ...addCategory,
        };
      }),
      catchError((error: Error) => {
        if (productsUrl.includes('localhost:4000')) {
          const fallbackUrl = productsUrl.replace('localhost:4000', 'localhost:5000');
          return this.http.get(fallbackUrl, this.getRequestOptions()).pipe(
            map((data: any) => {
              const productList = (data?.all || data?.data || (Array.isArray(data) ? data : [])).map((product: any) => ({
                ...product,
                tags: (product.tags || []).filter(Boolean).map((cat: string) => cat.toLowerCase()),
              }));
              return {
                success: true,
                data: productList,
                products: productList,
                pagination: data?.pagination || { total: productList.length, page: page, pageSize: pageSize || 20 },
                maxPrice: data?.maxPrice,
                minPrice: data?.minPrice,
                ...addCategory,
              };
            }),
            catchError((err2: Error) => of({ success: false, error: err2, data: [], products: [] } as any)),
          );
        }
        return of({ success: false, error, data: [], products: [] } as any);
      }),
    );
  }

  getCategories(lang: string = 'vi'): Observable<any> {
    const categoriesUrl = this.apiUrl + '/api/products/categories?lang=' + lang;
    return this.http.get(categoriesUrl, this.getRequestOptions()).pipe(
      map((response: any) => {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.data)) return response.data;
        return [];
      }),
      catchError((error: Error) => {
        if (categoriesUrl.includes('localhost:4000')) {
          const fallbackUrl = categoriesUrl.replace('localhost:4000', 'localhost:5000');
          return this.http.get(fallbackUrl, this.getRequestOptions()).pipe(
            map((res: any) => {
              if (Array.isArray(res)) return res;
              if (Array.isArray(res?.data)) return res.data;
              return [];
            }),
            catchError(() => of([])),
          );
        }
        return of([]);
      }),
    );
  }

  getProductsSearch(query: string) {
    const productUrl = this.apiUrl + '/api/products/search?query=' + query;
    return this.http.get(productUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getProduct(params) {
    const productUrl = this.apiUrl + '/api/products/' + params;
    return this.http.get(productUrl, this.getRequestOptions()).pipe(
      map((response: any) => response?.data || response?.raw || response),
      catchError((error: Error) => {
        if (productUrl.includes('localhost:4000')) {
          const fallbackUrl = productUrl.replace('localhost:4000', 'localhost:5000');
          return this.http.get(fallbackUrl, this.getRequestOptions()).pipe(
            map((res: any) => res?.data || res?.raw || res),
            catchError((err2: Error) => of({ error: err2 })),
          );
        }
        return of({ error });
      }),
    );
  }

  addProduct(product) {
    const addProductUrl = this.apiUrl + '/api/products/add';
    return this.http.post(addProductUrl, product, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  editProduct(product) {
    const editProductUrl = this.apiUrl + '/api/products/edit';
    return this.http.patch(editProductUrl, product, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAllProducts() {
    const productUrl = this.apiUrl + '/api/products/all';
    return this.http.get(productUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeProduct(name: string) {
    const removeProductUrl = this.apiUrl + '/api/products/' + name;
    return this.http.delete(removeProductUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  importCsvProducts(products: any[]) {
    const importUrl = this.apiUrl + '/api/products/import-csv';
    return this.http.post(importUrl, { products }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAllCategories() {
    const categoriesUrl = this.apiUrl + '/api/products/categories/all';
    return this.http.get(categoriesUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  editCategory(category) {
    const editCategoryUrl = this.apiUrl + '/api/products/categories/edit';
    return this.http.patch(editCategoryUrl, category, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeCategory(name: string) {
    const removeCategoryUrl = this.apiUrl + '/api/products/categories/' + name;
    return this.http.delete(removeCategoryUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  handleToken(token) {
    const tokenUrl = this.apiUrl + '/api/orders/stripe';
    return this.http.post(tokenUrl, token, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  makeOrder(req) {
    const addOrder = this.apiUrl + '/api/orders/add';
    return this.http.post(addOrder, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getUserOrders() {
    const userOrderUrl = this.apiUrl + '/api/orders';
    return this.http.get(userOrderUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getOrders() {
    const ordersUrl = this.apiUrl + '/api/orders/all';
    return this.http.get(ordersUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getOrder(id: string) {
    const orderUrl = this.apiUrl + '/api/orders/' + id;
    return this.http.get(orderUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  updateOrder(req) {
    const orderUpdateUrl = this.apiUrl + '/api/orders';
    return this.http.patch(orderUpdateUrl, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  deleteOrder(orderId: string) {
    const orderDeleteUrl = this.apiUrl + '/api/orders/' + orderId;
    return this.http.delete(orderDeleteUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  trackOrder(payload: { orderId?: string; trackingNumber?: string; email?: string; phone?: string }) {
    const trackUrl = this.apiUrl + '/api/orders/track';
    return this.http.post(trackUrl, payload, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getStripeSession(req) {
    const stripeSessionUrl = this.apiUrl + '/api/orders/stripe/session';
    return this.http.post(stripeSessionUrl, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  // ─── Shipping Methods ─────────────────────────────────────────────────────

  getShippingMethods(params?: { page?: number; limit?: number; pageSize?: number; search?: string; isActive?: boolean | string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.pageSize) httpParams = httpParams.set('limit', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.isActive !== undefined && params.isActive !== '' && params.isActive !== 'all') {
        httpParams = httpParams.set('isActive', params.isActive.toString());
      }
      if (params.status !== undefined && params.status !== '' && params.status !== 'all') {
        httpParams = httpParams.set('status', params.status);
      }
    }
    return this.http.get(this.apiUrl + '/api/orders/shipping-methods', { ...this.getRequestOptions(), params: httpParams }).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAllShippingMethods() {
    return this.http.get(this.apiUrl + '/api/orders/shipping-methods/all', this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  saveShippingMethod(data: any) {
    return this.http.post(this.apiUrl + '/api/orders/shipping-methods', data, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  deleteShippingMethod(id: string): Observable<any> {
    return this.http.delete(this.apiUrl + '/api/orders/shipping-methods/' + id, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  // ─── Payment Methods ──────────────────────────────────────────────────────

  getPaymentMethods(params?: { page?: number; limit?: number; pageSize?: number; search?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.pageSize) httpParams = httpParams.set('limit', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status !== undefined && params.status !== '') httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(this.apiUrl + '/api/orders/payment-methods', { ...this.getRequestOptions(), params: httpParams }).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAllPaymentMethods() {
    return this.http.get(this.apiUrl + '/api/orders/payment-methods/all', this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  savePaymentMethod(data: any) {
    return this.http.post(this.apiUrl + '/api/orders/payment-methods', data, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  deletePaymentMethod(id: string): Observable<any> {
    return this.http.delete(this.apiUrl + '/api/orders/payment-methods/' + id, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }


  getCart(lang?: string) {
    const withLangQuery = lang ? '?lang=' + lang : '';
    const cartUrl = this.apiUrl + '/api/cart' + withLangQuery;
    return this.http.get(cartUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  addToCart(params: string) {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const addToCartUrl = this.apiUrl + '/api/cart/add' + params + randomNum;
    return this.http.get(addToCartUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeFromCart(params: string) {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const removeFromCartUrl = this.apiUrl + '/api/cart/remove' + params + randomNum;
    return this.http.get(removeFromCartUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  updateCartQuantity(id: string, qty: number, lang = 'vi') {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const url = `${this.apiUrl}/api/cart/update-quantity?id=${encodeURIComponent(id)}&qty=${qty}&lang=${lang}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  deleteCartItem(id: string, lang = 'vi') {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const url = `${this.apiUrl}/api/cart/delete-item?id=${encodeURIComponent(id)}&lang=${lang}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  deleteCartItems(ids: string[], lang = 'vi') {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const joinedIds = ids.map(id => encodeURIComponent(id)).join(',');
    const url = `${this.apiUrl}/api/cart/delete-items?ids=${joinedIds}&lang=${lang}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  updateCartVariant(
    id: string,
    options: { variantId?: string; classification?: string; color?: string; size?: string },
    lang = 'vi',
  ) {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const params = new URLSearchParams();
    params.set('id', id);
    if (options.variantId) params.set('variantId', options.variantId);
    if (options.classification) params.set('classification', options.classification);
    if (options.color) params.set('color', options.color);
    if (options.size) params.set('size', options.size);
    params.set('lang', lang);

    const url = `${this.apiUrl}/api/cart/update-variant?${params.toString()}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  toggleCartItemSelect(id: string, selected: boolean, lang = 'vi') {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const url = `${this.apiUrl}/api/cart/toggle-select?id=${encodeURIComponent(id)}&selected=${selected}&lang=${lang}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  selectAllCartItems(selected: boolean, lang = 'vi') {
    this.ranNumber = this.ranNumber + 1;
    const randomNum = '&random=' + this.ranNumber;
    const url = `${this.apiUrl}/api/cart/select-all?selected=${selected}&lang=${lang}${randomNum}`;
    return this.http.get(url, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  mergeCart(guestItems: any[], lang = 'vi') {
    const url = `${this.apiUrl}/api/cart/merge?lang=${lang}`;
    return this.http.post(url, { items: guestItems }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  validateCoupon(code: string, subtotal: number) {
    const url = `${this.apiUrl}/api/orders/coupon/validate`;
    return this.http.post(url, { code, subtotal }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ valid: false, message: 'Lỗi kiểm tra mã giảm giá' })),
    );
  }

  getLangTranslations(lang: string) {
    const translationsUrl = this.apiUrl + '/api/translations?lang=' + lang;
    return this.http.get(translationsUrl).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAllTranslations() {
    const translationsUrl = this.apiUrl + '/api/translations/all';
    return this.http.get(translationsUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  editTranslation({ lang, keys }) {
    const translationsUpdateUrl = this.apiUrl + '/api/translations?lang=' + lang;
    return this.http.patch(translationsUpdateUrl, { keys: keys }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  editAllTranslation(translations: Translations[]) {
    const translationsUpdateUrl = this.apiUrl + '/api/translations/all';
    return this.http.patch(translationsUpdateUrl, translations, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getImages() {
    const getImagesUrl = this.apiUrl + '/api/admin/images';
    return this.http.get(getImagesUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  addProductImagesUrl({ image, titleUrl }) {
    const titleUrlQuery = titleUrl ? '?titleUrl=' + titleUrl : '';
    const addImageUrl = this.apiUrl + '/api/admin/images/add' + titleUrlQuery;
    return this.http.post(addImageUrl, { image }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeImage({ image, titleUrl }) {
    const titleUrlQuery = titleUrl ? '?titleUrl=' + titleUrl : '';
    const removeImageUrl = this.apiUrl + '/api/admin/images/remove' + titleUrlQuery;
    return this.http.post(removeImageUrl, { image }, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  uploadImage({ fileToUpload, titleUrl }: { fileToUpload: any; titleUrl?: string }) {
    if (isPlatformBrowser(this.platformId)) {
      const titleUrlQuery = titleUrl ? '?titleUrl=' + titleUrl : '';
      const accessToken = localStorage.getItem(accessTokenKey);
      const formData: FormData = new FormData();
      formData.append('file', fileToUpload);

      let headers = new HttpHeaders();
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined') {
        headers = headers.set('Authorization', 'Bearer ' + accessToken);
      }
      const sendHeaders = { headers, withCredentials: true };
      const uploadUrl = this.apiUrl + '/api/admin/images/upload' + titleUrlQuery;

      return this.http
        .post(uploadUrl, formData, {
          reportProgress: true,
          responseType: 'json',
          ...sendHeaders,
        })
        .pipe(
          map((response: any) => response),
          catchError((error: Error) => of({ error })),
        );
    }
  }

  sendContact(req) {
    const sendContactUrl = this.apiUrl + '/api/cheri/contact';
    return this.http.post(sendContactUrl, req, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getPages(query?) {
    const titlesQueryParams = query ? `?titles=${query.titles}&lang=${query.lang}` : '';
    const pagesUrl = this.apiUrl + '/api/cheri/page/all' + titlesQueryParams;
    return this.http.get(pagesUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getPage(query) {
    const pageUrl = this.apiUrl + '/api/cheri/page/' + query.titleUrl + '?lang=' + query.lang;
    return this.http.get(pageUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  addOrEditPage(pageReq) {
    const pageUrl = this.apiUrl + '/api/cheri/page';
    return this.http.post(pageUrl, pageReq, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removePage(titleUrl: string) {
    const pageUrl = this.apiUrl + '/api/cheri/page/' + titleUrl;
    return this.http.delete(pageUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getThemes() {
    const themesUrl = this.apiUrl + '/api/cheri/theme/all';
    return this.http.get(themesUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  addOrEditTheme(themeReq) {
    const themeUrl = this.apiUrl + '/api/cheri/theme';
    return this.http.post(themeUrl, themeReq, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeTheme(titleUrl: string) {
    const themeUrl = this.apiUrl + '/api/cheri/theme/' + titleUrl;
    return this.http.delete(themeUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getConfigs() {
    const configsUrl = this.apiUrl + '/api/cheri/config/all';
    return this.http.get(configsUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  addOrEditConfig(configReq) {
    const configUrl = this.apiUrl + '/api/cheri/config';
    return this.http.post(configUrl, configReq, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  removeConfig(titleUrl: string) {
    const configUrl = this.apiUrl + '/api/cheri/config/' + titleUrl;
    return this.http.delete(configUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getHomePublished(): Observable<any> {
    const homeUrl = this.apiUrl + '/api/cheri/home';
    return this.http.get(homeUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getHomeAdmin(): Observable<any> {
    const homeUrl = this.apiUrl + '/api/cheri/home/admin';
    return this.http.get(homeUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  publishHome(publishReq?: { sections?: any[]; updatedBy?: string }): Observable<any> {
    const homeUrl = this.apiUrl + '/api/cheri/home/publish';
    return this.http.post(homeUrl, publishReq || {}, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAboutPublished(): Observable<any> {
    const aboutUrl = this.apiUrl + '/api/cheri/about';
    return this.http.get(aboutUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  getAboutAdmin(): Observable<any> {
    const aboutUrl = this.apiUrl + '/api/cheri/about/admin';
    return this.http.get(aboutUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  publishAbout(publishReq?: { sections?: any[]; updatedBy?: string }): Observable<any> {
    const aboutUrl = this.apiUrl + '/api/cheri/about/publish';
    return this.http.post(aboutUrl, publishReq || {}, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
    );
  }

  // ── Admin Notifications (MongoDB notification-popup) ──
  getNotifications(recipientId: string = 'admin'): Observable<any[]> {
    const params = new HttpParams().set('recipientId', recipientId);
    return this.http.get<any[]>(`${this.apiUrl}/api/orders/notifications`, { ...this.getRequestOptions(), params }).pipe(
      catchError(() => of([]))
    );
  }

  getUnreadNotificationCount(recipientId: string = 'admin'): Observable<{ success: boolean; unreadCount: number }> {
    const params = new HttpParams().set('recipientId', recipientId);
    return this.http.get<{ success: boolean; unreadCount: number }>(`${this.apiUrl}/api/orders/notifications/unread-count`, { ...this.getRequestOptions(), params }).pipe(
      catchError(() => of({ success: false, unreadCount: 0 }))
    );
  }

  markNotificationAsRead(id: string, recipientId: string = 'admin'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/orders/notifications/${id}/read`, { recipientId }, this.getRequestOptions()).pipe(
      catchError((error) => of({ success: false, error }))
    );
  }

  markAllNotificationsAsRead(recipientId: string = 'admin'): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/orders/notifications/read-all`, { recipientId }, this.getRequestOptions()).pipe(
      catchError((error) => of({ success: false, error }))
    );
  }

  private initAuthTracking() {
    const selectors = inject(SignalStoreSelectors);
    combineLatest([toObservable(selectors.appLang), toObservable(selectors.user)]).subscribe(([lang, user]) => {
      if (lang) {
        this.currentLang = lang;
      }
      if (user && user.accessToken && isPlatformBrowser(this.platformId)) {
        localStorage.setItem(accessTokenKey, user.accessToken);
      }
      this.currentUser$.next(user);
    });
  }
}

