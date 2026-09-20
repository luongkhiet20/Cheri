import { toObservable } from '@angular/core/rxjs-interop';
import { WindowService } from './window.service';
import { catchError, map } from 'rxjs/operators';
import { Inject, Injectable, Optional, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';

import { environment } from '../../environments/environment';
import { Translations } from '../shared/models';
import { accessTokenKey } from '../shared/constants';
import { SignalStoreSelectors } from '../store/signal.store.selectors';
import { combineLatest, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  apiUrl = environment.apiUrl;
  ranNumber = 0;
  private currentLang = 'vi';

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

  getProducts(req: any = {}) {
    const lang = req.lang || 'vi';
    const page = req.page !== undefined ? req.page : 1;
    const sort = req.sort || 'newest';
    const { category, maxPrice } = req;
    const addCategory = category ? { category } : {};
    const categoryQuery = category ? '&category=' + category : '';
    const priceQuery = maxPrice ? '&maxPrice=' + maxPrice : '';
    const productsUrl = this.apiUrl + '/api/products?lang=' + lang + '&page=' + page + '&sort=' + sort + categoryQuery + priceQuery;
    return this.http.get(productsUrl, this.getRequestOptions()).pipe(
      map((data: any) => ({
        products: (data?.all || []).map((product) => ({
          ...product,
          tags: (product.tags || []).filter(Boolean).map((cat: string) => cat.toLowerCase()),
        })),
        pagination: data?.pagination,
        maxPrice: data?.maxPrice,
        minPrice: data?.minPrice,
        ...addCategory,
      })),
      catchError((error: Error) => of({ error })),
    );
  }

  getCategories(lang: string) {
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

  getStripeSession(req) {
    const stripeSessionUrl = this.apiUrl + '/api/orders/stripe/session';
    return this.http.post(stripeSessionUrl, req, this.getRequestOptions()).pipe(
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
}
