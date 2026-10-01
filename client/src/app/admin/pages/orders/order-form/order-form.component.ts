import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

interface OrderItemForm {
  clientId: number;
  productId: string;
  variantId: string | null;
  quantity: number;
  variants: any[];
  variantRequired: boolean;
  isLoadingVariants: boolean;
  variantRequestId: number;
}

@Component({
  selector: 'app-order-form',
  standalone: false,
  templateUrl: './order-form.component.html',
  styleUrls: ['./order-form.component.css']
})
export class OrderFormComponent implements OnInit {
  isEditMode = false;
  orderId: string | null = null;
  order: any = null;
  statusCode = '';
  products: any[] = [];
  paymentMethods: any[] = [];
  items: OrderItemForm[] = [];

  customerEmail = '';
  customerPhone = '';
  fullName = '';
  shippingPhone = '';
  shippingAddress = '';
  ward = '';
  district = '';
  province = '';
  paymentMethodId: string | null = null;
  shippingProvider = '';
  trackingNumber = '';
  estimatedDeliveryDate = '';
  notes = '';

  isLoadingOrder = false;
  isLoadingProducts = false;
  isLoadingPayments = false;
  isSubmitting = false;
  errorMessage = '';
  private nextClientId = 1;

  constructor(
    private adminService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = Boolean(this.orderId);
    if (this.isEditMode && this.orderId) {
      this.loadOrder(this.orderId);
      return;
    }
    this.addItem();
    this.loadProducts();
    this.loadPaymentMethods();
  }

  get isLoading(): boolean {
    return this.isLoadingOrder || this.isLoadingProducts || this.isLoadingPayments;
  }

  get canEditCustomerAddress(): boolean {
    return this.isEditMode && this.statusCode === 'PENDING';
  }

  get canEditFulfillment(): boolean {
    return this.isEditMode && ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING'].includes(this.statusCode);
  }

  addItem(): void {
    this.items.push({
      clientId: this.nextClientId++,
      productId: '',
      variantId: null,
      quantity: 1,
      variants: [],
      variantRequired: false,
      isLoadingVariants: false,
      variantRequestId: 0
    });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  onProductChange(item: OrderItemForm): void {
    item.variantId = null;
    item.variants = [];
    item.variantRequired = false;
    const requestId = ++item.variantRequestId;

    if (!item.productId) {
      item.isLoadingVariants = false;
      return;
    }

    item.isLoadingVariants = true;
    this.adminService.getProductVariants(item.productId).subscribe({
      next: (res) => {
        if (!this.items.includes(item) || requestId !== item.variantRequestId) return;
        item.isLoadingVariants = false;
        item.variants = Array.isArray(res?.data)
          ? res.data.filter((variant: any) => variant?.isActive !== false)
          : [];
        item.variantRequired = item.variants.length > 0;
        this.cdr.markForCheck();
      },
      error: () => {
        if (!this.items.includes(item) || requestId !== item.variantRequestId) return;
        item.isLoadingVariants = false;
        item.variants = [];
        item.variantRequired = false;
        this.errorMessage = 'Không thể tải biến thể sản phẩm. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  onSubmit(): void {
    if (this.isSubmitting || this.isLoading) return;
    this.errorMessage = '';

    if (this.isEditMode) {
      this.submitEdit();
      return;
    }

    const validationError = this.validateForm();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSubmitting = true;
    const payload = {
      customerEmail: this.customerEmail.trim(),
      customerPhone: this.customerPhone.trim(),
      shippingAddress: {
        fullName: this.fullName.trim(),
        phone: this.shippingPhone.trim(),
        address: this.shippingAddress.trim(),
        ward: this.ward.trim(),
        district: this.district.trim(),
        province: this.province.trim()
      },
      items: this.items.map(item => ({
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: Number(item.quantity)
      })),
      paymentMethodId: this.paymentMethodId || null,
      notes: this.notes.trim()
    };

    this.adminService.createOrder(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (!res?.success) {
          this.errorMessage = 'Không thể tạo đơn hàng. Vui lòng kiểm tra thông tin và thử lại.';
          this.cdr.markForCheck();
          return;
        }
        const createdId = res.data?._id || res.data?.id;
        if (createdId) {
          this.router.navigate(['/admin/orders', createdId]);
        } else {
          this.router.navigate(['/admin/orders']);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message
          || 'Không thể tạo đơn hàng. Vui lòng kiểm tra thông tin và thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  onCancel(): void {
    if (this.isEditMode && this.orderId) {
      this.router.navigate(['/admin/orders', this.orderId]);
    } else {
      this.router.navigate(['/admin/orders']);
    }
  }

  trackByClientId(_index: number, item: OrderItemForm): number {
    return item.clientId;
  }

  productLabel(product: any): string {
    return product?.vi?.title || product?.title || product?.name || product?.sku || 'Sản phẩm';
  }

  variantLabel(variant: any): string {
    const attributes = [variant?.color, variant?.size].filter(Boolean).join(' / ');
    return variant?.name || attributes || variant?.sku || 'Biến thể';
  }

  private loadOrder(id: string): void {
    this.isLoadingOrder = true;
    this.adminService.getOrderById(id).subscribe({
      next: (res) => {
        this.isLoadingOrder = false;
        if (!res?.success || !res?.data) {
          this.errorMessage = 'Không thể tải đơn hàng để chỉnh sửa.';
          this.cdr.markForCheck();
          return;
        }
        this.order = res.data;
        const knownStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'RETURNED'];
        const rawStatusCode = typeof this.order.raw?.status === 'string'
          ? this.order.raw.status.trim().toUpperCase()
          : '';
        this.statusCode = knownStatuses.includes(rawStatusCode) ? rawStatusCode : '';
        this.customerEmail = this.toSafeEditableString(this.order.customerEmail);
        this.customerPhone = this.toSafeEditableString(this.order.customerPhone || this.order.phone, true);
        const legacyAddress = Array.isArray(this.order.addresses) ? this.order.addresses[0] : null;
        const address = this.order.shippingAddress || legacyAddress || {};
        this.fullName = this.toSafeEditableString(address.fullName || address.name);
        this.shippingPhone = this.toSafeEditableString(address.phone, true);
        this.shippingAddress = this.toSafeEditableString(address.address || address.line1);
        this.ward = this.toSafeEditableString(address.ward);
        this.district = this.toSafeEditableString(address.district);
        this.province = this.toSafeEditableString(address.province || address.city);
        this.shippingProvider = this.toSafeEditableString(this.order.shippingProvider);
        this.trackingNumber = this.toSafeEditableString(this.order.trackingNumber, true);
        this.estimatedDeliveryDate = this.toDateInputValue(this.order.estimatedDeliveryDate);
        this.notes = this.toSafeEditableString(this.order.notes);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingOrder = false;
        this.errorMessage = 'Không thể tải đơn hàng để chỉnh sửa. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  private submitEdit(): void {
    if (!this.orderId) return;
    if (this.canEditCustomerAddress) {
      const email = this.trimEditableString(this.customerEmail);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.errorMessage = 'Email khách hàng không hợp lệ.';
        return;
      }
      if (!this.trimEditableString(this.fullName)
        || !this.trimEditableString(this.shippingPhone, true)
        || !this.trimEditableString(this.shippingAddress)) {
        this.errorMessage = 'Vui lòng nhập họ tên, số điện thoại và địa chỉ giao hàng.';
        return;
      }
    }

    const payload = this.buildEditPayload();
    this.isSubmitting = true;
    this.adminService.updateOrder(this.orderId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (!res?.success) {
          this.errorMessage = res?.message || 'Không thể cập nhật đơn hàng.';
          this.cdr.markForCheck();
          return;
        }
        this.router.navigate(['/admin/orders', this.orderId], { queryParams: { updated: '1' } });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Không thể cập nhật đơn hàng. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  private buildEditPayload(): any {
    const payload: any = { notes: this.trimEditableString(this.notes) };
    if (this.canEditCustomerAddress) {
      payload.customerEmail = this.trimEditableString(this.customerEmail);
      payload.customerPhone = this.trimEditableString(this.customerPhone, true);
      payload.shippingAddress = {
        fullName: this.trimEditableString(this.fullName),
        phone: this.trimEditableString(this.shippingPhone, true),
        address: this.trimEditableString(this.shippingAddress),
        ward: this.trimEditableString(this.ward),
        district: this.trimEditableString(this.district),
        province: this.trimEditableString(this.province)
      };
    }
    if (this.canEditFulfillment) {
      payload.shippingProvider = this.trimEditableString(this.shippingProvider);
      payload.trackingNumber = this.trimEditableString(this.trackingNumber, true);
      payload.estimatedDeliveryDate = this.estimatedDeliveryDate || null;
    }
    return payload;
  }

  private toSafeEditableString(value: unknown, allowNumber = false): string {
    if (typeof value === 'string') return value;
    if (allowNumber && typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }

  private trimEditableString(value: unknown, allowNumber = false): string {
    return this.toSafeEditableString(value, allowNumber).trim();
  }

  private toDateInputValue(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
    }
    if (typeof value !== 'string') return '';

    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
    if (!match || Number.isNaN(new Date(value).getTime())) return '';

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) {
      return '';
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private validateForm(): string {
    const email = this.customerEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Email khách hàng không hợp lệ.';
    }
    if (!this.fullName.trim() || !this.shippingPhone.trim() || !this.shippingAddress.trim()) {
      return 'Vui lòng nhập họ tên, số điện thoại và địa chỉ giao hàng.';
    }
    if (this.items.length === 0) return 'Đơn hàng phải có ít nhất một sản phẩm.';
    for (const item of this.items) {
      if (!item.productId) return 'Vui lòng chọn sản phẩm cho tất cả các dòng.';
      if (item.isLoadingVariants) return 'Vui lòng chờ tải biến thể sản phẩm.';
      if (item.variantRequired && !item.variantId) return 'Vui lòng chọn biến thể sản phẩm.';
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return 'Số lượng sản phẩm phải là số nguyên từ 1 trở lên.';
    }
    return '';
  }

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.loadProductsPage(1, []);
  }

  private loadProductsPage(page: number, accumulated: any[]): void {
    this.adminService.getProducts({ page, pageSize: 100, status: 'active' }).subscribe({
      next: (res) => {
        const pageItems = Array.isArray(res?.data) ? res.data : [];
        const products = this.mergeUniqueProducts(accumulated, pageItems);
        const totalPages = this.readTotalPages(res);
        if (page < totalPages) {
          this.loadProductsPage(page + 1, products);
          return;
        }
        this.products = products;
        this.isLoadingProducts = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingProducts = false;
        this.errorMessage = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  private loadPaymentMethods(): void {
    this.isLoadingPayments = true;
    this.loadPaymentMethodsPage(1, []);
  }

  private loadPaymentMethodsPage(page: number, accumulated: any[]): void {
    this.adminService.getPaymentMethods({ page, limit: 100, status: 'active' }).subscribe({
      next: (res) => {
        const pageItems = Array.isArray(res?.data)
          ? res.data.filter((method: any) => method?.isActive !== false && method?.status !== 'INACTIVE')
          : [];
        const methods = [...accumulated, ...pageItems];
        const totalPages = this.readTotalPages(res);
        if (page < totalPages) {
          this.loadPaymentMethodsPage(page + 1, methods);
          return;
        }
        this.paymentMethods = methods;
        this.isLoadingPayments = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingPayments = false;
        this.errorMessage = 'Không thể tải phương thức thanh toán. Vui lòng thử lại.';
        this.cdr.markForCheck();
      }
    });
  }

  private readTotalPages(res: any): number {
    const value = Number(res?.totalPages ?? res?.pagination?.totalPages ?? res?.pagination?.pages ?? 1);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
  }

  private mergeUniqueProducts(accumulated: any[], pageItems: any[]): any[] {
    const products = [...accumulated];
    const seenIds = new Set(products.map(product => String(product?._id || product?.id || '')).filter(Boolean));
    for (const product of pageItems) {
      const id = String(product?._id || product?.id || '');
      if (id && seenIds.has(id)) continue;
      if (id) seenIds.add(id);
      products.push(product);
    }
    return products;
  }
}
