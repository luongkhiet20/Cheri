import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

interface StatusOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-update-order-status',
  standalone: false,
  templateUrl: './update-order-status.component.html',
  styleUrls: ['./update-order-status.component.css']
})
export class UpdateOrderStatusComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() order: any = null;

  @Output() close = new EventEmitter<void>();
  @Output() statusUpdated = new EventEmitter<{ orderId: string; newStatus: string }>();

  readonly statusOptions: StatusOption[] = [
    { value: 'DELIVERED', label: 'Đã giao' },
    { value: 'SHIPPING', label: 'Đang giao' },
    { value: 'PROCESSING', label: 'Đang xử lý' },
    { value: 'PENDING', label: 'Chờ xác nhận' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'RETURNED', label: 'Đã hoàn trả' }
  ];

  readonly VALID_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPING', 'CANCELLED'],
    SHIPPING: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['RETURNED'],
    CANCELLED: [],
    RETURNED: []
  };

  initialStatus = '';
  selectedStatus = '';
  availableOptions: StatusOption[] = [];
  isSaving = false;
  errorMessage = '';

  constructor(
    private apiService: AdminService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.initStatus();
    } else if (changes['order'] && this.isOpen) {
      this.initStatus();
    }
  }

  private initStatus(): void {
    this.errorMessage = '';
    this.isSaving = false;

    if (!this.order) {
      this.initialStatus = 'PENDING';
      this.selectedStatus = 'PENDING';
      this.availableOptions = [...this.statusOptions];
      return;
    }

    const rawStatus = this.order.statusCode || this.order.rawStatus || this.order.status;
    const normalized = this.normalizeStatus(rawStatus);

    this.initialStatus = normalized;
    this.selectedStatus = normalized;

    // Lọc duy nhất các trạng thái chuyển tiếp hợp lệ theo quy tắc nghiệp vụ
    const allowed = this.VALID_TRANSITIONS[normalized] || [];
    const validTargetOptions = this.statusOptions.filter(opt => allowed.includes(opt.value));

    const currentBaseOpt = this.statusOptions.find(opt => opt.value === normalized);
    const currentLabel = currentBaseOpt ? currentBaseOpt.label : this.getStatusLabel(normalized);

    // Danh sách chọn chỉ hiển thị trạng thái hiện tại và các trạng thái hợp lệ có thể chuyển sang
    this.availableOptions = [
      { value: normalized, label: `${currentLabel} (Hiện tại)` },
      ...validTargetOptions
    ];

    this.cdr.markForCheck();
  }

  normalizeStatus(val: unknown): string {
    if (!val || typeof val !== 'string') return 'PENDING';
    const trimmed = val.trim().toUpperCase();

    const matchByValue = this.statusOptions.find(s => s.value === trimmed);
    if (matchByValue) return matchByValue.value;

    const matchByLabel = this.statusOptions.find(s => s.label.toUpperCase() === trimmed);
    if (matchByLabel) return matchByLabel.value;

    if (trimmed === 'NEW') return 'PENDING';
    if (trimmed === 'CONFIRMED') return 'PROCESSING';
    if (trimmed === 'COMPLETED') return 'DELIVERED';
    if (trimmed === 'CANCELED') return 'CANCELLED';
    if (trimmed === 'RETURN' || trimmed === 'DELIVERY_FAILED') return 'RETURNED';

    return 'PENDING';
  }

  getStatusLabel(val: string): string {
    const found = this.statusOptions.find(s => s.value === val);
    return found ? found.label : (val || '—');
  }

  get isUnchanged(): boolean {
    return !!this.initialStatus && this.selectedStatus === this.initialStatus;
  }

  get hasAvailableTransitions(): boolean {
    const allowed = this.VALID_TRANSITIONS[this.initialStatus] || [];
    return allowed.length > 0;
  }

  onCancel(): void {
    if (this.isSaving) return;
    this.errorMessage = '';
    this.close.emit();
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('status-modal-overlay')) {
      this.onCancel();
    }
  }

  onSave(): void {
    if (this.isSaving) return;

    if (!this.order) {
      this.errorMessage = 'Không xác định được đơn hàng cần cập nhật.';
      return;
    }

    const targetDocId = this.order._id || this.order.id || this.order.orderId;
    if (!targetDocId) {
      this.errorMessage = 'Không tìm thấy mã định danh đơn hàng hợp lệ.';
      return;
    }

    if (!this.selectedStatus) {
      this.errorMessage = 'Vui lòng chọn trạng thái đơn hàng.';
      return;
    }

    if (this.isUnchanged) {
      this.errorMessage = `Đơn hàng hiện tại đã ở trạng thái "${this.getStatusLabel(this.initialStatus)}".`;
      return;
    }

    // Xác thực trạng thái được chọn phải nằm trong danh sách chuyển đổi hợp lệ
    const allowed = this.VALID_TRANSITIONS[this.initialStatus] || [];
    if (!allowed.includes(this.selectedStatus)) {
      this.errorMessage = `Không thể chuyển từ trạng thái "${this.getStatusLabel(this.initialStatus)}" sang "${this.getStatusLabel(this.selectedStatus)}".`;
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    this.apiService.updateOrderStatus(targetDocId, this.selectedStatus).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res && res.success !== false) {
          const newLabel = this.getStatusLabel(this.selectedStatus);
          const msg = res.message || `Đã cập nhật trạng thái đơn hàng thành "${newLabel}"`;
          this.notificationService.success(msg);
          this.statusUpdated.emit({ orderId: targetDocId, newStatus: this.selectedStatus });
          this.close.emit();
        } else {
          const msg = res?.message || 'Không thể cập nhật trạng thái đơn hàng.';
          this.errorMessage = msg;
          this.notificationService.error(msg);
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => {
        this.isSaving = false;
        const msg = err?.error?.message || err?.message || 'Lỗi khi cập nhật trạng thái vào cơ sở dữ liệu.';
        this.errorMessage = msg;
        this.notificationService.error(msg);
        console.error('Lỗi khi cập nhật trạng thái đơn hàng:', err);
        this.cdr.markForCheck();
      }
    });
  }
}
