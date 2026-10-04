import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { AdminService } from '../../../services/admin.service';

@Component({
  selector: 'app-inventory-detail',
  standalone: false,
  templateUrl: './inventory-detail.component.html',
  styleUrls: ['./inventory-detail.component.css']
})
export class InventoryDetailComponent implements OnInit {
  productId: string | null = null;
  isLoading = false;
  errorMessage = '';
  inventoryData: any = null;

  constructor(
    private adminService: AdminService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      this.productId = id;
      if (id) {
        this.loadDetail(id);
      } else {
        this.errorMessage = 'Mã định danh sản phẩm không hợp lệ.';
        this.cdr.markForCheck();
      }
    });
  }

  loadDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.inventoryData = null;
    this.cdr.markForCheck();

    this.adminService.getInventoryById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.inventoryData = res.data;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy dữ liệu tồn kho cho sản phẩm này.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải chi tiết tồn kho:', err);
        this.errorMessage = err?.error?.message || 'Không thể kết nối đến máy chủ hoặc dữ liệu không tồn tại. Vui lòng thử lại sau.';
        this.cdr.markForCheck();
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/admin/inventory']);
  }

  formatCurrency(value: any): string {
    const num = Number(value);
    if (isNaN(num)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  }

  formatNumber(value: any): string {
    const num = Number(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('vi-VN');
  }

  getStatusClass(status: string): string {
    if (status === 'Còn hàng') return 'status-in-stock';
    if (status === 'Sắp hết') return 'status-low-stock';
    if (status === 'Hết hàng') return 'status-out-of-stock';
    return 'status-neutral';
  }
}
