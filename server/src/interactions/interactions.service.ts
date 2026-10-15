import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId, Types } from 'mongoose';
import { InteractionDocument } from './schemas/interaction.schema';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { User } from '../auth/models/user.model';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel('Interaction') private interactionModel: Model<InteractionDocument>,
    @InjectModel('Product') private productModel: Model<any>,
  ) {}

  async recordInteraction(
    createDto: CreateInteractionDto,
    user: User | null,
    session: any,
    clientGuestId?: string,
    userAgent?: string,
  ): Promise<any> {
    const rawProductId = createDto.productId?.trim();

    if (!rawProductId || !isValidObjectId(rawProductId)) {
      throw new BadRequestException('ID sản phẩm không đúng định dạng ObjectId');
    }

    const productObjectId = new Types.ObjectId(rawProductId);

    // 1. Xác thực sản phẩm có thực sự tồn tại trong catalog không
    const productExists = await this.productModel.exists({ _id: productObjectId });
    if (!productExists) {
      throw new NotFoundException('Sản phẩm không tồn tại trong danh mục');
    }

    // 2. Xác định danh tính: User đã đăng nhập vs Khách vãng lai
    let userId: Types.ObjectId | null = null;
    let sessionId: string | null = null;

    if (user && user._id) {
      userId = new Types.ObjectId(String(user._id));
      sessionId = clientGuestId || (session?.id ? String(session.id) : null);
    } else {
      sessionId =
        clientGuestId?.trim() ||
        createDto.sessionId?.trim() ||
        (session?.id ? String(session.id) : null);

      if (!sessionId) {
        sessionId = `gst_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
    }

    const eventType = (createDto.eventType || 'VIEW').trim().toUpperCase();
    const orderId = createDto.orderId ? String(createDto.orderId).trim() : null;

    // 3. Deduplication kỹ thuật
    // 3.1. Đối với VIEW / CLICK: bỏ qua nếu lặp lại trong vòng 2 giây
    if (eventType === 'VIEW' || eventType === 'CLICK') {
      const twoSecondsAgo = new Date(Date.now() - 2000);
      const recentDuplicate = await this.interactionModel
        .findOne({
          ...(userId ? { userId } : { sessionId }),
          productId: productObjectId,
          eventType,
          timestamp: { $gte: twoSecondsAgo },
        })
        .lean();

      if (recentDuplicate) {
        return {
          success: true,
          message: `Lượt ${eventType.toLowerCase()} vừa được ghi nhận (deduplicated)`,
          interactionId: recentDuplicate._id,
          eventType,
          isSynthetic: false,
        };
      }
    }

    // 3.2. Đối với PURCHASE: không ghi trùng đơn hàng cho cùng sản phẩm
    if (eventType === 'PURCHASE' && orderId) {
      const existingPurchase = await this.interactionModel
        .findOne({
          orderId,
          productId: productObjectId,
          eventType: 'PURCHASE',
        })
        .lean();

      if (existingPurchase) {
        return {
          success: true,
          message: 'Sự kiện mua hàng đã được ghi nhận trước đó (deduplicated)',
          interactionId: existingPurchase._id,
          eventType: 'PURCHASE',
          isSynthetic: false,
        };
      }
    }

    // 4. Tạo document tương tác THẬT (isSynthetic luôn là false, datasetType là 'real')
    // Không bao giờ cho phép client can thiệp hay lưu thông tin PII
    const cleanDoc = {
      userId,
      sessionId,
      productId: productObjectId,
      variantId: createDto.variantId ? String(createDto.variantId).trim() : null,
      orderId,
      eventType,
      timestamp: new Date(),
      isSynthetic: false,
      datasetType: 'real',
      metadata: {
        isSynthetic: false,
        source: 'web_client',
        userAgent: userAgent ? String(userAgent).substring(0, 150) : 'unknown',
      },
    };

    const created = await this.interactionModel.create(cleanDoc);

    return {
      success: true,
      message: `Ghi nhận sự kiện ${eventType} thành công`,
      interactionId: created._id,
      userId: created.userId,
      isGuest: !created.userId,
      productId: created.productId,
      eventType: created.eventType,
      isSynthetic: false,
      timestamp: created.timestamp,
    };
  }

  // Alias for backwards compatibility
  async recordView(
    createDto: CreateInteractionDto,
    user: User | null,
    session: any,
    clientGuestId?: string,
    userAgent?: string,
  ): Promise<any> {
    return this.recordInteraction(
      { ...createDto, eventType: createDto.eventType || 'VIEW' },
      user,
      session,
      clientGuestId,
      userAgent,
    );
  }
}
