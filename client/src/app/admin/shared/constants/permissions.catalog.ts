export interface PermissionItem {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionModule {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionItem[];
}

export interface PermissionGroup {
  id: string;
  name: string;
  modules: PermissionModule[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'overview',
    name: 'NHÓM 1 – TỔNG QUAN',
    modules: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        permissions: [
          { key: 'dashboard:view', label: 'Xem Dashboard', description: 'Xem tổng quan báo cáo và số liệu thống kê' }
        ]
      }
    ]
  },
  {
    id: 'business',
    name: 'NHÓM 2 – KINH DOANH',
    modules: [
      {
        id: 'products',
        name: 'Quản lý sản phẩm',
        permissions: [
          { key: 'products:view', label: 'Xem sản phẩm', description: 'Xem danh sách và chi tiết sản phẩm' },
          { key: 'products:create', label: 'Thêm sản phẩm', description: 'Tạo sản phẩm mới' },
          { key: 'products:update', label: 'Chỉnh sửa sản phẩm', description: 'Cập nhật thông tin sản phẩm' },
          { key: 'products:delete', label: 'Xóa sản phẩm', description: 'Xóa sản phẩm khỏi hệ thống' },
          { key: 'products:import', label: 'Import sản phẩm', description: 'Nhập dữ liệu sản phẩm từ file CSV' }
        ]
      },
      {
        id: 'categories',
        name: 'Quản lý danh mục',
        permissions: [
          { key: 'categories:view', label: 'Xem danh mục', description: 'Xem danh sách danh mục sản phẩm' },
          { key: 'categories:manage', label: 'Quản lý danh mục', description: 'Thêm, sửa, xóa danh mục sản phẩm' }
        ]
      },
      {
        id: 'orders',
        name: 'Quản lý đơn hàng',
        permissions: [
          { key: 'orders:view', label: 'Xem danh sách đơn hàng', description: 'Xem danh sách và chi tiết đơn hàng' },
          { key: 'orders:update_status', label: 'Cập nhật trạng thái đơn hàng', description: 'Thay đổi tiến trình xử lý đơn hàng' },
          { key: 'orders:return_manage', label: 'Quản lý yêu cầu trả hàng', description: 'Duyệt hoặc từ chối yêu cầu hoàn trả' },
          { key: 'orders:cod_reconcile', label: 'Đối soát COD', description: 'Xác nhận đối soát tiền thu hộ COD' },
          { key: 'orders:update', label: 'Chỉnh sửa đơn hàng', description: 'Cập nhật thông tin giao nhận và ghi chú đơn hàng' },
          { key: 'orders:delete', label: 'Xóa đơn hàng', description: 'Xóa đơn hàng khỏi hệ thống' }
        ]
      },
      {
        id: 'coupons',
        name: 'Mã giảm giá',
        permissions: [
          { key: 'coupons:view', label: 'Xem mã giảm giá', description: 'Xem danh sách mã khuyến mãi' },
          { key: 'coupons:manage', label: 'Quản lý mã giảm giá', description: 'Tạo, sửa, xóa mã khuyến mãi' }
        ]
      },
      {
        id: 'payment_methods',
        name: 'Phương thức thanh toán',
        permissions: [
          { key: 'payment_methods:view', label: 'Xem phương thức thanh toán', description: 'Xem danh sách cổng thanh toán' },
          { key: 'payment_methods:manage', label: 'Quản lý phương thức thanh toán', description: 'Bật/tắt, thêm hoặc sửa phương thức thanh toán' }
        ]
      },
      {
        id: 'shipping_methods',
        name: 'Đơn vị vận chuyển',
        permissions: [
          { key: 'shipping_methods:view', label: 'Xem đơn vị vận chuyển', description: 'Xem danh sách đơn vị vận chuyển' },
          { key: 'shipping_methods:manage', label: 'Quản lý đơn vị vận chuyển', description: 'Thêm, sửa, xóa và cấu hình đơn vị vận chuyển' }
        ]
      },
      {
        id: 'inventory',
        name: 'Quản lý tồn kho',
        permissions: [
          { key: 'inventory:view', label: 'Xem tồn kho', description: 'Xem số lượng tồn kho sản phẩm và biến thể' },
          { key: 'inventory:update', label: 'Cập nhật tồn kho', description: 'Điều chỉnh số lượng tồn kho' },
          { key: 'inventory:import', label: 'Import tồn kho', description: 'Nhập tồn kho từ file dữ liệu' }
        ]
      }
    ]
  },
  {
    id: 'marketing',
    name: 'NHÓM 3 – MARKETING',
    modules: [
      {
        id: 'subscribers',
        name: 'Đăng ký nhận ưu đãi',
        permissions: [
          { key: 'subscribers:view', label: 'Xem danh sách người đăng ký', description: 'Xem và xuất danh sách email đăng ký nhận tin' }
        ]
      }
    ]
  },
  {
    id: 'customer_care',
    name: 'NHÓM 4 – CHĂM SÓC KHÁCH HÀNG',
    modules: [
      {
        id: 'messages',
        name: 'Quản lý tin nhắn',
        permissions: [
          { key: 'messages:view', label: 'Xem tin nhắn', description: 'Xem hội thoại hỗ trợ khách hàng' },
          { key: 'messages:reply', label: 'Trả lời tin nhắn', description: 'Gửi tin nhắn phản hồi cho khách hàng' }
        ]
      },
      {
        id: 'reviews',
        name: 'Quản lý đánh giá',
        permissions: [
          { key: 'reviews:view', label: 'Xem đánh giá', description: 'Xem nhận xét và đánh giá sản phẩm' },
          { key: 'reviews:manage', label: 'Quản lý trạng thái đánh giá', description: 'Duyệt, ẩn hoặc xóa đánh giá' }
        ]
      }
    ]
  },
  {
    id: 'cms',
    name: 'NHÓM 5 – CMS',
    modules: [
      {
        id: 'cms_home',
        name: 'Trang chủ',
        permissions: [
          { key: 'cms:home', label: 'Quản lý nội dung trang chủ', description: 'Chỉnh sửa banner, slider và layout trang chủ' }
        ]
      },
      {
        id: 'cms_about',
        name: 'Giới thiệu',
        permissions: [
          { key: 'cms:about', label: 'Quản lý nội dung giới thiệu', description: 'Chỉnh sửa thông tin trang giới thiệu thương hiệu' }
        ]
      },
      {
        id: 'cms_policies',
        name: 'Chính sách',
        permissions: [
          { key: 'cms:policies', label: 'Quản lý chính sách', description: 'Chỉnh sửa điều khoản, bảo mật, đổi trả' }
        ]
      },
      {
        id: 'cms_social_links',
        name: 'Mạng xã hội',
        permissions: [
          { key: 'cms:social_links', label: 'Quản lý liên kết mạng xã hội', description: 'Cập nhật link mạng xã hội trên header/footer' }
        ]
      }
    ]
  },
  {
    id: 'system',
    name: 'NHÓM 6 – HỆ THỐNG',
    modules: [
      {
        id: 'notifications',
        name: 'Thông báo',
        permissions: [
          { key: 'notifications:view', label: 'Xem thông báo', description: 'Xem danh sách thông báo hệ thống' },
          { key: 'notifications:manage', label: 'Quản lý thông báo', description: 'Đánh dấu đã đọc và xử lý thông báo' }
        ]
      },
      {
        id: 'settings',
        name: 'Cài đặt',
        permissions: [
          { key: 'settings:view', label: 'Xem cài đặt', description: 'Xem cấu hình hệ thống' },
          { key: 'settings:manage', label: 'Quản lý cài đặt', description: 'Chỉnh sửa thông tin cửa hàng và cấu hình hệ thống' }
        ]
      },
      {
        id: 'users',
        name: 'Quản lý tài khoản',
        permissions: [
          { key: 'users:view', label: 'Xem tài khoản', description: 'Xem danh sách và chi tiết người dùng' },
          { key: 'users:create', label: 'Tạo tài khoản', description: 'Tạo mới tài khoản khách hàng' },
          { key: 'users:update', label: 'Cập nhật tài khoản', description: 'Chỉnh sửa thông tin cá nhân của người dùng' },
          { key: 'users:lock', label: 'Khóa tài khoản', description: 'Khóa hoặc mở khóa tài khoản khách hàng' },
          { key: 'users:delete', label: 'Xóa tài khoản', description: 'Xóa tài khoản khách hàng khỏi hệ thống' }
        ]
      }
    ]
  }
];

// Danh sách phẳng tất cả permission keys
export const ALL_STAFF_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(group =>
  group.modules.flatMap(module =>
    module.permissions.map(p => p.key)
  )
);

// Map từ permission key sang PermissionItem
export const PERMISSION_MAP: Record<string, PermissionItem> = (() => {
  const map: Record<string, PermissionItem> = {};
  for (const group of PERMISSION_GROUPS) {
    for (const mod of group.modules) {
      for (const p of mod.permissions) {
        map[p.key] = p;
      }
    }
  }
  return map;
})();

