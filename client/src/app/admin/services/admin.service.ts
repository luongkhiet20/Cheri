import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private baseUrl = environment.adminApiUrl || 'http://localhost:5000/api';

  currentUser$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient) {}

  // ── Dashboard ──────────────────────────────
  getDashboardStats(timeRange?: string): Observable<any> {
    let params = new HttpParams();
    if (timeRange) params = params.set('timeRange', timeRange);
    return this.http.get(`${this.baseUrl}/dashboard/stats`, { params });
  }

  // ── Products ───────────────────────────────
  getProducts(params?: { page?: number; pageSize?: number; search?: string; category?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.category) httpParams = httpParams.set('category', params.category);
      if (params.status) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(`${this.baseUrl}/products`, { params: httpParams });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/products/${id}`);
  }

  createProduct(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/products`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/products/${id}`);
  }

  bulkDeleteProducts(ids: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/bulk-delete`, { ids });
  }

  // ── CSV Import ─────────────────────────────
  downloadProductCsvTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/products/csv-template`, {
      responseType: 'blob'
    });
  }

  validateProductsCsv(csvContent: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/validate-csv`, { csvContent });
  }

  importProductsCsv(payload: { csvContent?: string; products?: any[] }): Observable<any> {
    return this.http.post(`${this.baseUrl}/products/import-csv`, payload);
  }

  // ── Categories ─────────────────────────────
  getCategories(): Observable<any> {
    return this.http.get(`${this.baseUrl}/categories`);
  }

  getCategoryById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/categories/${id}`);
  }

  createCategory(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories`, data);
  }

  updateCategory(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/categories/${id}`);
  }

  bulkDeleteCategories(ids: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/categories/bulk-delete`, { ids });
  }

  // ── Orders ─────────────────────────────────
  getOrders(): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders`);
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/orders/${id}`);
  }

  updateOrderStatus(id: string, status: string, note?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/${id}/status`, { status, note });
  }

  patchOrderStatus(id: string, status: string, note?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/orders/${id}/status`, { status, note });
  }

  deleteOrder(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/orders/${id}`);
  }

  bulkDeleteOrders(ids: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/orders/bulk-delete`, { ids });
  }

  // ── Users (Accounts) ────────────────────────
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
    return this.http.get(`${this.baseUrl}/users`, { params: httpParams });
  }

  getUserById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/users/${id}`);
  }

  createUser(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/users`, data);
  }

  updateUser(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/users/${id}`, data);
  }

  patchUser(id: string, data: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${id}`, data);
  }

  updateUserStatus(id: string, status?: boolean): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${id}/status`, status !== undefined ? { status } : {});
  }

  toggleUserStatus(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/users/${id}/status`, {});
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/users/${id}`);
  }

  bulkDeleteUsers(ids: string[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/users/bulk-delete`, { ids });
  }

  // ── Payment Methods ─────────────────────────
  getPaymentMethods(params?: { page?: number; limit?: number; pageSize?: number; search?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.pageSize) httpParams = httpParams.set('limit', params.pageSize.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status !== undefined && params.status !== '') httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(`${this.baseUrl}/payment-methods`, { params: httpParams });
  }

  getPaymentMethodById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/payment-methods/${id}`);
  }

  createPaymentMethod(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/payment-methods`, data);
  }

  updatePaymentMethod(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/payment-methods/${id}`, data);
  }

  updatePaymentMethodStatus(id: string, isActive?: boolean): Observable<any> {
    return this.http.patch(`${this.baseUrl}/payment-methods/${id}/status`, isActive !== undefined ? { isActive } : {});
  }

  togglePaymentMethod(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/payment-methods/${id}/status`, {});
  }

  deletePaymentMethod(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/payment-methods/${id}`);
  }

  // ── Shipping Methods ────────────────────────
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
    return this.http.get(`${this.baseUrl}/shipping-methods`, { params: httpParams });
  }

  getShippingMethodById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/shipping-methods/${id}`);
  }

  createShippingMethod(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/shipping-methods`, data);
  }

  updateShippingMethod(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/shipping-methods/${id}`, data);
  }

  updateShippingMethodStatus(id: string, isActive?: boolean): Observable<any> {
    return this.http.patch(`${this.baseUrl}/shipping-methods/${id}/status`, isActive !== undefined ? { isActive } : {});
  }

  toggleShippingMethod(id: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/shipping-methods/${id}/status`, {});
  }

  deleteShippingMethod(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/shipping-methods/${id}`);
  }

  // ── Inventory ──────────────────────────────
  getInventory(): Observable<any> {
    return this.http.get(`${this.baseUrl}/inventory`);
  }

  importInventory(productId: string, quantity: number, note?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/products/${productId}/inventory`, { quantity, note });
  }

  // ── Pages ──────────────────────────────────
  getPages(params?: { search?: string; status?: string }): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
    }
    return this.http.get(`${this.baseUrl}/pages`, { params: httpParams });
  }

  getPageById(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/pages/${id}`);
  }

  createPage(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/pages`, data);
  }

  updatePage(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/pages/${id}`, data);
  }

  patchPageStatus(id: string, status?: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/pages/${id}/status`, { status });
  }

  deletePage(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/pages/${id}`);
  }

  // ── Account (Admin Profile) ─────────────────
  getAccountProfile(): Observable<any> {
    return this.http.get(`${this.baseUrl}/account/me`).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  updateAccountProfile(data: { fullName: string; email: string; phone?: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/account/me`, data).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  uploadAccountAvatar(avatar: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/account/me/avatar`, { avatar }).pipe(
      tap((res: any) => {
        if (res && res.success && res.data) {
          this.currentUser$.next(res.data);
        }
      })
    );
  }

  changeAccountPassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/account/me/password`, data);
  }
}

