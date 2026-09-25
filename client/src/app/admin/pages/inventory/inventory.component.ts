import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-inventory',
  standalone: false,
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'name', label: 'Tên sản phẩm', type: 'text', sortable: true },
    { key: 'sku', label: 'SKU', type: 'text' },
    { key: 'quantity', label: 'Tồn kho', type: 'number', sortable: true, align: 'right' },
    { key: 'reserved', label: 'Đã đặt', type: 'number', align: 'right' },
    { key: 'available', label: 'Có thể bán', type: 'number', align: 'right' },
    { key: 'status', label: 'Tình trạng', type: 'status' },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];
  filterFields: FilterField[] = [
    {
      key: 'status', label: 'Tình trạng', type: 'select', options: [
        { value: 'Còn hàng', label: 'Còn hàng' },
        { value: 'Sắp hết', label: 'Sắp hết' },
        { value: 'Hết hàng', label: 'Hết hàng' }
      ]
    },
  ];
  data: any[] = [];
  allData: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  selectedIds: Set<any> = new Set();

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  isLoading = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  onImportInventory(): void {
    this.router.navigate(['/admin/inventory/import']);
  }

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.isLoading = true;
    this.apiService.getInventory().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allData = res.data || [];
          this.data = [...this.allData];
          this.pagination = { ...this.pagination, total: this.data.length };
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi inventory:', err);
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
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${c} mục đã chọn?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.pendingDeleteId) {
      this.apiService.deleteProduct(this.pendingDeleteId).subscribe({
        next: () => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.loadInventory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          console.error('Lỗi khi xóa sản phẩm từ kho:', err);
          this.cdr.markForCheck();
        }
      });
    } else if (this.isBulkDelete && this.selectedIds.size > 0) {
      this.apiService.bulkDeleteProducts(Array.from(this.selectedIds)).subscribe({
        next: () => {
          this.selectedIds.clear();
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.loadInventory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.isBulkDelete = false;
          console.error('Lỗi khi xóa hàng loạt sản phẩm từ kho:', err);
          this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      alert(`Sản phẩm: ${e.row.name}\nSKU: ${e.row.sku}\nTồn: ${e.row.quantity} | Đã đặt: ${e.row.reserved} | Khả dụng: ${e.row.available}`);
    } else if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc muốn xóa "${e.row.name}" không?`;
      this.confirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allData];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    const q = v.toLowerCase();
    this.data = this.allData.filter(d => (d.name || '').toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q));
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onFilter(v: Record<string, any>): void {
    if (!v['status']) {
      this.data = [...this.allData];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    this.data = this.allData.filter(d => d.status === v['status']);
    this.pagination = { ...this.pagination, total: this.data.length };
    this.cdr.markForCheck();
  }

  onRefresh(): void { this.loadInventory(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; this.cdr.markForCheck(); }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; this.cdr.markForCheck(); }
}
