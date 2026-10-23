import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-newsletter-subscribers',
  standalone: false,
  templateUrl: './newsletter-subscribers.component.html',
  styleUrls: ['./newsletter-subscribers.component.css']
})
export class NewsletterSubscribersComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Đăng ký nhận ưu đãi' }
  ];

  columns: TableColumn[] = [
    { key: 'stt', label: 'STT', type: 'text', width: '70px', align: 'center' },
    { key: 'customer', label: 'Khách hàng', type: 'customer', width: '220px' },
    { key: 'email', label: 'Email', type: 'text', sortable: true },
    { key: 'subscribedAtFormatted', label: 'Ngày đăng ký', type: 'text', sortable: true },
    { key: 'statusText', label: 'Trạng thái', type: 'status', sortable: true }
  ];

  actions: RowAction[] = [
    {
      key: 'status',
      label: 'Cập nhật trạng thái',
      icon: '',
      tooltip: 'Cập nhật trạng thái'
    },
    {
      key: 'copy',
      label: 'Sao chép',
      icon: '',
      tooltip: 'Sao chép email'
    }
  ];

  filterFields: FilterField[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả trạng thái' },
        { value: 'SUBSCRIBED', label: 'Đang đăng ký' },
        { value: 'UNSUBSCRIBED', label: 'Đã hủy' }
      ]
    }
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };

  currentSearch = '';
  currentStatus = '';
  isLoading = false;
  errorMessage = '';

  // Popup Cập nhật trạng thái
  isStatusModalOpen: boolean = false;
  selectedSubscriber: any = null;
  newStatus: 'SUBSCRIBED' | 'UNSUBSCRIBED' = 'SUBSCRIBED';
  isUpdatingStatus: boolean = false;

  statusOptions = [
    { value: 'SUBSCRIBED', label: 'Đang đăng ký' },
    { value: 'UNSUBSCRIBED', label: 'Đã hủy' }
  ];

  get displayTotal(): number {
    return this.pagination?.total ?? this.data.length;
  }

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadSubscribers();
  }

  loadSubscribers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const params: any = {
      page: this.pagination.page,
      pageSize: this.pagination.pageSize,
      search: this.currentSearch,
      status: this.currentStatus,
      sortBy: 'subscribedAt',
      sortOrder: 'desc'
    };

    this.adminService.getNewsletterSubscribers(params).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        const rawItems = res?.data || [];
        const page = res?.pagination?.page || this.pagination.page;
        const pageSize = res?.pagination?.pageSize || this.pagination.pageSize;

        this.data = rawItems.map((item: any, index: number) => {
          const stt = (page - 1) * pageSize + index + 1;
          const isSubscribed = item.status === 'SUBSCRIBED';
          const subDate = item.subscribedAt ? new Date(item.subscribedAt) : null;
          const subscribedAtFormatted = subDate
            ? subDate.toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
            : '—';

          return {
            ...item,
            id: item.id || item._id,
            stt,
            subscribedAtFormatted,
            statusText: isSubscribed ? 'Đang đăng ký' : 'Đã hủy',
            statusTextVariant: isSubscribed ? 'success' : 'neutral'
          };
        });

        if (res?.pagination) {
          this.pagination = {
            page: res.pagination.page,
            pageSize: res.pagination.pageSize,
            total: res.pagination.total
          };
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || 'Có lỗi xảy ra khi tải danh sách người đăng ký nhận ưu đãi.';
        this.notificationService.error(this.errorMessage);
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(query: string): void {
    this.currentSearch = query ? query.trim() : '';
    this.pagination.page = 1;
    this.loadSubscribers();
  }

  onFilter(values: Record<string, any>): void {
    this.currentStatus = values['status'] || '';
    this.pagination.page = 1;
    this.loadSubscribers();
  }

  onRefresh(): void {
    this.loadSubscribers();
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.loadSubscribers();
  }

  onPageSizeChange(pageSize: number): void {
    this.pagination.pageSize = pageSize;
    this.pagination.page = 1;
    this.loadSubscribers();
  }

  onAction(event: ActionEvent): void {
    if (event.action === 'status' || event.action === 'updateStatus') {
      this.openStatusModal(event.row);
      return;
    }

    if (event.action === 'copy') {
      const email = event.row?.email;
      if (!email) {
        this.notificationService.error('Không tìm thấy địa chỉ email để sao chép.');
        return;
      }

      this.copyToClipboard(email);
    }
  }

  openStatusModal(subscriber: any): void {
    if (!subscriber) return;
    this.selectedSubscriber = subscriber;
    this.newStatus = subscriber.status === 'UNSUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED';
    this.isStatusModalOpen = true;
    this.cdr.markForCheck();
  }

  closeStatusModal(): void {
    if (this.isUpdatingStatus) return;
    this.isStatusModalOpen = false;
    this.selectedSubscriber = null;
    this.cdr.markForCheck();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isStatusModalOpen && !this.isUpdatingStatus) {
      this.closeStatusModal();
    }
  }

  get isStatusUnchanged(): boolean {
    return !this.selectedSubscriber || this.newStatus === this.selectedSubscriber.status;
  }

  getStatusLabel(status?: string): string {
    return status === 'SUBSCRIBED' ? 'Đang đăng ký' : 'Đã hủy';
  }

  saveStatusChange(): void {
    if (!this.selectedSubscriber || this.isUpdatingStatus) return;

    if (this.isStatusUnchanged) {
      this.notificationService.error('Vui lòng chọn trạng thái khác với trạng thái hiện tại.');
      return;
    }

    const subscriberId = this.selectedSubscriber.id || this.selectedSubscriber._id;
    if (!subscriberId) {
      this.notificationService.error('Không tìm thấy ID người đăng ký.');
      return;
    }

    const targetStatus = this.newStatus;
    this.isUpdatingStatus = true;
    this.cdr.markForCheck();

    this.adminService.updateNewsletterSubscriberStatus(subscriberId, targetStatus).subscribe({
      next: (res: any) => {
        this.isUpdatingStatus = false;
        this.isStatusModalOpen = false;

        // Cập nhật ngay bản ghi trong bảng
        const isSubscribed = targetStatus === 'SUBSCRIBED';
        const targetRow = this.data.find(d => (d.id || d._id) === subscriberId);
        if (targetRow) {
          targetRow.status = targetStatus;
          targetRow.statusText = isSubscribed ? 'Đang đăng ký' : 'Đã hủy';
          targetRow.statusTextVariant = isSubscribed ? 'success' : 'neutral';
        }

        // Thông báo thành công theo đúng yêu cầu prompt
        if (targetStatus === 'SUBSCRIBED') {
          this.notificationService.success('Cập nhật thành công! Email đã chuyển sang trạng thái Đang đăng ký.');
        } else {
          this.notificationService.success('Cập nhật thành công! Email đã chuyển sang trạng thái Đã hủy.');
        }

        // Đồng bộ bộ lọc, phân trang và số lượng bản ghi nếu trạng thái mới không còn thuộc bộ lọc đang chọn
        if (this.currentStatus && this.currentStatus !== targetStatus) {
          this.loadSubscribers();
        } else {
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => {
        this.isUpdatingStatus = false;
        const msg = err?.error?.message || 'Không thể cập nhật trạng thái. Vui lòng thử lại.';
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  private copyToClipboard(text: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.notificationService.success('Đã sao chép email thành công');
        })
        .catch(() => {
          this.fallbackCopyToClipboard(text);
        });
    } else {
      this.fallbackCopyToClipboard(text);
    }
  }

  private fallbackCopyToClipboard(text: string): void {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        this.notificationService.success('Đã sao chép email thành công');
      } else {
        this.notificationService.error('Không thể sao chép email vào bộ nhớ tạm.');
      }
    } catch (err) {
      this.notificationService.error('Không thể sao chép email vào bộ nhớ tạm.');
    }
  }
}
