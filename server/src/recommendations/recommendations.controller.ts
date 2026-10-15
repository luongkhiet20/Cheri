import {
  Controller,
  Get,
  Query,
  Req,
  Headers,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/roles.guard';
import { RecommendationsService, RecommendationResponse } from './recommendations.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';

@Controller('api/recommendations')
@UseGuards(OptionalJwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  async getRecommendations(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    queryDto: GetRecommendationsDto,
    @Req() req: any,
    @Headers('x-guest-cart-id') guestCartId?: string,
  ): Promise<RecommendationResponse> {
    const user = req.user || null;
    return this.recommendationsService.getRecommendations(queryDto, user, guestCartId);
  }
}
