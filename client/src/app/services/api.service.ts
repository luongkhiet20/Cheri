import { toObservable } from '@angular/core/rxjs-interop';
import { WindowService } from './window.service';
import { catchError, map, tap } from 'rxjs/operators';
import { Inject, Injectable, Optional, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { environment } from '../../environments/environment';
import { Translations } from '../shared/models';
import { accessTokenKey } from '../shared/constants';
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

  public getRequestOptions() {
    let headers = new HttpHeaders();
    if (isPlatformBrowser(this.platformId)) {
      const accessToken = localStorage.getItem(accessTokenKey);
      if (accessToken && accessToken !== 'null' && accessToken !== 'undefined' && accessToken.trim() !== '') {
        headers = headers.set('Authorization', 'Bearer ' + accessToken);
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

  getProducts(req: any = {}): Observable<any> {
    const lang = req.lang || 'vi';
    const page = req.page !== undefined ? req.page : 1;
    const sort = req.sort || 'newest';
    const { category, maxPrice, minPrice, stock, rating, search, pageSize } = req;
    const catStr = Array.isArray(category) ? category.join(',') : (category || '');
    const addCategory = catStr ? { category: catStr } : {};
    const categoryQuery = catStr ? '&category=' + encodeURIComponent(catStr) : '';
    const priceQuery = maxPrice ? '&maxPrice=' + maxPrice : '';
    const minPriceQuery = minPrice ? '&minPrice=' + minPrice : '';
    const stockQuery = stock && stock !== 'all' ? '&stock=' + stock : '';
    const ratStr = Array.isArray(rating) ? rating.join(',') : (rating !== undefined && rating !== null ? String(rating) : '');
    const ratingQuery = ratStr && ratStr !== '0' ? '&rating=' + encodeURIComponent(ratStr) : '';
    const searchQuery = search ? '&search=' + encodeURIComponent(search) : '';
    const pageSizeQuery = pageSize ? '&pageSize=' + pageSize : '';
    const productsUrl = this.apiUrl + '/api/products?lang=' + lang + '&page=' + page + '&sort=' + sort + categoryQuery + priceQuery + minPriceQuery + stockQuery + ratingQuery + searchQuery + pageSizeQuery;
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
      catchError((error: Error) => of({ success: false, error, data: [], products: [] } as any)),
    );
  }

  getCategories(lang: string = 'vi'): Observable<any> {
    const categoriesUrl = this.apiUrl + '/api/products/categories?lang=' + lang;
    return this.http.get(categoriesUrl, this.getRequestOptions()).pipe(
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
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
      map((response: any) => response),
      catchError((error: Error) => of({ error })),
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

  uploadImage({ fileToUpload, titleUrl }) {
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

  private initAuthTracking() {
    const selectors = inject(SignalStoreSelectors);
    combineLatest([toObservable(selectors.appLang), toObservable(selectors.user)]).subscribe(([lang, user]) => {
      if (lang) {
        this.currentLang = lang;
      }
      if (user && user.accessToken && isPlatformBrowser(this.platformId)) {
        localStorage.setItem(accessTokenKey, user.accessToken);
      }
    });
  }

  // ══════════════════════════════════════════════
  // ── ADMIN METHODS ─────────────────────────────
  // ══════════════════════════════════════════════

  // ── Dashboard ──────────────────────────────
  getDashboardStats(timeRange?: string): Observable<any> {
    let params = new HttpParams();
    if (timeRange) params = params.set('timeRange', timeRange);
    return this.http.get(`${this.apiUrl}/dashboard/stats`, { params });
  }

  // ── Products (Admin) ───────────────────────
  getAdminProducts(params?: { page?: number; pageSize?: number; search?: string; category?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.status) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(`${this.apiUrl}/products`, { params: httpParams });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/products`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/products/${id}`);
  }

  bulkDeleteProducts(ids: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/products/bulk-delete`, { ids });
  }

  // ── CSV Import ─────────────────────────────
  downloadProductCsvTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/products/csv-template`, {
      responseType: 'blob'
    });
  }

  validateProductsCsv(csvContent: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/products/validate-csv`, { csvContent });
  }

  importProductsCsv(payload: { csvContent?: string; products?: any[] }): Observable<any> {
    return this.http.post(`${this.apiUrl}/products/import-csv`, payload);
  }

  // ── Categories (Admin) ─────────────────────
  getAdminCategories(): Observable<any> {
    return this.http.get(`${this.apiUrl}/categories`);
  }

  getCategoryById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/categories/${id}`);
  }

  createCategory(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/categories`, data);
  }

  updateCategory(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/categories/${id}`);
  }

  // ── Orders (Admin) ─────────────────────────
  getAdminOrders(): Observable<any> {
    return this.http.get(`${this.apiUrl}/orders`);
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/orders/${id}`);
  }

  updateOrderStatus(id: string, status: string, note?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/orders/${id}/status`, { status, note });
  }

  patchOrderStatus(id: string, status: string, note?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/orders/${id}/status`, { status, note });
  }

  // ── Users (Accounts) ────────────────────────
  getUserById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/auth/users/${id}`, this.getRequestOptions());
  }

  patchUser(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/auth/users/${id}`, data, this.getRequestOptions());
  }

  updateUserStatus(id: string, status?: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/auth/users/${id}/status`, status !== undefined ? { status } : {}, this.getRequestOptions());
  }

  toggleUserStatus(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/auth/users/${id}/status`, {}, this.getRequestOptions());
  }

  bulkDeleteUsers(ids: string[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/auth/users/bulk-delete`, { ids }, this.getRequestOptions());
  }

  // ── Payment Methods (Admin extras) ────────────────────────
  getPaymentMethodById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/orders/payment-methods/${id}`, this.getRequestOptions());
  }

  createPaymentMethod(data: any): Observable<any> {
    return this.savePaymentMethod(data);
  }

  updatePaymentMethod(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/orders/payment-methods/${id}`, data, this.getRequestOptions());
  }

  updatePaymentMethodStatus(id: string, isActive?: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/orders/payment-methods/${id}/status`, isActive !== undefined ? { isActive } : {}, this.getRequestOptions());
  }

  togglePaymentMethod(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/orders/payment-methods/${id}/status`, {}, this.getRequestOptions());
  }

  // ── Shipping Methods (Admin extras) ───────────────────────
  getShippingMethodById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/orders/shipping-methods/${id}`, this.getRequestOptions());
  }

  createShippingMethod(data: any): Observable<any> {
    return this.saveShippingMethod(data);
  }

  updateShippingMethod(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/orders/shipping-methods/${id}`, data, this.getRequestOptions());
  }

  updateShippingMethodStatus(id: string, isActive?: boolean): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/orders/shipping-methods/${id}/status`, isActive !== undefined ? { isActive } : {}, this.getRequestOptions());
  }

  toggleShippingMethod(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/api/orders/shipping-methods/${id}/status`, {}, this.getRequestOptions());
  }

  // ── Inventory ──────────────────────────────
  getInventory(): Observable<any> {
    return this.http.get(`${this.apiUrl}/inventory`);
  }

  importInventory(productId: string, quantity: number, note?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/products/${productId}/inventory`, { quantity, note });
  }

  // ── Pages (Admin) ──────────────────────────
  getAdminPages(params?: { search?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(`${this.apiUrl}/pages`, { params: httpParams });
  }

  getPageById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/pages/${id}`);
  }

  createPage(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/pages`, data);
  }

  updatePage(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/pages/${id}`, data);
  }

  patchPageStatus(id: string, status?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/pages/${id}/status`, { status });
  }

  deletePage(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/pages/${id}`);
  }

  // ── Account (Admin Profile) ─────────────────
  getAccountProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/account/me`).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  updateAccountProfile(data: { fullName: string; email: string; phone?: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/account/me`, data).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  uploadAccountAvatar(avatar: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/account/me/avatar`, { avatar }).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  changeAccountPassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/account/me/password`, data);
  }
}
