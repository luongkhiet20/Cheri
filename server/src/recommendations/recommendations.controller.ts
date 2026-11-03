import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Session,
  Headers,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/roles.guard';
import { RecommendationsService, RecommendationResponse } from './recommendations.service';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { RecordImpressionsDto } from './dto/record-impressions.dto';

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

  @Post('impressions')
  async recordImpressions(
    @Body(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: false }))
    bodyDto: RecordImpressionsDto,
    @Req() req: any,
    @Session() session: any,
    @Headers('x-guest-cart-id') guestCartId?: string,
  ) {
    const user = req.user || null;
    return this.recommendationsService.recordImpressions(bodyDto, user, session, guestCartId);
  }
}
