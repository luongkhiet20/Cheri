import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { ShippingService } from './shipping.service';
import { CreateShippingMethodDto, UpdateShippingMethodDto, BulkDeleteShippingDto } from './dto/shipping.dto';
import { ShippingMethod } from './models/shipping.model';

@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ─── PUBLIC: lấy danh sách đang hoạt động ───
  @Get('/active')
  getActive(): Promise<ShippingMethod[]> {
    return this.shippingService.getActive();
  }

  // ─── ADMIN: lấy tất cả ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get()
  getAll(): Promise<ShippingMethod[]> {
    return this.shippingService.getAll();
  }

  // ─── ADMIN: lấy theo ID ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Get('/:id')
  getById(@Param('id') id: string): Promise<ShippingMethod> {
    return this.shippingService.getById(id);
  }

  // ─── ADMIN: thêm mới ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Post()
  create(
    @Body(new ValidationPipe({ transform: true })) dto: CreateShippingMethodDto,
  ): Promise<ShippingMethod> {
    return this.shippingService.create(dto);
  }

  // ─── ADMIN: chỉnh sửa ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Put('/:id')
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethod> {
    return this.shippingService.update(id, dto);
  }

  // ─── ADMIN: bật/tắt ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Patch('/:id/toggle')
  toggle(@Param('id') id: string): Promise<ShippingMethod> {
    return this.shippingService.toggle(id);
  }

  // ─── ADMIN: xóa nhiều (Bulk) — đặt TRƯỚC /:id để tránh match nhầm ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('/bulk')
  deleteBulk(@Body() dto: BulkDeleteShippingDto): Promise<{ deleted: number }> {
    return this.shippingService.deleteBulk(dto.ids);
  }

  // ─── ADMIN: xóa ───
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Delete('/:id')
  delete(@Param('id') id: string): Promise<void> {
    return this.shippingService.delete(id);
  }
}
