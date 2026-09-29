import {
  Component, inject, OnInit, signal, computed, ChangeDetectorRef, HostListener,
} from '@angular/core';
import {
  FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

export interface PaymentMethod {
  _id?: string;
  name: string;
  code: string;
  paymentType: string;
  type?: string;
  paymentInfo?: string;
  description: string;
  transactionFee: { enabled: boolean; type: 'FIXED' | 'PERCENT'; value: number };
  logo: string;
  isActive: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

type FilterStatus = 'all' | 'active' | 'inactive';
type FilterType = 'all' | 'CASH' | 'E_WALLET' | 'GATEWAY';

@Component({
  selector: 'app-payments-edit',
  templateUrl: './payments-edit.html',
  styleUrl: './payments-edit.css',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatSnackBarModule,
  ],
})
export class PaymentsEditComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  // ─── Data ───
  methods = signal<PaymentMethod[]>([]);
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
  selectedMethod: PaymentMethod | null = null;

  // ─── Bulk selection ───
  selectedIds: Set<string> = new Set<string>();

  // ─── Search & Filter ───
  searchQuery = '';
  filterStatus: FilterStatus = 'all';
  filterType: FilterType = 'all';

  // ─── Computed ───
  inactiveCount = computed(() => this.methods().filter(m => !m.isActive).length);

  filteredMethods = computed(() => {
    const q = this.searchQuery.toLowerCase().trim();
    return this.methods().filter(m => {
      const matchSearch = !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
      const matchStatus = this.filterStatus === 'all'
        || (this.filterStatus === 'active' && m.isActive)
        || (this.filterStatus === 'inactive' && !m.isActive);
      const matchType = this.filterType === 'all' || m.paymentType === this.filterType;
      return matchSearch && matchStatus && matchType;
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

  readonly paymentTypeOptions = [
    { value: 'CASH', label: '💵 Tiền mặt' },
    { value: 'E_WALLET', label: '📱 Ví điện tử' },
    { value: 'GATEWAY', label: '🏦 Cổng thanh toán' },
  ];

  readonly feeTypeOptions = [
    { value: 'FIXED', label: 'Cố định (VNĐ)' },
    { value: 'PERCENT', label: 'Phần trăm (%)' },
  ];

  constructor() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      code: ['', [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/i)]],
      paymentType: ['CASH', Validators.required],
      description: [''],
      logo: [''],
      isActive: [true],
      feeEnabled: [false],
      feeType: ['FIXED'],
      feeValue: [0, [Validators.min(0)]],
    });
  }

  ngOnInit() { this.loadMethods(); }

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
    this.api.getPaymentMethods().subscribe({
      next: (data: any) => {
        this.methods.set(Array.isArray(data) ? data : []);
        // Xóa những ID đã chọn không còn tồn tại
        const currentIds = new Set(this.methods().map(m => m._id!));
        this.selectedIds.forEach(id => {
          if (!currentIds.has(id)) this.selectedIds.delete(id);
        });
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Không thể tải danh sách phương thức thanh toán', 'Đóng', { duration: 3000 });
        this.loading.set(false);
      },
    });
  }

  // ── Form controls ────────────────────────────────────
  openAddForm() {
    this.selectedMethod = null;
    this.form.reset({
      name: '',
      code: '',
      paymentType: 'CASH',
      description: '',
      logo: '',
      isActive: true,
      feeEnabled: false,
      feeType: 'FIXED',
      feeValue: 0
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.enable();
    this.isEditing.set(false);
    this.isViewMode.set(false);
    this.editingId.set(null);
    this.showForm.set(true);
  }

  openEditForm(m: PaymentMethod) {
    this.selectedMethod = m;
    this.form.patchValue({
      name: m.name,
      code: m.code,
      paymentType: m.paymentType,
      description: m.description || '',
      logo: m.logo || '',
      isActive: m.isActive,
      feeEnabled: m.transactionFee?.enabled ?? false,
      feeType: m.transactionFee?.type ?? 'FIXED',
      feeValue: m.transactionFee?.value ?? 0,
    });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.enable();
    this.isEditing.set(true);
    this.isViewMode.set(false);
    this.editingId.set(m._id || null);
    this.showForm.set(true);
  }

  openViewMode(m: PaymentMethod) {
    this.selectedMethod = m;
    this.openEditForm(m);
    this.form.disable();
    this.isViewMode.set(true);
    this.isEditing.set(false);
  }

  switchToEdit() {
    if (this.selectedMethod) {
      this.openEditForm(this.selectedMethod);
    }
  }

  resetForm() {
    if (this.isEditing() && this.selectedMethod) {
      const m = this.selectedMethod;
      this.form.patchValue({
        name: m.name,
        code: m.code,
        paymentType: m.paymentType,
        description: m.description || '',
        logo: m.logo || '',
        isActive: m.isActive,
        feeEnabled: m.transactionFee?.enabled ?? false,
        feeType: m.transactionFee?.type ?? 'FIXED',
        feeValue: m.transactionFee?.value ?? 0,
      });
    } else {
      this.form.reset({
        name: '',
        code: '',
        paymentType: 'CASH',
        description: '',
        logo: '',
        isActive: true,
        feeEnabled: false,
        feeType: 'FIXED',
        feeValue: 0
      });
    }
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

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

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('Vui lòng kiểm tra và điền đầy đủ các trường bắt buộc (*)', 'Đóng', { duration: 3000 });
      return;
    }
    const v = this.form.getRawValue();

    // Kiểm tra tỷ lệ phần trăm tối đa 100%
    if (v.feeEnabled && v.feeType === 'PERCENT' && Number(v.feeValue) > 100) {
      this.snackBar.open('Phí giao dịch theo phần trăm không được vượt quá 100%', 'Đóng', { duration: 3500 });
      return;
    }

    const payload = {
      name: (v.name || '').trim(),
      code: (v.code || '').trim().toUpperCase(),
      paymentType: v.paymentType,
      description: (v.description || '').trim(),
      logo: (v.logo || '').trim(),
      isActive: v.isActive !== false,
      transactionFee: {
        enabled: !!v.feeEnabled,
        type: v.feeType || 'FIXED',
        value: Number(v.feeValue) || 0
      },
    };
    this.saving.set(true);
    const req$ = this.isEditing() && this.editingId()
      ? this.api.updatePaymentMethod(this.editingId()!, payload)
      : this.api.createPaymentMethod(payload);

    req$.subscribe({
      next: (res: any) => {
        if (res?.error) {
          this.snackBar.open('Lỗi: ' + (res.error.message || 'Thao tác thất bại'), 'Đóng', { duration: 4000 });
        } else {
          this.snackBar.open(
            this.isEditing() ? '✅ Cập nhật phương thức thanh toán thành công!' : '✅ Thêm mới phương thức thanh toán thành công!',
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

  // ── Toggle ───────────────────────────────────────────
  toggleStatus(m: PaymentMethod) {
    if (!m._id) return;
    this.api.togglePaymentMethod(m._id).subscribe({
      next: (updated: any) => {
        if (!updated?.error) {
          this.methods.update(list => list.map(x => x._id === m._id ? { ...x, isActive: !x.isActive, status: !x.isActive ? 'ACTIVE' : 'INACTIVE' } : x));
          this.snackBar.open(`${m.isActive ? '⏸ Đã tắt' : '▶ Đã bật'} "${m.name}"`, 'Đóng', { duration: 2500 });
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.snackBar.open('Không thể đổi trạng thái. Vui lòng thử lại.', 'Đóng', { duration: 3000 });
      }
    });
  }

  // ── Single delete ────────────────────────────────────
  confirmDelete(id: string) { this.confirmDeleteId.set(id); }
  cancelDelete() { this.confirmDeleteId.set(null); }

  deleteMethod() {
    const id = this.confirmDeleteId();
    if (!id) return;
    this.api.deletePaymentMethod(id).subscribe({
      next: () => {
        this.methods.update(list => list.filter(m => m._id !== id));
        this.selectedIds.delete(id);
        this.snackBar.open('🗑 Đã xóa phương thức thanh toán thành công', 'Đóng', { duration: 2500 });
        this.confirmDeleteId.set(null);
        this.cdr.detectChanges();
      },
      error: () => {
        this.snackBar.open('Không thể xóa. Vui lòng thử lại.', 'Đóng', { duration: 3000 });
        this.confirmDeleteId.set(null);
      },
    });
  }

  // ── Bulk select ──────────────────────────────────────
  isSelected(m: PaymentMethod): boolean { return !!m._id && this.selectedIds.has(m._id); }

  toggleSelect(m: PaymentMethod, event?: Event) {
    event?.stopPropagation();
    if (!m._id) return;
    if (this.selectedIds.has(m._id)) { this.selectedIds.delete(m._id); }
    else { this.selectedIds.add(m._id); }
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

  // ── Bulk delete ──────────────────────────────────────
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
    this.api.deletePaymentMethodsBulk(ids).subscribe({
      next: (res: any) => {
        this.isDeleting.set(false);
        this.confirmBulkDelete.set(false);
        if (res?.error) {
          this.snackBar.open('Lỗi khi xóa hàng loạt: ' + (res.error.message || 'Thất bại'), 'Đóng', { duration: 3000 });
        } else {
          this.methods.update(list => list.filter(m => !ids.includes(m._id!)));
          this.selectedIds.clear();
          this.snackBar.open(`🗑 Đã xóa ${res.deleted || ids.length} phương thức thanh toán đã chọn!`, 'Đóng', { duration: 3000 });
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

  // ── Helpers ──────────────────────────────────────────
  formatCurrency(v: number): string { return new Intl.NumberFormat('vi-VN').format(v || 0) + ' VNĐ'; }

  getTypeLabel(type: string): string {
    return { CASH: 'Tiền mặt', E_WALLET: 'Ví điện tử', GATEWAY: 'Cổng thanh toán', Online: 'Trực tuyến' }[type] || type;
  }

  getTypeEmoji(type: string): string {
    return { CASH: '💵', E_WALLET: '📱', GATEWAY: '🏦', Online: '🌐' }[type] || '💳';
  }

  getFieldError(field: string): string {
    const ctrl = this.form.get(field);
    if (!ctrl?.touched || !ctrl?.errors) return '';
    if (ctrl.errors['required']) return 'Trường này là bắt buộc';
    if (ctrl.errors['minlength']) return `Tối thiểu ${ctrl.errors['minlength'].requiredLength} ký tự`;
    if (ctrl.errors['pattern']) return 'Chỉ dùng chữ cái, số, dấu gạch dưới (A-Z, 0-9, _)';
    if (ctrl.errors['min']) return 'Giá trị phải >= 0';
    return '';
  }

  onSearchChange(q: string) { this.searchQuery = q; this.cdr.detectChanges(); }
  onFilterChange(status: FilterStatus) { this.filterStatus = status; this.cdr.detectChanges(); }
  onTypeFilterChange(type: FilterType) { this.filterType = type; this.cdr.detectChanges(); }
  trackById(_: number, m: PaymentMethod) { return m._id; }
}

export { PaymentsEditComponent as PaymentsEdit };
