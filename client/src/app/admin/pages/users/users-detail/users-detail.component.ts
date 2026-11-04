import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { environment } from '../../../../../environments/environment';
import { BreadcrumbItem } from '../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { SignalStoreSelectors } from '../../../../store/signal.store.selectors';
import { checkIsAdmin } from '../../../../services/auth.guard';
import {
  PERMISSION_GROUPS,
  ALL_STAFF_PERMISSIONS,
  PermissionGroup,
  PermissionModule,
  PermissionItem,
} from '../../../shared/constants/permissions.catalog';

@Component({
  selector: 'app-users-detail',
  standalone: false,
  templateUrl: './users-detail.component.html',
  styleUrls: ['./users-detail.component.css']
})
export class UsersDetailComponent implements OnInit {
  userId: string | null = null;
  user: any = null;

  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý tài khoản', url: '/admin/users' },
    { label: 'Chi tiết tài khoản' }
  ];

  isLoading = false;
  isNotFound = false;
  errorMessage = '';

  // Orders section state
  orders: any[] = [];
  isOrdersLoading = false;
  ordersErrorMessage = '';

  // Confirm dialog for lock/unlock
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' | 'danger' = 'warning';
  isStatusUpdating = false;

  defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="%23e2e8f0"><circle cx="12" cy="8" r="4" fill="%2394a3b8"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="%2394a3b8"/></svg>';
  avatarHasError = false;
  isAvatarExpanded = false;

  // Quản lý phân quyền STAFF
  readonly permissionGroups: PermissionGroup[] = PERMISSION_GROUPS;
  isEditPermissionsModalOpen = false;
  editingPermissions: Set<string> = new Set<string>();
  isSavingPermissions = false;

  // Dialog thu hồi toàn bộ quyền
  revokeConfirmOpen = false;
  isRevoking = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService,
    private selectors: SignalStoreSelectors
  ) { }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId || this.userId.trim() === '') {
      this.isNotFound = true;
      return;
    }
    this.loadUser();
    this.loadOrders();
  }

  getUserInitial(): string {
    if (!this.user) return 'U';
    const raw = (this.user.fullName || this.user.name || this.user.email || '').trim();
    if (!raw) return 'U';
    return String(Array.from(raw)[0] || 'U').toUpperCase();
  }

  getInitialsAvatar(): string {
    const initial = this.getUserInitial();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="76" height="76" viewBox="0 0 76 76"><rect width="100%" height="100%" fill="%23F8EBEB"/><text x="50%" y="54%" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="30" font-weight="700" fill="%2374070E" text-anchor="middle" dominant-baseline="middle">${initial}</text></svg>`;
    return `data:image/svg+xml;utf8,${svg}`;
  }

  getRawAvatarUrl(): string {
    if (!this.user) return '';

    let raw = this.user.avatar;

    // Fallback: check user.image
    if (!raw && this.user.image) {
      raw = typeof this.user.image === 'string' ? this.user.image : this.user.image?.url;
    }

    // Fallback: check user.images array
    if (!raw && Array.isArray(this.user.images) && this.user.images.length > 0) {
      const first = this.user.images[0];
      raw = typeof first === 'string' ? first : first?.url;
    }

    if (!raw || typeof raw !== 'string') return '';
    raw = raw.trim();
    if (!raw) return '';

    // If it's a relative path to uploads, prepend backend origin if needed
    if (raw.startsWith('/uploads') || raw.startsWith('uploads/')) {
      const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
      const origin = (environment.adminApiUrl || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
      return `${origin}${cleanPath}`;
    }

    return raw;
  }

  get avatarSrc(): string {
    if (this.avatarHasError) {
      return this.getInitialsAvatar();
    }
    const raw = this.getRawAvatarUrl();
    if (raw) {
      return raw;
    }
    return this.getInitialsAvatar();
  }

  onAvatarError(): void {
    if (this.avatarHasError) return;
    this.avatarHasError = true;
    this.cdr.markForCheck();
  }

  toggleAvatarExpand(): void {
    this.isAvatarExpanded = !this.isAvatarExpanded;
    this.cdr.markForCheck();
  }

  get isAvatarLong(): boolean {
    const raw = this.user?.avatar;
    return typeof raw === 'string' && raw.trim().length > 50;
  }

  get displayedAvatarText(): string {
    const raw = this.user?.avatar;
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (this.isAvatarExpanded || !this.isAvatarLong) {
      return trimmed;
    }
    return trimmed.slice(0, 45) + '...';
  }

  loadUser(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';
    this.avatarHasError = false;
    this.isAvatarExpanded = false;

    this.apiService.getUserById(this.userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.user = res.data;
          this.avatarHasError = false;
          this.isAvatarExpanded = false;
          this.resolveCartItems();
          const name = this.user?.fullName || this.user?.name || this.user?.email || '';
          this.breadcrumbItems = [
            { label: 'Quản lý tài khoản', url: '/admin/users' },
            { label: name ? name : 'Chi tiết tài khoản' }
          ];
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
          this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin tài khoản từ máy chủ MongoDB';
        }
        console.error('Error fetching account detail:', err);
        this.cdr.markForCheck();
      }
    });
  }

  loadOrders(): void {
    if (!this.userId) return;

    this.isOrdersLoading = true;
    this.ordersErrorMessage = '';

    this.apiService.getUserOrders(this.userId).subscribe({
      next: (res) => {
        this.isOrdersLoading = false;
        if (res.success && Array.isArray(res.data)) {
          this.orders = res.data;
        } else {
          this.orders = [];
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isOrdersLoading = false;
        this.ordersErrorMessage = err.error?.message || 'Không thể tải danh sách đơn hàng.';
        console.error('Error fetching user orders:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onViewOrder(orderId: string): void {
    if (!orderId) return;
    this.router.navigate(['/admin/orders', orderId]);
  }

  getOrderStatusVariant(status: string): string {
    if (!status) return 'neutral';
    const s = status.toUpperCase().trim();
    switch (s) {
      case 'DELIVERED':
      case 'ĐÃ GIAO':
      case 'ĐÃ GIAO HÀNG':
      case 'SUCCESS':
        return 'success';
      case 'SHIPPING':
      case 'ĐANG GIAO':
      case 'ĐANG GIAO HÀNG':
      case 'CONFIRMED':
      case 'ĐÃ XÁC NHẬN':
      case 'PRIMARY':
        return 'primary';
      case 'PROCESSING':
      case 'ĐANG XỬ LÝ':
      case 'PENDING':
      case 'CHỜ XÁC NHẬN':
      case 'CHỜ XỬ LÝ':
      case 'RETURNED':
      case 'ĐÃ HOÀN TRẢ':
      case 'WARNING':
        return 'warning';
      case 'CANCELLED':
      case 'ĐÃ HỦY':
      case 'DANGER':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  getOrderStatusLabel(order: any): string {
    return order.statusText || order.status || 'Chờ xử lý';
  }

  onBack(): void {
    this.router.navigate(['/admin/users']);
  }

  onEdit(): void {
    if (!this.userId) return;
    this.router.navigate(['/admin/users', this.userId, 'edit']);
  }

  onToggleStatusClick(): void {
    if (!this.user || !this.userId) return;

    const isActive = this.user.status !== false;
    if (isActive) {
      this.confirmTitle = 'Khóa tài khoản';
      this.confirmMessage = `Bạn có chắc chắn muốn khóa tài khoản "${this.user.email}" không? Người dùng sẽ không thể đăng nhập vào hệ thống.`;
      this.confirmLabel = 'Khóa tài khoản';
      this.confirmVariant = 'warning';
    } else {
      this.confirmTitle = 'Mở khóa tài khoản';
      this.confirmMessage = `Bạn có chắc chắn muốn mở khóa tài khoản "${this.user.email}" không?`;
      this.confirmLabel = 'Mở khóa';
      this.confirmVariant = 'default';
    }
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmStatusChange(): void {
    if (!this.user || !this.userId || this.isStatusUpdating) return;

    const currentStatus = this.user.status !== false;
    const newStatus = !currentStatus;
    this.isStatusUpdating = true;

    this.apiService.updateUserStatus(this.userId, newStatus).subscribe({
      next: (res) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        if (res.success) {
          const msg = res.message || (newStatus ? 'Đã mở khóa tài khoản thành công' : 'Đã khóa tài khoản thành công');
          this.notificationService.success(msg);
          this.loadUser();
        } else {
          this.errorMessage = res.message || 'Thao tác không thành công';
          this.notificationService.error(this.errorMessage);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái người dùng';
        this.notificationService.error(this.errorMessage);
        console.error('Status change error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  cartDisplayItems: CartItemDisplay[] = [];
  isCartResolving = false;

  onCancelStatusChange(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  get hasCartItems(): boolean {
    return !!(this.user?.cart?.items && Array.isArray(this.user.cart.items) && this.user.cart.items.length > 0);
  }

  get cartDistinctProductsCount(): number {
    return this.user?.cart?.items?.length || 0;
  }

  get cartTotalQuantity(): number {
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + Math.max(1, Number(item.quantity || item.qty) || 1), 0);
  }

  get cartItemsCount(): number {
    return this.cartTotalQuantity;
  }

  get cartTotalPrice(): number {
    if (this.cartDisplayItems.length > 0) {
      return this.cartDisplayItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
    }
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + ((Number(item.price) || 0) * (Math.max(1, Number(item.quantity || item.qty) || 1))), 0);
  }

  // ─────────────────────────────────────────────────────────────
  // ROLE & PERMISSION HELPERS
  // ─────────────────────────────────────────────────────────────
  get userRoleKey(): 'admin' | 'staff' | 'user' {
    if (!this.user) return 'user';
    const rawRoles = this.user.roles || (this.user.role ? [this.user.role] : []);
    const roles: string[] = (Array.isArray(rawRoles) ? rawRoles : [rawRoles])
      .map((r: any) => typeof r === 'string' ? r.toLowerCase().trim() : '');
    if (roles.includes('admin') || roles.includes('superadmin') || roles.includes('super-admin') || this.user.isAdmin === true) {
      return 'admin';
    }
    if (roles.includes('staff')) {
      return 'staff';
    }
    return 'user';
  }

  get userRoleText(): string {
    const role = this.userRoleKey;
    if (role === 'admin') return 'Quản trị viên (Admin)';
    if (role === 'staff') return 'Nhân viên (Staff)';
    return 'Khách hàng (User)';
  }

  get userRoleBadgeClass(): string {
    const role = this.userRoleKey;
    if (role === 'admin') return 'badge-admin';
    if (role === 'staff') return 'badge-staff';
    return 'badge-user';
  }

  get isViewingStaff(): boolean {
    return this.userRoleKey === 'staff';
  }

  get isViewingAdmin(): boolean {
    return this.userRoleKey === 'admin';
  }

  get isViewingCustomer(): boolean {
    return this.userRoleKey === 'user';
  }

  get viewerIsAdmin(): boolean {
    return checkIsAdmin(this.selectors.user());
  }

  get canManagePermissions(): boolean {
    return this.isViewingStaff && this.viewerIsAdmin;
  }

  getGrantedModules(): { module: PermissionModule; permissions: PermissionItem[] }[] {
    if (!this.user || !Array.isArray(this.user.permissions)) return [];
    const userPerms = new Set<string>(this.user.permissions);
    const result: { module: PermissionModule; permissions: PermissionItem[] }[] = [];

    for (const group of PERMISSION_GROUPS) {
      for (const mod of group.modules) {
        const granted = mod.permissions.filter(p => userPerms.has(p.key));
        if (granted.length > 0) {
          result.push({
            module: mod,
            permissions: granted,
          });
        }
      }
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // MODAL CHỈNH SỬA PHÂN QUYỀN TRỰC TIẾP TẠI TRANG CHI TIẾT
  // ─────────────────────────────────────────────────────────────
  openEditPermissionsModal(): void {
    if (!this.canManagePermissions) return;
    const currentPerms = Array.isArray(this.user?.permissions) ? this.user.permissions : [];
    this.editingPermissions = new Set<string>(currentPerms);
    this.isEditPermissionsModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEditPermissionsModal(): void {
    this.isEditPermissionsModalOpen = false;
    this.cdr.markForCheck();
  }

  hasEditingPermission(key: string): boolean {
    return this.editingPermissions.has(key);
  }

  toggleEditingPermission(key: string): void {
    if (this.editingPermissions.has(key)) {
      this.editingPermissions.delete(key);
    } else {
      this.editingPermissions.add(key);
    }
    this.cdr.markForCheck();
  }

  isEditingModuleFullySelected(module: PermissionModule): boolean {
    if (!module.permissions || module.permissions.length === 0) return false;
    return module.permissions.every(p => this.editingPermissions.has(p.key));
  }

  isEditingModuleIndeterminate(module: PermissionModule): boolean {
    if (!module.permissions || module.permissions.length === 0) return false;
    const count = module.permissions.filter(p => this.editingPermissions.has(p.key)).length;
    return count > 0 && count < module.permissions.length;
  }

  getEditingModuleSelectedCount(module: PermissionModule): number {
    return module.permissions.filter(p => this.editingPermissions.has(p.key)).length;
  }

  toggleEditingModulePermissions(module: PermissionModule): void {
    if (this.isEditingModuleFullySelected(module)) {
      for (const p of module.permissions) {
        this.editingPermissions.delete(p.key);
      }
    } else {
      for (const p of module.permissions) {
        this.editingPermissions.add(p.key);
      }
    }
    this.cdr.markForCheck();
  }

  selectAllEditingPermissions(): void {
    for (const key of ALL_STAFF_PERMISSIONS) {
      this.editingPermissions.add(key);
    }
    this.cdr.markForCheck();
  }

  clearAllEditingPermissions(): void {
    this.editingPermissions.clear();
    this.cdr.markForCheck();
  }

  getEditingSelectedCount(): number {
    return this.editingPermissions.size;
  }

  getTotalPermissionsCount(): number {
    return ALL_STAFF_PERMISSIONS.length;
  }

  savePermissions(): void {
    if (!this.userId || this.isSavingPermissions) return;
    this.isSavingPermissions = true;
    const newPermissions = Array.from(this.editingPermissions);

    this.apiService.updateUserPermissions(this.userId, newPermissions).subscribe({
      next: (res) => {
        this.isSavingPermissions = false;
        this.isEditPermissionsModalOpen = false;
        if (res.success) {
          this.notificationService.success('Cập nhật phân quyền nhân viên thành công');
          this.loadUser();
        } else {
          this.notificationService.error(res.message || 'Cập nhật phân quyền thất bại');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSavingPermissions = false;
        this.notificationService.error(err.error?.message || 'Lỗi khi cập nhật phân quyền');
        this.cdr.markForCheck();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // THU HỒI TOÀN BỘ QUYỀN
  // ─────────────────────────────────────────────────────────────
  openRevokeConfirm(): void {
    if (!this.canManagePermissions) return;
    this.revokeConfirmOpen = true;
    this.cdr.markForCheck();
  }

  closeRevokeConfirm(): void {
    this.revokeConfirmOpen = false;
    this.cdr.markForCheck();
  }

  confirmRevokeAllPermissions(): void {
    if (!this.userId || this.isRevoking) return;
    this.isRevoking = true;

    this.apiService.updateUserPermissions(this.userId, []).subscribe({
      next: (res) => {
        this.isRevoking = false;
        this.revokeConfirmOpen = false;
        if (res.success) {
          this.notificationService.success('Đã thu hồi toàn bộ quyền truy cập của nhân viên');
          this.loadUser();
        } else {
          this.notificationService.error(res.message || 'Thu hồi quyền thất bại');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isRevoking = false;
        this.notificationService.error(err.error?.message || 'Lỗi khi thu hồi quyền truy cập');
        this.cdr.markForCheck();
      }
    });
  }

  resolveCartItems(): void {
    const rawItems = this.user?.cart?.items;
    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      this.cartDisplayItems = [];
      this.isCartResolving = false;
      this.cdr.markForCheck();
      return;
    }

    // Check if items are already enriched by API
    const isEnriched = rawItems.some((it: any) => it.title && it.title !== it.productId);
    if (isEnriched) {
      this.cartDisplayItems = rawItems.map((it: any) => ({
        productId: String(it.productId || ''),
        variantId: it.variantId ? String(it.variantId) : null,
        quantity: Math.max(1, Number(it.quantity || it.qty) || 1),
        title: it.title || (it.productExists === false ? 'Sản phẩm không còn tồn tại' : 'Sản phẩm'),
        image: it.image || '',
        sku: it.sku || '',
        variantText: it.variantText || '',
        price: Number(it.price) || 0,
        productExists: it.productExists !== false,
      }));
      this.isCartResolving = false;
      this.cdr.markForCheck();
      return;
    }

    // If not yet enriched (raw productId/variantId), resolve via apiService
    this.isCartResolving = true;
    const fetchPromises = rawItems.map((raw: any) => {
      const pId = String(raw.productId || '');
      const vId = raw.variantId ? String(raw.variantId) : null;
      const qty = Math.max(1, Number(raw.quantity || raw.qty) || 1);

      if (!pId) {
        return Promise.resolve<CartItemDisplay>({
          productId: '',
          variantId: vId,
          quantity: qty,
          title: 'Sản phẩm không còn tồn tại',
          image: '',
          sku: '',
          variantText: '',
          price: 0,
          productExists: false,
        });
      }

      return new Promise<CartItemDisplay>((resolve) => {
        this.apiService.getProductById(pId).subscribe({
          next: (res) => {
            const p = res?.data || res;
            if (!p) {
              resolve({
                productId: pId,
                variantId: vId,
                quantity: qty,
                title: 'Sản phẩm không còn tồn tại',
                image: '',
                sku: '',
                variantText: '',
                price: 0,
                productExists: false,
              });
              return;
            }

            const variants = Array.isArray(p.variants) ? p.variants : [];
            let variant: any = null;
            if (vId && variants.length > 0) {
              variant = variants.find((v: any) =>
                (v._id && v._id.toString() === vId) ||
                v.id === vId ||
                v.sku === vId
              );
            }

            const varParts = [
              variant?.classification || raw.selectedClassification,
              variant?.color || raw.selectedColor,
              variant?.size || raw.selectedSize,
            ].filter(Boolean);
            const variantText = varParts.length > 0 ? varParts.join(' - ') : (variant?.sku || '');

            const regularPrice = Number(variant?.price || p.salePrice || p.regularPrice || p.vi?.salePrice || p.vi?.regularPrice || 0);
            const discountPrice = Number(variant?.discountPrice || p.salePrice || p.vi?.salePrice || 0);
            const finalPrice = discountPrice > 0 ? discountPrice : regularPrice;

            resolve({
              productId: pId,
              variantId: vId,
              quantity: qty,
              title: p.title || p.vi?.title || p.mainImage?.name || 'Sản phẩm',
              image: p.mainImage?.url || (Array.isArray(p.images) && p.images[0]) || '',
              sku: variant?.sku || p.sku || '',
              variantText: variantText,
              price: finalPrice,
              productExists: true,
            });
          },
          error: () => {
            resolve({
              productId: pId,
              variantId: vId,
              quantity: qty,
              title: 'Sản phẩm không còn tồn tại',
              image: '',
              sku: '',
              variantText: '',
              price: 0,
              productExists: false,
            });
          }
        });
      });
    });

    Promise.all(fetchPromises).then((items) => {
      this.cartDisplayItems = items;
      this.isCartResolving = false;
      this.cdr.markForCheck();
    });
  }
}

export interface CartItemDisplay {
  productId: string;
  variantId?: string | null;
  quantity: number;
  title: string;
  image: string;
  sku?: string;
  variantText?: string;
  price?: number;
  productExists: boolean;
}

export { UsersDetailComponent as AccountDetailComponent };
