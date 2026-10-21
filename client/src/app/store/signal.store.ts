import { SignalStoreSelectors } from './signal.store.selectors';
import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { User } from '../user/shared/models';
import { accessTokenKey } from '../user/shared/constants';
import { catchError, map, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SignalStore {

  constructor(
    private apiService: ApiService,
    private selectors: SignalStoreSelectors,
    private router: Router,
    private ngZone: NgZone
  ) {
    if (this.apiService?.reviewCreated$) {
      this.apiService.reviewCreated$.subscribe(({ productId }) => {
        if (productId) {
          this.refreshProductRating(productId);
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === 'accessToken') {
          this.handleMultiTabStorageChange(event);
        }
      });
    }
  }

  private handleMultiTabStorageChange = (event: StorageEvent) => {
    this.ngZone.run(() => {
      const rawPath = (this.router.url || (typeof window !== 'undefined' ? window.location.pathname : '') || '').toLowerCase();
      const currentPath = rawPath.split('?')[0].split('#')[0];
      const lang = (this.selectors.userState()?.lang) || 'vi';

      if (!event.newValue) {
        // Tab 1 ĐĂNG XUẤT:
        console.log('[Store] Multi-tab sync: User logged out in another tab');
        this.cleanLocalSession();
        this.getCart(lang);

        if (currentPath.includes('/admin')) {
          this.router.navigate(['/' + lang + '/authorize/signin'], {
            queryParams: { returnUrl: '/admin', session: 'expired' }
          });
        } else if (currentPath.includes('/profile')) {
          this.router.navigate(['/' + lang + '/authorize/signin'], {
            queryParams: { session: 'expired' }
          });
        }
      } else {
        // Tab 1 ĐĂNG NHẬP / ĐĂNG KÝ THÀNH CÔNG (Token mới được cấp):
        console.log('[Store] Multi-tab sync: New token set in another tab');

        // 1. Đồng bộ tài khoản mới: nạp user mới, đơn hàng mới, giỏ hàng mới
        this.getUser((user) => {
          if (user) {
            this.getUserOrders();
            this.getCart(lang);
          }
        });

        // 2. Xử lý điều hướng theo trang hiện tại của Tab 2:
        const isAuthPage =
          currentPath.includes('/authorize') ||
          currentPath.includes('/signin') ||
          currentPath.includes('/signup') ||
          currentPath.includes('/login') ||
          currentPath.includes('/register');

        if (isAuthPage) {
          // Tab 2 đang ở trang Đăng nhập hoặc Đăng ký -> tự động chuyển về trang chủ
          this.router.navigateByUrl('/' + lang);
        } else if (currentPath.includes('/profile')) {
          // Tab 2 đang ở trang cá nhân -> đồng bộ tài khoản mới và tải lại dữ liệu theo tài khoản
          // getUser() và getUserOrders() đã được gọi ở trên để nạp dữ liệu mới
        } else {
          // Tab 2 đang ở trang chủ hoặc các trang công khai khác -> giữ nguyên trang
        }
      }
    });
  };

  refreshProductRating = (productId: string) => {
    if (!productId) return;
    this.apiService.getProductReviewStats(productId).subscribe({
      next: (stats: any) => {
        if (stats && !stats.error && stats.averageRating !== undefined) {
          const avgRating = stats.averageRating;
          const reviewCount = stats.reviewCount;
          this.selectors.productState.update((state) => {
            let updatedProduct = state.product;
            if (updatedProduct && (updatedProduct._id === productId || (updatedProduct as any).id === productId)) {
              updatedProduct = {
                ...updatedProduct,
                rating: avgRating,
                reviewCount,
                reviewsCount: reviewCount,
              };
            }
            let updatedProducts = state.products;
            if (Array.isArray(updatedProducts)) {
              updatedProducts = updatedProducts.map((p) => {
                if (p._id === productId || (p as any).id === productId) {
                  return {
                    ...p,
                    rating: avgRating,
                    reviewCount,
                    reviewsCount: reviewCount,
                  };
                }
                return p;
              });
            }
            return {
              ...state,
              product: updatedProduct,
              products: updatedProducts,
            };
          });
        }
      },
      error: () => {}
    });
  };

  signIn = (payload) => {
    this.selectors.userState.update((state) => ({ ...state, loading: true }));
    this.apiService.signIn(payload).subscribe((response: any) => {
      this.selectors.userState.update((state) => ({ ...state, user: response, loading: false }));
    });
  };

  signUp = (payload) => {
    this.selectors.userState.update((state) => ({ ...state, loading: true }));
    this.apiService.signUp(payload).subscribe(() => {
      this.selectors.userState.update((state) => ({ ...state, loading: false }));
    });
  };

  getUser = (callback?: (user: any) => void) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(accessTokenKey);
      if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
        if (this.selectors.user()) {
          this.storeUser(null);
        }
        this.selectors.userState.update((state) => ({ ...state, loading: false }));
        if (callback) callback(null);
        return;
      }
    }
    this.selectors.userState.update((state) => ({ ...state, loading: true }));
    this.apiService.getUser().subscribe((response: any) => {
      if (!response || response.error) {
        this.selectors.userState.update((state) => ({ ...state, loading: false }));
        if (callback) callback(null);
        return;
      }
      const user = response.data || response;
      this.selectors.userState.update((state) => ({ ...state, user, loading: false }));
      this.apiService.currentUser$.next(user);
      if (callback) callback(user);
    });
  };

  storeUser = (payload: any) => {
    this.selectors.userState.update((state) => ({ ...state, user: payload, loading: false }));
    this.apiService.currentUser$.next(payload);
  };

  mergeGuestCartIfAny = (lang: string = 'vi', callback?: (cart: any) => void) => {
    const guestItems = this.apiService.getGuestCartLocal();
    if (guestItems && guestItems.length > 0) {
      console.log('[Cart] Login detected with guest items. Merging guest cart into user:', guestItems);
      this.apiService.mergeCart(guestItems, lang).subscribe({
        next: (res: any) => {
          const mergedCart = res?.cart || res;
          if (mergedCart && !mergedCart.error) {
            this.selectors.productState.update((state) => ({ ...state, cart: mergedCart }));
          }
          // XÓA NGAY LẬP TỨC guest cart sau khi merge
          this.apiService.clearGuestCartLocal();
          console.log('[Cart] Merge complete. Guest cart cleared.');
          if (callback) callback(mergedCart);
        },
        error: (err) => {
          console.error('[Cart] Merge error:', err);
          this.apiService.clearGuestCartLocal();
          this.getCart(lang);
          if (callback) callback(null);
        },
      });
    } else {
      console.log('[Cart] Login with no guest items. Loading user cart from DB.');
      this.getCart(lang);
      if (callback) callback(null);
    }
  };

  cleanLocalSession = () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('cheri_cart_selected_ids');
        localStorage.removeItem('cheri_cart_payment_method');
        localStorage.removeItem('cheri_cart_shipping_method');
        localStorage.removeItem('cheri_wishlist');
        localStorage.removeItem('wishlist');
        localStorage.removeItem('cheri_wishlist_items');

        const pendingNotify = sessionStorage.getItem('cheri_pending_notify');
        sessionStorage.clear();
        if (pendingNotify) {
          sessionStorage.setItem('cheri_pending_notify', pendingNotify);
        }

        const cookieNames = ['jwt', 'token', 'accessToken', 'connect.sid'];
        const currentCookies = document.cookie || '';
        const hasAuthCookie = cookieNames.some((name) => currentCookies.includes(`${name}=`));
        if (hasAuthCookie) {
          cookieNames.forEach((name) => {
            document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            if (window.location.hostname) {
              document.cookie = `${name}=; Path=/; Domain=${window.location.hostname}; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
            }
          });
        }
      } catch (e) {
        console.warn('[Store] cleanLocalSession warning:', e);
      }
    }

    if (this.selectors.user()) {
      this.storeUser(null);
      this.apiService.currentUser$.next(null);
    }
    const currentProduct = this.selectors.productState();
    if (currentProduct.cart || currentProduct.userOrders || currentProduct.order) {
      this.selectors.productState.update((state) => ({ ...state, cart: null, userOrders: null, order: null }));
    }
    const currentDashboard = this.selectors.dashboardState();
    if (currentDashboard.orders || currentDashboard.order || currentDashboard.allProducts?.length || currentDashboard.allCategories?.length) {
      this.selectors.dashboardState.update((state) => ({ ...state, orders: null, order: null, allProducts: [], allCategories: [] }));
    }
    this.apiService.clearGuestCartLocal(true);
  };

  signOut = (callback?: (res: { success: boolean; networkError?: boolean; serverError?: boolean }) => void) => {
    console.log('[Cart] signOut triggered: Clearing user and cart state');
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    this.cleanLocalSession();

    this.apiService.signOut(token).subscribe({
      next: () => {
        // Tải lại giỏ hàng cho Guest mới (giỏ rỗng)
        this.getCart('vi');
        if (callback) callback({ success: true });
      },
      error: (err: any) => {
        this.getCart('vi');
        const status = err?.status || 0;
        const isNetwork = status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine);
        if (callback) callback({ success: false, networkError: isNetwork, serverError: !isNetwork });
      }
    });
  };

  changeLanguage = (payload) => {
    this.selectors.userState.update((state) => ({ ...state, lang: payload.lang, currency: payload.currency }));
  };

  sendContact = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.sendContact(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
    });
  };

  getPages = (payload?) => {
    this.apiService.getPages(payload).subscribe((response: any) => {
      this.selectors.cheriState.update((state) => ({ ...state, pages: response }));
    });
  };

  getPage = (payload) => {
    this.apiService.getPage(payload).subscribe((response: any) => {
      this.selectors.cheriState.update((state) => ({ ...state, page: response }));
    });
  };

  addOrEditPage = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.addOrEditPage(payload).subscribe((response: any) => {
      this.selectors.cheriState.update((state) => ({ ...state, page: response, loading: false }));
      this.getPages();
    });
  };

  removePage = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.removePage(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
      this.getPages();
    });
  };

  getThemes = () => {
    this.apiService.getThemes().subscribe((response: any) => {
      this.selectors.cheriState.update((state) => ({ ...state, themes: response }));
    });
  };

  addOrEditTheme = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.addOrEditTheme(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
      this.getThemes();
    });
  };

  removeTheme = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.removeTheme(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
      this.getThemes();
    });
  };

  getConfigs = () => {
    this.apiService.getConfigs().subscribe((response: any) => {
      this.selectors.cheriState.update((state) => ({ ...state, configs: response }));
    });
  };

  addOrEditConfig = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.addOrEditConfig(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
      this.getConfigs();
    });
  };

  removeConfig = (payload) => {
    this.selectors.cheriState.update((state) => ({ ...state, loading: true }));
    this.apiService.removeConfig(payload).subscribe(() => {
      this.selectors.cheriState.update((state) => ({ ...state, loading: false }));
      this.getConfigs();
    });
  };

  getProducts = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, loadingProducts: true }));
    this.apiService.getProducts(payload).subscribe((response: any) => {
      if (response.error) {
        this.selectors.productState.update((state) => ({ ...state, loadingProducts: false }));
        return;
      }
      this.selectors.productState.update((state) => ({
        ...state,
        products: response.products,
        pagination: response.pagination,
        maxPrice: response.maxPrice,
        minPrice: response.minPrice,
        loadingProducts: false,
      }));
    });
  };

  getCategories = (payload) => {
    this.apiService.getCategories(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, categories: response }));
    });
  };

  getProduct = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, loadingProduct: true }));
    this.apiService.getProduct(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, product: response, loadingProduct: false }));
    });
  };

  getProductSearch = (payload) => {
    this.apiService.getProductsSearch(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, productsTitles: response }));
    });
  };

  getCart = (payload) => {
    this.apiService.getCart(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, cart: response }));
      this.apiService.saveGuestCartLocal(response);
    });
  };

  addToCart = (payload) => {
    this.apiService.addToCart(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, cart: response }));
      this.apiService.saveGuestCartLocal(response);
    });
  };

  removeFromCart = (payload) => {
    this.apiService.removeFromCart(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, cart: response }));
      this.apiService.saveGuestCartLocal(response);
    });
  };

  updateCartQuantity = (id: string, qty: number, lang = 'vi') => {
    return this.apiService.updateCartQuantity(id, qty, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.saveGuestCartLocal(response);
        }
        return response;
      })
    );
  };

  deleteCartItem = (id: string, lang = 'vi') => {
    return this.apiService.deleteCartItem(id, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.saveGuestCartLocal(response);
        }
        return response;
      })
    );
  };

  deleteCartItems = (ids: string[], lang = 'vi') => {
    return this.apiService.deleteCartItems(ids, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.saveGuestCartLocal(response);
        }
        return response;
      })
    );
  };

  updateCartVariant = (
    id: string,
    options: { variantId?: string; classification?: string; color?: string; size?: string },
    lang = 'vi',
  ) => {
    return this.apiService.updateCartVariant(id, options, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          const cartData = response.cart || response;
          this.selectors.productState.update((state) => ({ ...state, cart: cartData }));
          this.apiService.saveGuestCartLocal(cartData);
        }
        return response;
      }),
    );
  };

  toggleCartItemSelect = (id: string, selected: boolean, lang = 'vi') => {
    return this.apiService.toggleCartItemSelect(id, selected, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.saveGuestCartLocal(response);
        }
        return response;
      }),
    );
  };

  selectAllCartItems = (selected: boolean, lang = 'vi') => {
    return this.apiService.selectAllCartItems(selected, lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.saveGuestCartLocal(response);
        }
        return response;
      }),
    );
  };

  makeOrder = (payload: any, callback?: (response: any) => void) => {
    this.selectors.productState.update((state) => ({ ...state, loading: true }));
    this.apiService.makeOrder(payload).subscribe((response: any) => {
      const errorMsg = response?.error || (!response ? 'ORDER_SUBMIT_ERROR' : '');
      if (errorMsg) {
        this.selectors.productState.update((state) => ({
          ...state,
          order: null,
          error: typeof errorMsg === 'string' ? errorMsg : (errorMsg.message || 'ORDER_SUBMIT_ERROR'),
          loading: false,
        }));
        if (callback) callback(response);
        return;
      }
      const updatedCart = response.cart || { items: [], totalQty: 0, totalPrice: 0 };
      this.selectors.productState.update((state) => ({
        ...state,
        order: response.result,
        cart: updatedCart,
        error: '',
        loading: false,
      }));
      if (!this.selectors.user()) {
        this.apiService.saveGuestCartLocal(updatedCart);
      }
      if (callback) callback(response);
    });
  };

  makeOrderWithPayment = (payload: any, callback?: (response: any) => void) => {
    this.selectors.productState.update((state) => ({ ...state, loading: true }));
    this.apiService.handleToken(payload).subscribe((response: any) => {
      const errorMsg = response?.error || (!response ? 'ORDER_SUBMIT_ERROR' : '');
      if (errorMsg) {
        this.selectors.productState.update((state) => ({
          ...state,
          order: null,
          error: typeof errorMsg === 'string' ? errorMsg : (errorMsg.message || 'ORDER_SUBMIT_ERROR'),
          loading: false,
        }));
        if (callback) callback(response);
        return;
      }
      const updatedCart = response.cart || { items: [], totalQty: 0, totalPrice: 0 };
      this.selectors.productState.update((state) => ({
        ...state,
        order: response.result,
        cart: updatedCart,
        error: '',
        loading: false,
      }));
      if (!this.selectors.user()) {
        this.apiService.saveGuestCartLocal(updatedCart);
      }
      if (callback) callback(response);
    });
  };

  clearCart = (lang = 'vi') => {
    return this.apiService.clearCart(lang).pipe(
      map((response: any) => {
        if (response && !response.error) {
          this.selectors.productState.update((state) => ({ ...state, cart: response }));
          this.apiService.clearGuestCartLocal(false);
        }
        return response;
      }),
    );
  };

  getStripeSession = (payload) => {
    this.apiService.getStripeSession(payload);
  };

  // ─── Shipping Methods ────────────────────────────────────────────────────

  getShippingMethods = () => {
    this.apiService.getShippingMethods().subscribe((response: any) => {
      if (!response?.error) {
        this.selectors.productState.update((state) => ({ ...state, shippingMethods: response }));
      }
    });
  };

  getAllShippingMethods = () => {
    this.apiService.getAllShippingMethods().subscribe((response: any) => {
      if (!response?.error) {
        this.selectors.dashboardState.update((state) => ({ ...state, shippingMethods: response }));
      }
    });
  };

  saveShippingMethod = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.saveShippingMethod(payload).subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
      if (callback) callback(response);
    });
  };

  deleteShippingMethod = (id: string, callback?: () => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.deleteShippingMethod(id).subscribe(() => {
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
      if (callback) callback();
    });
  };

  // ─── Payment Methods ─────────────────────────────────────────────────────

  getPaymentMethods = () => {
    this.apiService.getPaymentMethods().subscribe((response: any) => {
      if (!response?.error) {
        this.selectors.productState.update((state) => ({ ...state, paymentMethods: response }));
      }
    });
  };

  getAllPaymentMethods = () => {
    this.apiService.getAllPaymentMethods().subscribe((response: any) => {
      if (!response?.error) {
        this.selectors.dashboardState.update((state) => ({ ...state, paymentMethods: response }));
      }
    });
  };

  savePaymentMethod = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.savePaymentMethod(payload).subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
      if (callback) callback(response);
    });
  };

  deletePaymentMethod = (id: string, callback?: () => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.deletePaymentMethod(id).subscribe(() => {
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
      if (callback) callback();
    });
  };


  getUserOrders = () => {
    this.apiService.getUserOrders().subscribe((response: any) => {
      const orders = Array.isArray(response)
        ? response
        : (Array.isArray(response?.data) ? response.data : (Array.isArray(response?.orders) ? response.orders : []));
      this.selectors.productState.update((state) => ({ ...state, userOrders: orders }));
    });
  }

  filterPrice = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, priceFilter: payload }));
  };

  updatePosition = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, position: payload }));
  };

  cleanError = () => {
    this.selectors.productState.update((state) => ({ ...state, order: null, error: '' }));
  };

  getOrders = () => {
    this.apiService.getOrders().subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, orders: response }));
    });
  }

  getOrder = (payload) => {
    this.apiService.getOrder(payload).subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, order: response }));
      this.selectors.productState.update((state) => ({ ...state, order: response }));
    });
  }

  removeOrder = (orderId: string) => {
    // Đã vô hiệu hóa: Đơn hàng là dữ liệu nghiệp vụ cần lưu trữ để tra cứu và đối soát
    console.warn('Thao tác xóa đơn hàng đã bị vô hiệu hóa để bảo vệ dữ liệu nghiệp vụ.');
  }

  addProduct = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.addProduct(payload).subscribe({
      next: (response: any) => {
        if (response && !response.error) {
          this.getAllProducts();
          this.getAllCategories();
        }
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback(response);
        }
      },
      error: (err: any) => {
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback({ error: err });
        }
      }
    });
  }

  editProduct = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.editProduct(payload).subscribe({
      next: (response: any) => {
        if (response && !response.error) {
          this.getAllProducts();
          this.getAllCategories();
        }
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback(response);
        }
      },
      error: (err: any) => {
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback({ error: err });
        }
      }
    });
  }

  removeProduct = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.removeProduct(payload).subscribe({
      next: (response: any) => {
        if (response && !response.error) {
          this.getAllProducts();
          this.getAllCategories();
        }
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback(response);
        }
      },
      error: (err: any) => {
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) {
          callback({ error: err });
        }
      }
    });
  }

  importCsvProducts = (payload, callback?: (result: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.importCsvProducts(payload).subscribe((response: any) => {
      this.getAllProducts();
      this.getAllCategories();
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
      if (callback) {
        callback(response);
      }
    });
  }

  storeProduct = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, product: payload, loadingProduct: false }));
  }

  getAllProducts = (callback?: (err?: any) => void) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.getAllProducts().subscribe({
      next: (response: any) => {
        if (response && !response.error && Array.isArray(response)) {
          this.selectors.dashboardState.update((state) => ({ ...state, allProducts: response, loading: false }));
          if (callback) callback(null);
        } else {
          console.error('Lỗi khi tải danh sách sản phẩm:', response?.error || response);
          this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
          if (callback) callback(response?.error || 'Lỗi khi tải danh sách sản phẩm');
        }
      },
      error: (err) => {
        console.error('Lỗi kết nối khi tải danh sách sản phẩm:', err);
        this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
        if (callback) callback(err);
      }
    });
  }

  getAllCategories = () => {
    this.apiService.getAllCategories().subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, allCategories: response }));
    });
  }

  editCategory = (payload) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.editCategory(payload).subscribe(() => {
      this.getAllCategories();
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
    });
  }

  removeCategory = (payload) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.removeCategory(payload).subscribe(() => {
      this.getAllCategories();
      this.selectors.dashboardState.update((state) => ({ ...state, loading: false }));
    });
  }

  getImages = () => {
    this.apiService.getImages().subscribe((response: any) => {
      if (response.error) {
        return;
      }
      this.selectors.dashboardState.update((state) => ({ ...state, productImages: response.all }));
    });
  }

  addProductImagesUrl = (payload, callback?: (result: any) => void) => {
    this.apiService.addProductImagesUrl(payload).subscribe({
      next: (response: any) => {
        if (response && !response.error) {
          if (response.titleUrl) {
            this.selectors.productState.update((state) => ({ ...state, product: response }));
          }
          if (response.all) {
            this.selectors.dashboardState.update((state) => ({ ...state, productImages: response.all }));
          }
        }
        if (callback) {
          callback(response);
        }
      },
      error: (err: any) => {
        if (callback) {
          callback({ error: err });
        }
      }
    });
  }

  removeImage = (payload, callback?: (result: any) => void) => {
    this.apiService.removeImage(payload).subscribe({
      next: (response: any) => {
        if (response && !response.error) {
          if (response.titleUrl) {
            this.selectors.productState.update((state) => ({ ...state, product: response }));
          }
          if (response.all) {
            this.selectors.dashboardState.update((state) => ({ ...state, productImages: response.all }));
          }
        }
        if (callback) {
          callback(response);
        }
      },
      error: (err: any) => {
        if (callback) {
          callback({ error: err });
        }
      }
    });
  }

  storeProductImages = (payload) => {
    this.selectors.dashboardState.update((state) => ({ ...state, productImages: payload.all }));
  }

  updateOrder = (payload) => {
    this.apiService.updateOrder(payload).subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, order: response }));
      this.getOrders();
    });
  }

  getAllTranslations = () => {
    this.apiService.getAllTranslations().subscribe((response: any) => {
      this.selectors.dashboardState.update((state) => ({ ...state, translations: response }));
    });
  }

  editTranslation = (payload) => {
    this.selectors.dashboardState.update((state) => ({ ...state, loading: true }));
    this.apiService.editAllTranslation(payload).subscribe((response: any) => {
      this.selectors.dashboardState.update(state => ({
        ...state,
        loading: false,
        translations: state.translations.map(trans => trans._id === response._id ? response : trans)
      }))
    })
  };

}
