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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, AdminJwtAuthGuard } from '../auth/roles.guard';
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

  // ─── Lấy orders của user hiện tại ────────────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Get()
  getOrders(@GetUser() user: User) {
    return this.ordersService.getOrders(user);
  }

  // ─── Đặt hàng COD — yêu cầu đăng nhập để lấy cart từ DB ─────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('/add')
  async addOrder(
    @Body() orderDto: OrderDto,
    @GetUser() user: User,
  ): Promise<{ error: string; result: Order }> {
    return this.ordersService.addOrder(orderDto, user);
  }

  // ─── Đặt hàng Stripe — yêu cầu đăng nhập ────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('/stripe')
  async orderWithStripe(
    @Body() body,
    @GetUser() user: User,
  ): Promise<{ error: string; result: Order }> {
    return this.ordersService.orderWithStripe(body, user);
  }

  // ─── Admin: lấy tất cả orders ────────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/all')
  getAllOrders() {
    return this.ordersService.getAllOrders();
  }

  // ─── Admin: lấy order theo orderId ───────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/:id')
  getOrderById(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
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

  // ─── Admin: xóa order ────────────────────────────────────────────────────
  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Delete('/:id')
  deleteOrder(@Param('id') id: string) {
    return this.ordersService.removeOrder(id);
  }
}
