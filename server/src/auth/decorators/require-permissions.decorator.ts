import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissions_any';

/**
 * Decorator yêu cầu granular permissions cho endpoints quản trị (Bắt buộc người dùng có TẤT CẢ quyền được liệt kê)
 * @param permissions Danh sách quyền bắt buộc (ví dụ: 'products:view', 'orders:update_status')
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator yêu cầu người dùng có ÍT NHẤT MỘT trong các permissions được liệt kê
 * @param permissions Danh sách quyền chấp nhận (ví dụ: 'products:create', 'products:update', 'cms:home')
 */
export const RequireAnyPermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_ANY_KEY, permissions);
