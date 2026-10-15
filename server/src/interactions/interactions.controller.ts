import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Session,
  Headers,
  ValidationPipe,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/roles.guard';
import { InteractionsService } from './interactions.service';
import { CreateInteractionDto } from './dto/create-interaction.dto';

@Controller('api/interactions')
@UseGuards(OptionalJwtAuthGuard)
export class InteractionsController {
  constructor(private interactionsService: InteractionsService) {}

  @Post()
  async recordInteraction(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    createDto: CreateInteractionDto,
    @Req() req: any,
    @Session() session: any,
    @Headers('x-guest-cart-id') guestCartId?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const user = req.user || null;
    return this.interactionsService.recordInteraction(
      createDto,
      user,
      session,
      guestCartId,
      userAgent,
    );
  }
}
