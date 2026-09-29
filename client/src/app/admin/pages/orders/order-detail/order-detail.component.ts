import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

interface StatusOption {
  code: string;
  label: string;
  variant: 'neutral' | 'warning' | 'primary' | 'success' | 'danger';
}

@Component({
  selector: 'app-order-detail',
  standalone: false,
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit {
  orderId: string | null = null;
  order: any = null;

  isLoading = true;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Status transition state
  selectedNextStatus = '';
  statusNote = '';
  statusValidationMessage = '';
  isUpdatingStatus = false;
  confirmOpen = false;
  confirmDialogTitle = '';
  confirmDialogMessage = '';

  // Business state transitions rule
  readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'CANCELLED'],
    CONFIRMED: [],
    PROCESSING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: [],
    RETURNED: []
  };

  readonly ALL_STATUSES: StatusOption[] = [
    { code: 'PENDING', label: 'Chờ xác nhận', variant: 'neutral' },
    { code: 'CONFIRMED', label: 'Đã xác nhận', variant: 'primary' },
    { code: 'PROCESSING', label: 'Đang xử lý', variant: 'warning' },
    { code: 'SHIPPING', label: 'Đang giao', variant: 'primary' },
    { code: 'DELIVERED', label: 'Đã giao', variant: 'success' },
    { code: 'CANCELLED', label: 'Đã hủy', variant: 'danger' },
    { code: 'RETURNED', label: 'Đã hoàn trả', variant: 'warning' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.orderId = this.route.snapshot.paramMap.get('id');
    if (!this.orderId || this.orderId.trim() === '') {
      this.isNotFound = true;
      this.isLoading = false;
      return;
    }
    this.loadOrderDetail(this.orderId);
  }

  loadOrderDetail(id: string): void {
    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getOrderById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.order = res.data;
          this.selectedNextStatus = '';
          this.statusNote = '';
          this.statusValidationMessage = '';
        } else {
          this.isNotFound = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 404 || err.status === 400) {
          this.isNotFound = true;
        } else {
          this.errorMessage = err.error?.message || 'Không thể tải thông tin đơn hàng. Vui lòng thử lại.';
        }
        console.error('Error fetching order detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  getStatusMeta(code: string): StatusOption | undefined {
    return this.ALL_STATUSES.find(s => s.code === (code || '').toUpperCase());
  }

  getStatusLabel(code: unknown): string {
    const rawCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    return this.getStatusMeta(rawCode)?.label || rawCode || '—';
  }

  isTransitionAllowed(targetStatus: string): boolean {
    if (!this.order || !this.order.statusCode) return false;
    const current = this.order.statusCode.toUpperCase();
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return allowed.includes(targetStatus.toUpperCase());
  }

  getAllowedStatuses(): StatusOption[] {
    if (!this.order || !this.order.statusCode) return [];
    const current = this.order.statusCode.toUpperCase();
    const allowed = this.VALID_TRANSITIONS[current] || [];
    return this.ALL_STATUSES.filter(s => allowed.includes(s.code));
  }

  onSelectStatus(targetStatus: string): void {
    this.statusValidationMessage = '';
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.order || !this.order.statusCode) return;
    const current = this.order.statusCode.toUpperCase();
    const target = targetStatus.toUpperCase();

    if (current === target) {
      this.statusValidationMessage = 'Đơn hàng hiện tại đã ở trạng thái này.';
      this.selectedNextStatus = '';
      return;
    }

    if (!this.isTransitionAllowed(target)) {
      const allowedLabels = (this.VALID_TRANSITIONS[current] || [])
        .map(c => this.getStatusMeta(c)?.label || c)
        .join(', ') || 'Không có trạng thái nào khả dụng';
      this.statusValidationMessage = `Trạng thái mới không hợp lệ với trạng thái hiện tại. Từ "${this.getStatusMeta(current)?.label || current}" chỉ có thể chuyển sang: ${allowedLabels}.`;
      this.selectedNextStatus = '';
      return;
    }

    this.selectedNextStatus = target;
  }

  onRequestChangeStatus(): void {
    if (!this.selectedNextStatus) {
      this.statusValidationMessage = 'Vui lòng chọn trạng thái hợp lệ để cập nhật.';
      return;
    }

    const current = this.order?.statusCode?.toUpperCase();
    if (!this.isTransitionAllowed(this.selectedNextStatus)) {
      this.statusValidationMessage = 'Trạng thái mới không hợp lệ với trạng thái hiện tại.';
      return;
    }

    const fromLabel = this.getStatusMeta(current)?.label || current;
    const toLabel = this.getStatusMeta(this.selectedNextStatus)?.label || this.selectedNextStatus;

    this.confirmDialogTitle = 'Xác nhận chuyển trạng thái đơn hàng';
    this.confirmDialogMessage = `Bạn có chắc chắn muốn chuyển trạng thái đơn hàng "${this.order?.orderId || this.order?.code}" từ "${fromLabel}" sang "${toLabel}" không?`;
    this.confirmOpen = true;
  }

  onConfirmStatusUpdate(): void {
    if (!this.orderId || !this.selectedNextStatus || this.isUpdatingStatus) return;

    this.isUpdatingStatus = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.statusValidationMessage = '';

    const newStatus = this.selectedNextStatus;
    const noteText = this.statusNote.trim();

    this.apiService.updateOrderStatus(this.orderId, newStatus, noteText).subscribe({
      next: (res) => {
        this.isUpdatingStatus = false;
        this.confirmOpen = false;
        if (res.success && res.data) {
          this.order = res.data;
          this.selectedNextStatus = '';
          this.statusNote = '';
          this.successMessage = res.message || 'Cập nhật trạng thái đơn hàng thành công';
        } else {
          this.errorMessage = res.message || 'Cập nhật trạng thái thất bại';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isUpdatingStatus = false;
        this.confirmOpen = false;
        this.errorMessage = err.error?.message || 'Không thể cập nhật trạng thái đơn hàng. Vui lòng kiểm tra lại.';
        console.error('Update order status error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelConfirmDialog(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  getItemTitle(it: any): string {
    return it?.productSnapshot?.title
      || it?.item?.title
      || it?.title
      || it?.item?.name
      || it?.item?.titleUrl?.replace(/-/g, ' ')
      || '—';
  }

  getItemImage(it: any): string {
    const firstLegacyImage = Array.isArray(it?.item?.images) ? it.item.images[0] : null;
    return it?.productSnapshot?.image
      || it?.item?.mainImage?.url
      || (typeof firstLegacyImage === 'string' ? firstLegacyImage : firstLegacyImage?.url)
      || '';
  }

  getItemVariants(it: any): string[] {
    const list: string[] = [];
    const variant = it?.productSnapshot?.variant || {};
    const legacyProduct = it?.item || {};
    const legacyColor = this.getLegacyVariantValue(legacyProduct.colors ?? legacyProduct.color);
    const legacySize = this.getLegacyVariantValue(legacyProduct.sizes ?? legacyProduct.size);
    const legacyClassification = this.getDisplayString(
      legacyProduct.productType ?? legacyProduct.classification
    );
    const color = this.getDisplayString(variant.color) || legacyColor;
    const size = this.getDisplayString(variant.size) || legacySize;
    const classification = this.getDisplayString(variant.classification) || legacyClassification;

    if (color) list.push(`Màu: ${color}`);
    if (size) list.push(`Size: ${size}`);
    if (classification) list.push(`Phân loại: ${classification}`);
    return list;
  }

  getOrderItems(): any[] {
    const normalizedItems = Array.isArray(this.order?.items)
      ? this.order.items.filter((item: any) => this.isUsableNormalizedItem(item))
      : [];
    if (normalizedItems.length > 0) return normalizedItems;

    return Array.isArray(this.order?.cart?.items)
      ? this.order.cart.items.filter((item: any) => item && typeof item === 'object')
      : [];
  }

  getItemSku(it: any): string {
    return this.getDisplayString(it?.productSnapshot?.sku)
      || this.getDisplayString(it?.item?.sku)
      || this.getDisplayString(it?.sku)
      || '';
  }

  getItemQuantity(it: any): number | null {
    return this.getFiniteNumber(it?.quantity) ?? this.getFiniteNumber(it?.qty);
  }

  getItemUnitPrice(it: any): number | null {
    return this.getFiniteNumber(it?.unitPrice) ?? this.getFiniteNumber(it?.price);
  }

  getItemSubtotal(it: any): number | null {
    const explicitSubtotal = this.getFiniteNumber(it?.subtotal);
    if (explicitSubtotal !== null) return explicitSubtotal;

    const unitPrice = this.getItemUnitPrice(it);
    const quantity = this.getItemQuantity(it);
    return unitPrice !== null && quantity !== null ? unitPrice * quantity : null;
  }

  getTotalQuantity(): number | null {
    if (this.order && Object.prototype.hasOwnProperty.call(this.order, 'itemsCount')) {
      return this.getFiniteNumber(this.order.itemsCount);
    }
    const legacyTotalQty = this.getFiniteNumber(this.order?.cart?.totalQty);
    if (legacyTotalQty !== null) return legacyTotalQty;

    const quantities = this.getOrderItems().map(item => this.getItemQuantity(item));
    if (quantities.some(quantity => quantity === null)) {
      return null;
    }
    return quantities.reduce((total: number, quantity) => total + (quantity as number), 0);
  }

  getShippingAddresses(): any[] {
    const legacyAddresses = Array.isArray(this.order?.addresses)
      ? this.order.addresses.filter((address: any) => address && typeof address === 'object')
      : [];
    const normalizedAddress = this.order?.shippingAddress;

    if (!normalizedAddress || typeof normalizedAddress !== 'object' || Array.isArray(normalizedAddress)) {
      return legacyAddresses;
    }

    const legacyPrimary = legacyAddresses[0] || {};
    const normalizedProvince = this.getDisplayString(normalizedAddress.province);
    const mergedPrimary = {
      ...legacyPrimary,
      ...normalizedAddress,
      fullName: this.getDisplayString(normalizedAddress.fullName)
        || this.getDisplayString(legacyPrimary.fullName)
        || this.getDisplayString(legacyPrimary.name),
      phone: this.getDisplayString(normalizedAddress.phone)
        || this.getDisplayString(legacyPrimary.phone),
      address: this.getDisplayString(normalizedAddress.address)
        || this.getDisplayString(legacyPrimary.address)
        || this.getDisplayString(legacyPrimary.line1),
      ward: this.getDisplayString(normalizedAddress.ward)
        || this.getDisplayString(legacyPrimary.ward),
      district: this.getDisplayString(normalizedAddress.district)
        || this.getDisplayString(legacyPrimary.district),
      province: normalizedProvince
        || this.getDisplayString(legacyPrimary.province)
        || this.getDisplayString(legacyPrimary.city),
      line1: null,
      city: null
    };

    return [mergedPrimary, ...legacyAddresses.slice(1)];
  }

  getLegacySellerMessage(): string | number | null {
    const value = this.order?.outcome?.seller_message;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return null;
  }

  private isUsableNormalizedItem(item: any): boolean {
    if (!item || typeof item !== 'object' || !item.productSnapshot || typeof item.productSnapshot !== 'object') {
      return false;
    }
    return Boolean(
      this.getDisplayString(item.productSnapshot.title)
      || this.getDisplayString(item.productSnapshot.sku)
      || item.productId != null
    );
  }

  private getFiniteNumber(value: any): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private getDisplayString(value: any): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private getLegacyVariantValue(value: any): string | null {
    if (Array.isArray(value)) {
      const values = value
        .map(entry => this.getDisplayString(entry))
        .filter((entry): entry is string => Boolean(entry));
      return values.length > 0 ? values.join(', ') : null;
    }
    return this.getDisplayString(value);
  }
}
