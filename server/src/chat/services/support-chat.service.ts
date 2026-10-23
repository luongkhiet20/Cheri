import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../schemas/conversation.schema';
import { ConversationMessage, ConversationMessageDocument } from '../schemas/conversation-message.schema';
import { User } from '../../auth/models/user.model';

@Injectable()
export class SupportChatService {
  constructor(
    @InjectModel('Conversation') private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel('ConversationMessage') private readonly messageModel: Model<ConversationMessageDocument>,
    @InjectModel('Order') private readonly orderModel: Model<any>,
    @InjectModel('User') private readonly userModel: Model<User>,
  ) {}

  /**
   * Helper to normalize identity
   */
  private resolveCustomerIdentity(user: User | null, guestId?: string, sessionId?: string): {
    userId: Types.ObjectId | null;
    guestId: string | null;
  } {
    if (user && user._id) {
      return {
        userId: new Types.ObjectId(user._id),
        guestId: null,
      };
    }
    const resolvedGuest = (guestId || sessionId || '').trim();
    if (!resolvedGuest) {
      throw new BadRequestException('Không thể xác thực danh tính khách hàng');
    }
    return {
      userId: null,
      guestId: resolvedGuest,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // CUSTOMER FLOW
  // ─────────────────────────────────────────────────────────────

  /**
   * Only called when customer clicks "Liên hệ nhân viên hỗ trợ".
   * STRICT: Sets source = 'SUPPORT_BUTTON'.
   */
  async requestSupport(user: User | null, guestId?: string, sessionId?: string) {
    const identity = this.resolveCustomerIdentity(user, guestId, sessionId);

    // Look for an existing OPEN conversation for this user or guest
    const filter: any = {
      source: 'SUPPORT_BUTTON',
      status: { $in: ['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED'] },
    };
    if (identity.userId) {
      filter.userId = identity.userId;
    } else {
      filter.guestId = identity.guestId;
    }

    let conversation = await this.conversationModel.findOne(filter).exec();

    if (conversation) {
      // Reuse existing active conversation
      return {
        success: true,
        isNew: false,
        conversation,
        message: 'Khôi phục phiên hỗ trợ đang hoạt động',
      };
    }

    // Create new conversation
    conversation = await this.conversationModel.create({
      userId: identity.userId,
      guestId: identity.guestId,
      channel: 'WEB_CHAT',
      source: 'SUPPORT_BUTTON', // Guaranteed by Backend
      status: 'WAITING_ADMIN',
      requestedAt: new Date(),
      lastMessageAt: new Date(),
      lastMessagePreview: 'Đang kết nối với nhân viên hỗ trợ. Nàng vui lòng chờ trong giây lát nhé! 💛',
      unreadAdminCount: 1,
      unreadCustomerCount: 0,
    });

    // Create initial SYSTEM message
    const sysMsg = await this.messageModel.create({
      conversationId: conversation._id,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      systemEvent: 'SUPPORT_REQUESTED',
      content: 'Đang kết nối với nhân viên hỗ trợ. Nàng vui lòng chờ trong giây lát nhé! 💛',
      createdAt: new Date(),
    });

    conversation.lastMessageId = sysMsg._id as Types.ObjectId;
    conversation.lastMessagePreview = sysMsg.content;
    await conversation.save();

    return {
      success: true,
      isNew: true,
      conversation,
      systemMessage: sysMsg,
      message: 'Tạo phiên hỗ trợ nhân viên thành công',
    };
  }

  /**
   * Check if current customer has an active support conversation
   */
  async getCurrentSupport(user: User | null, guestId?: string, sessionId?: string) {
    try {
      const identity = this.resolveCustomerIdentity(user, guestId, sessionId);
      const filter: any = {
        source: 'SUPPORT_BUTTON',
        status: { $in: ['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED'] },
      };
      if (identity.userId) {
        filter.userId = identity.userId;
      } else {
        filter.guestId = identity.guestId;
      }

      const conversation = await this.conversationModel.findOne(filter).exec();
      return {
        success: true,
        hasActiveSupport: !!conversation,
        conversation: conversation || null,
      };
    } catch {
      return {
        success: true,
        hasActiveSupport: false,
        conversation: null,
      };
    }
  }

  /**
   * Get messages for customer with ownership check
   */
  async getCustomerMessages(conversationId: string, user: User | null, guestId?: string, sessionId?: string) {
    const identity = this.resolveCustomerIdentity(user, guestId, sessionId);
    const conv = await this.conversationModel.findById(conversationId).exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    // Verify ownership
    if (identity.userId) {
      if (!conv.userId || conv.userId.toString() !== identity.userId.toString()) {
        throw new ForbiddenException('Bạn không có quyền xem cuộc hội thoại này');
      }
    } else {
      if (!conv.guestId || conv.guestId !== identity.guestId) {
        throw new ForbiddenException('Bạn không có quyền xem cuộc hội thoại này');
      }
    }

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .exec();

    return {
      success: true,
      conversation: conv,
      messages,
    };
  }

  /**
   * Send a message from customer to open support conversation
   */
  async sendCustomerMessage(
    conversationId: string,
    content: string,
    user: User | null,
    guestId?: string,
    sessionId?: string,
    clientMessageId?: string,
  ) {
    const text = (content || '').trim();
    if (!text) {
      throw new BadRequestException('Nội dung tin nhắn không được rỗng');
    }

    const identity = this.resolveCustomerIdentity(user, guestId, sessionId);
    const conv = await this.conversationModel.findById(conversationId).exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    // Ownership check
    if (identity.userId) {
      if (!conv.userId || conv.userId.toString() !== identity.userId.toString()) {
        throw new ForbiddenException('Bạn không có quyền gửi tin nhắn trong hội thoại này');
      }
    } else {
      if (!conv.guestId || conv.guestId !== identity.guestId) {
        throw new ForbiddenException('Bạn không có quyền gửi tin nhắn trong hội thoại này');
      }
    }

    if (conv.status === 'CLOSED') {
      throw new BadRequestException('Phiên hỗ trợ này đã kết thúc. Vui lòng gửi yêu cầu hỗ trợ mới.');
    }

    // Idempotency check if clientMessageId provided
    if (clientMessageId) {
      const existing = await this.messageModel.findOne({ clientMessageId }).exec();
      if (existing) {
        return { success: true, message: existing };
      }
    }

    const newMsg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: 'CUSTOMER',
      senderId: identity.userId,
      messageType: 'TEXT',
      content: text,
      clientMessageId: clientMessageId || null,
      createdAt: new Date(),
    });

    conv.lastMessageId = newMsg._id as Types.ObjectId;
    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = text;
    conv.unreadAdminCount = (conv.unreadAdminCount || 0) + 1;
    // If status was REPLIED, change back to IN_PROGRESS
    if (conv.status === 'REPLIED') {
      conv.status = 'IN_PROGRESS';
    }
    await conv.save();

    return {
      success: true,
      message: newMsg,
    };
  }

  /**
   * Mark customer read (clear unreadCustomerCount)
   */
  async markCustomerRead(conversationId: string, user: User | null, guestId?: string, sessionId?: string) {
    const identity = this.resolveCustomerIdentity(user, guestId, sessionId);
    const conv = await this.conversationModel.findById(conversationId).exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    if (identity.userId && (!conv.userId || conv.userId.toString() !== identity.userId.toString())) {
      throw new ForbiddenException('Quyền truy cập bị từ chối');
    }
    if (!identity.userId && (!conv.guestId || conv.guestId !== identity.guestId)) {
      throw new ForbiddenException('Quyền truy cập bị từ chối');
    }

    conv.unreadCustomerCount = 0;
    conv.customerLastReadAt = new Date();
    await conv.save();

    await this.messageModel.updateMany(
      { conversationId: conv._id, senderType: 'ADMIN', readByCustomerAt: null },
      { $set: { readByCustomerAt: new Date() } },
    );

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────
  // ADMIN FLOW (Only conversations with source = 'SUPPORT_BUTTON')
  // ─────────────────────────────────────────────────────────────

  async getAdminConversations(query: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    // MANDATORY CONSTRAINT: source must be SUPPORT_BUTTON
    const filter: any = { source: 'SUPPORT_BUTTON' };

    if (query.status) {
      if (query.status === 'unread') {
        filter.unreadAdminCount = { $gt: 0 };
      } else if (['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED', 'CLOSED'].includes(query.status)) {
        filter.status = query.status;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      const userMatches = await this.userModel
        .find({
          $or: [
            { fullName: { $regex: term, $options: 'i' } },
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { phoneNumber: { $regex: term, $options: 'i' } },
          ],
        })
        .select('_id')
        .exec();

      const userIds = userMatches.map((u) => u._id);
      filter.$or = [
        { userId: { $in: userIds } },
        { guestId: { $regex: term, $options: 'i' } },
        { lastMessagePreview: { $regex: term, $options: 'i' } },
      ];
    }

    const [items, total, countWaiting, countInProgress, countUnread, countAll] = await Promise.all([
      this.conversationModel
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'fullName name email phoneNumber avatar createdAt')
        .populate('assignedAdminId', 'fullName name avatar')
        .lean()
        .exec(),
      this.conversationModel.countDocuments(filter).exec(),
      this.conversationModel.countDocuments({ source: 'SUPPORT_BUTTON', status: 'WAITING_ADMIN' }).exec(),
      this.conversationModel.countDocuments({ source: 'SUPPORT_BUTTON', status: 'IN_PROGRESS' }).exec(),
      this.conversationModel.countDocuments({ source: 'SUPPORT_BUTTON', unreadAdminCount: { $gt: 0 } }).exec(),
      this.conversationModel.countDocuments({ source: 'SUPPORT_BUTTON' }).exec(),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        counts: {
          waiting: countWaiting,
          inProgress: countInProgress,
          unread: countUnread,
          all: countAll,
        },
      },
    };
  }

  async getAdminConversationDetail(conversationId: string) {
    const conv = await this.conversationModel
      .findOne({ _id: new Types.ObjectId(conversationId), source: 'SUPPORT_BUTTON' })
      .populate('userId', 'fullName name email phoneNumber avatar createdAt')
      .populate('assignedAdminId', 'fullName name avatar')
      .lean()
      .exec();

    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    // Retrieve customer CRM data (orders, total spent)
    let customerStats = {
      orderCount: 0,
      totalSpent: 0,
      recentOrders: [] as any[],
    };

    if (conv.userId) {
      const userId = (conv.userId as any)._id || conv.userId;
      const [orderCount, totalAgg, recentOrders] = await Promise.all([
        this.orderModel.countDocuments({ userId }).exec(),
        this.orderModel.aggregate([
          { $match: { userId: new Types.ObjectId(userId) } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        this.orderModel
          .find({ userId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select('orderId totalAmount status createdAt items')
          .lean()
          .exec(),
      ]);

      customerStats = {
        orderCount,
        totalSpent: totalAgg[0]?.total || 0,
        recentOrders,
      };
    }

    return {
      success: true,
      conversation: conv,
      customerStats,
    };
  }

  async getAdminMessages(conversationId: string) {
    const conv = await this.conversationModel
      .findOne({ _id: new Types.ObjectId(conversationId), source: 'SUPPORT_BUTTON' })
      .exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .populate('senderId', 'fullName name avatar')
      .lean()
      .exec();

    // Mark messages as read by Admin
    if (conv.unreadAdminCount > 0) {
      conv.unreadAdminCount = 0;
      conv.adminLastReadAt = new Date();
      await conv.save();

      await this.messageModel.updateMany(
        { conversationId: conv._id, senderType: 'CUSTOMER', readByAdminAt: null },
        { $set: { readByAdminAt: new Date() } },
      );
    }

    return {
      success: true,
      messages,
    };
  }

  async acceptConversation(conversationId: string, adminUser: User) {
    const adminObjId = new Types.ObjectId(adminUser._id);
    const convObjId = new Types.ObjectId(conversationId);

    // Atomic update: Tiếp nhận hội thoại khi đang WAITING_ADMIN hoặc hội thoại chưa có admin phụ trách
    const conv = await this.conversationModel.findOneAndUpdate(
      {
        _id: convObjId,
        source: 'SUPPORT_BUTTON',
        $or: [
          { status: 'WAITING_ADMIN' },
          { status: { $in: ['IN_PROGRESS', 'REPLIED'] }, assignedAdminId: null },
        ],
      },
      {
        $set: {
          status: 'IN_PROGRESS',
          assignedAdminId: adminObjId,
          acceptedAt: new Date(),
          unreadAdminCount: 0,
          adminLastReadAt: new Date(),
        },
      },
      { new: true }
    )
      .populate('userId', 'fullName name email phoneNumber avatar createdAt')
      .populate('assignedAdminId', 'fullName name avatar')
      .exec();

    if (!conv) {
      const existing = await this.conversationModel.findById(convObjId).exec();
      if (!existing) {
        throw new NotFoundException('Không tìm thấy cuộc hội thoại');
      }
      // Idempotent: Nếu chính admin này đã tiếp nhận trước đó
      if (existing.status === 'IN_PROGRESS' && existing.assignedAdminId?.toString() === adminObjId.toString()) {
        return {
          success: true,
          conversation: existing,
          message: 'Cuộc trò chuyện đã được tiếp nhận trước đó',
        };
      }
      if (existing.status === 'IN_PROGRESS' && existing.assignedAdminId) {
        throw new BadRequestException('Cuộc trò chuyện đã được một nhân viên khác tiếp nhận');
      }
      if (existing.status === 'CLOSED') {
        throw new BadRequestException('Cuộc trò chuyện này đã kết thúc');
      }
      throw new BadRequestException('Không thể tiếp nhận cuộc trò chuyện ở trạng thái hiện tại');
    }

    const sysMsg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      systemEvent: 'ADMIN_JOINED',
      content: 'Nhân viên Chéri đã tham gia cuộc trò chuyện và sẵn sàng hỗ trợ nàng! ✨',
      createdAt: new Date(),
    });

    conv.lastMessageId = sysMsg._id as Types.ObjectId;
    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = sysMsg.content;
    conv.unreadCustomerCount = (conv.unreadCustomerCount || 0) + 1;
    await conv.save();

    return {
      success: true,
      conversation: conv,
      systemMessage: sysMsg,
    };
  }

  async returnConversation(conversationId: string, adminUser: User) {
    const convObjId = new Types.ObjectId(conversationId);
    const adminObjId = new Types.ObjectId(adminUser._id);
    const isSuperAdmin =
      Array.isArray(adminUser.roles) &&
      adminUser.roles.some((r: string) => r.toLowerCase() === 'super-admin');

    // Atomic update: Trả hội thoại về hàng chờ WAITING_ADMIN khi đang IN_PROGRESS hoặc REPLIED
    // Chỉ admin đang phụ trách (hoặc super-admin) mới được thực hiện
    const queryFilter: any = {
      _id: convObjId,
      source: 'SUPPORT_BUTTON',
      status: { $in: ['IN_PROGRESS', 'REPLIED'] },
    };
    if (!isSuperAdmin) {
      queryFilter.assignedAdminId = adminObjId;
    }

    const conv = await this.conversationModel
      .findOneAndUpdate(
        queryFilter,
        {
          $set: {
            status: 'WAITING_ADMIN',
            assignedAdminId: null,
            unreadAdminCount: 1,
          },
        },
        { new: true }
      )
      .populate('userId', 'fullName name email phoneNumber avatar createdAt')
      .exec();

    if (!conv) {
      const existing = await this.conversationModel.findById(convObjId).exec();
      if (!existing) {
        throw new NotFoundException('Không tìm thấy cuộc hội thoại');
      }
      if (existing.status === 'WAITING_ADMIN') {
        return {
          success: true,
          conversation: existing,
          message: 'Cuộc trò chuyện đã ở hàng chờ',
        };
      }
      if (
        existing.assignedAdminId &&
        existing.assignedAdminId.toString() !== adminObjId.toString() &&
        !isSuperAdmin
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền trả cuộc trò chuyện do nhân viên khác phụ trách',
        );
      }
      throw new BadRequestException('Không thể trả hội thoại ở trạng thái hiện tại');
    }

    const sysMsg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      systemEvent: 'SUPPORT_REQUESTED',
      content: 'Đang kết nối với nhân viên hỗ trợ. Nàng vui lòng chờ trong giây lát nhé! 💛',
      createdAt: new Date(),
    });

    conv.lastMessageId = sysMsg._id as Types.ObjectId;
    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = sysMsg.content;
    await conv.save();

    return {
      success: true,
      conversation: conv,
      systemMessage: sysMsg,
      message: 'Đã trả cuộc trò chuyện về hàng chờ',
    };
  }

  async sendAdminMessage(conversationId: string, content: string, adminUser: User, clientMessageId?: string) {
    const text = (content || '').trim();
    if (!text) {
      throw new BadRequestException('Nội dung tin nhắn không được để trống');
    }

    const conv = await this.conversationModel
      .findOne({ _id: new Types.ObjectId(conversationId), source: 'SUPPORT_BUTTON' })
      .exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    if (conv.status === 'CLOSED') {
      throw new BadRequestException('Cuộc hội thoại đã đóng, không thể gửi tin nhắn.');
    }

    if (conv.status === 'WAITING_ADMIN' || !conv.assignedAdminId) {
      throw new BadRequestException('Cuộc trò chuyện đang ở hàng chờ, vui lòng tiếp nhận trước khi gửi tin nhắn.');
    }

    const adminObjId = new Types.ObjectId(adminUser._id);
    const isAssigned = conv.assignedAdminId?.toString() === adminObjId.toString();
    const isSuperAdmin =
      Array.isArray(adminUser.roles) &&
      adminUser.roles.some((r: string) => r.toLowerCase() === 'super-admin');

    if (!isAssigned && !isSuperAdmin) {
      throw new ForbiddenException('Bạn không phải nhân viên phụ trách cuộc hội thoại này');
    }

    // Idempotency check with clientMessageId
    if (clientMessageId) {
      const existingMsg = await this.messageModel.findOne({ clientMessageId }).exec();
      if (existingMsg) {
        return { success: true, message: existingMsg };
      }
    }

    const newMsg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: 'ADMIN',
      senderId: adminObjId,
      messageType: 'TEXT',
      content: text,
      clientMessageId: clientMessageId || null,
      createdAt: new Date(),
    });

    conv.status = 'REPLIED';
    conv.lastMessageId = newMsg._id as Types.ObjectId;
    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = text;
    conv.unreadCustomerCount = (conv.unreadCustomerCount || 0) + 1;
    conv.adminLastReadAt = new Date();
    await conv.save();

    return {
      success: true,
      message: newMsg,
    };
  }

  async updateConversationStatus(conversationId: string, status: any) {
    if (!['WAITING_ADMIN', 'IN_PROGRESS', 'REPLIED', 'CLOSED'].includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    const conv = await this.conversationModel
      .findOne({ _id: new Types.ObjectId(conversationId), source: 'SUPPORT_BUTTON' })
      .exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    conv.status = status;
    if (status === 'CLOSED') {
      conv.closedAt = new Date();
    }
    await conv.save();

    return { success: true, conversation: conv };
  }

  async updateNotes(conversationId: string, internalNote: string, adminUser: User) {
    const conv = await this.conversationModel
      .findOne({ _id: new Types.ObjectId(conversationId), source: 'SUPPORT_BUTTON' })
      .exec();
    if (!conv) {
      throw new NotFoundException('Không tìm thấy cuộc hội thoại');
    }

    conv.internalNote = internalNote || '';
    conv.internalNoteUpdatedBy = new Types.ObjectId(adminUser._id);
    conv.internalNoteUpdatedAt = new Date();
    await conv.save();

    return { success: true, internalNote: conv.internalNote };
  }

  async closeConversation(conversationId: string, adminUser: User) {
    const convObjId = new Types.ObjectId(conversationId);
    const adminObjId = new Types.ObjectId(adminUser._id);
    const isSuperAdmin =
      Array.isArray(adminUser.roles) &&
      adminUser.roles.some((r: string) => r.toLowerCase() === 'super-admin');

    // Atomic update: Chỉ đóng khi status khác CLOSED và đúng quyền phụ trách
    const queryFilter: any = {
      _id: convObjId,
      source: 'SUPPORT_BUTTON',
      status: { $ne: 'CLOSED' },
    };
    if (!isSuperAdmin) {
      queryFilter.assignedAdminId = adminObjId;
    }

    const conv = await this.conversationModel.findOneAndUpdate(
      queryFilter,
      {
        $set: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      },
      { new: true }
    )
      .populate('userId', 'fullName name email phoneNumber avatar createdAt')
      .populate('assignedAdminId', 'fullName name avatar')
      .exec();

    if (!conv) {
      const existing = await this.conversationModel.findById(convObjId).exec();
      if (!existing) {
        throw new NotFoundException('Không tìm thấy cuộc hội thoại');
      }
      if (existing.status === 'CLOSED') {
        return {
          success: true,
          conversation: existing,
          message: 'Cuộc hội thoại đã đóng trước đó',
        };
      }
      if (
        existing.assignedAdminId &&
        existing.assignedAdminId.toString() !== adminObjId.toString() &&
        !isSuperAdmin
      ) {
        throw new ForbiddenException(
          'Bạn không có quyền đóng cuộc trò chuyện do nhân viên khác phụ trách',
        );
      }
      throw new BadRequestException('Không thể đóng cuộc hội thoại');
    }

    // Add SYSTEM message indicating session ended
    const sysMsg = await this.messageModel.create({
      conversationId: conv._id,
      senderType: 'SYSTEM',
      messageType: 'SYSTEM',
      systemEvent: 'ADMIN_LEFT',
      content: 'Nhân viên Chéri đã rời cuộc trò chuyện. Chéri Assistant sẽ tiếp tục hỗ trợ nàng nhé! 💛',
      createdAt: new Date(),
    });

    conv.lastMessageId = sysMsg._id as Types.ObjectId;
    conv.lastMessageAt = new Date();
    conv.lastMessagePreview = sysMsg.content;
    conv.unreadCustomerCount = (conv.unreadCustomerCount || 0) + 1;
    await conv.save();

    return {
      success: true,
      conversation: conv,
      message: 'Đã đóng cuộc hội thoại',
      systemMessage: sysMsg,
    };
  }
}
