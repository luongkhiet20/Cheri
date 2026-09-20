export interface NavItem {
  key: string;
  label: string;
  icon: string;
  route?: string;
  badge?: string;
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Dashboard',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
             <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
           </svg>`
  },
  {
    key: 'products',
    label: 'Quản lý sản phẩm',
    route: '/product-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
             <line x1="3" y1="6" x2="21" y2="6"/>
             <path d="M16 10a4 4 0 01-8 0"/>
           </svg>`
  },
  {
    key: 'categories',
    label: 'Quản lý danh mục',
    route: '/category-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
           </svg>`
  },
  {
    key: 'payments',
    label: 'Quản lý thanh toán',
    route: '/payment-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
             <line x1="1" y1="10" x2="23" y2="10"/>
           </svg>`
  },
  {
    key: 'shipping',
    label: 'Quản lý vận chuyển',
    route: '/shipping-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="1" y="3" width="15" height="13"/>
             <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
             <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
           </svg>`
  },
  {
    key: 'inventory',
    label: 'Quản lý tồn kho',
    route: '/inventory-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
           </svg>`
  },
  {
    key: 'orders',
    label: 'Quản lý đơn hàng',
    route: '/order-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
             <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
             <polyline points="10 9 9 9 8 9"/>
           </svg>`
  },
  {
    key: 'accounts',
    label: 'Quản lý tài khoản',
    route: '/account-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
             <circle cx="12" cy="7" r="4"/>
           </svg>`
  },
  {
    key: 'pages',
    label: 'Quản lý trang',
    route: '/page-management',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
             <polyline points="14 2 14 8 20 8"/>
           </svg>`
  },

];
