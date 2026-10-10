import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-inventory',
  standalone: false,
  templateUrl: './inventory.component.html',
  styleUrls: ['./inventory.component.css']
})
export class InventoryComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý tồn kho' }
  ];

  columns: TableColumn[] = [
    { key: 'image', label: '', type: 'image', width: '72px' },
    { key: 'name', label: 'Tên sản phẩm', type: 'text', sortable: true },
    { key: 'sku', label: 'SKU', type: 'sku-list', width: '200px', sortable: true },
    { key: 'quantity', label: 'Tồn kho', type: 'number', sortable: true, align: 'right' },
    { key: 'reserved', label: 'Đã đặt', type: 'number', sortable: true, align: 'right' },
    { key: 'available', label: 'Có thể bán', type: 'number', sortable: true, align: 'right' },
    { key: 'status', label: 'Tình trạng', type: 'status', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
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

  get deleteLabel(): string {
    return this.selectedCount > 0
      ? `Xóa đã chọn (${this.selectedCount})`
      : 'Xóa đã chọn';
  }

  isLoading = false;

  constructor(
    private apiService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
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
          this.allData = (res.data || []).map((item: any) => {
            const raw = item.raw || item;
            const hasVariants = Boolean(item.hasVariants || (Array.isArray(item.variants) && item.variants.length > 0));

            let totalStock = 0;
            let totalReserved = 0;
            let totalAvailable = 0;
            let displaySku = item.sku || '';
            let variantSkus: string[] = [];

            if (hasVariants && Array.isArray(item.variants) && item.variants.length > 0) {
              totalStock = item.variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
              totalReserved = item.variants.reduce((sum: number, v: any) => sum + (Number(v.reserved) || 0), 0);
              totalAvailable = item.variants.reduce(
                (sum: number, v: any) => sum + Math.max(0, (Number(v.stock) || 0) - (Number(v.reserved) || 0)),
                0
              );
              variantSkus = item.variants.map((v: any) => v.sku).filter(Boolean);
              if (variantSkus.length > 0) {
                displaySku = variantSkus.join(', ');
              }
            } else {
              totalStock = Math.max(
                0,
                Number(item.stock !== undefined ? item.stock : (item.quantity !== undefined ? item.quantity : (raw.vi?.stock ?? (raw.vi?.quantity ?? 0))))
              );
              totalReserved = Math.max(0, Number(item.reserved) || 0);
              totalAvailable = Math.max(0, totalStock - totalReserved);
              displaySku = (item.sku || raw.sku || raw.vi?.sku || '').trim();
            }

            let status = 'Còn hàng';
            let statusVariant = 'success';
            if (totalAvailable <= 0) {
              status = 'Hết hàng';
              statusVariant = 'danger';
            } else if (totalAvailable <= 5) {
              status = 'Sắp hết';
              statusVariant = 'warning';
            }

            return {
              ...item,
              image: item.image || raw.mainImage?.url || (Array.isArray(raw.images) && raw.images[0]) || '',
              hasVariants,
              sku: (hasVariants && variantSkus.length > 0) ? variantSkus : (displaySku || '---'),
              quantity: totalStock,
              stock: totalStock,
              reserved: totalReserved,
              available: totalAvailable,
              status,
              statusVariant
            };
          });
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
          this.notificationService.success('Xóa sản phẩm thành công.');
          this.loadInventory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.pendingDeleteId = null;
          this.notificationService.error('Lỗi khi xóa sản phẩm từ kho.');
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
          this.notificationService.success('Đã xóa các sản phẩm được chọn thành công.');
          this.loadInventory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.confirmOpen = false;
          this.isBulkDelete = false;
          this.notificationService.error('Lỗi khi xóa hàng loạt sản phẩm.');
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
    const prodId = e.row.id || e.row._id || e.row.productId;
    if (e.action === 'view') {
      if (prodId) {
        this.router.navigate(['/admin/inventory', prodId]);
      }
    } else if (e.action === 'edit') {
      if (prodId) {
        this.router.navigate(['/admin/inventory', prodId, 'edit']);
      }
    } else if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc muốn xóa "${e.row.name}" không?`;
      this.confirmOpen = true;
      this.cdr.markForCheck();
    }
  }

  getVariantDesc(v: any): string {
    const parts = [v.color, v.size, v.classification].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : 'Mặc định';
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allData];
      this.pagination = { ...this.pagination, total: this.data.length };
      this.cdr.markForCheck();
      return;
    }
    const q = v.toLowerCase().trim();
    this.data = this.allData.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.sku || '').toLowerCase().includes(q) ||
      (d.variants && d.variants.some((v: any) => (v.sku || '').toLowerCase().includes(q)))
    );
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
