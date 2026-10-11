import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { RolesGuard, AdminJwtAuthGuard } from '../auth/roles.guard';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private ordersService: OrdersService) {}

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('/stats')
  async getStats(
    @Query('timeRange') timeRange?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Custom date range takes priority
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const stats = await this.ordersService.getDashboardDetailedStats('custom', start, end);
        return { success: true, stats };
      }
    }

    const period: '7d' | '30d' | 'this_month' | 'last_month' | 'custom' =
      timeRange === '30d' ? '30d' :
      timeRange === 'this_month' ? 'this_month' :
      timeRange === 'last_month' ? 'last_month' : '7d';

    const stats = await this.ordersService.getDashboardDetailedStats(period);
    return { success: true, stats };
  }
}
