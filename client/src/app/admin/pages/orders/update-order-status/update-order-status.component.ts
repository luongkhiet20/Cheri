/* eslint-disable @angular-eslint/prefer-standalone */
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ChangeDetectorRef, inject } from '@angular/core';
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
  private apiService = inject(AdminService);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() order: any = null;
  @Input() activeTab: 'order' | 'return' = 'order';

  @Output() modalClose = new EventEmitter<void>();
  @Output() statusUpdated = new EventEmitter<{ orderId: string; newStatus: string }>();
  @Output() returnUpdated = new EventEmitter<{ orderId: string; action: string }>();

  readonly statusOptions: StatusOption[] = [
    { value: 'DELIVERED', label: 'Đã giao' },
    { value: 'SHIPPING', label: 'Đang giao' },
    { value: 'PROCESSING', label: 'Đang xử lý' },
    { value: 'PENDING', label: 'Chờ xác nhận' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'RETURNED', label: 'Trả hàng' }
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

  // ── Return / Refund Workflow State ──
  currentTab: 'order' | 'return' = 'order';
  hasReturnReq = false;
  activeReturnReq: any = null;
  isProcessingReturn = false;
  returnErrorMessage = '';

  orderStatusNote = '';

  // Action fields
  showRejectInput = false;
  rejectReason = '';
  approveAmount = 0;
  approveInstructions = '';
  approveNote = '';
  shippingCarrier = '';
  shippingTrackingCode = '';
  shippingNote = '';
  receiveNote = '';
  inspectEligible = true;
  inspectNotes = '';
  inspectRestock = true;
  refundAmount = 0;
  refundTxId = '';
  refundBankName = '';
  refundAccountNum = '';
  refundAccountHolder = '';
  refundNotes = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.initStatus();
    } else if (changes['order'] && this.isOpen) {
      this.initStatus();
    } else if (changes['activeTab']) {
      this.currentTab = this.activeTab || 'order';
    }
  }

  private initStatus(): void {
    this.errorMessage = '';
    this.returnErrorMessage = '';
    this.isSaving = false;
    this.isProcessingReturn = false;
    this.showRejectInput = false;
    this.rejectReason = '';
    this.orderStatusNote = '';
    this.approveNote = '';
    this.shippingNote = '';
    this.receiveNote = '';

    if (!this.order) {
      this.initialStatus = 'PENDING';
      this.selectedStatus = 'PENDING';
      this.availableOptions = [...this.statusOptions];
      this.hasReturnReq = false;
      this.activeReturnReq = null;
      this.currentTab = 'order';
      return;
    }

    // 1. Khởi tạo trạng thái đơn hàng thông thường
    const rawStatus = this.order.statusCode || this.order.rawStatus || this.order.status;
    const normalized = this.normalizeStatus(rawStatus);

    this.initialStatus = normalized;
    this.selectedStatus = normalized;

    const allowed = this.VALID_TRANSITIONS[normalized] || [];
    const validTargetOptions = this.statusOptions.filter(opt => allowed.includes(opt.value));
    const currentBaseOpt = this.statusOptions.find(opt => opt.value === normalized);
    const currentLabel = currentBaseOpt ? currentBaseOpt.label : this.getStatusLabel(normalized);

    this.availableOptions = [
      { value: normalized, label: `${currentLabel} (Hiện tại)` },
      ...validTargetOptions
    ];

    // 2. Khởi tạo dữ liệu Yêu cầu đổi trả & hoàn tiền
    this.activeReturnReq = this.resolveActiveReturnRequest(this.order);
    this.hasReturnReq = !!this.activeReturnReq;

    if (this.hasReturnReq) {
      const req = this.activeReturnReq;
      const totalAmount = Number(this.order.totalAmount ?? this.order.total ?? 0);
      this.approveAmount = Number(req.refund?.approvedAmount) > 0
        ? Number(req.refund.approvedAmount)
        : (Number(req.refund?.requestedAmount) || totalAmount);
      this.approveInstructions = req.returnShipping?.instructions || 'Vui lòng bọc kỹ sản phẩm bằng túi chống sốc và gửi lại theo hướng dẫn của Chéri.';
      this.shippingCarrier = req.returnShipping?.carrier || 'Giao Hàng Nhanh (GHN)';
      this.shippingTrackingCode = req.returnShipping?.trackingCode || '';
      this.inspectEligible = req.inspection?.isEligible !== false;
      this.inspectNotes = req.inspection?.conditionNotes || '';
      this.inspectRestock = req.inspection?.restocked !== false;
      this.refundAmount = Number(req.refund?.approvedAmount) > 0
        ? Number(req.refund.approvedAmount)
        : (Number(req.refund?.requestedAmount) || totalAmount);
      this.refundTxId = req.refund?.transactionId || `RFD-${this.order.code || this.order.orderId || 'CHERI'}-${Date.now().toString().slice(-4)}`;
      this.refundBankName = req.refund?.bankName || '';
      this.refundAccountNum = req.refund?.accountNumber || '';
      this.refundAccountHolder = req.refund?.accountHolder || this.order.customer || '';
      this.refundNotes = req.refund?.notes || '';

      this.currentTab = this.activeTab === 'return' ? 'return' : 'order';
    } else {
      this.currentTab = 'order';
    }

    this.cdr.markForCheck();
  }

  switchTab(tab: 'order' | 'return'): void {
    this.currentTab = tab;
    this.errorMessage = '';
    this.returnErrorMessage = '';
    this.cdr.markForCheck();
  }

  resolveActiveReturnRequest(order: any): any {
    if (!order) return null;
    if (order.activeReturnRequest) return order.activeReturnRequest;

    const reqs: any[] = Array.isArray(order.returnRequests) && order.returnRequests.length > 0
      ? order.returnRequests
      : (Array.isArray(order.raw?.returnRequests) && order.raw.returnRequests.length > 0
        ? order.raw.returnRequests
        : (order.returnRequest ? [order.returnRequest] : (order.raw?.returnRequest ? [order.raw.returnRequest] : [])));

    if (reqs.length === 0) {
      if (order.latestReturnStatus) {
        return {
          status: order.latestReturnStatus,
          requestId: order.latestReturnRequestId,
          refund: { status: order.latestReturnRefundStatus }
        };
      }
      return null;
    }

    const getScore = (st: string) => {
      const s = String(st || '').toUpperCase();
      if (s === 'PENDING') return 5;
      if (['APPROVED', 'WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED', 'INSPECTED'].includes(s)) return 4;
      if (s === 'COMPLETED') return 3;
      if (s === 'REJECTED') return 2;
      if (s === 'CANCELLED') return 1;
      return 0;
    };

    const sorted = [...reqs].sort((a: any, b: any) => {
      const scoreDiff = getScore(b?.status) - getScore(a?.status);
      if (scoreDiff !== 0) return scoreDiff;
      const timeA = new Date(a?.requestedAt || a?.createdAt || 0).getTime();
      const timeB = new Date(b?.requestedAt || b?.createdAt || 0).getTime();
      return timeB - timeA;
    });

    return sorted[0];
  }

  // ── Ánh xạ chính xác theo bảng trạng thái nghiệp vụ Chéri ──
  getReturnDisplayLabel(req: any): string {
    if (!req) return '';
    const status = String(req.status || '').toUpperCase();
    const refSt = String(req.refund?.status || '').toUpperCase();

    if (status === 'PENDING') {
      return 'Chờ duyệt trả hàng';
    }
    if (status === 'APPROVED') {
      return 'Đã duyệt trả hàng';
    }
    if (['WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED'].includes(status)) {
      return 'Đang trả hàng';
    }
    if (status === 'INSPECTED') {
      if (refSt === 'PROCESSING') {
        return 'Đang hoàn tiền';
      }
      if (refSt === 'COMPLETED') {
        return 'Đã hoàn tiền';
      }
      return 'Đang kiểm hàng trả';
    }
    if (status === 'COMPLETED') {
      return 'Đã hoàn tiền';
    }
    if (status === 'REJECTED') {
      return 'Yêu cầu bị từ chối';
    }
    if (status === 'CANCELLED') {
      return 'Yêu cầu đã hủy';
    }
    return status;
  }

  getReturnBadgeClass(req: any): string {
    if (!req) return 'neutral';
    const s = String(req.status || '').toUpperCase();
    if (s === 'PENDING') return 'pending';
    if (s === 'APPROVED') return 'approved';
    if (['WAITING_FOR_RETURN_SHIPMENT', 'RETURN_SHIPPED', 'RETURN_RECEIVED'].includes(s)) return 'shipping';
    if (s === 'INSPECTED') return req.refund?.status === 'PROCESSING' ? 'refunding' : 'inspecting';
    if (s === 'COMPLETED') return 'completed';
    if (s === 'REJECTED') return 'rejected';
    if (s === 'CANCELLED') return 'cancelled';
    return 'neutral';
  }

  isReturnActionable(req: any): boolean {
    if (!req) return false;
    const s = String(req.status || '').toUpperCase();
    if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(s)) return false;
    if (s === 'INSPECTED') {
      const refSt = String(req.refund?.status || '').toUpperCase();
      if (refSt === 'COMPLETED' || refSt === 'NOT_REQUIRED') return false;
    }
    return true;
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
    if (this.isSaving || this.isProcessingReturn) return;
    this.errorMessage = '';
    this.returnErrorMessage = '';
    this.modalClose.emit();
  }

  onOverlayClick(e: MouseEvent): void {
    if ((e.target as HTMLElement).classList.contains('status-modal-overlay')) {
      this.onCancel();
    }
  }

  // ── Lưu thay đổi trạng thái đơn hàng thông thường ──
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

    const allowed = this.VALID_TRANSITIONS[this.initialStatus] || [];
    if (!allowed.includes(this.selectedStatus)) {
      this.errorMessage = `Không thể chuyển từ trạng thái "${this.getStatusLabel(this.initialStatus)}" sang "${this.getStatusLabel(this.selectedStatus)}".`;
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    this.apiService.updateOrderStatus(targetDocId, this.selectedStatus, this.orderStatusNote.trim() || undefined).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res && res.success !== false) {
          const newLabel = this.getStatusLabel(this.selectedStatus);
          const msg = res.message || `Đã cập nhật trạng thái đơn hàng thành "${newLabel}"`;
          this.notificationService.success(msg);
          this.statusUpdated.emit({ orderId: targetDocId, newStatus: this.selectedStatus });
          this.modalClose.emit();
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

  // ── Thực thi thao tác workflow trả hàng & hoàn tiền ──
  onExecuteReturnAction(action: string): void {
    if (this.isProcessingReturn) return;
    this.returnErrorMessage = '';

    if (!this.order) {
      this.returnErrorMessage = 'Không tìm thấy thông tin đơn hàng.';
      return;
    }

    const orderId = this.order._id || this.order.id || this.order.orderId;
    const req = this.activeReturnReq;
    const reqId = req?.requestId || req?._id || 'latest';

    let payload: any = {};

    switch (action) {
      case 'APPROVE':
        if (Number(this.approveAmount) < 0) {
          this.returnErrorMessage = 'Số tiền duyệt hoàn không hợp lệ.';
          return;
        }
        payload = {
          approvedAmount: Number(this.approveAmount),
          instructions: this.approveInstructions,
          note: this.approveNote.trim() || undefined
        };
        break;

      case 'REJECT':
        if (!this.rejectReason || !this.rejectReason.trim()) {
          this.returnErrorMessage = 'Vui lòng nhập lý do từ chối yêu cầu đổi trả.';
          return;
        }
        payload = { reason: this.rejectReason.trim() };
        break;

      case 'CUSTOMER_SHIPPED':
        payload = {
          carrier: this.shippingCarrier,
          trackingCode: this.shippingTrackingCode,
          note: this.shippingNote.trim() || undefined
        };
        break;

      case 'RECEIVE_GOODS':
        payload = {
          note: this.receiveNote.trim() || undefined
        };
        break;

      case 'INSPECT_GOODS':
        payload = {
          isEligible: this.inspectEligible,
          conditionNotes: this.inspectNotes,
          restock: this.inspectRestock,
          approvedAmount: Number(this.approveAmount)
        };
        break;

      case 'PROCESS_REFUND':
        if (Number(this.refundAmount) <= 0) {
          this.returnErrorMessage = 'Số tiền hoàn phải lớn hơn 0 đ.';
          return;
        }
        payload = {
          refundAmount: Number(this.refundAmount),
          transactionId: this.refundTxId,
          bankName: this.refundBankName,
          accountNumber: this.refundAccountNum,
          accountHolder: this.refundAccountHolder,
          notes: this.refundNotes
        };
        break;

      default:
        payload = {};
    }

    this.isProcessingReturn = true;

    this.apiService.updateReturnRequestWorkflow(orderId, reqId, action, payload).subscribe({
      next: (res: any) => {
        this.isProcessingReturn = false;
        if (res && res.success !== false) {
          const msg = res.message || 'Cập nhật tiến trình đổi trả & hoàn tiền thành công!';
          this.notificationService.success(msg);
          this.returnUpdated.emit({ orderId, action });
          this.modalClose.emit();
        } else {
          this.returnErrorMessage = res?.message || 'Không thể xử lý yêu cầu đổi trả.';
          this.notificationService.error(this.returnErrorMessage);
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => {
        this.isProcessingReturn = false;
        this.returnErrorMessage = err?.error?.message || err?.message || 'Có lỗi xảy ra khi xử lý yêu cầu đổi trả.';
        this.notificationService.error(this.returnErrorMessage);
        console.error('Lỗi khi thực hiện return workflow action:', err);
        this.cdr.markForCheck();
      }
    });
  }
}
