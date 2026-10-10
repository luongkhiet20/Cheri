import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NotificationService } from '../../../shared/notification/notification.service';

export interface CategoryFormData {
  title: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  position: number;
  visibility: boolean;
}

@Component({
  selector: 'app-category-form',
  standalone: false,
  templateUrl: './category-form.component.html',
  styleUrls: ['./category-form.component.css']
})
export class CategoryFormComponent implements OnInit {
  isEditMode = false;
  categoryId: string | null = null;
  isLoading = false;
  isSubmitting = false;
  isDirty = false;
  isSlugCustomized = false;

  formData: CategoryFormData = {
    title: '',
    slug: '',
    parentId: '',
    description: '',
    imageUrl: '',
    position: 0,
    visibility: true
  };

  parentCategories: any[] = [];
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
    this.categoryId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.categoryId;

    this.loadParentCategories();

    if (this.isEditMode && this.categoryId) {
      this.loadCategoryDetail(this.categoryId);
    }
  }

  markDirty(): void {
    this.isDirty = true;
  }

  loadParentCategories(): void {
    this.apiService.getCategories().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          // If in edit mode, exclude self from parent options
          this.parentCategories = res.data.filter((c: any) => c.id !== this.categoryId);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Lỗi khi tải danh sách danh mục cha:', err);
        this.cdr.markForCheck();
      }
    });
  }

  loadCategoryDetail(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getCategoryById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success && res.data) {
          const cat = res.data;
          const vi = cat.vi || {};
          const position = typeof vi.position === 'number'
            ? vi.position
            : (typeof cat.position === 'number'
              ? cat.position
              : (vi.position !== undefined && !isNaN(Number(vi.position)) ? Number(vi.position) : 0));
          this.formData = {
            title: vi.title || cat.name || '',
            slug: cat.slug || cat.titleUrl || '',
            parentId: cat.parentId || '',
            description: vi.description || '',
            imageUrl: cat.mainImage?.url || cat.image || '',
            position: position,
            visibility: vi.visibility !== false
          };
          this.isSlugCustomized = !!this.formData.slug;
          this.isDirty = false;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy thông tin danh mục';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải danh mục từ cơ sở dữ liệu MongoDB';
        this.cdr.markForCheck();
      }
    });
  }

  onTitleChange(): void {
    this.markDirty();
    delete this.errors['title'];
    if (!this.isSlugCustomized) {
      this.formData.slug = this.slugify(this.formData.title);
      if (this.errors['slug'] && /^[a-z0-9-]+$/.test(this.formData.slug)) {
        delete this.errors['slug'];
      }
    }
    this.cdr.markForCheck();
  }

  onSlugChange(): void {
    this.markDirty();
    delete this.errors['slug'];
    this.isSlugCustomized = true;
    this.formData.slug = this.slugify(this.formData.slug);
    this.cdr.markForCheck();
  }

  clearFieldError(field: string): void {
    if (this.errors[field]) {
      delete this.errors[field];
      this.cdr.markForCheck();
    }
  }

  scrollToFirstError(key: string): void {
    setTimeout(() => {
      let el: HTMLElement | null = null;

      // 1. Direct query by id, name, or field wrapper
      el = document.getElementById(`category-${key}`)
        || document.getElementById(key)
        || document.getElementById(`category${key.charAt(0).toUpperCase() + key.slice(1)}`)
        || document.getElementById(`field-${key}`)
        || document.querySelector<HTMLElement>(`[name="${key}"]`);

      // 2. Specific key targets
      if (!el) {
        if (key === 'title') {
          el = document.getElementById('categoryTitle');
        } else if (key === 'slug') {
          el = document.getElementById('categorySlug');
        } else if (key === 'position') {
          el = document.getElementById('categoryPosition');
        }
      }

      // 3. Fallback to first .is-invalid element
      if (!el) {
        el = document.querySelector<HTMLElement>('.is-invalid');
      }

      if (el) {
        // Expand any collapsed ancestor details or hidden containers
        let parent: HTMLElement | null = el.parentElement;
        while (parent) {
          if (parent.tagName === 'DETAILS' && !(parent as HTMLDetailsElement).open) {
            (parent as HTMLDetailsElement).open = true;
          }
          if (parent.hidden) {
            parent.hidden = false;
          }
          parent = parent.parentElement;
        }

        // Smooth scroll to the target element, centered in viewport
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Find focusable interactive element
        let focusTarget: HTMLElement | null = null;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') {
          focusTarget = el;
        } else {
          focusTarget = el.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea, button');
        }

        if (focusTarget && typeof focusTarget.focus === 'function') {
          setTimeout(() => {
            focusTarget?.focus({ preventScroll: true });
          }, 200);
        }
      }
    }, 50);
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.formData.imageUrl = e.target.result;
      this.markDirty();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  removeImage(): void {
    this.formData.imageUrl = '';
    this.markDirty();
  }

  validate(): boolean {
    this.errors = {};

    if (!this.formData.title || !this.formData.title.trim()) {
      this.errors['title'] = 'Tên danh mục không được để trống';
    }

    if (this.formData.slug && !/^[a-z0-9-]+$/.test(this.formData.slug)) {
      this.errors['slug'] = 'Mã slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang (-)';
    }

    // Validate position: Must be an integer >= 0
    const posVal = this.formData.position;
    if (posVal === null || posVal === undefined || String(posVal).trim() === '') {
      this.errors['position'] = 'Vị trí sắp xếp không được để trống';
    } else {
      const num = Number(posVal);
      if (isNaN(num) || !Number.isInteger(num) || num < 0) {
        this.errors['position'] = 'Vị trí sắp xếp phải là số nguyên lớn hơn hoặc bằng 0 (0, 1, 2...)';
      }
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.validate()) {
      const fieldOrder = ['title', 'slug', 'position'];
      const firstError = fieldOrder.find(k => !!this.errors[k]);
      if (firstError) {
        this.scrollToFirstError(firstError);
      }
      return;
    }

    this.isSubmitting = true;

    const title = this.formData.title.trim();
    const slug = (this.formData.slug || this.slugify(title)).trim();
    const parsedPos = parseInt(String(this.formData.position), 10);
    const position = Number.isInteger(parsedPos) && parsedPos >= 0 ? parsedPos : 0;

    const payload = {
      titleUrl: slug,
      mainImage: {
        url: this.formData.imageUrl ? this.formData.imageUrl.trim() : '',
        name: title
      },
      parentId: this.formData.parentId ? this.formData.parentId : null,
      vi: {
        title: title,
        description: (this.formData.description || '').trim(),
        position: position,
        visibility: this.formData.visibility,
        menuHidden: false
      }
    };

    if (this.isEditMode && this.categoryId) {
      // UPDATE
      this.apiService.updateCategory(this.categoryId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Cập nhật danh mục thành công!');
            this.isDirty = false;
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/categories']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi cập nhật danh mục';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật danh mục vào MongoDB';
          this.notificationService.error(this.errorMessage);
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      // CREATE
      this.apiService.createCategory(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.notificationService.success('Thêm danh mục thành công!');
            this.isDirty = false;
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/categories']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi thêm danh mục';
            this.notificationService.error(this.errorMessage);
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi thêm danh mục vào MongoDB';
          this.notificationService.error(this.errorMessage);
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
    this.router.navigate(['/admin/categories']);
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
