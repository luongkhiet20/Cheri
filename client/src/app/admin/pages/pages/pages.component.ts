import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-pages',
  standalone: false,
  templateUrl: './pages.component.html',
  styleUrls: ['./pages.component.css']
})
export class PagesComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'title', label: 'Tiêu đề trang', type: 'text', sortable: true },
    { key: 'slug', label: 'Đường dẫn', type: 'text' },
    { key: 'updatedAt', label: 'Cập nhật lần cuối', type: 'date', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    { key: 'toggle', label: 'Bật/Tắt' },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
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

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadPages();
  }

  loadPages(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPages().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allData = res.data || [];
          this.data = [...this.allData];
          this.pagination = { ...this.pagination, total: this.data.length };
        } else {
          this.errorMessage = res.message || 'Lỗi khi tải danh sách trang';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Không thể tải danh sách trang từ máy chủ MongoDB';
        console.error('Lỗi pages:', err);
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

  onDeleteSelected(): void {
    const c = this.selectedCount;
    if (c === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${c} trang đã chọn khỏi MongoDB?`;
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmDelete(): void {
    if (this.isBulkDelete) {
      const idsToDelete = Array.from(this.selectedIds);
      this.confirmOpen = false;
      this.cdr.markForCheck();
      let completed = 0;
      idsToDelete.forEach(id => {
        this.apiService.deletePage(id).subscribe({
          next: () => {
            completed++;
            if (completed === idsToDelete.length) {
              this.selectedIds.clear();
              this.successMessage = `Đã xóa thành công ${completed} trang`;
              this.cdr.markForCheck();
              setTimeout(() => {
                this.successMessage = '';
                this.cdr.markForCheck();
              }, 3000);
              this.loadPages();
            }
          },
          error: (err) => {
            console.error('Lỗi khi xóa trang:', err);
            this.cdr.markForCheck();
          }
        });
      });
    } else if (this.pendingDeleteId) {
      this.apiService.deletePage(this.pendingDeleteId).subscribe({
        next: (res) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          if (res.success) {
            this.successMessage = 'Xóa trang thành công';
            this.loadPages();
          } else {
            this.errorMessage = res.message || 'Lỗi khi xóa trang';
          }
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = '';
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.errorMessage = err.error?.message || 'Lỗi khi xóa trang khỏi MongoDB';
          this.cdr.markForCheck();
          setTimeout(() => {
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        }
      });
    } else {
      this.confirmOpen = false;
      this.cdr.markForCheck();
    }
  }

  onCancelDelete(): void {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.isBulkDelete = false;
    this.cdr.markForCheck();
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'view' || e.action === 'preview') {
      this.router.navigate(['/admin/pages', e.row.id]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/pages', e.row.id, 'edit']);
    } else if (e.action === 'toggle') {
      const newTarget = e.row.isPublished ? 'draft' : 'published';
      this.apiService.patchPageStatus(e.row.id, newTarget).subscribe({
        next: (res) => {
          if (res.success) {
            this.successMessage = res.message || 'Cập nhật trạng thái thành công';
            this.loadPages();
          } else {
            this.errorMessage = res.message || 'Lỗi khi đổi trạng thái';
          }
          this.cdr.markForCheck();
          setTimeout(() => {
            this.successMessage = '';
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Lỗi kết nối khi đổi trạng thái trang';
          this.cdr.markForCheck();
          setTimeout(() => {
            this.errorMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        }
      });
    } else if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc muốn xóa trang "${e.row.title}" khỏi MongoDB không?`;
      this.confirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allData];
    } else {
      const q = v.toLowerCase();
      this.data = this.allData.filter(d => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q));
    }
    this.cdr.markForCheck();
  }

  onFilter(v: Record<string, any>): void {
    if (!v['status']) {
      this.data = [...this.allData];
    } else {
      this.data = this.allData.filter(d => d.status === v['status']);
    }
    this.cdr.markForCheck();
  }

  onRefresh(): void { this.loadPages(); }
  onPageChange(p: number): void {
    this.pagination = { ...this.pagination, page: p };
    this.cdr.markForCheck();
  }
  onPageSizeChange(s: number): void {
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.cdr.markForCheck();
  }
}
