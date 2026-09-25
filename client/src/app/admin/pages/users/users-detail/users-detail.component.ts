import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-users-detail',
  standalone: false,
  templateUrl: './users-detail.component.html',
  styleUrls: ['./users-detail.component.css']
})
export class UsersDetailComponent implements OnInit {
  userId: string | null = null;
  user: any = null;
  isLoading = false;
  isNotFound = false;
  errorMessage = '';
  successMessage = '';

  // Confirm dialog for lock/unlock
  confirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmLabel = '';
  confirmVariant: 'warning' | 'default' | 'danger' = 'warning';
  isStatusUpdating = false;

  defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="%23e2e8f0"><circle cx="12" cy="8" r="4" fill="%2394a3b8"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="%2394a3b8"/></svg>';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    if (!this.userId || this.userId.trim() === '') {
      this.isNotFound = true;
      return;
    }
    this.loadUser();
  }

  loadUser(): void {
    if (!this.userId) return;

    this.isLoading = true;
    this.isNotFound = false;
    this.errorMessage = '';

    this.apiService.getUserById(this.userId).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.user = res.data;
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
          this.successMessage = res.message || (newStatus ? 'Đã mở khóa tài khoản thành công' : 'Đã khóa tài khoản thành công');
          this.loadUser();
        } else {
          this.errorMessage = res.message || 'Thao tác không thành công';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isStatusUpdating = false;
        this.confirmOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái người dùng';
        console.error('Status change error:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelStatusChange(): void {
    this.confirmOpen = false;
    this.cdr.markForCheck();
  }

  get hasCartItems(): boolean {
    return !!(this.user?.cart?.items && Array.isArray(this.user.cart.items) && this.user.cart.items.length > 0);
  }

  get cartItemsCount(): number {
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + (item.qty || item.quantity || 1), 0);
  }

  get cartTotalPrice(): number {
    if (this.user?.cart?.totalPrice) return this.user.cart.totalPrice;
    if (!this.hasCartItems) return 0;
    return this.user.cart.items.reduce((sum: number, item: any) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
  }
}

export { UsersDetailComponent as AccountDetailComponent };
