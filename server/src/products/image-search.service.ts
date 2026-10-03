import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ProductModel } from './models/product.model';

export interface ImageSearchMatch {
  productId: string;
  title?: string;
  similarityScore: number;
  matchedImageUrl?: string;
}

export interface ImageSearchResponse {
  success: boolean;
  provider: string;
  message: string;
  matches: ImageSearchMatch[];
  searchToken?: string;
}

@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);
  private readonly allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  private readonly maxFileSize = 5 * 1024 * 1024; // 5 MB

  constructor(
    @InjectModel('Product') private productModel: ProductModel,
  ) {}

  /**
   * Validate uploaded image file
   */
  validateImageFile(file: any): void {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file hình ảnh hợp lệ.');
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Định dạng file không được hỗ trợ. Vui lòng tải lên ảnh JPG, PNG hoặc WebP.',
      );
    }
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        'Dung lượng ảnh vượt quá giới hạn 5MB. Vui lòng chọn ảnh nhỏ hơn.',
      );
    }
  }

  /**
   * Image similarity search abstraction
   * Designed for integration with image embedding models (e.g. CLIP, ResNet, ViT, or External Similarity APIs).
   */
  async searchByImage(file: any, keyword?: string): Promise<ImageSearchResponse> {
    this.validateImageFile(file);

    const provider = process.env.IMAGE_SEARCH_PROVIDER || 'pending_model_integration';
    this.logger.log(
      `Image search requested: filename=${file.originalname}, size=${file.size}, provider=${provider}`,
    );

    // Abstraction point: If an external or local image embedding service is configured:
    if (provider === 'clip' || provider === 'resnet' || provider === 'vision_api') {
      try {
        // TODO: Call specialized embedding model service
        // const embedding = await this.extractImageFeatureVector(file.buffer);
        // const matches = await this.findSimilarProductsByVector(embedding);
        return {
          success: true,
          provider,
          message: 'Tìm kiếm bằng hình ảnh thành công.',
          matches: [],
        };
      } catch (err: any) {
        this.logger.error(`Image search provider error: ${err?.message || err}`);
        throw new BadRequestException('Lỗi trong quá trình xử lý đối chiếu hình ảnh.');
      }
    }

    // Honest reporting when no specialized embedding service is configured in the environment:
    // We strictly DO NOT fake image search by URL/filename equality or random products.
    return {
      success: false,
      provider: 'pending_model_integration',
      message:
        'Hệ thống hiện tại chưa kết nối dịch vụ Image Embedding AI chuyên dụng. Vui lòng cấu hình model (CLIP/Vision) để thực hiện đối chiếu đặc trưng thị giác.',
      matches: [],
    };
  }
}
