import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { SignalStoreSelectors } from '../../../store/signal.store.selectors';
import { SignalStore } from '../../../store/signal.store';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { checkIsAdmin, checkIsStaff, getStaffDefaultRoute } from '../../../services/auth.guard';

@Component({
  selector: 'app-admin-unauthorized',
  standalone: false,
  templateUrl: './admin-unauthorized.component.html',
  styleUrls: ['./admin-unauthorized.component.css']
})
export class AdminUnauthorizedComponent implements OnInit, OnDestroy {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Khu vực quản trị' },
    { label: 'Phân quyền truy cập' }
  ];

  currentUser: any = null;
  deniedModule: string = '';
  requiredPermission: string = '';
  isCheckingPermissions = false;
  private userSub: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private selectors: SignalStoreSelectors,
    private store: SignalStore,
    private adminService: AdminService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.deniedModule = params['deniedModule'] || '';
      this.requiredPermission = params['required'] || '';
      this.cdr.markForCheck();
    });

    this.currentUser = this.selectors.user();
    this.userSub = this.adminService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser = user;
        this.cdr.markForCheck();
      }
    });

    // Tự động kiểm tra cập nhật hồ sơ mới nhất từ backend
    this.refreshPermissions(false);
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
  }

  get userPermissions(): string[] {
    return Array.isArray(this.currentUser?.permissions) ? this.currentUser.permissions : [];
  }

  get hasNoPermissions(): boolean {
    return this.userPermissions.length === 0;
  }

  get fallbackRoute(): string {
    return getStaffDefaultRoute(this.currentUser);
  }

  get canNavigateToPermittedRoute(): boolean {
    return !this.hasNoPermissions && this.fallbackRoute !== '/admin/unauthorized';
  }

  get userDisplayName(): string {
    return this.currentUser?.fullName || this.currentUser?.name || this.currentUser?.email || 'Nhân viên';
  }

  get userRoleText(): string {
    if (checkIsAdmin(this.currentUser)) return 'Quản trị viên (Admin)';
    if (checkIsStaff(this.currentUser)) return 'Nhân viên (Staff)';
    return 'Khách hàng';
  }

  goToPermittedModule(): void {
    const route = this.fallbackRoute;
    if (route && route !== '/admin/unauthorized') {
      this.router.navigate([route]);
    } else {
      this.router.navigate(['/admin/account']);
    }
  }

  goToAccount(): void {
    this.router.navigate(['/admin/account']);
  }

  onLogout(): void {
    this.store.signOut(() => {
      this.notificationService.success('Đã đăng xuất khỏi khu vực quản trị.');
      this.router.navigate(['/vi/authorize/signin']);
    });
  }

  refreshPermissions(showSuccessToast: boolean = true): void {
    if (this.isCheckingPermissions) return;
    this.isCheckingPermissions = true;
    this.cdr.markForCheck();

    this.adminService.getAccountProfile().subscribe({
      next: (res) => {
        this.isCheckingPermissions = false;
        const updated = res?.data || res;
        if (updated) {
          this.currentUser = updated;
          this.store.storeUser(updated);

          // Nếu tài khoản đã có quyền hoặc là Admin, tự động điều hướng vào module được phép
          if (checkIsAdmin(updated) || (Array.isArray(updated.permissions) && updated.permissions.length > 0)) {
            const target = getStaffDefaultRoute(updated);
            if (target !== '/admin/unauthorized') {
              if (showSuccessToast) {
                this.notificationService.success('Quyền truy cập của bạn đã được cập nhật!');
              }
              this.router.navigate([target]);
              return;
            }
          }
        }
        if (showSuccessToast) {
          this.notificationService.success('Đã làm mới thông tin tài khoản. Hiện chưa có quyền mới được cấp.');
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isCheckingPermissions = false;
        if (showSuccessToast) {
          this.notificationService.error('Không thể kiểm tra quyền mới lúc này. Vui lòng thử lại sau.');
        }
        this.cdr.markForCheck();
      }
    });
  }
}
