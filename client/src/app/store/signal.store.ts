import { SignalStoreSelectors } from './signal.store.selectors';
import { Injectable } from '@angular/core';
import { ApiService } from '../services/api.service';
import { User } from '../user/shared/models';
import { catchError, map, of } from 'rxjs';



@Injectable({
  providedIn: 'root',
})
export class SignalStore {


  constructor(private apiService: ApiService,
    private selectors: SignalStoreSelectors
  ) { }

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

  getUser = () => {
    this.selectors.userState.update((state) => ({ ...state, loading: true }));
    this.apiService.getUser().subscribe((response: any) => {
      if (response.error) {
        this.selectors.userState.update((state) => ({ ...state, loading: false }));
        return;
      }
      this.selectors.userState.update((state) => ({ ...state, user: response, loading: false }));
    });
  };

  storeUser = (payload) => {
    this.selectors.userState.update((state) => ({ ...state, user: payload, loading: false }));
  };

  signOut = (callback?: () => void) => {
    this.storeUser(null);
    this.selectors.productState.update((state) => ({ ...state, userOrders: null, order: null }));
    this.selectors.dashboardState.update((state) => ({ ...state, orders: null, order: null, allProducts: [], allCategories: [] }));
    this.apiService.signOut().subscribe({
      next: () => {
        if (callback) callback();
      },
      error: () => {
        if (callback) callback();
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
    });
  };

  addToCart = (payload) => {
    this.apiService.addToCart(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, cart: response }));
    });
  };

  removeFromCart = (payload) => {
    this.apiService.removeFromCart(payload).subscribe((response: any) => {
      this.selectors.productState.update((state) => ({ ...state, cart: response }));
    });
  };

  makeOrder = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, loading: true }));
    this.apiService.makeOrder(payload).subscribe((response: any) => {
      if (response.error || !response) {
        this.selectors.productState.update((state) => ({
          ...state,
          order: null,
          error: 'ORDER_SUBMIT_ERROR',
          loading: false,
        }));
      }
      this.selectors.productState.update((state) => ({
        ...state,
        order: response.result,
        cart: response.cart,
        error: response.error,
        loading: false,
      }));
    });
  };

  makeOrderWithPayment = (payload) => {
    this.selectors.productState.update((state) => ({ ...state, loading: true }));
    this.apiService.handleToken(payload).subscribe((response: any) => {
      if (response.error || !response) {
        this.selectors.productState.update((state) => ({
          ...state,
          order: null,
          error: 'ORDER_SUBMIT_ERROR',
          loading: false,
        }));
      }
      this.selectors.productState.update((state) => ({
        ...state,
        order: response.result,
        cart: response.cart,
        error: response.error,
        loading: false,
      }));
    });
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
      this.selectors.productState.update((state) => ({ ...state, userOrders: response }));
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
    this.apiService.deleteOrder(orderId).subscribe(() => {
      this.getOrders();
    });
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
