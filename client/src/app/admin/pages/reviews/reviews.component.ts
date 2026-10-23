import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  TableColumn,
  RowAction,
  FilterField,
  PaginationConfig,
  ActionEvent,
  BadgeVariant,
} from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-reviews',
  standalone: false,
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.css']
})
export class ReviewsComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Chăm sóc khách hàng' },
    { label: 'Quản lý đánh giá' }
  ];

  // ── Table Configuration ──────────────────────────────────────
  columns: TableColumn[] = [
    { key: 'image', label: '', type: 'image', shape: 'circle', isAvatar: true, width: '60px' },
    { key: 'customerName', label: 'Khách hàng', type: 'text', sortable: true, width: '150px' },
    { key: 'productImage', label: '', type: 'image', width: '56px' },
    { key: 'productTitle', label: 'Sản phẩm', type: 'text', sortable: true, width: '220px' },

    { key: 'ratingDisplay', label: 'Đánh giá', type: 'text', sortable: true, align: 'center', width: '120px' },
    { key: 'commentShort', label: 'Nội dung', type: 'text', width: '260px' },
    { key: 'orderIdDisplay', label: 'Mã đơn hàng', type: 'text', width: '130px' },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true, align: 'center', width: '110px' },
    { key: 'createdDate', label: 'Ngày đánh giá', type: 'text', sortable: true, align: 'center', width: '120px' },
  ];

  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    {
      key: 'toggle_hide',
      label: 'Ẩn',
      variant: 'warning',
      showWhen: (r: any) => r.rawStatus === 'APPROVED' || r.status === 'Hiển thị'
    },
    {
      key: 'toggle_show',
      label: 'Hiện',
      variant: 'default',
      showWhen: (r: any) => r.rawStatus !== 'APPROVED' && r.status !== 'Hiển thị'
    },
    { key: 'delete', label: 'Xóa', variant: 'danger' },
  ];

  filterFields: FilterField[] = [
    {
      key: 'rating',
      label: 'Mức sao',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả mức sao' },
        { value: 5, label: '5 sao (★★★★★)' },
        { value: 4, label: '4 sao (★★★★☆)' },
        { value: 3, label: '3 sao (★★★☆☆)' },
        { value: 2, label: '2 sao (★★☆☆☆)' },
        { value: 1, label: '1 sao (★☆☆☆☆)' },
      ]
    },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả trạng thái' },
        { value: 'APPROVED', label: 'Hiển thị' },
        { value: 'REJECTED', label: 'Tạm ẩn' },
        { value: 'PENDING', label: 'Chờ duyệt' },
      ]
    },
    {
      key: 'isVerifiedPurchase',
      label: 'Đã mua hàng',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả' },
        { value: 'true', label: 'Đã mua hàng' },
        { value: 'false', label: 'Chưa xác minh' },
      ]
    },
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;
  errorMessage = '';

  // Search & Filter state
  searchQuery = '';
  selectedRating: number | null = null;
  selectedStatus = '';
  selectedVerified: boolean | undefined = undefined;

  // Selection state
  selectedIds: Set<any> = new Set();

  get selectedCount(): number { return this.selectedIds.size; }

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every(r => this.selectedIds.has(r.id));
  }

  get isIndeterminate(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  get displayTotal(): number {
    return this.pagination?.total ?? this.data.length;
  }

  // ── Detail Modal State ───────────────────────────────────────
  isDetailModalOpen = false;
  selectedReview: any = null;

  // ── Confirm Dialog State ─────────────────────────────────────
  confirmOpen = false;
  confirmTitle = 'Xác nhận';
  confirmMessage = '';
  confirmLabel = 'Xác nhận';
  confirmVariant: 'danger' | 'warning' | 'default' = 'danger';
  confirmActionType: 'delete' | 'bulk_delete' | 'toggle' | null = null;
  pendingRow: any = null;
  pendingDeleteId: string | null = null;

  constructor(
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getReviews({
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      search: this.searchQuery,
      rating: this.selectedRating || undefined,
      status: this.selectedStatus || undefined,
      isVerifiedPurchase: this.selectedVerified,
      sortKey: 'createdAt',
      sortDir: 'desc'
    }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res && res.success) {
          this.data = (res.data || []).map((r: any) => {
            const rawStatus = r.status || 'APPROVED';
            const statusLabel = this.getStatusLabel(rawStatus);
            const statusVariant = this.getStatusVariant(rawStatus);

            const isVerified = r.isVerifiedPurchase !== false;
            const verifiedBadge = isVerified ? 'Đã mua hàng' : 'Chưa xác minh';
            const verifiedBadgeVariant: BadgeVariant = isVerified ? 'success' : 'neutral';

            const ratingNum = Number(r.rating) || 5;
            const ratingDisplay = this.formatRatingStars(ratingNum);

            const commentShort = r.comment && r.comment.length > 80
              ? r.comment.substring(0, 80) + '...'
              : (r.comment || '—');

            const createdDate = r.createdAt
              ? new Date(r.createdAt).toLocaleDateString('vi-VN')
              : '—';

            const orderIdDisplay = r.orderId ? `#${r.orderId}` : '—';

            // ── Quy tắc ưu tiên tên khách hàng: users.fullName -> users.name -> product_reviews.userName -> 'Khách hàng'
            const customerName = this.resolveCustomerName(r);

            // ── Quy tắc ưu tiên avatar: users.avatar -> product_reviews.userAvatar -> ''
            const customerAvatar = this.resolveCustomerAvatar(r);
            const userInitial = this.getUserInitial(customerName);

            return {
              ...r,
              id: r.id || r._id,
              customerName,
              name: customerName,
              fullName: customerName,
              image: customerAvatar,
              avatar: customerAvatar,
              customerAvatar,
              initial: userInitial,
              userInitial,
              avatarAlt: customerName,
              rawStatus,
              status: statusLabel,
              statusVariant,
              verifiedBadge,
              verifiedBadgeVariant,
              ratingNum,
              ratingDisplay,
              commentShort,
              createdDate,
              orderIdDisplay,
            };
          });

          this.pagination = {
            ...this.pagination,
            total: res.pagination?.total ?? this.data.length
          };
          this.selectedIds.clear();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Không thể tải danh sách đánh giá từ máy chủ. Vui lòng thử lại!';
        this.notificationService.error('✨Không thể tải danh sách đánh giá. Vui lòng thử lại!✨');
        console.error('Error loading reviews:', err);
      }
    });
  }

  /**
   * Quy tắc ưu tiên tên khách hàng:
   * 1. users.fullName
   * 2. users.name
   * 3. product_reviews.userName
   * 4. "Khách hàng"
   */
  resolveCustomerName(r: any): string {
    const user = r.user || r.userId;
    if (user && typeof user === 'object') {
      if (user.fullName && typeof user.fullName === 'string' && user.fullName.trim()) {
        return user.fullName.trim();
      }
      if (user.name && typeof user.name === 'string' && user.name.trim()) {
        return user.name.trim();
      }
    }
    if (r.customerName && typeof r.customerName === 'string' && r.customerName.trim() && r.customerName !== 'Khách hàng') {
      return r.customerName.trim();
    }
    if (r.userName && typeof r.userName === 'string' && r.userName.trim()) {
      return r.userName.trim();
    }
    return r.customerName || 'Khách hàng';
  }

  /**
   * Quy tắc ưu tiên avatar khách hàng:
   * 1. users.avatar (avatar hiện tại của khách)
   * 2. product_reviews.userAvatar (avatar lúc đánh giá)
   * 3. '' (admin-table tự động xử lý chữ cái đầu initial và fallback)
   */
  resolveCustomerAvatar(r: any): string {
    const user = r.user || r.userId;
    if (user && typeof user === 'object' && user.avatar && typeof user.avatar === 'string' && user.avatar.trim()) {
      return user.avatar.trim();
    }
    if (r.customerAvatar && typeof r.customerAvatar === 'string' && r.customerAvatar.trim()) {
      return r.customerAvatar.trim();
    }
    if (r.avatar && typeof r.avatar === 'string' && r.avatar.trim()) {
      return r.avatar.trim();
    }
    if (r.image && typeof r.image === 'string' && r.image.trim()) {
      return r.image.trim();
    }
    if (r.userAvatar && typeof r.userAvatar === 'string' && r.userAvatar.trim()) {
      return r.userAvatar.trim();
    }
    return '';
  }

  getUserInitial(name: string): string {
    if (!name) return 'K';
    const trimmed = name.trim();
    return String(Array.from(trimmed)[0] || 'K').toUpperCase();
  }

  formatRatingStars(rating: number): string {
    const fullStars = '★'.repeat(Math.max(1, Math.min(5, Math.floor(rating))));
    const emptyStars = '☆'.repeat(5 - Math.max(1, Math.min(5, Math.floor(rating))));
    return `${fullStars}${emptyStars} (${rating}/5)`;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'APPROVED':
        return 'Hiển thị';
      case 'REJECTED':
        return 'Tạm ẩn';
      case 'PENDING':
        return 'Chờ duyệt';
      default:
        return status;
    }
  }

  getStatusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'neutral';
      case 'PENDING':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  // ── Toolbar Handlers ─────────────────────────────────────────
  onSearch(query: string): void {
    this.searchQuery = query;
    this.pagination.page = 1;
    this.loadReviews();
  }

  onFilter(filters: Record<string, any>): void {
    this.selectedRating = filters['rating'] ? Number(filters['rating']) : null;
    this.selectedStatus = filters['status'] || '';
    if (filters['isVerifiedPurchase'] === 'true') {
      this.selectedVerified = true;
    } else if (filters['isVerifiedPurchase'] === 'false') {
      this.selectedVerified = false;
    } else {
      this.selectedVerified = undefined;
    }
    this.pagination.page = 1;
    this.loadReviews();
  }

  onRefresh(): void {
    this.loadReviews();
    this.notificationService.success('✨Đã làm mới danh sách đánh giá thành công!✨');
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds.clear();
    } else {
      this.data.forEach(r => this.selectedIds.add(r.id));
    }
  }

  onSelectionChange(selected: Set<any>): void {
    this.selectedIds = selected;
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.loadReviews();
  }

  onPageSizeChange(pageSize: number): void {
    this.pagination.pageSize = pageSize;
    this.pagination.page = 1;
    this.loadReviews();
  }

  // ── Action Handlers ──────────────────────────────────────────
  onAction(event: ActionEvent): void {
    const { action, row } = event;
    switch (action) {
      case 'view':
        this.openDetailModal(row);
        break;

      case 'toggle_hide':
        this.updateStatus(row, 'REJECTED');
        break;

      case 'toggle_show':
        this.updateStatus(row, 'APPROVED');
        break;

      case 'delete':
        this.openDeleteConfirm(row);
        break;
    }
  }

  openDetailModal(row: any): void {
    this.selectedReview = row;
    this.isDetailModalOpen = true;
  }

  closeDetailModal(): void {
    this.isDetailModalOpen = false;
    this.selectedReview = null;
  }

  updateStatus(row: any, newStatus: string): void {
    this.apiService.updateReviewStatus(row.id, newStatus).subscribe({
      next: (res: any) => {
        if (res && res.success) {
          const isShow = newStatus === 'APPROVED';
          const msg = isShow
            ? '✨Đã hiển thị đánh giá thành công!✨'
            : '✨Đã ẩn đánh giá thành công!✨';
          this.notificationService.success(msg);
          this.loadReviews();
          if (this.selectedReview && this.selectedReview.id === row.id) {
            this.selectedReview.rawStatus = newStatus;
            this.selectedReview.status = this.getStatusLabel(newStatus);
            this.selectedReview.statusVariant = this.getStatusVariant(newStatus);
          }
        }
      },
      error: (err) => {
        this.notificationService.error('✨Lỗi cập nhật trạng thái đánh giá! Vui lòng thử lại.✨');
        console.error('Error updating status:', err);
      }
    });
  }

  openDeleteConfirm(row: any): void {
    this.confirmActionType = 'delete';
    this.pendingDeleteId = row.id;
    this.confirmTitle = 'Xác nhận xóa đánh giá';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa đánh giá của khách hàng "${row.customerName}" cho sản phẩm "${row.productTitle}" không? Thao tác này sẽ cập nhật lại điểm đánh giá trung bình của sản phẩm.`;
    this.confirmLabel = 'Xóa đánh giá';
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
  }

  onDeleteSelected(): void {
    if (this.selectedIds.size === 0) return;

    this.confirmActionType = 'bulk_delete';
    this.confirmTitle = 'Xác nhận xóa hàng loạt';
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${this.selectedIds.size} đánh giá đã chọn không? Thao tác này không thể hoàn tác.`;
    this.confirmLabel = `Xóa ${this.selectedIds.size} đánh giá`;
    this.confirmVariant = 'danger';
    this.confirmOpen = true;
  }

  onConfirmDialog(): void {
    this.confirmOpen = false;

    if (this.confirmActionType === 'delete' && this.pendingDeleteId) {
      this.apiService.deleteReview(this.pendingDeleteId).subscribe({
        next: (res: any) => {
          if (res && res.success) {
            this.notificationService.success('✨Đã xóa đánh giá thành công!✨');
            if (this.isDetailModalOpen && this.selectedReview?.id === this.pendingDeleteId) {
              this.closeDetailModal();
            }
            this.loadReviews();
          }
        },
        error: (err) => {
          this.notificationService.error('✨Lỗi khi xóa đánh giá! Vui lòng thử lại.✨');
          console.error('Error deleting review:', err);
        }
      });
    } else if (this.confirmActionType === 'bulk_delete' && this.selectedIds.size > 0) {
      const ids = Array.from(this.selectedIds);
      this.apiService.bulkDeleteReviews(ids).subscribe({
        next: (res: any) => {
          if (res && res.success) {
            this.notificationService.success(`✨Đã xóa ${res.deletedCount || ids.length} đánh giá đã chọn thành công!✨`);
            this.selectedIds.clear();
            this.loadReviews();
          }
        },
        error: (err) => {
          this.notificationService.error('✨Lỗi khi xóa hàng loạt đánh giá! Vui lòng thử lại.✨');
          console.error('Error bulk deleting reviews:', err);
        }
      });
    }

    this.confirmActionType = null;
    this.pendingDeleteId = null;
  }

  onCancelDialog(): void {
    this.confirmOpen = false;
    this.confirmActionType = null;
    this.pendingDeleteId = null;
  }
}
