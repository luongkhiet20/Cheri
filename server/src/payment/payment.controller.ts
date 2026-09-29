import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, UseGuards, ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { PaymentService } from './payment.service';
import { CreatePaymentMethodDto, UpdatePaymentMethodDto, BulkDeletePaymentDto } from './dto/payment.dto';
import { PaymentMethod } from './models/payment.model';

@Controller('api/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ─── PUBLIC: phương thức đang bật (cho giỏ hàng) ───
  @Get('/active')
  getActive(): Promise<PaymentMethod[]> {
    return this.paymentService.getActive();
  }

  // ─── ADMIN: tất cả ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  getAll(): Promise<PaymentMethod[]> {
    return this.paymentService.getAll();
  }

  // ─── ADMIN: theo ID ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('/:id')
  getById(@Param('id') id: string): Promise<PaymentMethod> {
    return this.paymentService.getById(id);
  }

  // ─── ADMIN: thêm mới ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  create(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    return this.paymentService.create(dto);
  }

  // ─── ADMIN: xóa nhiều (Bulk) — đặt TRƯỚC /:id để tránh match nhầm ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('/bulk')
  deleteBulk(@Body() dto: BulkDeletePaymentDto): Promise<{ deleted: number }> {
    return this.paymentService.deleteBulk(dto.ids);
  }

  // ─── ADMIN: chỉnh sửa ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Put('/:id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) dto: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    return this.paymentService.update(id, dto);
  }

  // ─── ADMIN: bật/tắt ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('/:id/toggle')
  toggle(@Param('id') id: string): Promise<PaymentMethod> {
    return this.paymentService.toggle(id);
  }

  // ─── ADMIN: xóa một ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('/:id')
  delete(@Param('id') id: string): Promise<void> {
    return this.paymentService.delete(id);
  }
}
