import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

export interface AccountUser {
  _id?: string;
  id?: string;
  name?: string;
  fullName?: string;
  email: string;
  password?: string;
  salt?: string;
  roles: string[];
  status: boolean;
  phoneNumber?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: any;
  avatar?: string;
  images?: string[];
  cart?: any;
  description?: string;
  googleId?: string;
  createdAt?: any;
  updatedAt?: any;
  dateAdded?: any;
  __v?: number;
}

@Component({
  selector: 'app-accounts-edit',
  templateUrl: './accounts-edit.component.html',
  styleUrls: ['./accounts-edit.component.css'],
  standalone: false
})
export class AccountsEditComponent implements OnInit, OnDestroy {
  allAccounts: AccountUser[] = [];
  filteredAccounts: AccountUser[] = [];
  isLoading: boolean = false;

  searchQuery: string = '';
  viewMode: 'grid' | 'table' = 'table'; // Table / Data-grid mode by default as requested by user

  // Checkbox selection state
  selectedAccountKeys: Set<string> = new Set<string>();
  isDeleting: boolean = false;

  // Filter state
  isFilterOpen: boolean = false;
  filterStatus: 'all' | 'active' | 'locked' = 'all';
  filterRole: 'all' | 'admin' | 'super-admin' | 'staff' | 'user' = 'all';
  sortBy: 'default' | 'name-asc' | 'name-desc' | 'email-asc' | 'email-desc' | 'newest' | 'recently-updated' = 'default';

  // Modal State for Add/Edit
  isModalOpen: boolean = false;
  modalMode: 'add' | 'edit' = 'add';
  editingAccountId: string | null = null;
  formName: string = '';
  formFullName: string = '';
  formEmail: string = '';
  formPhoneNumber: string = '';
  formAddress: string = '';
  formGender: string = 'Nam';
  formDateOfBirth: string = '';
  formAvatar: string = '';
  formPassword: string = '';
  formRole: string = 'admin';
  formStatus: boolean = true;
  formDescription: string = '';
  formError: string = '';
  isSaving: boolean = false;

  // View Modal State (View Account MongoDB details)
  isViewModalOpen: boolean = false;
  viewingAccount: AccountUser | null = null;
  viewRawJson: boolean = false;
  copySuccess: boolean = false;

  private sub: Subscription | null = null;

  constructor(
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.viewMode = 'table';
    this.loadAccounts(true);
  }

  setViewMode(mode: 'grid' | 'table'): void {
    this.viewMode = mode;
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test((email || '').trim());
  }

  isFormValid(): boolean {
    const nameToTest = (this.formFullName || this.formName || '').trim();
    if (!nameToTest) {
      return false;
    }
    if (!this.formEmail || !this.formEmail.trim() || !this.isValidEmail(this.formEmail)) {
      return false;
    }
    if (this.modalMode === 'add') {
      if (!this.formPassword || this.formPassword.trim().length < 6) {
        return false;
      }
    } else {
      if (this.formPassword && this.formPassword.trim().length > 0 && this.formPassword.trim().length < 6) {
        return false;
      }
    }
    if (!this.formRole) {
      return false;
    }
    if (this.formStatus === undefined || this.formStatus === null) {
      return false;
    }
    return true;
  }

  loadAccounts(force: boolean = false, retryCount: number = 2): void {
    if (this.isLoading && !force) {
      return;
    }
    this.isLoading = true;
    this.cdr.markForCheck();

    this.apiService.getUsers().subscribe({
      next: (res: any) => {
        if (res && res.error) {
          console.warn('Lỗi khi tải danh sách người dùng:', res.error);
          if (retryCount > 0) {
            setTimeout(() => this.loadAccounts(true, retryCount - 1), 300);
            return;
          }
          this.isLoading = false;
          this.allAccounts = [];
          this.filterAccounts();
          this.cdr.detectChanges();
          return;
        }

        this.isLoading = false;
        if (Array.isArray(res)) {
          this.allAccounts = res.map((u: any) => ({
            ...u,
            name: u.name || u.fullName || u.email?.split('@')[0] || 'Chưa đặt tên',
            fullName: u.fullName || u.name || u.email?.split('@')[0] || 'Chưa đặt tên',
            phoneNumber: u.phoneNumber || '',
            address: u.address || '',
            gender: u.gender || '',
            dateOfBirth: u.dateOfBirth || '',
            avatar: u.avatar || (Array.isArray(u.images) && u.images[0]) || '',
            status: u.status !== undefined ? u.status : true,
            roles: Array.isArray(u.roles) && u.roles.length ? u.roles : ['user'],
            description: u.description || '',
            createdAt: u.createdAt || u.dateAdded,
            updatedAt: u.updatedAt || u.createdAt || u.dateAdded,
          }));
        } else {
          this.allAccounts = [];
        }
        this.filterAccounts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (retryCount > 0) {
          setTimeout(() => this.loadAccounts(true, retryCount - 1), 300);
          return;
        }
        this.isLoading = false;
        console.error('Lỗi khi tải danh sách người dùng:', err);
        this.allAccounts = [];
        this.filterAccounts();
        this.cdr.detectChanges();
      }
    });
  }

  refreshRotation: number = 0;

  onRefresh(): void {
    this.refreshRotation += 180;
    this.selectedAccountKeys.clear();
    this.loadAccounts(true);
  }

  onSearchChange(): void {
    this.filterAccounts();
  }

  getAccountKey(account: AccountUser): string {
    return (account._id || account.id || account.email || '').toString();
  }

  // --- Checkbox Selection Methods ---
  isSelected(account: AccountUser): boolean {
    const key = this.getAccountKey(account);
    return !!key && this.selectedAccountKeys.has(key);
  }

  toggleSelect(account: AccountUser, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const key = this.getAccountKey(account);
    if (!key) return;
    if (this.selectedAccountKeys.has(key)) {
      this.selectedAccountKeys.delete(key);
    } else {
      this.selectedAccountKeys.add(key);
    }
  }

  isAllSelected(): boolean {
    if (!this.filteredAccounts || this.filteredAccounts.length === 0) return false;
    return this.filteredAccounts.every(a => this.isSelected(a));
  }

  isPartiallySelected(): boolean {
    const count = this.selectedAccountKeys.size;
    return count > 0 && !this.isAllSelected();
  }

  toggleSelectAll(event: any): void {
    const checked = event && event.target ? event.target.checked : !this.isAllSelected();
    if (checked) {
      this.filteredAccounts.forEach(a => {
        const key = this.getAccountKey(a);
        if (key) this.selectedAccountKeys.add(key);
      });
    } else {
      this.filteredAccounts.forEach(a => {
        const key = this.getAccountKey(a);
        if (key) this.selectedAccountKeys.delete(key);
      });
    }
  }

  // --- Filter Methods ---
  toggleFilterMenu(): void {
    this.isFilterOpen = !this.isFilterOpen;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterStatus !== 'all') count++;
    if (this.filterRole !== 'all') count++;
    if (this.sortBy !== 'default') count++;
    return count;
  }

  hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  resetFilters(): void {
    this.filterStatus = 'all';
    this.filterRole = 'all';
    this.sortBy = 'default';
    this.filterAccounts();
  }

  onFilterChange(): void {
    this.filterAccounts();
  }

  filterAccounts(): void {
    let list = [...(this.allAccounts || [])];

    // 1. Text search
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(a => {
        const name = (a.name || '').toLowerCase();
        const fullName = (a.fullName || '').toLowerCase();
        const email = (a.email || '').toLowerCase();
        const phone = (a.phoneNumber || '').toLowerCase();
        const address = (a.address || '').toLowerCase();
        const idStr = (a._id || a.id || '').toLowerCase();
        const roles = Array.isArray(a.roles) ? a.roles.join(' ').toLowerCase() : '';
        const desc = (a.description || '').toLowerCase();
        return name.includes(q) || fullName.includes(q) || email.includes(q) ||
               phone.includes(q) || address.includes(q) || idStr.includes(q) ||
               roles.includes(q) || desc.includes(q);
      });
    }

    // 2. Status filter
    if (this.filterStatus === 'active') {
      list = list.filter(a => a.status === true);
    } else if (this.filterStatus === 'locked') {
      list = list.filter(a => a.status === false);
    }

    // 3. Role filter
    if (this.filterRole !== 'all') {
      list = list.filter(a => Array.isArray(a.roles) && a.roles.includes(this.filterRole));
    }

    // 4. Sorting
    if (this.sortBy === 'name-asc') {
      list.sort((a, b) => this.getAccountDisplayName(a).localeCompare(this.getAccountDisplayName(b), 'vi'));
    } else if (this.sortBy === 'name-desc') {
      list.sort((a, b) => this.getAccountDisplayName(b).localeCompare(this.getAccountDisplayName(a), 'vi'));
    } else if (this.sortBy === 'email-asc') {
      list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    } else if (this.sortBy === 'email-desc') {
      list.sort((a, b) => (b.email || '').localeCompare(a.email || ''));
    } else if (this.sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || b.dateAdded || 0).getTime() - new Date(a.createdAt || a.dateAdded || 0).getTime());
    } else if (this.sortBy === 'recently-updated') {
      list.sort((a, b) => new Date(b.updatedAt || b.createdAt || b.dateAdded || 0).getTime() - new Date(a.updatedAt || a.createdAt || a.dateAdded || 0).getTime());
    }

    this.filteredAccounts = list;
  }

  // --- Single Status Toggle ---
  toggleAccountStatus(account: AccountUser, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const currentStatus = account.status;
    const newStatus = !currentStatus;
    const accountId = account._id || account.id;

    if (accountId) {
      account.status = newStatus;
      this.apiService.updateUser(accountId, { status: newStatus }).subscribe({
        next: (res: any) => {
          if (res && res.error) {
            console.error('Lỗi cập nhật trạng thái tài khoản:', res.error);
            account.status = currentStatus;
            alert(res.error?.error?.message || res.error?.message || 'Không thể cập nhật trạng thái trên cơ sở dữ liệu.');
          } else {
            this.loadAccounts();
          }
        },
        error: (err) => {
          console.error('Lỗi cập nhật trạng thái tài khoản:', err);
          account.status = currentStatus;
          alert(err?.error?.message || 'Không thể cập nhật trạng thái trên cơ sở dữ liệu.');
        }
      });
    }
  }

  // --- View Modal Actions ---
  openViewModal(account: AccountUser, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.viewingAccount = account;
    this.viewRawJson = false;
    this.copySuccess = false;
    this.isViewModalOpen = true;
  }

  closeViewModal(): void {
    this.isViewModalOpen = false;
    this.viewingAccount = null;
    this.viewRawJson = false;
    this.copySuccess = false;
  }

  copyAccountJson(): void {
    if (!this.viewingAccount) return;
    const jsonStr = JSON.stringify(this.viewingAccount, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        this.copySuccess = true;
        setTimeout(() => (this.copySuccess = false), 2500);
      });
    }
  }

  // --- Edit & Add Modal Actions ---
  openAddModal(): void {
    this.modalMode = 'add';
    this.editingAccountId = null;
    this.formFullName = '';
    this.formName = '';
    this.formEmail = '';
    this.formPhoneNumber = '';
    this.formAddress = '';
    this.formGender = 'Nam';
    this.formDateOfBirth = '';
    this.formAvatar = '';
    this.formPassword = '';
    this.formRole = 'admin';
    this.formStatus = true;
    this.formDescription = '';
    this.formError = '';
    this.isModalOpen = true;
  }

  onEdit(account: AccountUser, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.modalMode = 'edit';
    this.editingAccountId = account._id || account.id || null;
    this.formFullName = account.fullName || account.name || '';
    this.formName = account.name || account.fullName || '';
    this.formEmail = account.email || '';
    this.formPhoneNumber = account.phoneNumber || '';
    this.formAddress = account.address || '';
    this.formGender = account.gender || 'Khác';
    this.formDateOfBirth = account.dateOfBirth ? this.formatDateForInput(account.dateOfBirth) : '';
    this.formAvatar = account.avatar || account.images?.[0] || '';
    this.formPassword = '';
    this.formRole = account.roles?.[0] || 'admin';
    this.formStatus = account.status !== false;
    this.formDescription = account.description || '';
    this.formError = '';
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.formError = '';
    this.isSaving = false;
  }

  saveModal(): void {
    const resolvedName = (this.formFullName || this.formName || '').trim();

    // 1. Họ và tên (Bắt buộc)
    if (!resolvedName) {
      this.formError = 'Vui lòng nhập Họ và tên / Tên hiển thị';
      return;
    }

    // 2. Email đăng nhập (Bắt buộc & đúng định dạng)
    if (!this.formEmail || !this.formEmail.trim()) {
      this.formError = 'Vui lòng nhập địa chỉ Email';
      return;
    }
    if (!this.isValidEmail(this.formEmail)) {
      this.formError = 'Địa chỉ Email không đúng định dạng (ví dụ: user@example.com)';
      return;
    }

    // 3. Mật khẩu (Bắt buộc khi tạo mới, tối thiểu 6 ký tự)
    if (this.modalMode === 'add') {
      if (!this.formPassword || !this.formPassword.trim()) {
        this.formError = 'Vui lòng nhập mật khẩu';
        return;
      }
      if (this.formPassword.trim().length < 6) {
        this.formError = 'Mật khẩu phải có ít nhất 6 ký tự';
        return;
      }
    } else {
      if (this.formPassword && this.formPassword.trim().length > 0 && this.formPassword.trim().length < 6) {
        this.formError = 'Mật khẩu mới phải có ít nhất 6 ký tự';
        return;
      }
    }

    // 4. Vai trò / Quyền hạn (Bắt buộc)
    if (!this.formRole) {
      this.formError = 'Vui lòng chọn vai trò / quyền hạn';
      return;
    }

    // 5. Trạng thái hoạt động (Bắt buộc)
    if (this.formStatus === undefined || this.formStatus === null) {
      this.formError = 'Vui lòng chọn trạng thái hoạt động';
      return;
    }

    this.isSaving = true;
    this.formError = '';

    const payload: any = {
      name: resolvedName,
      fullName: resolvedName,
      email: this.formEmail.trim().toLowerCase(),
      phoneNumber: (this.formPhoneNumber || '').trim(),
      address: (this.formAddress || '').trim(),
      gender: this.formGender || 'Khác',
      dateOfBirth: this.formDateOfBirth || '',
      avatar: (this.formAvatar || '').trim(),
      images: this.formAvatar && this.formAvatar.trim() ? [this.formAvatar.trim()] : [],
      roles: [this.formRole],
      status: this.formStatus,
      description: this.formDescription ? this.formDescription.trim() : ''
    };
    if (this.formPassword && this.formPassword.trim()) {
      payload.password = this.formPassword.trim();
    }

    if (this.modalMode === 'add') {
      this.apiService.createUser(payload).subscribe({
        next: (created: any) => {
          if (created && created.error) {
            this.isSaving = false;
            this.formError = created.error?.error?.message || created.error?.message || 'Lỗi khi tạo tài khoản. Vui lòng thử lại.';
            return;
          }
          this.isSaving = false;
          this.closeModal();
          this.loadAccounts(); // Tự động đồng bộ và hiển thị đầy đủ trên trang admin
        },
        error: (err) => {
          this.isSaving = false;
          this.formError = err?.error?.message || 'Lỗi khi tạo tài khoản. Vui lòng thử lại.';
        }
      });
    } else {
      if (!this.editingAccountId) return;
      this.apiService.updateUser(this.editingAccountId, payload).subscribe({
        next: (updated: any) => {
          if (updated && updated.error) {
            this.isSaving = false;
            this.formError = updated.error?.error?.message || updated.error?.message || 'Lỗi khi cập nhật tài khoản.';
            return;
          }
          this.isSaving = false;
          this.closeModal();
          this.loadAccounts(); // Tự động đồng bộ và hiển thị đầy đủ trên trang admin
        },
        error: (err) => {
          this.isSaving = false;
          this.formError = err?.error?.message || 'Lỗi khi cập nhật tài khoản.';
        }
      });
    }
  }

  // --- Single Delete ---
  onDelete(account: AccountUser, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const name = this.getAccountDisplayName(account);
    if (confirm(`Bạn có chắc chắn muốn xóa tài khoản "${name}" không? Thao tác này sẽ xóa vĩnh viễn trên cơ sở dữ liệu MongoDB.`)) {
      const target = this.getAccountKey(account);
      if (!target) return;

      const accountId = account._id || account.id;
      if (accountId) {
        this.isLoading = true;
        this.apiService.deleteUser(accountId).subscribe({
          next: (res: any) => {
            this.isLoading = false;
            if (res && res.error) {
              alert(res.error?.error?.message || res.error?.message || 'Lỗi khi xóa tài khoản từ cơ sở dữ liệu.');
              return;
            }
            this.selectedAccountKeys.delete(target);
            this.loadAccounts();
          },
          error: (err) => {
            this.isLoading = false;
            alert(err?.error?.message || 'Lỗi khi xóa tài khoản từ cơ sở dữ liệu.');
          }
        });
      }
    }
  }

  // --- Bulk Delete ---
  deleteSelectedAccounts(): void {
    const count = this.selectedAccountKeys.size;
    if (count === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa ${count} tài khoản đã chọn không? Thao tác này sẽ xóa vĩnh viễn trên cơ sở dữ liệu MongoDB.`)) {
      return;
    }

    this.isDeleting = true;
    const targets = Array.from(this.selectedAccountKeys);

    forkJoin(
      targets.map(target => {
        const acc = this.allAccounts.find(a => this.getAccountKey(a) === target);
        const accountId = acc ? (acc._id || acc.id) : null;
        if (accountId) {
          return this.apiService.deleteUser(accountId).pipe(
            catchError(err => of({ error: err, target }))
          );
        }
        return of({ ok: true });
      })
    ).subscribe({
      next: () => {
        this.isDeleting = false;
        this.selectedAccountKeys.clear();
        this.loadAccounts();
      },
      error: () => {
        this.isDeleting = false;
        this.selectedAccountKeys.clear();
        this.loadAccounts();
      }
    });
  }

  // --- Display Helpers ---
  getAccountDisplayName(account: AccountUser): string {
    return account.fullName || account.name || account.email || 'Người dùng';
  }

  getInitials(account: AccountUser): string {
    const name = this.getAccountDisplayName(account).trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarGradient(account: AccountUser): string {
    const role = account.roles?.[0] || 'admin';
    if (role === 'super-admin') return 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)';
    if (role === 'admin') return 'linear-gradient(135deg, #74070E 0%, #9e121b 100%)';
    if (role === 'staff') return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
    return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
  }

  getRoleLabel(account: AccountUser): string {
    const role = account.roles?.[0] || 'user';
    switch (role) {
      case 'super-admin': return 'Super Admin';
      case 'admin': return 'Admin';
      case 'staff': return 'Nhân viên';
      case 'user': return 'Khách hàng';
      default: return role;
    }
  }

  getCartCount(cart: any): number {
    if (!cart) return 0;
    if (Array.isArray(cart.items)) return cart.items.length;
    if (Array.isArray(cart)) return cart.length;
    return 0;
  }

  getFormattedDate(val: any): string {
    if (!val) return '—';
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

  formatDateForInput(val: any): string {
    if (!val) return '';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toISOString().split('T')[0];
    } catch {
      return String(val);
    }
  }
}
