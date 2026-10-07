import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { RolesGuard, AdminJwtAuthGuard } from '../auth/roles.guard';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/stats')
  async getStats(@Query('timeRange') timeRange?: string) {
    const period = timeRange === '30d' || timeRange === 'month' ? 'month' : 'week';
    const stats = await this.ordersService.getDashboardDetailedStats(period);
    return {
      success: true,
      stats,
    };
  }
}
