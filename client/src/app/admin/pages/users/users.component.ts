import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  columns: TableColumn[] = [
    { key: 'name', label: 'Họ tên', type: 'text', sortable: true },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Số điện thoại', type: 'text' },
    { key: 'role', label: 'Vai trò', type: 'text' },
    { key: 'status', label: 'Trạng thái', type: 'status' },
    { key: 'createdAt', label: 'Ngày tạo', type: 'date', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    { key: 'lock', label: 'Khóa / Mở', variant: 'warning' },
    { key: 'delete', label: 'Xóa', variant: 'danger' }
  ];
  filterFields: FilterField[] = [
    { key: 'role', label: 'Vai trò', type: 'select', options: [{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'Khách hàng' }] },
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Đã khóa' }] },
  ];

  data: any[] = [];
  allUsers: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;

  selectedIds: Set<any> = new Set();
  get selectedCount(): number { return this.selectedIds.size; }
  get allSelected(): boolean { return this.data.length > 0 && this.data.every((r: any) => this.selectedIds.has(r.id)); }
  get isIndeterminate(): boolean { return this.selectedCount > 0 && !this.allSelected; }
  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  confirmOpen = false;
  confirmMessage = '';
  pendingDeleteId: any = null;
  isBulkDelete = false;

  constructor(
    private apiService: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.apiService.getUsers().subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.allUsers = (res.data || []).map((u: any) => {
            const isActive = u.status !== false;
            return {
              ...u,
              id: u.id || u._id,
              name: u.fullName || u.name || u.email?.split('@')[0] || 'Người dùng',
              phone: u.phoneNumber || u.phone || '—',
              role: u.roleText || (Array.isArray(u.roles) ? (u.roles.includes('admin') || u.roles.includes('superadmin') ? 'Admin' : 'Khách hàng') : u.role) || 'Khách hàng',
              status: u.statusText || (isActive ? 'Hoạt động' : 'Đã khóa'),
              statusVariant: u.statusVariant || (isActive ? 'success' : 'danger')
            };
          });
          this.data = [...this.allUsers];
          this.pagination = { ...this.pagination, total: this.data.length };
          this.selectedIds.clear();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Lỗi khi tải users từ MongoDB:', err);
        this.cdr.markForCheck();
      }
    });
  }

  onAddUser(): void {
    this.router.navigate(['/admin/users/add']);
  }

  onSelectionChange(ids: Set<any>): void { this.selectedIds = new Set(ids); }
  onToolbarSelectAll(): void {
    if (this.allSelected) { this.selectedIds = new Set(); }
    else { this.selectedIds = new Set(this.data.map((r: any) => r.id)); }
  }

  onDeleteSelected(): void {
    const c = this.selectedCount;
    if (c === 0) return;
    this.isBulkDelete = true;
    this.pendingDeleteId = null;
    this.confirmMessage = `Bạn có chắc chắn muốn xóa ${c} người dùng đã chọn không?`;
    this.confirmOpen = true;
  }

  onConfirmDelete(): void {
    if (this.isBulkDelete) {
      const ids = Array.from(this.selectedIds);
      this.apiService.bulkDeleteUsers(ids).subscribe({
        next: () => {
          this.selectedIds.clear();
          this.loadUsers();
          this.confirmOpen = false;
          this.isBulkDelete = false;
        },
        error: (err) => {
          console.error('Lỗi khi xóa nhiều users:', err);
          this.confirmOpen = false;
          this.isBulkDelete = false;
        }
      });
    } else if (this.pendingDeleteId) {
      this.apiService.deleteUser(this.pendingDeleteId).subscribe({
        next: () => {
          this.loadUsers();
          this.confirmOpen = false;
          this.pendingDeleteId = null;
        },
        error: (err) => {
          console.error('Lỗi khi xóa user:', err);
          this.confirmOpen = false;
          this.pendingDeleteId = null;
        }
      });
    } else {
      this.confirmOpen = false;
    }
  }

  onCancelDelete(): void {
    this.confirmOpen = false;
    this.pendingDeleteId = null;
    this.isBulkDelete = false;
  }

  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      this.router.navigate(['/admin/users', e.row.id]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/users', e.row.id, 'edit']);
    } else if (e.action === 'lock') {
      this.apiService.toggleUserStatus(e.row.id).subscribe({
        next: () => this.loadUsers(),
        error: (err) => console.error(err)
      });
    } else if (e.action === 'delete') {
      this.isBulkDelete = false;
      this.pendingDeleteId = e.row.id;
      this.confirmMessage = `Bạn có chắc muốn xóa người dùng ${e.row.email}?`;
      this.confirmOpen = true;
    }
  }

  onSearch(v: string): void {
    if (!v) {
      this.data = [...this.allUsers];
      return;
    }
    const q = v.toLowerCase();
    this.data = this.allUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q))
    );
  }

  onFilter(v: Record<string, any>): void {
    let filtered = [...this.allUsers];
    if (v['role']) {
      const targetRole = String(v['role']).toLowerCase();
      filtered = filtered.filter(u => {
        const uRole = String(u.role).toLowerCase();
        const rawRoles = Array.isArray(u.roles) ? u.roles.map((r: any) => String(r).toLowerCase()) : [];
        if (targetRole === 'admin') {
          return uRole.includes('admin') || rawRoles.includes('admin');
        } else if (targetRole === 'user' || targetRole === 'customer') {
          return uRole.includes('khách') || uRole.includes('user') || rawRoles.includes('user');
        }
        return uRole === targetRole;
      });
    }
    if (v['status']) {
      const st = String(v['status']).toLowerCase();
      if (st === 'active' || st === 'hoạt động') {
        filtered = filtered.filter(u => u.status === 'Hoạt động' || u.statusVariant === 'success');
      } else if (st === 'inactive' || st === 'đã khóa') {
        filtered = filtered.filter(u => u.status === 'Đã khóa' || u.statusVariant === 'danger');
      }
    }
    this.data = filtered;
  }

  onRefresh(): void { this.loadUsers(); }
  onPageChange(p: number): void { this.pagination = { ...this.pagination, page: p }; }
  onPageSizeChange(s: number): void { this.pagination = { ...this.pagination, pageSize: s, page: 1 }; }
}
