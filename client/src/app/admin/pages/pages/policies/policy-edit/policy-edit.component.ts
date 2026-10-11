import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../../services/admin.service';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { ADMIN_PAGES_URLS } from '../../pages.routes';
import { BreadcrumbItem } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-policy-edit',
  standalone: false,
  templateUrl: './policy-edit.component.html',
  styleUrls: ['./policy-edit.component.css']
})
export class PolicyEditComponent implements OnInit {
  readonly adminPagesUrls = ADMIN_PAGES_URLS;
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý chính sách', url: '/admin/policies' },
    { label: 'Chi tiết chính sách' }
  ];
  pageId: string | null = null;
  page: any = null;
  isLoading = false;
  isToggling = false;
  errorMessage = '';

  activeTab: 'preview' | 'html' = 'preview';

  get displayTitle(): string {
    if (!this.page) return '';
    return this.page.vi?.title || this.page.title || '';
  }

  get displayContentHTML(): string {
    if (!this.page) return '';
    return this.page.vi?.contentHTML || this.page.contentHTML || '';
  }

  get displayMetaDescription(): string {
    if (!this.page) return '';
    return this.page.vi?.metaDescription || this.page.metaDescription || '';
  }

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
          const title = this.page.vi?.title || this.page.title;
          if (title) {
            this.breadcrumbItems = [
              { label: 'Quản lý chính sách', url: '/admin/policies' },
              { label: title }
            ];
          }
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
          this.notificationService.success(msg);
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
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES, this.pageId, 'edit']);
    }
  }
}

export { PolicyEditComponent as PageDetailComponent };
