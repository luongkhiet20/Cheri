import { BreadcrumbItem } from './admin-breadcrumb.component';

export interface BreadcrumbGroupPageDef {
  group: string;
  page: string;
  routes: string[];
  labels: string[];
  exactOnly?: boolean;
}

/**
 * Bảng mapping 15 trang quản trị Admin Chéri theo nhóm chuẩn hóa:
 * - TỔNG QUAN: Dashboard
 * - KINH DOANH: Quản lý sản phẩm, Quản lý danh mục, Quản lý đơn hàng
 * - MARKETING: Mã giảm giá, Đăng ký nhận ưu đãi
 * - VẬN HÀNH: Phương thức thanh toán, Đơn vị vận chuyển, Quản lý tài khoản, Quản lý tồn kho
 * - CHĂM SÓC KHÁCH HÀNG: Quản lý đánh giá
 * - CMS: Trang chủ, Giới thiệu, Chính sách, Quản lý mạng xã hội
 *
 * (LƯU Ý: Tuyệt đối không bao gồm Quản lý tin nhắn)
 */
export const ADMIN_BREADCRUMB_DEFINITIONS: BreadcrumbGroupPageDef[] = [
  // ── 1. TỔNG QUAN ──────────────────────────────────────────
  {
    group: 'Tổng quan',
    page: 'Dashboard',
    routes: ['/admin', '/admin/dashboard'],
    labels: ['Dashboard', 'Tổng quan'],
    exactOnly: true,
  },

  // ── 2. KINH DOANH ─────────────────────────────────────────
  {
    group: 'Kinh doanh',
    page: 'Quản lý sản phẩm',
    routes: ['/admin/products'],
    labels: ['Quản lý sản phẩm', 'Sản phẩm'],
  },
  {
    group: 'Kinh doanh',
    page: 'Quản lý danh mục',
    routes: ['/admin/categories'],
    labels: ['Quản lý danh mục', 'Danh mục'],
  },
  {
    group: 'Kinh doanh',
    page: 'Quản lý đơn hàng',
    routes: ['/admin/orders'],
    labels: ['Quản lý đơn hàng', 'Đơn hàng'],
  },

  // ── 3. MARKETING ──────────────────────────────────────────
  {
    group: 'Marketing',
    page: 'Mã giảm giá',
    routes: ['/admin/coupons', '/admin/pages/coupons'],
    labels: ['Mã giảm giá', 'Quản lý mã giảm giá', 'Coupon'],
  },
  {
    group: 'Marketing',
    page: 'Đăng ký nhận ưu đãi',
    routes: [
      '/admin/marketing/subscribers',
      '/admin/newsletter-subscribers',
      '/admin/pages/subscribers',
      '/admin/subscribers',
    ],
    labels: [
      'Đăng ký nhận ưu đãi',
      'Người đăng ký nhận ưu đãi',
      'Newsletter',
      'Subscribers',
    ],
  },

  // ── 4. VẬN HÀNH ───────────────────────────────────────────
  {
    group: 'Vận hành',
    page: 'Phương thức thanh toán',
    routes: ['/admin/payment-methods'],
    labels: ['Phương thức thanh toán', 'Thanh toán'],
  },
  {
    group: 'Vận hành',
    page: 'Đơn vị vận chuyển',
    routes: ['/admin/shipping-methods'],
    labels: ['Đơn vị vận chuyển', 'Phương thức vận chuyển', 'Vận chuyển'],
  },
  {
    group: 'Vận hành',
    page: 'Quản lý tài khoản',
    routes: ['/admin/users'],
    labels: ['Quản lý tài khoản', 'Tài khoản người dùng', 'Tài khoản', 'Người dùng'],
  },
  {
    group: 'Vận hành',
    page: 'Quản lý tồn kho',
    routes: ['/admin/inventory'],
    labels: ['Quản lý tồn kho', 'Tồn kho', 'Kho hàng'],
  },

  // ── 5. CHĂM SÓC KHÁCH HÀNG ────────────────────────────────
  {
    group: 'Chăm sóc khách hàng',
    page: 'Quản lý đánh giá',
    routes: ['/admin/reviews'],
    labels: ['Quản lý đánh giá', 'Đánh giá'],
  },

  // ── 6. CMS ────────────────────────────────────────────────
  {
    group: 'CMS',
    page: 'Trang chủ',
    routes: ['/admin/pages/home', '/admin/home'],
    labels: ['Trang chủ', 'Quản lý trang chủ'],
  },
  {
    group: 'CMS',
    page: 'Giới thiệu',
    routes: ['/admin/pages/about', '/admin/about'],
    labels: ['Giới thiệu', 'Quản lý giới thiệu', 'Về chúng tôi'],
  },
  {
    group: 'CMS',
    page: 'Chính sách',
    routes: ['/admin/policies', '/admin/pages/policies'],
    labels: ['Chính sách', 'Quản lý chính sách'],
  },
  {
    group: 'CMS',
    page: 'Quản lý mạng xã hội',
    routes: ['/admin/social-links'],
    labels: ['Quản lý mạng xã hội', 'Mạng xã hội', 'Social Links'],
  },
];

/**
 * Danh sách hằng số dùng trực tiếp trong component nếu cần
 */
export const ADMIN_BREADCRUMB_ITEMS = {
  DASHBOARD: [{ label: 'Tổng quan' }, { label: 'Dashboard' }],
  PRODUCTS: [{ label: 'Kinh doanh' }, { label: 'Quản lý sản phẩm' }],
  CATEGORIES: [{ label: 'Kinh doanh' }, { label: 'Quản lý danh mục' }],
  ORDERS: [{ label: 'Kinh doanh' }, { label: 'Quản lý đơn hàng' }],
  COUPONS: [{ label: 'Marketing' }, { label: 'Mã giảm giá' }],
  SUBSCRIBERS: [{ label: 'Marketing' }, { label: 'Đăng ký nhận ưu đãi' }],
  PAYMENT_METHODS: [{ label: 'Vận hành' }, { label: 'Phương thức thanh toán' }],
  SHIPPING_METHODS: [{ label: 'Vận hành' }, { label: 'Đơn vị vận chuyển' }],
  USERS: [{ label: 'Vận hành' }, { label: 'Quản lý tài khoản' }],
  INVENTORY: [{ label: 'Vận hành' }, { label: 'Quản lý tồn kho' }],
  REVIEWS: [{ label: 'Chăm sóc khách hàng' }, { label: 'Quản lý đánh giá' }],
  HOME: [{ label: 'CMS' }, { label: 'Trang chủ' }],
  ABOUT: [{ label: 'CMS' }, { label: 'Giới thiệu' }],
  POLICIES: [{ label: 'CMS' }, { label: 'Chính sách' }],
  SOCIAL_LINKS: [{ label: 'CMS' }, { label: 'Quản lý mạng xã hội' }],
};

/**
 * Hàm phân giải và chuẩn hóa breadcrumb tập trung tại một nơi duy nhất.
 * - Tuân thủ cấu trúc: Tên nhóm quản lý > Tên trang hiện tại
 * - Loại trừ hoàn toàn trang Quản lý tin nhắn (/admin/messages)
 * - Không làm ảnh hưởng các trang ngoài phạm vi (như /admin/account, /admin/settings)
 */
export function resolveAdminBreadcrumbs(
  currentUrl: string,
  rawItems?: BreadcrumbItem[]
): BreadcrumbItem[] {
  const safeUrl = (currentUrl || '').split('?')[0].split('#')[0].replace(/\/+$/, '');

  // 1. Kiểm tra loại trừ trang Quản lý tin nhắn
  if (
    safeUrl.startsWith('/admin/messages') ||
    (rawItems && rawItems.some(item => /tin\s*nhắn|messages/i.test(item.label || '')))
  ) {
    return rawItems && rawItems.length > 0 ? [...rawItems] : [];
  }

  // 2. Tìm định nghĩa khớp dựa trên route hoặc label
  let matchedDef: BreadcrumbGroupPageDef | undefined;

  // 2.1 Khớp chính xác route
  matchedDef = ADMIN_BREADCRUMB_DEFINITIONS.find(def =>
    def.routes.some(r => r === safeUrl || (r === '/admin' && (safeUrl === '' || safeUrl === '/admin')))
  );

  // 2.2 Khớp tiền tố route (cho các trang con nếu không phải exactOnly)
  if (!matchedDef) {
    matchedDef = ADMIN_BREADCRUMB_DEFINITIONS.find(def =>
      !def.exactOnly && def.routes.some(r => safeUrl.startsWith(r + '/') || safeUrl === r)
    );
  }

  // 2.3 Khớp theo label của rawItems
  if (!matchedDef && rawItems && rawItems.length > 0) {
    matchedDef = ADMIN_BREADCRUMB_DEFINITIONS.find(def =>
      rawItems.some(item => {
        const lbl = (item.label || '').trim().toLowerCase();
        return def.labels.some(l => l.toLowerCase() === lbl);
      })
    );
  }

  // 3. Nếu tìm thấy định nghĩa khớp trong 15 trang
  if (matchedDef) {
    // 3.1 Nếu rawItems rỗng hoặc chỉ có 1 item (trang danh sách chính):
    if (!rawItems || rawItems.length <= 1) {
      return [{ label: matchedDef.group }, { label: matchedDef.page }];
    }

    // 3.2 Nếu rawItems có 2 item mà item[0] đã là tên nhóm, item[1] là tên trang:
    if (
      rawItems.length === 2 &&
      (rawItems[0].label.toLowerCase() === matchedDef.group.toLowerCase() ||
        rawItems[0].label.toLowerCase() === 'quản lý trang')
    ) {
      return [{ label: matchedDef.group }, { label: matchedDef.page }];
    }

    // 3.3 Nếu là trang con (ví dụ: rawItems có nhiều hơn 1 item và có link, như ['Quản lý sản phẩm', 'Thêm sản phẩm']):
    const firstItem = rawItems[0];
    const isFirstGroup = firstItem.label.toLowerCase() === matchedDef.group.toLowerCase();

    if (isFirstGroup) {
      return [...rawItems];
    } else {
      // Bổ sung nhóm quản lý vào đầu danh sách breadcrumb
      return [{ label: matchedDef.group }, ...rawItems];
    }
  }

  // 4. Các trang khác ngoài phạm vi (Account, Settings, v.v.): giữ nguyên rawItems
  return rawItems && rawItems.length > 0 ? [...rawItems] : [];
}

