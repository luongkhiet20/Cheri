import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { ApiService } from '../../../services/api.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-categories',
  standalone: false,
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css']
})
export class CategoriesComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'name', label: 'Tên danh mục', type: 'text', sortable: true },
    { key: 'slug', label: 'Slug', type: 'text' },
    { key: 'productCount', label: 'Số sản phẩm', type: 'number', sortable: true, align: 'right' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
  ];
  actions: RowAction[] = [
    { key: 'edit', label: 'Sửa' },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];
  filterFields: FilterField[] = [
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Hiển thị' }, { value: 'inactive', label: 'Ẩn' }] },
  ];

  data: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();
  isLoading = false;

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.apiService.getCategories().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.data = res.data || [];
          this.pagination = { ...this.pagination, total: this.data.length };
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải danh mục từ MongoDB:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onSelectionChange(ids: Set<any>): void { this.selectedIds = new Set(ids); }
  onToolbarSelectAll(): void {
    if (this.allSelected) { this.selectedIds = new Set(); }
    else { this.selectedIds = new Set(this.data.map((r: any) => r.id)); }
  }

  onDeleteSelected(): void {
    const c = this.selectedCount;
    if (c === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${c} danh mục đã chọn không?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.pendingDeleteId) {
      this.apiService.deleteCategory(this.pendingDeleteId).subscribe({
        next: () => {
          this.loadCategories();
          this.confirmOpen = false;
          this.pendingDeleteId = null;
        },
        error: (err) => console.error('Lỗi xóa danh mục:', err)
      });
    } else {
      this.confirmOpen = false;
    }
  }

  onCancelDelete(): void { this.confirmOpen = false; this.pendingDeleteId = null; }

  onAction(e: ActionEvent): void {
    if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc chắn muốn xóa danh mục "${e.row.name}" khỏi MongoDB không?`;
      this.confirmOpen = true;
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/categories', e.row.id, 'edit']);
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.loadCategories();
      return;
    }
    const q = v.toLowerCase();
    this.data = this.data.filter(c => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }

  onFilter(v: Record<string, any>): void {
    const statusVal = v['status'];
    if (!statusVal) {
      this.loadCategories();
      return;
    }
    const target = statusVal === 'active' ? 'Hiển thị' : 'Ẩn';
    this.data = this.data.filter(c => c.status === target);
  }

  onRefresh(): void { this.loadCategories(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; }
}
