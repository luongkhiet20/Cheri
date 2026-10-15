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

  async recordView(
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

    // 3. Deduplication kỹ thuật: Bỏ qua nếu có lượt xem trùng trong vòng 2 giây
    const twoSecondsAgo = new Date(Date.now() - 2000);
    const recentDuplicate = await this.interactionModel.findOne({
      ...(userId ? { userId } : { sessionId }),
      productId: productObjectId,
      eventType: 'VIEW',
      timestamp: { $gte: twoSecondsAgo },
    }).lean();

    if (recentDuplicate) {
      return {
        success: true,
        message: 'Lượt xem vừa được ghi nhận (deduplicated)',
        interactionId: recentDuplicate._id,
        isSynthetic: false,
      };
    }

    // 4. Tạo document tương tác THẬT (isSynthetic luôn là false)
    // Tuyệt đối không lưu email, SĐT, địa chỉ hay thông tin PII
    const cleanDoc = {
      userId,
      sessionId,
      productId: productObjectId,
      variantId: createDto.variantId ? String(createDto.variantId).trim() : null,
      eventType: 'VIEW',
      timestamp: new Date(),
      isSynthetic: false,
      metadata: {
        isSynthetic: false,
        source: 'web_client',
        userAgent: userAgent ? String(userAgent).substring(0, 150) : 'unknown',
      },
    };

    const created = await this.interactionModel.create(cleanDoc);

    return {
      success: true,
      message: 'Ghi nhận lượt xem thành công',
      interactionId: created._id,
      userId: created.userId,
      isGuest: !created.userId,
      productId: created.productId,
      isSynthetic: false,
      timestamp: created.timestamp,
    };
  }
}
