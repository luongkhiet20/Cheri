import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OptionalJwtAuthGuard, AdminJwtAuthGuard, RolesGuard } from '../../auth/roles.guard';
import { GetUser } from '../../auth/utils/get-user.decorator';
import { User } from '../../auth/models/user.model';
import { SupportChatService } from '../services/support-chat.service';

@Controller('api')
export class SupportChatController {
  constructor(private readonly supportChatService: SupportChatService) {}

  // ─────────────────────────────────────────────────────────────
  // CUSTOMER ENDPOINTS (/api/chat/support)
  // ─────────────────────────────────────────────────────────────

  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat/support/request')
  async requestSupport(
    @GetUser() user: User | null,
    @Body() body: { guestId?: string; sessionId?: string },
  ) {
    return this.supportChatService.requestSupport(user, body?.guestId, body?.sessionId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('chat/support/current')
  async getCurrentSupport(
    @GetUser() user: User | null,
    @Query('guestId') guestId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.supportChatService.getCurrentSupport(user, guestId, sessionId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('chat/support/:id/messages')
  async getCustomerMessages(
    @Param('id') id: string,
    @GetUser() user: User | null,
    @Query('guestId') guestId?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.supportChatService.getCustomerMessages(id, user, guestId, sessionId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('chat/support/:id/messages')
  async sendCustomerMessage(
    @Param('id') id: string,
    @GetUser() user: User | null,
    @Body() body: { content: string; guestId?: string; sessionId?: string; clientMessageId?: string },
  ) {
    return this.supportChatService.sendCustomerMessage(
      id,
      body?.content,
      user,
      body?.guestId,
      body?.sessionId,
      body?.clientMessageId,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Patch('chat/support/:id/read')
  async markCustomerRead(
    @Param('id') id: string,
    @GetUser() user: User | null,
    @Body() body: { guestId?: string; sessionId?: string },
  ) {
    return this.supportChatService.markCustomerRead(id, user, body?.guestId, body?.sessionId);
  }

  // ─────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS (/api/admin/conversations)
  // ─────────────────────────────────────────────────────────────

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('admin/conversations')
  async getAdminConversations(
    @Query() query: { status?: string; search?: string; page?: number; limit?: number },
  ) {
    return this.supportChatService.getAdminConversations(query);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('admin/conversations/:id')
  async getAdminConversationDetail(@Param('id') id: string) {
    return this.supportChatService.getAdminConversationDetail(id);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Get('admin/conversations/:id/messages')
  async getAdminMessages(@Param('id') id: string) {
    return this.supportChatService.getAdminMessages(id);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('admin/conversations/:id/accept')
  async acceptConversation(@Param('id') id: string, @GetUser() adminUser: User) {
    return this.supportChatService.acceptConversation(id, adminUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('admin/conversations/:id/return')
  async returnConversation(@Param('id') id: string, @GetUser() adminUser: User) {
    return this.supportChatService.returnConversation(id, adminUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('admin/conversations/:id/messages')
  async sendAdminMessage(
    @Param('id') id: string,
    @Body() body: { content: string; clientMessageId?: string },
    @GetUser() adminUser: User,
  ) {
    return this.supportChatService.sendAdminMessage(id, body?.content, adminUser, body?.clientMessageId);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('admin/conversations/:id/status')
  async updateConversationStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.supportChatService.updateConversationStatus(id, body?.status);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Patch('admin/conversations/:id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() body: { internalNote: string },
    @GetUser() adminUser: User,
  ) {
    return this.supportChatService.updateNotes(id, body?.internalNote, adminUser);
  }

  @UseGuards(AdminJwtAuthGuard, RolesGuard)
  @Post('admin/conversations/:id/close')
  async closeConversation(@Param('id') id: string, @GetUser() adminUser: User) {
    return this.supportChatService.closeConversation(id, adminUser);
  }
}
