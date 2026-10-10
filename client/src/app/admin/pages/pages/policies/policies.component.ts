import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../../shared/models/admin-table.models';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ADMIN_PAGES_URLS } from '../pages.routes';

export function isPolicyPublished(row: any): boolean {
  if (!row) return false;
  if (typeof row.isPublished === 'boolean') return row.isPublished;
  return row.status === 'Đã xuất bản' || row.statusCode === 'published';
}

@Component({
  selector: 'app-policies',
  standalone: false,
  templateUrl: './policies.component.html',
  styleUrls: ['./policies.component.css']
})
export class PoliciesComponent implements OnInit {
  readonly adminPagesUrls = ADMIN_PAGES_URLS;

  columns: TableColumn[] = [
    { key: 'title', label: 'Tiêu đề chính sách', type: 'text', sortable: true },
    { key: 'slug', label: 'Đường dẫn', type: 'text', sortable: true },
    { key: 'updatedAt', label: 'Cập nhật lần cuối', type: 'date', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    {
      key: 'toggle',
      label: 'Tắt',
      showWhen: (r: any) => isPolicyPublished(r)
    },
    {
      key: 'toggle',
      label: 'Bật',
      showWhen: (r: any) => !isPolicyPublished(r)
    }
  ];
  filterFields: FilterField[] = [
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'select',
      options: [
        { value: 'Đã xuất bản', label: 'Đã xuất bản' },
        { value: 'Bản nháp', label: 'Bản nháp' }
      ]
    },
  ];

  data: any[] = [];
  allData: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  currentSearch = '';
  currentStatusFilter = '';

  constructor(
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.loadPolicies();
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get allSelected(): boolean {
    return this.data.length > 0 && this.data.every(r => this.selectedIds.has(r.id));
  }

  get displayTotal(): number {
    return this.pagination.total || this.data.length;
  }

  isPolicyPublished(row: any): boolean {
    return isPolicyPublished(row);
  }

  applyFilters(): void {
    let result = [...this.allData];
    if (this.currentSearch) {
      const q = this.currentSearch.toLowerCase();
      result = result.filter(d => (d.title && d.title.toLowerCase().includes(q)) || (d.slug && d.slug.toLowerCase().includes(q)));
    }
    if (this.currentStatusFilter) {
      result = result.filter(d => d.status === this.currentStatusFilter);
    }
    this.data = result;
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  loadPolicies(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPages().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allData = res.data || [];
          this.applyFilters();
        } else {
          this.errorMessage = res.message || 'Lỗi khi tải danh sách chính sách';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Không thể tải danh sách chính sách từ máy chủ MongoDB';
        console.error('Lỗi policies:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onSelectionChange(ids: Set<any>): void {
    this.selectedIds = new Set(ids);
    this.cdr.markForCheck();
  }

  onToolbarSelectAll(): void {
    if (this.allSelected) {
      this.selectedIds = new Set();
    } else {
      this.selectedIds = new Set(this.data.map((r: any) => r.id));
    }
    this.cdr.markForCheck();
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'view' || e.action === 'preview') {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES, e.row.id]);
    } else if (e.action === 'edit') {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES, e.row.id, 'edit']);
    } else if (e.action === 'toggle') {
      const isCurrentlyPublished = this.isPolicyPublished(e.row);
      const newTarget = isCurrentlyPublished ? 'draft' : 'published';
      const nextIsPublished = !isCurrentlyPublished;

      // Lưu trạng thái trước để hoàn tác nếu xảy ra lỗi
      const prevIsPublished = e.row.isPublished;
      const prevStatus = e.row.status;
      const prevStatusVariant = e.row.statusVariant;
      const prevStatusCode = e.row.statusCode;

      // Cập nhật ngay trên bảng (optimistic update)
      e.row.isPublished = nextIsPublished;
      e.row.status = nextIsPublished ? 'Đã xuất bản' : 'Bản nháp';
      e.row.statusVariant = nextIsPublished ? 'success' : 'neutral';
      e.row.statusCode = nextIsPublished ? 'published' : 'draft';

      const itemInAll = this.allData.find(item => item.id === e.row.id);
      if (itemInAll && itemInAll !== e.row) {
        itemInAll.isPublished = nextIsPublished;
        itemInAll.status = e.row.status;
        itemInAll.statusVariant = e.row.statusVariant;
        itemInAll.statusCode = e.row.statusCode;
      }
      this.cdr.markForCheck();

      this.apiService.patchPageStatus(e.row.id, newTarget).subscribe({
        next: (res) => {
          if (res.success) {
            if (res.data) {
              Object.assign(e.row, res.data);
              if (itemInAll) {
                Object.assign(itemInAll, res.data);
              }
            }
            const msg = res.message || `Chính sách    cn sang trạng thái "${nextIsPublished ? 'Đã xuất bản' : 'Bản nháp'}"`;
            this.successMessage = msg;
            this.notificationService.success(msg);
            this.loadPolicies();
          } else {
            // Hoàn tác nếu server trả về không thành công
            e.row.isPublished = prevIsPublished;
            e.row.status = prevStatus;
            e.row.statusVariant = prevStatusVariant;
            e.row.statusCode = prevStatusCode;
            if (itemInAll) {
              itemInAll.isPublished = prevIsPublished;
              itemInAll.status = prevStatus;
              itemInAll.statusVariant = prevStatusVariant;
              itemInAll.statusCode = prevStatusCode;
            }
            const msg = res.message || 'Lỗi khi đổi trạng thái';
            this.errorMessage = msg;
            this.notificationService.error(msg);
          }
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = '';
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (err) => {
          // Hoàn tác nếu lỗi kết nối
          e.row.isPublished = prevIsPublished;
          e.row.status = prevStatus;
          e.row.statusVariant = prevStatusVariant;
          e.row.statusCode = prevStatusCode;
          if (itemInAll) {
            itemInAll.isPublished = prevIsPublished;
            itemInAll.status = prevStatus;
            itemInAll.statusVariant = prevStatusVariant;
            itemInAll.statusCode = prevStatusCode;
          }
          const msg = err.error?.message || 'Lỗi kết nối khi đổi trạng thái chính sách';
          this.errorMessage = msg;
          this.notificationService.error(msg);
          this.cdr.markForCheck();
          setTimeout(() => {
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        }
      });
    }
  }

  onSearch(v: string): void {
    this.currentSearch = v || '';
    this.pagination = { ...this.pagination, page: 1 };
    this.applyFilters();
  }

  onFilter(v: Record<string, any>): void {
    this.currentStatusFilter = v?.['status'] || '';
    this.pagination = { ...this.pagination, page: 1 };
    this.applyFilters();
  }

  onRefresh(): void { this.loadPolicies(); }
  onPageChange(p: number): void {
    this.pagination = { ...this.pagination, page: p };
    this.cdr.markForCheck();
  }
  onPageSizeChange(s: number): void {
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.cdr.markForCheck();
  }
}

export { PoliciesComponent as PagesComponent };
