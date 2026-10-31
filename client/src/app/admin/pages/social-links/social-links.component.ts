import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

export interface SocialLinkItem {
  id: string;
  platform: 'TIKTOK' | 'INSTAGRAM' | 'FACEBOOK' | string;
  platformName: string;
  url: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedAtFormatted?: string;
  status: string;
  statusVariant: 'success' | 'neutral';
}

@Component({
  selector: 'app-social-links',
  standalone: false,
  templateUrl: './social-links.component.html',
  styleUrls: ['./social-links.component.css']
})
export class SocialLinksComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'CMS' },
    { label: 'Quản lý mạng xã hội' }
  ];

  columns: TableColumn[] = [
    { key: 'platformName', label: 'Nền tảng', type: 'text', sortable: true },
    { key: 'urlDisplay', label: 'Đường dẫn liên kết', type: 'text', sortable: true },
    { key: 'updatedAtFormatted', label: 'Cập nhật lần cuối', type: 'text', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
  ];

  actions: RowAction[] = [
    {
      key: 'edit',
      label: 'Sửa',
      tooltip: 'Chỉnh sửa đường dẫn liên kết'
    },
    {
      key: 'toggle-off',
      label: 'Tắt',
      variant: 'warning',
      tooltip: 'Tắt hiển thị liên kết',
      showWhen: (r: SocialLinkItem) => r.isActive !== false
    },
    {
      key: 'toggle-on',
      label: 'Bật',
      variant: 'primary',
      tooltip: 'Bật hiển thị liên kết',
      showWhen: (r: SocialLinkItem) => r.isActive === false
    }
  ];

  filterFields: FilterField[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: '', label: 'Tất cả trạng thái' },
        { value: 'active', label: 'Đang hiển thị' },
        { value: 'inactive', label: 'Đang ẩn' }
      ]
    }
  ];

  data: SocialLinkItem[] = [];
  allData: SocialLinkItem[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 10, total: 3 };

  isLoading = false;
  errorMessage = '';

  currentSearch = '';
  currentStatusFilter = '';

  // Modal chỉnh sửa popup
  isEditModalOpen = false;
  editingItem: SocialLinkItem | null = null;
  editUrlValue = '';
  editUrlError = '';
  isSaving = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadSocialLinks();
  }

  get displayTotal(): number {
    return this.data.length;
  }

  loadSocialLinks(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminService.getSocialLinks().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res?.success) {
          const rawItems = res.data || [];
          this.allData = this.transformData(rawItems);
          this.applyFilters();
        } else {
          this.errorMessage = res?.message || 'Lỗi khi tải danh sách mạng xã hội';
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Không thể kết nối đến máy chủ API';
        console.error('Lỗi khi tải social-links:', err);
        this.cdr.markForCheck();
      }
    });
  }

  private transformData(items: any[]): SocialLinkItem[] {
    const platformDisplayNames: Record<string, string> = {
      TIKTOK: 'TikTok',
      INSTAGRAM: 'Instagram',
      FACEBOOK: 'Facebook'
    };

    return items.map((item: any) => {
      const platformKey = (item.platform || '').toUpperCase();
      const platformName = platformDisplayNames[platformKey] || platformKey;
      const isActive = Boolean(item.isActive);
      const url = item.url ? item.url.trim() : '';

      const updatedDate = item.updatedAt ? new Date(item.updatedAt) : null;
      const updatedAtFormatted = updatedDate
        ? updatedDate.toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
        : '—';

      return {
        id: item.id || item._id,
        platform: platformKey,
        platformName,
        url,
        urlDisplay: url || 'Chưa cấu hình',
        isActive,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        updatedAtFormatted,
        status: isActive ? 'Đang hiển thị' : 'Đang ẩn',
        statusVariant: isActive ? 'success' : 'neutral'
      };
    });
  }

  applyFilters(): void {
    let result = [...this.allData];

    if (this.currentSearch) {
      const q = this.currentSearch.toLowerCase().trim();
      result = result.filter(
        d =>
          d.platformName.toLowerCase().includes(q) ||
          d.platform.toLowerCase().includes(q) ||
          (d.url && d.url.toLowerCase().includes(q))
      );
    }

    if (this.currentStatusFilter === 'active') {
      result = result.filter(d => d.isActive);
    } else if (this.currentStatusFilter === 'inactive') {
      result = result.filter(d => !d.isActive);
    }

    this.data = result;
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onSearch(query: string): void {
    this.currentSearch = query || '';
    this.applyFilters();
  }

  onFilter(filters: Record<string, any>): void {
    this.currentStatusFilter = filters?.status || '';
    this.applyFilters();
  }

  onRefresh(): void {
    this.loadSocialLinks();
    this.notificationService.success('Đã làm mới danh sách mạng xã hội');
  }

  onAction(event: ActionEvent): void {
    const row = event.row as SocialLinkItem;
    if (!row) return;

    if (event.action === 'edit') {
      this.openEditModal(row);
    } else if (event.action === 'toggle' || event.action === 'toggle-off' || event.action === 'toggle-on') {
      this.toggleStatus(row);
    }
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.applyFilters();
  }

  onPageSizeChange(pageSize: number): void {
    this.pagination.pageSize = pageSize;
    this.pagination.page = 1;
    this.applyFilters();
  }

  // ── Modal chỉnh sửa URL ──────────────────────────────────
  openEditModal(item: SocialLinkItem): void {
    this.editingItem = { ...item };
    this.editUrlValue = item.url || '';
    this.editUrlError = '';
    this.isEditModalOpen = true;
    this.cdr.markForCheck();
  }

  closeEditModal(): void {
    if (this.isSaving) return;
    this.isEditModalOpen = false;
    this.editingItem = null;
    this.editUrlValue = '';
    this.editUrlError = '';
    this.cdr.markForCheck();
  }

  validateUrl(platform: string, url: string): string | null {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      return 'Vui lòng nhập đường dẫn URL';
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return 'Đường dẫn phải bắt đầu bằng http:// hoặc https://';
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();

      if (platform === 'TIKTOK' && !host.includes('tiktok.com')) {
        return 'Đường dẫn không hợp lệ cho TikTok (phải thuộc tên miền tiktok.com)';
      }
      if (platform === 'INSTAGRAM' && !host.includes('instagram.com')) {
        return 'Đường dẫn không hợp lệ cho Instagram (phải thuộc tên miền instagram.com)';
      }
      if (platform === 'FACEBOOK' && !host.includes('facebook.com') && !host.includes('fb.com')) {
        return 'Đường dẫn không hợp lệ cho Facebook (phải thuộc tên miền facebook.com hoặc fb.com)';
      }
    } catch (_) {
      return 'Định dạng URL không hợp lệ';
    }

    return null;
  }

  onSaveUrl(): void {
    if (!this.editingItem) return;

    const error = this.validateUrl(this.editingItem.platform, this.editUrlValue);
    if (error) {
      this.editUrlError = error;
      return;
    }

    this.editUrlError = '';
    this.isSaving = true;
    const platform = this.editingItem.platform;
    const url = this.editUrlValue.trim();

    this.adminService.updateSocialLinkUrl(platform, url).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        if (res?.success) {
          this.notificationService.success(`Đã cập nhật đường dẫn cho ${this.editingItem?.platformName} thành công!`);
          this.closeEditModal();
          this.loadSocialLinks();
        } else {
          this.editUrlError = res?.message || 'Cập nhật thất bại. Vui lòng thử lại.';
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isSaving = false;
        this.editUrlError = err?.error?.message || 'Có lỗi xảy ra khi cập nhật đường dẫn URL.';
        this.cdr.markForCheck();
      }
    });
  }

  // ── Bật / Tắt trạng thái ──────────────────────────────────
  toggleStatus(item: SocialLinkItem): void {
    const nextStatus = !item.isActive;

    // Nếu muốn bật mà chưa có URL
    if (nextStatus && (!item.url || !item.url.trim())) {
      this.notificationService.error(
        `Vui lòng cập nhật đường dẫn URL hợp lệ trước khi bật hiển thị ${item.platformName}.`
      );
      this.openEditModal(item);
      return;
    }

    this.isLoading = true;
    this.adminService.toggleSocialLinkStatus(item.platform, nextStatus).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res?.success) {
          const actionText = nextStatus ? 'Bật' : 'Tắt';
          this.notificationService.success(
            `${actionText} hiển thị ${item.platformName} thành công!`
          );
          this.loadSocialLinks();
        } else {
          this.notificationService.error(res?.message || 'Không thể thay đổi trạng thái');
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.notificationService.error(
          err?.error?.message || 'Có lỗi xảy ra khi cập nhật trạng thái hiển thị.'
        );
        this.cdr.markForCheck();
      }
    });
  }
}
