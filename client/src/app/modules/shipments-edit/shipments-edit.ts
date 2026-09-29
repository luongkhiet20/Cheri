import { Component, inject, OnInit, signal, computed, HostListener, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

export interface ShippingMethod {
  _id?: string;
  name: string;
  code: string;
  baseCost: number;
  estimatedDays: string;
  coverageArea: 'national' | 'regional';
  freeShippingThreshold: number;
  isActive: boolean;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-shipments-edit',
  templateUrl: './shipments-edit.html',
  styleUrl: './shipments-edit.css',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
})
export class ShipmentsEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // ─── State ───
  methods = signal<ShippingMethod[]>([]);
  loading = signal(false);
  saving = signal(false);
  isDeleting = signal(false);

  // ─── UI state ───
  showForm = signal(false);
  isEditing = signal(false);
  isViewMode = signal(false);
  editingId = signal<string | null>(null);
  confirmDeleteId = signal<string | null>(null);
  confirmBulkDelete = signal(false);
  selectedMethod: ShippingMethod | null = null;

  // ─── Bulk selection ───
  selectedIds: Set<string> = new Set<string>();

  // ─── Search & Filter ───
  searchQuery = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';

  inactiveCount = computed(() => this.methods().filter(m => !m.isActive).length);

  // ─── Computed: danh sách sau khi lọc + tìm kiếm ───
  filteredMethods = computed(() => {
    const query = this.searchQuery.toLowerCase().trim();
    return this.methods().filter(m => {
      const matchSearch = !query ||
        m.name.toLowerCase().includes(query) ||
        m.code.toLowerCase().includes(query);
      const matchStatus =
        this.filterStatus === 'all' ||
        (this.filterStatus === 'active' && m.isActive) ||
        (this.filterStatus === 'inactive' && !m.isActive);
      return matchSearch && matchStatus;
    });
  });

  hasSelection = computed(() => this.selectedIds.size > 0);
  selectionCount = computed(() => this.selectedIds.size);

  isAllSelected = computed(() => {
    const list = this.filteredMethods();
    return list.length > 0 && list.every(m => this.selectedIds.has(m._id!));
  });

  isPartiallySelected = computed(() => {
    const count = this.filteredMethods().filter(m => this.selectedIds.has(m._id!)).length;
    return count > 0 && count < this.filteredMethods().length;
  });

  form: FormGroup;

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/i)]],
      baseCost: [0, [Validators.required, Validators.min(0)]],
      estimatedDays: ['', Validators.required],
      coverageArea: ['national', Validators.required],
      freeShippingThreshold: [0, [Validators.min(0)]],
      isActive: [true],
      description: [''],
    });
  }

  ngOnInit() {
    this.loadMethods();
  }

  // ─── Lắng nghe phím ESC để đóng modal ───
  @HostListener('window:keydown.escape')
  handleEscape() {
    if (this.confirmDeleteId()) {
      this.cancelDelete();
    } else if (this.confirmBulkDelete()) {
      this.cancelBulkDelete();
    } else if (this.showForm()) {
      this.closeForm();
    }
  }

  loadMethods() {
    this.loading.set(true);
    this.api.getShippingMethods().subscribe({
      next: (data: any) => {
        this.methods.set(Array.isArray(data) ? data : []);
        // Xóa những id đã chọn nếu không còn tồn tại
        const currentIds = new Set(this.methods().map(m => m._id!));
        this.selectedIds.forEach(id => {
          if (!currentIds.has(id)) this.selectedIds.delete(id);
        });
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách phương thức vận chuyển', 'Đóng', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  // ─── Mở form thêm mới ───
  openAddForm() {
    this.selectedMethod = null;
    this.form.reset({
      name: '',
      code: '',
      coverageArea: 'national',
      isActive: true,
      baseCost: 0,
      freeShippingThreshold: 0,
      estimatedDays: '',
      description: '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.enable();
    this.isEditing.set(false);
    this.isViewMode.set(false);
    this.editingId.set(null);
    this.showForm.set(true);
  }

  // ─── Mở form chỉnh sửa ───
  openEditForm(method: ShippingMethod) {
    this.selectedMethod = method;
    this.form.patchValue({
      name: method.name,
      code: method.code,
      baseCost: method.baseCost,
      estimatedDays: method.estimatedDays,
      coverageArea: method.coverageArea,
      freeShippingThreshold: method.freeShippingThreshold || 0,
      isActive: method.isActive,
      description: method.description || '',
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.enable();
    this.isEditing.set(true);
    this.isViewMode.set(false);
    this.editingId.set(method._id || null);
    this.showForm.set(true);
  }

  // ─── Mở xem chi tiết (read-only) ───
  openViewMode(method: ShippingMethod) {
    this.selectedMethod = method;
    this.openEditForm(method);
    this.form.disable();
    this.isEditing.set(false);
    this.isViewMode.set(true);
  }

  // ─── Chuyển từ Xem chi tiết sang Chỉnh sửa ───
  switchToEdit() {
    if (this.selectedMethod) {
      this.openEditForm(this.selectedMethod);
    }
  }

  // ─── Reset form (Đặt lại) ───
  resetForm() {
    if (this.isEditing() && this.selectedMethod) {
      this.form.patchValue(this.selectedMethod);
    } else {
      this.form.reset({
        name: '',
        code: '',
        coverageArea: 'national',
        isActive: true,
        baseCost: 0,
        freeShippingThreshold: 0,
        estimatedDays: '',
        description: '',
      });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  // ─── Đóng form ───
  closeForm() {
    this.showForm.set(false);
    this.form.reset();
    this.form.enable();
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.isEditing.set(false);
    this.isViewMode.set(false);
    this.editingId.set(null);
    this.selectedMethod = null;
  }

  // ─── Lưu (thêm mới hoặc cập nhật) ───
  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Vui lòng kiểm tra và điền đầy đủ các trường bắt buộc (*)', 'Đóng', { duration: 3000 });
      return;
    }
    const val = this.form.getRawValue();
    const payload = {
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      baseCost: Number(val.baseCost) || 0,
      estimatedDays: (val.estimatedDays || '').trim(),
      coverageArea: val.coverageArea || 'national',
      freeShippingThreshold: Number(val.freeShippingThreshold) || 0,
      isActive: val.isActive !== false,
      description: (val.description || '').trim(),
    };
    this.saving.set(true);

    const request$ = this.isEditing() && this.editingId()
      ? this.api.updateShippingMethod(this.editingId()!, payload)
      : this.api.createShippingMethod(payload);

    request$.subscribe({
      next: (result: any) => {
        if (result?.error) {
          this.snackBar.open('Lỗi: ' + (result.error.message || 'Thao tác thất bại'), 'Đóng', { duration: 4000 });
        } else {
          this.snackBar.open(
            this.isEditing() ? '✅ Đã cập nhật phương thức vận chuyển thành công!' : '✅ Đã thêm mới phương thức vận chuyển thành công!',
            'Đóng', { duration: 3000 }
          );
          this.loadMethods();
          this.closeForm();
        }
        this.saving.set(false);
      },
      error: () => {
        this.snackBar.open('Có lỗi xảy ra, vui lòng thử lại.', 'Đóng', { duration: 3000 });
        this.saving.set(false);
      },
    });
  }

  // ─── Bật / Tắt trạng thái ───
  toggleStatus(method: ShippingMethod) {
    if (!method._id) return;
    this.api.toggleShippingMethod(method._id).subscribe({
      next: (updated: any) => {
        if (!updated?.error) {
          this.methods.update(list =>
            list.map(m => m._id === method._id ? { ...m, isActive: !m.isActive } : m)
          );
          this.snackBar.open(
            `${method.isActive ? '⏸ Đã tắt' : '▶ Đã bật'} "${method.name}"`,
            'Đóng', { duration: 2500 }
          );
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.snackBar.open('Không thể đổi trạng thái. Vui lòng thử lại.', 'Đóng', { duration: 3000 });
      }
    });
  }

  // ─── Single Delete ───
  confirmDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  deleteMethod() {
    const id = this.confirmDeleteId();
    if (!id) return;
    this.api.deleteShippingMethod(id).subscribe({
      next: () => {
        this.methods.update(list => list.filter(m => m._id !== id));
        this.selectedIds.delete(id);
        this.snackBar.open('🗑 Đã xóa phương thức vận chuyển thành công', 'Đóng', { duration: 2500 });
        this.confirmDeleteId.set(null);
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Không thể xóa. Vui lòng thử lại.', 'Đóng', { duration: 3000 });
        this.confirmDeleteId.set(null);
      },
    });
  }

  // ─── Bulk Select ───
  isSelected(m: ShippingMethod): boolean {
    return !!m._id && this.selectedIds.has(m._id);
  }

  toggleSelect(m: ShippingMethod, event?: Event) {
    event?.stopPropagation();
    if (!m._id) return;
    if (this.selectedIds.has(m._id)) {
      this.selectedIds.delete(m._id);
    } else {
      this.selectedIds.add(m._id);
    }
    this.cdr.detectChanges();
  }

  toggleSelectAll(event: any) {
    const checked = event?.target ? event.target.checked : !this.isAllSelected();
    if (checked) {
      this.filteredMethods().forEach(m => {
        if (m._id) this.selectedIds.add(m._id);
      });
    } else {
      this.filteredMethods().forEach(m => {
        if (m._id) this.selectedIds.delete(m._id);
      });
    }
    this.cdr.detectChanges();
  }

  // ─── Bulk Delete ───
  promptBulkDelete() {
    if (this.selectedIds.size === 0) return;
    this.confirmBulkDelete.set(true);
  }

  cancelBulkDelete() {
    this.confirmBulkDelete.set(false);
  }

  deleteSelectedMethods() {
    const ids = Array.from(this.selectedIds);
    if (ids.length === 0 || this.isDeleting()) return;

    this.isDeleting.set(true);
    this.api.deleteShippingMethodsBulk(ids).subscribe({
      next: (res: any) => {
        this.isDeleting.set(false);
        this.confirmBulkDelete.set(false);
        if (res?.error) {
          this.snackBar.open('Lỗi khi xóa hàng loạt: ' + (res.error.message || 'Thất bại'), 'Đóng', { duration: 3000 });
        } else {
          this.methods.update(list => list.filter(m => !ids.includes(m._id!)));
          this.selectedIds.clear();
          this.snackBar.open(`🗑 Đã xóa ${res.deleted || ids.length} phương thức vận chuyển đã chọn!`, 'Đóng', { duration: 3000 });
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isDeleting.set(false);
        this.confirmBulkDelete.set(false);
        this.snackBar.open('Có lỗi xảy ra khi xóa hàng loạt', 'Đóng', { duration: 3000 });
      }
    });
  }

  // ─── Helpers ───
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value || 0) + ' VNĐ';
  }

  getCoverageLabel(area: string): string {
    return area === 'national' ? 'Toàn quốc' : 'Khu vực cụ thể';
  }

  getFieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return '';
    if (ctrl.errors['required']) return 'Trường này là bắt buộc';
    if (ctrl.errors['minlength']) return `Tối thiểu ${ctrl.errors['minlength'].requiredLength} ký tự`;
    if (ctrl.errors['min']) return 'Giá trị phải >= 0';
    if (ctrl.errors['pattern']) return 'Chỉ dùng chữ cái, số, dấu gạch dưới (A-Z, 0-9, _)';
    return '';
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
  }

  onFilterChange(status: 'all' | 'active' | 'inactive') {
    this.filterStatus = status;
  }

  trackByMethod(_: number, m: ShippingMethod) {
    return m._id;
  }
}

export { ShipmentsEditComponent as ShipmentsEdit };
