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
    PROCESSING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['DELIVERED', 'CANCELLED'],
    DELIVERED: [],
    CANCELLED: []
  };

  readonly ALL_STATUSES: StatusOption[] = [
    { code: 'PENDING', label: 'Chờ xác nhận', variant: 'neutral' },
    { code: 'PROCESSING', label: 'Đang xử lý', variant: 'warning' },
    { code: 'SHIPPING', label: 'Đang giao', variant: 'primary' },
    { code: 'DELIVERED', label: 'Đã giao', variant: 'success' },
    { code: 'CANCELLED', label: 'Đã hủy', variant: 'danger' }
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
          this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin đơn hàng từ máy chủ MongoDB';
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
    this.confirmDialogMessage = `Bạn có chắc chắn muốn chuyển trạng thái đơn hàng "${this.order?.orderId || this.order?.code}" từ "${fromLabel}" sang "${toLabel}" không? Thao tác này sẽ cập nhật trực tiếp vào cơ sở dữ liệu MongoDB.`;
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
          this.successMessage = res.message || 'Cập nhật trạng thái đơn hàng thành công trên MongoDB';
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
    return it.item?.title || it.title || it.item?.name || it.item?.titleUrl?.replace(/-/g, ' ') || 'Sản phẩm';
  }

  getItemImage(it: any): string {
    return it.item?.mainImage?.url || (Array.isArray(it.item?.images) && it.item.images[0]) || '';
  }

  getItemVariants(it: any): string[] {
    const list: string[] = [];
    if (it.item?.sizes && Array.isArray(it.item.sizes) && it.item.sizes.length > 0) {
      list.push(`Size: ${it.item.sizes.join(', ')}`);
    }
    if (it.item?.colors && Array.isArray(it.item.colors) && it.item.colors.length > 0) {
      list.push(`Màu: ${it.item.colors.join(', ')}`);
    }
    if (it.item?.productType) {
      list.push(`Loại: ${it.item.productType}`);
    }
    return list;
  }
}
