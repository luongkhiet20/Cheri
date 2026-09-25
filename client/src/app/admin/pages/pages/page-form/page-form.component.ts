import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

export interface PageFormData {
  title: string;
  slug: string;
  isPublished: boolean;
  metaDescription: string;
  contentHTML: string;
}

@Component({
  selector: 'app-page-form',
  standalone: false,
  templateUrl: './page-form.component.html',
  styleUrls: ['./page-form.component.css']
})
export class PageFormComponent implements OnInit {
  isEditMode = false;
  pageId: string | null = null;
  isLoading = false;
  isSubmitting = false;
  isDirty = false;
  isSlugCustomized = false;

  formData: PageFormData = {
    title: '',
    slug: '',
    isPublished: true,
    metaDescription: '',
    contentHTML: ''
  };

  errors: Record<string, string> = {};
  errorMessage = '';
  successMessage = '';
  confirmDeleteOpen = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.pageId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.pageId;

    if (this.isEditMode && this.pageId) {
      this.loadPageDetail(this.pageId);
    }
  }

  markDirty(): void {
    this.isDirty = true;
  }

  loadPageDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getPageById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const page = res.data;
          this.formData = {
            title: page.title || '',
            slug: page.rawSlug || (page.slug ? page.slug.replace(/^\/+/, '') : ''),
            isPublished: page.isPublished !== false,
            metaDescription: page.metaDescription || '',
            contentHTML: page.contentHTML || ''
          };
          this.isSlugCustomized = true;
          this.isDirty = false;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy trang để chỉnh sửa';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải thông tin trang từ cơ sở dữ liệu MongoDB';
        this.cdr.markForCheck();
      }
    });
  }

  onTitleChange(): void {
    this.markDirty();
    delete this.errors['title'];
    if (!this.isSlugCustomized) {
      this.formData.slug = this.slugify(this.formData.title);
    }
  }

  onSlugChange(): void {
    this.markDirty();
    delete this.errors['slug'];
    this.isSlugCustomized = true;
    this.formData.slug = this.slugify(this.formData.slug);
  }

  validate(): boolean {
    this.errors = {};

    if (!this.formData.title || !this.formData.title.trim()) {
      this.errors['title'] = 'Tiêu đề trang không được để trống';
    }

    if (this.formData.slug && !/^[a-z0-9-]+$/.test(this.formData.slug)) {
      this.errors['slug'] = 'Mã slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang (-)';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    this.isSubmitting = true;
    const title = this.formData.title.trim();
    const slug = (this.formData.slug || this.slugify(title)).trim();

    const payload = {
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

    if (this.isEditMode && this.pageId) {
      // UPDATE
      this.apiService.updatePage(this.pageId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Cập nhật trang thành công vào MongoDB!';
            this.isDirty = false;
            setTimeout(() => {
              this.router.navigate(['/admin/pages', this.pageId]);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi cập nhật trang';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật trang vào MongoDB';
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      // CREATE
      this.apiService.createPage(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Tạo trang mới thành công vào MongoDB!';
            this.isDirty = false;
            const newId = res.id || res.data?.id || res.data?._id;
            setTimeout(() => {
              if (newId) {
                this.router.navigate(['/admin/pages', newId]);
              } else {
                this.router.navigate(['/admin/pages']);
              }
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi tạo trang mới';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi tạo trang mới trong MongoDB';
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }

  onCancel(): void {
    if (this.isDirty) {
      const confirmLeave = confirm('Bạn có thay đổi chưa được lưu. Bạn có chắc chắn muốn hủy?');
      if (!confirmLeave) return;
    }
    if (this.isEditMode && this.pageId) {
      this.router.navigate(['/admin/pages', this.pageId]);
    } else {
      this.router.navigate(['/admin/pages']);
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
          this.router.navigate(['/admin/pages']);
        } else {
          this.errorMessage = res.message || 'Lỗi khi xóa trang';
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        this.confirmDeleteOpen = false;
        this.errorMessage = err.error?.message || 'Lỗi khi xóa trang khỏi MongoDB';
        this.cdr.markForCheck();
      }
    });
  }

  onCancelDelete(): void {
    this.confirmDeleteOpen = false;
    this.cdr.markForCheck();
  }

  slugify(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
