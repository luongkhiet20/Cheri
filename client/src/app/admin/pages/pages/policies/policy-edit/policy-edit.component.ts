import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../../services/admin.service';
import { NotificationService } from '../../../../shared/notification/notification.service';

@Component({
  selector: 'app-policy-edit',
  standalone: false,
  templateUrl: './policy-edit.component.html',
  styleUrls: ['./policy-edit.component.css']
})
export class PolicyEditComponent implements OnInit {
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
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.pageId = this.route.snapshot.paramMap.get('id');
    if (this.pageId) {
      this.loadPolicyDetail(this.pageId);
    } else {
      this.errorMessage = 'ID chính sách không hợp lệ';
      this.cdr.markForCheck();
    }
  }

  loadPolicyDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPageById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          this.page = res.data;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy thông tin chính sách';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin chính sách từ cơ sở dữ liệu MongoDB';
        this.cdr.markForCheck();
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
          const msg = res.message || 'Cập nhật trạng thái thành công';
          this.successMessage = msg;
          this.notificationService.success(msg);
          setTimeout(() => {
            this.successMessage = '';
            this.cdr.markForCheck();
          }, 3000);
        } else {
          const msg = res.message || 'Lỗi khi chuyển trạng thái chính sách';
          this.errorMessage = msg;
          this.notificationService.error(msg);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isToggling = false;
        const msg = err.error?.message || 'Lỗi khi cập nhật trạng thái trong MongoDB';
        this.errorMessage = msg;
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  onEdit(): void {
    if (this.pageId) {
      this.router.navigate(['/admin/policies', this.pageId, 'edit']);
    }
  }

  openConfirmDelete(): void {
    this.confirmDeleteOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmDelete(): void {
    if (!this.pageId) return;
    this.apiService.deletePage(this.pageId).subscribe({
      next: (res) => {
        this.confirmDeleteOpen = false;
        if (res.success) {
          this.notificationService.success('Xóa chính sách thành công');
          this.router.navigate(['/admin/policies']);
        } else {
          const msg = res.message || 'Lỗi khi xóa chính sách';
          this.errorMessage = msg;
          this.notificationService.error(msg);
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.confirmDeleteOpen = false;
        const msg = err.error?.message || 'Lỗi khi xóa chính sách khỏi MongoDB';
        this.errorMessage = msg;
        this.notificationService.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  onCancelDelete(): void {
    this.confirmDeleteOpen = false;
    this.cdr.markForCheck();
  }
}

export { PolicyEditComponent as PageDetailComponent };
