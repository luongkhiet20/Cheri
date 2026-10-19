import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TableColumn, RowAction, FilterField, PaginationConfig, ActionEvent } from '../../shared/models/admin-table.models';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { BreadcrumbItem } from '../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý tài khoản' }
  ];

  columns: TableColumn[] = [
    { key: 'image', label: '', type: 'image', shape: 'circle', isAvatar: true, width: '60px' },
    { key: 'name', label: 'Họ tên', type: 'text', sortable: true },
    { key: 'email', label: 'Email', type: 'text', sortable: true },
    { key: 'phone', label: 'Số điện thoại', type: 'text', sortable: true },
    { key: 'role', label: 'Vai trò', type: 'text', sortable: true },
    { key: 'status', label: 'Trạng thái', type: 'status', sortable: true },
    { key: 'createdAt', label: 'Ngày tạo', type: 'date', sortable: true },
  ];
  actions: RowAction[] = [
    { key: 'view', label: 'Xem' },
    { key: 'edit', label: 'Sửa' },
    { key: 'lock', label: 'Khóa / Mở', variant: 'warning' }
  ];
  filterFields: FilterField[] = [
    { key: 'role', label: 'Vai trò', type: 'select', options: [{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'Khách hàng' }] },
    { key: 'status', label: 'Trạng thái', type: 'select', options: [{ value: 'active', label: 'Hoạt động' }, { value: 'inactive', label: 'Đã khóa' }] },
  ];

  data: any[] = [];
  allUsers: any[] = [];
  pagination: PaginationConfig = { page: 1, pageSize: 20, total: 0 };
  isLoading = false;

  searchQuery = '';
  selectedRole = '';
  selectedStatus = '';

  get displayTotal(): number { return this.pagination?.total ?? this.data.length; }

  constructor(
    private apiService: AdminService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.loadUsers(params['status']);
    });
  }

  getUserInitial(user: any): string {
    if (!user) return 'U';
    const raw = (typeof user === 'string' ? user : (user.fullName || user.name || user.email || '')).trim();
    if (!raw) return 'U';
    return String(Array.from(raw)[0] || 'U').toUpperCase();
  }

  loadUsers(statusParam?: string): void {
    this.isLoading = true;
    this.apiService.getUsers({
      page: this.pagination.page,
      limit: this.pagination.pageSize,
      pageSize: this.pagination.pageSize,
      search: this.searchQuery || undefined,
      role: this.selectedRole || undefined,
      status: this.selectedStatus || undefined
    }).subscribe({
      next: (res) => {
        this.isLoading = false;
        const rawList = (res && res.success && Array.isArray(res.data))
          ? res.data
          : (Array.isArray(res) ? res : (res?.data || []));

        this.allUsers = rawList.map((u: any) => {
          const isActive = u.status !== false && u.status !== 'inactive' && u.status !== 'locked';
          const avatarUrl = (u.avatar && typeof u.avatar === 'string' && u.avatar.trim() !== '')
            ? u.avatar.trim()
            : ((u.image && typeof u.image === 'string' && !u.image.startsWith('data:image')) ? u.image.trim() : '');
          const initial = this.getUserInitial(u);
          const displayName = u.fullName || u.name || u.email?.split('@')[0] || 'Người dùng';

          return {
            ...u,
            id: u.id || u._id,
            avatar: avatarUrl,
            image: avatarUrl,
            initial,
            userInitial: initial,
            avatarAlt: displayName,
            name: displayName,
            phone: u.phoneNumber || u.phone || '—',
            role: u.roleText || (Array.isArray(u.roles) ? (u.roles.includes('admin') || u.roles.includes('superadmin') ? 'Admin' : 'Khách hàng') : u.role) || 'Khách hàng',
            status: u.statusText || (isActive ? 'Hoạt động' : 'Đã khóa'),
            statusVariant: u.statusVariant || (isActive ? 'success' : 'danger')
          };
        });
        this.data = [...this.allUsers];
        const totalFromApi = Number(res?.pagination?.total ?? res?.total ?? this.data.length);
        this.pagination = { ...this.pagination, total: totalFromApi };

        if (statusParam) {
          const statusField = this.filterFields.find(f => f.key === 'status');
          if (statusField) statusField.value = statusParam;
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

  onAction(e: ActionEvent): void {
    if (e.action === 'view') {
      this.router.navigate(['/admin/users', e.row.id]);
    } else if (e.action === 'edit') {
      this.router.navigate(['/admin/users', e.row.id, 'edit']);
    } else if (e.action === 'lock') {
      this.apiService.toggleUserStatus(e.row.id).subscribe({
        next: () => {
          this.notificationService.success('Cập nhật trạng thái người dùng thành công.');
          this.loadUsers();
        },
        error: (err) => {
          this.notificationService.error('Lỗi khi cập nhật trạng thái người dùng.');
          console.error(err);
          this.cdr.markForCheck();
        }
      });
    }
  }

  onSearch(v: string): void {
    this.searchQuery = (v || '').trim();
    this.pagination.page = 1;
    this.loadUsers();
  }

  onFilter(v: Record<string, any>): void {
    this.selectedRole = (v && v['role']) ? String(v['role']).trim() : '';
    this.selectedStatus = (v && v['status']) ? String(v['status']).trim() : '';
    this.pagination.page = 1;
    this.loadUsers();
  }

  onFilterReset(): void {
    this.selectedRole = '';
    this.selectedStatus = '';
    this.pagination.page = 1;
    this.loadUsers();
  }

  onRefresh(): void {
    this.searchQuery = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.pagination.page = 1;
    this.loadUsers();
  }

  onPageChange(p: number): void {
    this.pagination = { ...this.pagination, page: p };
    this.loadUsers();
  }

  onPageSizeChange(s: number): void {
    this.pagination = { ...this.pagination, pageSize: s, page: 1 };
    this.loadUsers();
  }
}
