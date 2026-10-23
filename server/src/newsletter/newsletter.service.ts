import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QuerySubscribersDto } from './dto/query-subscribers.dto';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectModel('NewsletterSubscriber')
    private readonly subscriberModel: Model<any>,
    @InjectModel('User')
    private readonly userModel: Model<any>,
  ) {}

  async subscribe(email: string, source: string = 'FOOTER') {
    if (!email) {
      throw new BadRequestException('Vui lòng cung cấp địa chỉ email');
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new BadRequestException('Định dạng email không hợp lệ');
    }

    const existing = await this.subscriberModel.findOne({ email: normalizedEmail });

    if (existing) {
      if (existing.status === 'SUBSCRIBED') {
        return {
          success: true,
          message: 'Email này đã được đăng ký nhận ưu đãi trước đó.',
          data: {
            id: existing._id,
            email: existing.email,
            status: existing.status,
            subscribedAt: existing.subscribedAt,
          },
        };
      }

      // Từng hủy đăng ký -> kích hoạt lại
      existing.status = 'SUBSCRIBED';
      existing.subscribedAt = new Date();
      if (source) existing.source = source;
      await existing.save();

      return {
        success: true,
        message: 'Chào mừng bạn quay lại! Đăng ký nhận ưu đãi thành công.',
        data: {
          id: existing._id,
          email: existing.email,
          status: existing.status,
          subscribedAt: existing.subscribedAt,
        },
      };
    }

    const created = await this.subscriberModel.create({
      email: normalizedEmail,
      status: 'SUBSCRIBED',
      source: source || 'FOOTER',
      subscribedAt: new Date(),
    });

    return {
      success: true,
      message: 'Đăng ký nhận ưu đãi thành công!',
      data: {
        id: created._id,
        email: created.email,
        status: created.status,
        subscribedAt: created.subscribedAt,
      },
    };
  }

  async getAdminSubscribers(query: QuerySubscribersDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const pipeline: any[] = [];

    // Lookup người dùng từ collection `users` theo email
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'email',
        foreignField: 'email',
        as: 'userMatch',
      },
    });

    pipeline.push({
      $addFields: {
        matchedUser: { $arrayElemAt: ['$userMatch', 0] },
      },
    });

    // Lọc theo trạng thái
    const matchConditions: any = {};
    if (query.status && query.status.trim() && query.status.toUpperCase() !== 'ALL') {
      matchConditions.status = query.status.trim().toUpperCase();
    }

    // Tìm kiếm không phân biệt chữ hoa thường theo email hoặc tên tài khoản
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      matchConditions.$or = [
        { email: searchRegex },
        { 'matchedUser.name': searchRegex },
        { 'matchedUser.fullName': searchRegex },
      ];
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Sắp xếp
    const sortBy = query.sortBy || 'subscribedAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sortStage: any = {};
    sortStage[sortBy] = sortDir;

    // Phân trang và project kết quả
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [
          { $sort: sortStage },
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              id: '$_id',
              email: 1,
              status: 1,
              source: 1,
              subscribedAt: 1,
              createdAt: 1,
              updatedAt: 1,
              customer: {
                isGuest: { $eq: [{ $size: '$userMatch' }, 0] },
                avatar: { $ifNull: ['$matchedUser.avatar', null] },
                name: {
                  $cond: {
                    if: { $eq: [{ $size: '$userMatch' }, 0] },
                    then: 'Khách vãng lai',
                    else: {
                      $cond: {
                        if: {
                          $gt: [
                            { $strLenCP: { $ifNull: ['$matchedUser.name', ''] } },
                            0,
                          ],
                        },
                        then: '$matchedUser.name',
                        else: {
                          $cond: {
                            if: {
                              $gt: [
                                {
                                  $strLenCP: {
                                    $ifNull: ['$matchedUser.fullName', ''],
                                  },
                                },
                                0,
                              ],
                            },
                            then: '$matchedUser.fullName',
                            else: 'Thành viên Chéri',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });

    const result = await this.subscriberModel.aggregate(pipeline).exec();
    const total = result[0]?.metadata[0]?.total || 0;
    const items = result[0]?.data || [];

    return {
      success: true,
      data: items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async updateStatus(id: string, status: 'SUBSCRIBED' | 'UNSUBSCRIBED') {
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID người đăng ký không hợp lệ');
    }

    if (!['SUBSCRIBED', 'UNSUBSCRIBED'].includes(status)) {
      throw new BadRequestException(
        'Trạng thái không hợp lệ. Chỉ chấp nhận SUBSCRIBED hoặc UNSUBSCRIBED',
      );
    }

    const subscriber = await this.subscriberModel.findById(id).exec();
    if (!subscriber) {
      throw new NotFoundException('Không tìm thấy người đăng ký nhận ưu đãi');
    }

    subscriber.status = status;
    await subscriber.save();

    return {
      success: true,
      message: 'Cập nhật trạng thái thành công!',
      data: {
        id: subscriber._id,
        _id: subscriber._id,
        email: subscriber.email,
        status: subscriber.status,
        subscribedAt: subscriber.subscribedAt,
        updatedAt: subscriber.updatedAt,
      },
    };
  }

  async exportSubscribers(query: QuerySubscribersDto) {
    const pipeline: any[] = [];

    // Lookup người dùng từ collection `users` theo email
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'email',
        foreignField: 'email',
        as: 'userMatch',
      },
    });

    pipeline.push({
      $addFields: {
        matchedUser: { $arrayElemAt: ['$userMatch', 0] },
      },
    });

    // Lọc theo trạng thái
    const matchConditions: any = {};
    if (query.status && query.status.trim() && query.status.toUpperCase() !== 'ALL') {
      matchConditions.status = query.status.trim().toUpperCase();
    }

    // Tìm kiếm không phân biệt chữ hoa thường theo email hoặc tên tài khoản
    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(query.search.trim(), 'i');
      matchConditions.$or = [
        { email: searchRegex },
        { 'matchedUser.name': searchRegex },
        { 'matchedUser.fullName': searchRegex },
      ];
    }

    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Sắp xếp
    const sortBy = query.sortBy || 'subscribedAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;
    const sortStage: any = {};
    sortStage[sortBy] = sortDir;
    pipeline.push({ $sort: sortStage });

    // Project kết quả đầy đủ không bị giới hạn trang
    pipeline.push({
      $project: {
        _id: 1,
        id: '$_id',
        email: 1,
        status: 1,
        source: 1,
        subscribedAt: 1,
        createdAt: 1,
        updatedAt: 1,
        customer: {
          isGuest: { $eq: [{ $size: '$userMatch' }, 0] },
          avatar: { $ifNull: ['$matchedUser.avatar', null] },
          name: {
            $cond: {
              if: { $eq: [{ $size: '$userMatch' }, 0] },
              then: 'Khách vãng lai',
              else: {
                $cond: {
                  if: {
                    $gt: [
                      { $strLenCP: { $ifNull: ['$matchedUser.name', ''] } },
                      0,
                    ],
                  },
                  then: '$matchedUser.name',
                  else: {
                    $cond: {
                      if: {
                        $gt: [
                          {
                            $strLenCP: {
                              $ifNull: ['$matchedUser.fullName', ''],
                            },
                          },
                          0,
                        ],
                      },
                      then: '$matchedUser.fullName',
                      else: 'Thành viên Chéri',
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Giới hạn an toàn tối đa 50,000 bản ghi
    pipeline.push({ $limit: 50000 });

    const items = await this.subscriberModel.aggregate(pipeline).exec();

    return {
      success: true,
      data: items,
      total: items.length,
    };
  }
}
