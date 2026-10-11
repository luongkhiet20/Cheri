import { Routes } from '@angular/router';
import { Type } from '@angular/core';

/**
 * Định nghĩa mã định danh / segment tương đối cho các trang thuộc CMS Pages
 */
export const PAGES_ROUTES = {
  HOME: 'home',
  ABOUT: 'about',
  POLICIES: 'policies',
} as const;

export type PageRouteKey = keyof typeof PAGES_ROUTES;
export type PageRouteValue = (typeof PAGES_ROUTES)[PageRouteKey];

/**
 * Tiền tố và đường dẫn gốc của khu vực quản trị
 */
export const ADMIN_BASE_ROUTE = '/admin';
export const ADMIN_PAGES_PREFIX = `${ADMIN_BASE_ROUTE}/pages`;

/**
 * Tập hợp URL tuyệt đối hoàn chỉnh dùng cho điều hướng (routerLink, navigate, sidebar)
 */
export const ADMIN_PAGES_URLS = {
  HOME: `${ADMIN_PAGES_PREFIX}/${PAGES_ROUTES.HOME}`,
  ABOUT: `${ADMIN_PAGES_PREFIX}/${PAGES_ROUTES.ABOUT}`,
  POLICIES: `${ADMIN_BASE_ROUTE}/${PAGES_ROUTES.POLICIES}`,
  POLICIES_NEW: `${ADMIN_BASE_ROUTE}/${PAGES_ROUTES.POLICIES}/new`,
  POLICIES_ADD: `${ADMIN_BASE_ROUTE}/${PAGES_ROUTES.POLICIES}/add`,
  policyDetail: (id: string | number) => `${ADMIN_BASE_ROUTE}/${PAGES_ROUTES.POLICIES}/${id}`,
  policyEdit: (id: string | number) => `${ADMIN_BASE_ROUTE}/${PAGES_ROUTES.POLICIES}/${id}/edit`,
  PAGES_PREFIX: ADMIN_PAGES_PREFIX,
} as const;

/**
 * Các route path tương đối phục vụ đăng ký trong hệ thống Angular Router (AdminModule)
 */
export const ADMIN_PAGES_ROUTE_PATHS = {
  PAGE_HOME: `pages/${PAGES_ROUTES.HOME}`,
  PAGE_ABOUT: `pages/${PAGES_ROUTES.ABOUT}`,
  PAGE_POLICIES: `pages/${PAGES_ROUTES.POLICIES}`,
  POLICIES: PAGES_ROUTES.POLICIES,
  POLICIES_NEW: `${PAGES_ROUTES.POLICIES}/new`,
  POLICIES_ADD: `${PAGES_ROUTES.POLICIES}/add`,
  POLICIES_DETAIL: `${PAGES_ROUTES.POLICIES}/:id`,
  POLICIES_EDIT: `${PAGES_ROUTES.POLICIES}/:id/edit`,
  PAGES_ROOT: 'pages',
  PAGES_NEW: 'pages/new',
  PAGES_ADD: 'pages/add',
  PAGES_DETAIL: 'pages/:id',
  PAGES_EDIT: 'pages/:id/edit',
} as const;

/**
 * Interface chứa các component cần đăng ký vào cấu hình route CMS Pages
 * (Truyền dưới dạng tham số để đảm bảo không tạo import vòng giữa file routes và component)
 */
export interface AdminPagesComponents {
  home: Type<any>;
  about: Type<any>;
  policies: Type<any>;
  policyForm: Type<any>;
  policyEdit: Type<any>;
}

/**
 * Khởi tạo danh sách Angular Routes cho module Admin CMS Pages
 * Tích hợp đầy đủ các trang chính cùng các redirect tương thích ngược
 */
export function createAdminPagesRoutes(components: AdminPagesComponents): Routes {
  return [
    // Quản lý chính sách (Policies)
    { path: ADMIN_PAGES_ROUTE_PATHS.POLICIES, component: components.policies },
    { path: ADMIN_PAGES_ROUTE_PATHS.POLICIES_NEW, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.POLICIES_ADD, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.POLICIES_DETAIL, component: components.policyEdit },
    { path: ADMIN_PAGES_ROUTE_PATHS.POLICIES_EDIT, component: components.policyForm },

    // Quản lý trang chủ (Home) & Giới thiệu (About)
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGE_HOME, component: components.home },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGE_ABOUT, component: components.about },

    // Redirects tương thích ngược và định tuyến phụ trợ
    { path: PAGES_ROUTES.HOME, redirectTo: ADMIN_PAGES_ROUTE_PATHS.PAGE_HOME, pathMatch: 'full' },
    { path: PAGES_ROUTES.ABOUT, redirectTo: ADMIN_PAGES_ROUTE_PATHS.PAGE_ABOUT, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGES_ROOT, redirectTo: ADMIN_PAGES_ROUTE_PATHS.PAGE_HOME, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGE_POLICIES, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGES_NEW, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGES_ADD, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGES_DETAIL, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES_DETAIL, pathMatch: 'full' },
    { path: ADMIN_PAGES_ROUTE_PATHS.PAGES_EDIT, redirectTo: ADMIN_PAGES_ROUTE_PATHS.POLICIES_EDIT, pathMatch: 'full' },
  ];
}

/**
 * Kiểm tra xem URL có thuộc phạm vi quản lý của CMS Pages (home, about, policies) hay không
 */
export function isPagesAdminUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return (
    url.startsWith(ADMIN_PAGES_URLS.HOME) ||
    url.startsWith(ADMIN_PAGES_URLS.ABOUT) ||
    url.startsWith(ADMIN_PAGES_URLS.POLICIES) ||
    url.startsWith(ADMIN_PAGES_URLS.PAGES_PREFIX)
  );
}
