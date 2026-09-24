import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';

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
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService
  ) {}

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
      },
      error: (err) => {
        console.error('Lỗi khi tải danh sách danh mục cha:', err);
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
          this.formData = {
            title: vi.title || cat.name || '',
            slug: cat.slug || cat.titleUrl || '',
            parentId: cat.parentId || '',
            description: vi.description || '',
            imageUrl: cat.mainImage?.url || cat.image || '',
            position: typeof vi.position === 'number' ? vi.position : 0,
            visibility: vi.visibility !== false
          };
          this.isSlugCustomized = !!this.formData.slug;
          this.isDirty = false;
        } else {
          this.errorMessage = res.message || 'Không tìm thấy thông tin danh mục';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Lỗi khi tải danh mục từ cơ sở dữ liệu MongoDB';
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
      mainImage: {
        url: this.formData.imageUrl ? this.formData.imageUrl.trim() : '',
        name: title
      },
      parentId: this.formData.parentId ? this.formData.parentId : null,
      vi: {
        title: title,
        description: (this.formData.description || '').trim(),
        position: Number(this.formData.position || 0),
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
            this.successMessage = 'Cập nhật danh mục thành công!';
            this.isDirty = false;
            setTimeout(() => {
              this.router.navigate(['/admin/categories']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi cập nhật danh mục';
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi cập nhật danh mục vào MongoDB';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      // CREATE
      this.apiService.createCategory(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Thêm danh mục thành công!';
            this.isDirty = false;
            setTimeout(() => {
              this.router.navigate(['/admin/categories']);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi thêm danh mục';
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = err.error?.message || 'Lỗi khi thêm danh mục vào MongoDB';
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
