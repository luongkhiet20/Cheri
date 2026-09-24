import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';

@Component({
  selector: 'app-page-detail',
  standalone: false,
  templateUrl: './page-detail.component.html',
  styleUrls: ['./page-detail.component.css']
})
export class PageDetailComponent implements OnInit {
  pageId: string | null = null;
  page: any = null;
  isLoading = false;
  isToggling = false;
  errorMessage = '';
  successMessage = '';
  confirmDeleteOpen = false;

  activeTab: 'preview' | 'html' = 'preview';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    this.pageId = this.route.snapshot.paramMap.get('id');
    if (this.pageId) {
      this.loadPageDetail(this.pageId);
    } else {
      this.errorMessage = 'ID trang không hợp lệ';
    }
  }

  loadPageDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPageById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.page = res.data;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy thông tin trang';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin trang từ cơ sở dữ liệu MongoDB';
      }
    });
  }

  onToggleStatus(): void {
    if (!this.pageId || !this.page) return;
    this.isToggling = true;
    this.errorMessage = '';

    const newTarget = this.page.isPublished ? 'draft' : 'published';

    this.apiService.patchPageStatus(this.pageId, newTarget).subscribe({
      next: (res) => {
        this.isToggling = false;
        if (res.success && res.data) {
          this.page = res.data;
          this.successMessage = res.message || 'Cập nhật trạng thái thành công';
          setTimeout(() => this.successMessage = '', 3000);
        } else {
          this.errorMessage = res.message || 'Lỗi khi chuyển trạng thái trang';
        }
      },
      error: (err) => {
        this.isToggling = false;
        this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trạng thái trong MongoDB';
      }
    });
  }

  onEdit(): void {
    if (this.pageId) {
      this.router.navigate(['/admin/pages', this.pageId, 'edit']);
    }
  }

  openConfirmDelete(): void {
    this.confirmDeleteOpen = true;
  }

  onConfirmDelete(): void {
    if (!this.pageId) return;
    this.apiService.deletePage(this.pageId).subscribe({
      next: (res) => {
        this.confirmDeleteOpen = false;
        if (res.success) {
          this.router.navigate(['/admin/pages']);
        } else {
          this.errorMessage = res.message || 'Lỗi khi xóa trang';
        }
      },
      error: (err) => {
        this.confirmDeleteOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi xóa trang khỏi MongoDB';
      }
    });
  }

  onCancelDelete(): void {
    this.confirmDeleteOpen = false;
  }
}
