import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../../services/admin.service';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { ADMIN_PAGES_URLS } from '../../pages.routes';

export interface PolicyFormData {
  title: string;              // vi.title
  slug: string;               // titleUrl (readonly)
  isPublished: boolean;       // status / visibility
  metaDescription: string;    // vi.metaDescription
  contentHTML: string;        // vi.contentHTML
}

@Component({
  selector: 'app-policy-form',
  standalone: false,
  templateUrl: './policy-form.component.html',
  styleUrls: ['./policy-form.component.css']
})
export class PolicyFormComponent implements OnInit {
  readonly adminPagesUrls = ADMIN_PAGES_URLS;
  isEditMode = true;
  pageId: string | null = null;
  isLoading = false;
  isSubmitting = false;
  isDirty = false;

  private existingSlug = '';
  private existingEnData: any = null;

  formData: PolicyFormData = {
    title: '',
    slug: '',
    isPublished: true,
    metaDescription: '',
    contentHTML: ''
  };

  errors: Record<string, string> = {};
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.pageId = this.route.snapshot.paramMap.get('id');
    // Module chỉ phục vụ xem và chỉnh sửa các trang Policies đã tồn tại, không cho phép tạo mới
    if (!this.pageId) {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES]);
      return;
    }

    this.isEditMode = true;
    this.loadPolicyDetail(this.pageId);
  }

  markDirty(): void {
    this.isDirty = true;
  }

  loadPolicyDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPageById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const page = res.data;
          this.existingSlug = page.titleUrl || page.rawSlug || (page.slug ? page.slug.replace(/^\/+/, '') : '');
          this.existingEnData = page.en || null;
          this.formData = {
            title: page.vi?.title || page.title || '',
            slug: this.existingSlug,
            isPublished: page.isPublished !== false && page.status !== 'draft',
            metaDescription: page.vi?.metaDescription || page.metaDescription || '',
            contentHTML: page.vi?.contentHTML || page.contentHTML || ''
          };
          this.isDirty = false;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy chính sách để chỉnh sửa';
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

  onTitleChange(): void {
    this.markDirty();
    delete this.errors['title'];
    // titleUrl bị khóa để bảo toàn liên kết URL, không tự động sinh slug mới từ tiêu đề
  }

  validate(): boolean {
    this.errors = {};

    if (!this.formData.title || !this.formData.title.trim()) {
      this.errors['title'] = 'Tiêu đề chính sách (tiếng Việt) không được để trống';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.pageId) {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES]);
      return;
    }

    if (!this.validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.isSubmitting = true;
    const title = this.formData.title.trim();
    // Luôn bảo toàn titleUrl hiện có
    const slug = this.existingSlug || this.formData.slug;

    const payload: any = {
      titleUrl: slug,
      status: this.formData.isPublished ? 'published' : 'draft',
      isPublished: this.formData.isPublished,
      metaDescription: (this.formData.metaDescription || '').trim(),
      vi: {
        title: title,
        contentHTML: this.formData.contentHTML || '',
        visibility: this.formData.isPublished,
        metaDescription: (this.formData.metaDescription || '').trim()
      }
    };

    // Giữ nguyên dữ liệu tiếng Anh sẵn có từ MongoDB, không ghi đè hay làm mất
    if (this.existingEnData) {
      payload.en = this.existingEnData;
    }

    this.apiService.updatePage(this.pageId, payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          const msg = 'Cập nhật chính sách thành công!';
          this.notificationService.success(msg);
          this.isDirty = false;
          setTimeout(() => {
            this.router.navigate([ADMIN_PAGES_URLS.POLICIES, this.pageId]);
          }, 600);
        } else {
          const msg = res.message || 'Lỗi cập nhật chính sách';
          this.errorMessage = msg;
          this.notificationService.error(msg);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err.error?.message || 'Lỗi khi cập nhật chính sách vào MongoDB';
        this.errorMessage = msg;
        this.notificationService.error(msg);
        this.cdr.markForCheck();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  onCancel(): void {
    if (this.isDirty) {
      const confirmLeave = confirm('Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn hủy?');
      if (!confirmLeave) return;
    }
    if (this.pageId) {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES, this.pageId]);
    } else {
      this.router.navigate([ADMIN_PAGES_URLS.POLICIES]);
    }
  }
}

export { PolicyFormComponent as PageFormComponent };
