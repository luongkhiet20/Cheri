import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: false,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Constant configuration
  readonly LOW_STOCK_THRESHOLD = 5;

  // State
  stats: any = null;
  isLoading = true;
  isRefreshing = false;
  errorMessage = '';
  currentTimeRange = '7d';
  lastUpdatedText = '';
  hoveredPoint: any = null;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(isRefresh = false): void {
    if (isRefresh) {
      this.isRefreshing = true;
    } else if (!this.stats) {
      this.isLoading = true;
    }
    this.errorMessage = '';

    this.apiService.getDashboardStats(this.currentTimeRange).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.isRefreshing = false;
        if (res.success && res.stats) {
          this.stats = res.stats;
          this.lastUpdatedText = this.formatTimestamp(new Date());
        } else {
          this.errorMessage = 'Không nhận được dữ liệu hợp lệ từ máy chủ.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.isRefreshing = false;
        this.errorMessage = 'Không thể tải dữ liệu Dashboard từ MongoDB Atlas. Vui lòng kiểm tra kết nối.';
        console.error('Error loading dashboard stats:', err);
        this.cdr.markForCheck();
      }
    });
  }

  setTimeRange(range: string): void {
    if (this.currentTimeRange === range || this.isRefreshing) return;
    this.currentTimeRange = range;
    this.loadStats(true);
  }

  formatTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${hours}:${minutes}:${seconds} – ${day}/${month}/${year}`;
  }

  // ── Chart Helpers ──────────────────────────────────────────
  getMaxTimelineRevenue(): number {
    if (!this.stats?.revenueTimeline || this.stats.revenueTimeline.length === 0) return 1000000;
    const max = Math.max(...this.stats.revenueTimeline.map((p: any) => p.revenue || 0));
    return max > 0 ? max : 1000000;
  }

  getBarHeight(rev: number): number {
    const max = this.getMaxTimelineRevenue();
    if (!rev || rev <= 0) return 4;
    return Math.max(8, Math.round((rev / max) * 100));
  }

  onPointHover(point: any): void {
    this.hoveredPoint = point;
  }

  onPointLeave(): void {
    this.hoveredPoint = null;
  }

  // ── Navigation Handlers ────────────────────────────────────
  navigateOrders(): void {
    this.router.navigate(['/admin/orders']);
  }

  navigateOrdersByStatus(statusLabel: string): void {
    this.router.navigate(['/admin/orders'], { queryParams: { status: statusLabel } });
  }

  navigateOrderDetail(id: string): void {
    if (!id) return;
    this.router.navigate(['/admin/orders', id]);
  }

  navigateProducts(queryParamKey?: string, val?: string): void {
    if (queryParamKey && val) {
      this.router.navigate(['/admin/products'], { queryParams: { [queryParamKey]: val } });
    } else {
      this.router.navigate(['/admin/products']);
    }
  }

  navigateProductEdit(id: string): void {
    if (!id) return;
    this.router.navigate(['/admin/products', id, 'edit']);
  }

  navigateProductAdd(): void {
    this.router.navigate(['/admin/products/add']);
  }

  navigateUsers(): void {
    this.router.navigate(['/admin/users']);
  }

  navigateCategories(): void {
    this.router.navigate(['/admin/categories']);
  }
}
