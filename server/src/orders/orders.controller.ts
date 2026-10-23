import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Session,
  Headers,
  MethodNotAllowedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, AdminJwtAuthGuard, OptionalJwtAuthGuard } from '../auth/roles.guard';
import { OrdersService } from './orders.service';
import { GetUser } from '../auth/utils/get-user.decorator';
import { User } from '../auth/models/user.model';
import { OrderDto } from './dto/order.dto';
import { Order } from './models/order.model';

@Controller('api/orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  // ─── Public: lấy danh sách shipping methods (user chọn khi checkout) ──────
  @Get('/shipping-methods')
  getShippingMethods() {
    return this.ordersService.getActiveShippingMethods();
  }

  // ─── Public: lấy danh sách payment methods (user chọn khi checkout) ──────
  @Get('/payment-methods')
  getPaymentMethods() {
    return this.ordersService.getActivePaymentMethods();
  }

  // ─── Public: lấy thông tin địa chỉ gửi của cửa hàng từ settings (hóa đơn) ──
  @Get('/store-contact')
  getStoreContact() {
    return this.ordersService.getStoreContact();
  }

  // ─── Admin: lấy tất cả shipping methods ──────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/shipping-methods/all')
  getAllShippingMethods() {
    return this.ordersService.getAllShippingMethods();
  }

  // ─── Admin: tạo/cập nhật shipping method ────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/shipping-methods')
  upsertShippingMethod(@Body() body: any) {
    return this.ordersService.upsertShippingMethod(body);
  }

  // ─── Admin: xóa shipping method ─────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/shipping-methods/:id')
  deleteShippingMethod(@Param('id') id: string) {
    return this.ordersService.deleteShippingMethod(id);
  }

  // ─── Admin: lấy tất cả payment methods ───────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/payment-methods/all')
  getAllPaymentMethods() {
    return this.ordersService.getAllPaymentMethods();
  }

  // ─── Admin: tạo/cập nhật payment method ─────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/payment-methods')
  upsertPaymentMethod(@Body() body: any) {
    return this.ordersService.upsertPaymentMethod(body);
  }

  // ─── Admin: xóa payment method ───────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/payment-methods/:id')
  deletePaymentMethod(@Param('id') id: string) {
    return this.ordersService.deletePaymentMethod(id);
  }

  // ─── Lấy orders (user lấy đơn của mình, admin lấy toàn bộ với bộ lọc) ────
  @UseGuards(AuthGuard('jwt'))
  @Get()
  getOrders(@GetUser() user: User, @Query() query: any) {
    const userRoles = (user as any)?.roles || (user as any)?.role || [];
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    const isAdmin = roles.some((r: any) => typeof r === 'string' && r.toLowerCase().includes('admin'));
    if (isAdmin || query?.page || query?.status || query?.search) {
      return this.ordersService.getAdminOrders(query);
    }
    return this.ordersService.getOrders(user);
  }

  // ─── Khách hàng: Hủy đơn hàng (chỉ khi đơn ở trạng thái PENDING) ───────────
  @UseGuards(AuthGuard('jwt'))
  @Post('/:id/cancel')
  cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason?: string; reasonDetail?: string },
    @GetUser() user: User,
  ) {
    return this.ordersService.cancelOrder(id, body, user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('/:id/cancel')
  cancelOrderPatch(
    @Param('id') id: string,
    @Body() body: { reason?: string; reasonDetail?: string },
    @GetUser() user: User,
  ) {
    return this.ordersService.cancelOrder(id, body, user);
  }

  // ─── Khách hàng: Lấy chữ ký upload ảnh minh chứng lên Cloudinary ────────
  @UseGuards(AuthGuard('jwt'))
  @Get('/return-upload-signature')
  getReturnUploadSignature() {
    return this.ordersService.getReturnUploadSignature();
  }

  // ─── Khách hàng: Yêu cầu Trả hàng / Hoàn tiền (đơn đã DELIVERED) ─────────
  @UseGuards(AuthGuard('jwt'))
  @Post('/:id/return-request')
  createReturnRequest(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() user: User,
  ) {
    return this.ordersService.createReturnRequest(id, body, user);
  }

  // ─── Khách hàng: Hủy yêu cầu Trả hàng / Hoàn tiền (khi còn PENDING) ────────
  @UseGuards(AuthGuard('jwt'))
  @Patch('/:id/return-requests/:reqId/cancel')
  cancelReturnRequest(
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() body: { reason?: string },
    @GetUser() user: User,
  ) {
    return this.ordersService.cancelReturnRequest(id, reqId, body, user);
  }

  // ─── Public: Tra cứu vận đơn (khách vãng lai) ─────────────────────────────
  // Guest verification stays in the POST body; no contact details are accepted from the URL.
  // Không trả toàn bộ document — chỉ trả dữ liệu tracking cần thiết.
  @Post('/track')
  trackOrder(@Body() body: {
    trackingCode?: string;
    authContact?: string;
    orderId?: string;
    trackingNumber?: string;
    email?: string;
    phone?: string;
  }) {
    return this.ordersService.trackOrder(body);
  }

  // ─── Public: Lấy danh mục địa giới hành chính (Tỉnh/Thành, Quận/Huyện, Phường/Xã) ───
  @Get('/address/provinces')
  getProvinces() {
    return this.ordersService.getProvinces();
  }

  @Get('/address/districts/:code')
  getDistricts(@Param('code') code: string) {
    return this.ordersService.getDistricts(code);
  }

  @Get('/address/wards/:code')
  getWards(@Param('code') code: string) {
    return this.ordersService.getWards(code);
  }

  // ─── Public: Kiểm tra và áp dụng mã giảm giá ─────────────────────────────
  @Post('/coupon/validate')
  validateCoupon(@Body() body: { code: string; subtotal: number }) {
    return this.ordersService.validateCoupon(body.code, body.subtotal);
  }

  // ─── Đặt hàng COD — hỗ trợ cả user đăng nhập và khách vãng lai ─────────
  @UseGuards(OptionalJwtAuthGuard)
  @Post('/add')
  async addOrder(
    @Body() orderDto: OrderDto,
    @GetUser() user: User,
    @Session() session: any,
    @Headers('x-guest-cart-id') guestCartId?: string,
  ): Promise<{ error: string; result: Order; cart?: any }> {
    return this.ordersService.addOrder(orderDto, user, 'vi', session, guestCartId);
  }

  // ─── Đặt hàng Stripe — hỗ trợ cả user đăng nhập và khách vãng lai ────────
  @UseGuards(OptionalJwtAuthGuard)
  @Post('/stripe')
  async orderWithStripe(
    @Body() body,
    @GetUser() user: User,
    @Session() session: any,
    @Headers('x-guest-cart-id') guestCartId?: string,
  ): Promise<{ error: string; result: Order; cart?: any }> {
    return this.ordersService.orderWithStripe(body, user, 'vi', session, guestCartId);
  }

  // ─── Admin: thông báo ──────────────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/notifications')
  getNotifications(@Query('recipientId') recipientId?: string) {
    return this.ordersService.getNotifications(recipientId || 'admin');
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/notifications/unread-count')
  getUnreadCount(@Query('recipientId') recipientId?: string) {
    return this.ordersService.getUnreadNotificationCount(recipientId || 'admin');
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/notifications/read-all')
  markAllNotificationsReadPost(@Body('recipientId') recipientId?: string) {
    return this.ordersService.markAllNotificationsRead(recipientId || 'admin');
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/notifications/read-all')
  markAllNotificationsReadPatch(@Body('recipientId') recipientId?: string) {
    return this.ordersService.markAllNotificationsRead(recipientId || 'admin');
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/notifications/:id/read')
  markNotificationReadPatch(@Param('id') id: string, @Body('recipientId') recipientId?: string) {
    return this.ordersService.markNotificationRead(id, recipientId || 'admin');
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('/notifications/:id/read')
  markNotificationReadPost(@Param('id') id: string, @Body('recipientId') recipientId?: string) {
    return this.ordersService.markNotificationRead(id, recipientId || 'admin');
  }

  // ─── Admin: thống kê dashboard ───────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/stats')
  getOrderStats(@Query('period') period: 'week' | 'month') {
    return this.ordersService.getOrderStats(period || 'week');
  }

  // ─── Admin: lấy tất cả orders ────────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/all')
  getAllOrders() {
    return this.ordersService.getAllOrders();
  }

  // ─── Lấy order theo orderId (Admin hoặc User sở hữu) ─────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Get('/:id')
  async getOrderById(@Param('id') id: string, @GetUser() user: User) {
    const order = await this.ordersService.getOrderById(id);
    if (!order) {
      throw new NotFoundException('Đơn hàng không tồn tại');
    }
    const userRoles = (user as any)?.roles || (user as any)?.role || [];
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    const isAdmin = roles.some((r: any) => typeof r === 'string' && r.toLowerCase().includes('admin'));
    if (!isAdmin) {
      const userIdStr = user?._id ? user._id.toString() : '';
      const orderUserStr = (order as any)?._user ? (order as any)._user.toString() : '';
      const orderUserIdStr = (order as any)?.userId ? (order as any).userId.toString() : '';
      const userEmail = (user?.email || '').toLowerCase();
      const orderEmail = ((order as any)?.customerEmail || (order as any)?.email || '').toLowerCase();

      const isOwner =
        (userIdStr && (userIdStr === orderUserStr || userIdStr === orderUserIdStr)) ||
        (userEmail && userEmail === orderEmail);

      if (!isOwner) {
        throw new ForbiddenException('Bạn không có quyền xem đơn hàng này');
      }
    }
    return order;
  }

  // ─── Admin: cập nhật riêng trạng thái order (status) ─────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id/status')
  updateOrderStatus(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
    @GetUser() user: User,
  ) {
    return this.ordersService.updateOrderStatus(id, body?.status, body?.note, user);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Put('/:id/status')
  updateOrderStatusPut(
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
    @GetUser() user: User,
  ) {
    return this.ordersService.updateOrderStatus(id, body?.status, body?.note, user);
  }

  // ─── Admin: cập nhật order (status, tracking...) ─────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch()
  updateOrder(@Body() order, @GetUser() user: User) {
    return this.ordersService.updateOrder({ ...order, updatedBy: user?._id || null });
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Put()
  updateOrderPut(@Body() order, @GetUser() user: User) {
    return this.ordersService.updateOrder({ ...order, updatedBy: user?._id || null });
  }

  // ─── Admin: Xử lý quy trình trả hàng & hoàn tiền ────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id/return-requests/:reqId/status')
  updateReturnRequestWorkflow(
    @Param('id') id: string,
    @Param('reqId') reqId: string,
    @Body() body: { action: string; [key: string]: any },
    @GetUser() user: User,
  ) {
    return this.ordersService.updateReturnRequestWorkflow(id, reqId, body?.action, body, user);
  }

  // ─── Admin: Cập nhật đối soát COD ───────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('/:id/cod-reconciliation')
  updateCodReconciliation(
    @Param('id') id: string,
    @Body() body: any,
    @GetUser() user: User,
  ) {
    return this.ordersService.updateCodReconciliation(id, body, user);
  }

  // ─── Admin: xóa order (Vô hiệu hóa để bảo vệ dữ liệu nghiệp vụ) ───────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/:id')
  deleteOrder(@Param('id') id: string) {
    throw new MethodNotAllowedException(
      'Không hỗ trợ thao tác xóa đơn hàng. Đơn hàng là dữ liệu nghiệp vụ cần được lưu trữ để tra cứu, đối soát và quản lý lịch sử giao dịch.',
    );
  }
}
