import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-newsletter-export-csv',
  standalone: false,
  templateUrl: './newsletter-export-csv.component.html',
  styleUrls: ['./newsletter-export-csv.component.css']
})
export class NewsletterExportCsvComponent {
  @Input() search: string = '';
  @Input() status: string = '';
  @Input() disabled: boolean = false;

  isExporting: boolean = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  exportCsv(): void {
    if (this.isExporting || this.disabled) return;

    this.isExporting = true;
    this.cdr.markForCheck();

    const params: {
      search?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {
      sortBy: 'subscribedAt',
      sortOrder: 'desc'
    };

    if (this.search && this.search.trim()) {
      params.search = this.search.trim();
    }

    if (this.status && this.status.trim()) {
      params.status = this.status.trim();
    }

    this.adminService.exportNewsletterSubscribers(params).subscribe({
      next: (res) => {
        if (!res || !res.success || !Array.isArray(res.data)) {
          this.isExporting = false;
          this.notificationService.error('Không thể xuất báo cáo CSV. Vui lòng thử lại.');
          this.cdr.markForCheck();
          return;
        }

        const subscribers = res.data;
        if (subscribers.length === 0) {
          this.isExporting = false;
          this.notificationService.error('Không có dữ liệu đăng ký phù hợp để xuất báo cáo.');
          this.cdr.markForCheck();
          return;
        }

        try {
          const success = this.generateAndDownloadCsv(subscribers);
          this.isExporting = false;
          if (success) {
            this.notificationService.success('Xuất báo cáo CSV thành công!');
          }
        } catch (err) {
          console.error('Error generating CSV:', err);
          this.isExporting = false;
          this.notificationService.error('Không thể xuất báo cáo CSV. Vui lòng thử lại.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to export newsletter subscribers:', err);
        this.isExporting = false;
        this.notificationService.error('Không thể xuất báo cáo CSV. Vui lòng thử lại.');
        this.cdr.markForCheck();
      }
    });
  }

  private generateAndDownloadCsv(subscribers: any[]): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }

    const headers = [
      'STT',
      'Mã đăng ký',
      'Khách hàng',
      'Email',
      'Ngày đăng ký',
      'Trạng thái',
      'Nguồn đăng ký',
      'Thời điểm cập nhật'
    ];

    const lines: string[] = [headers.map(h => this.escapeCsvField(h)).join(',')];

    subscribers.forEach((item, index) => {
      const stt = this.escapeCsvField(index + 1);
      const id = this.escapeCsvField(item.id || item._id || '');
      const customer = this.escapeCsvField(this.getCustomerName(item));
      const email = this.escapeCsvField(item.email || '');
      const subscribedAt = this.escapeCsvField(this.formatDateTime(item.subscribedAt || item.createdAt));
      const statusText = this.escapeCsvField(this.mapStatusLabel(item.status));
      const source = this.escapeCsvField(item.source || 'Website');
      const updatedAt = this.escapeCsvField(this.formatDateTime(item.updatedAt));

      const row = [stt, id, customer, email, subscribedAt, statusText, source, updatedAt];
      lines.push(row.join(','));
    });

    // UTF-8 BOM để Excel hiển thị tiếng Việt chuẩn không bị lỗi font
    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.getFileName();
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Giải phóng Blob URL
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);

    return true;
  }

  private getCustomerName(item: any): string {
    if (!item) return 'Khách vãng lai';
    if (typeof item.customer === 'string' && item.customer.trim()) {
      return item.customer.trim();
    }
    if (item.customer && typeof item.customer === 'object') {
      if (item.customer.name && typeof item.customer.name === 'string' && item.customer.name.trim()) {
        return item.customer.name.trim();
      }
      if (item.customer.fullName && typeof item.customer.fullName === 'string' && item.customer.fullName.trim()) {
        return item.customer.fullName.trim();
      }
    }
    return 'Khách vãng lai';
  }

  private mapStatusLabel(status: string): string {
    const s = String(status || '').toUpperCase().trim();
    if (s === 'SUBSCRIBED') return 'Đang đăng ký';
    if (s === 'UNSUBSCRIBED') return 'Đã hủy';
    return status || '—';
  }

  private sanitizeCsvValue(val: any): string {
    if (val === null || val === undefined) return '';
    let str = String(val).trim();
    // Chống CSV Formula Injection đối với dữ liệu người dùng
    if (/^[=+@\-\t\r]/.test(str)) {
      str = `'` + str;
    }
    return str;
  }

  private escapeCsvField(val: any): string {
    const sanitized = this.sanitizeCsvValue(val);
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  private formatDateTime(val: any): string {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return String(val);
    }
  }

  private getFileName(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `cheri-newsletter-subscribers-${year}-${month}-${day}.csv`;
  }
}
