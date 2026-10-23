import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsService } from '../../products/products.service';
import { RecommendationsService } from '../../recommendations/recommendations.service';
import { ChatProductCard } from '../interfaces/chatbot-response.interface';
import { ProductVariantDocument } from '../../products/models/product-variant.model';

export interface ProductSearchFilter {
  queryText?: string;
  maxPrice?: number;
  minPrice?: number;
  color?: string;
  size?: string;
  category?: string;
  onlyInStock?: boolean;
}

@Injectable()
export class ChatbotProductService {
  private readonly logger = new Logger(ChatbotProductService.name);

  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('ProductVariant') private productVariantModel: Model<ProductVariantDocument>,
    @InjectModel('Interaction') private interactionModel: Model<any>,
    private productsService: ProductsService,
    private recommendationsService: RecommendationsService,
  ) {}

  /**
   * Search active, visible products with detailed criteria (color, size, price, stock)
   */
  async searchProductsWithCriteria(
    criteria: ProductSearchFilter,
    limit = 4,
  ): Promise<ChatProductCard[]> {
    // 1. Mandatory base visibility filter: Only show visible products (root and vi locale)
    const andClauses: any[] = [
      { visibility: { $ne: false } },
      { 'vi.visibility': { $ne: false } },
    ];

    // 2. Keyword & category filtering (searching root, vi locale, descriptions, tags)
    const keywords = this.extractKeywords(criteria.queryText || '');
    if (keywords.length > 0) {
      const keywordRegex = keywords.join('|');
      andClauses.push({
        $or: [
          { title: { $regex: keywordRegex, $options: 'i' } },
          { 'vi.title': { $regex: keywordRegex, $options: 'i' } },
          { description: { $regex: keywordRegex, $options: 'i' } },
          { 'vi.description': { $regex: keywordRegex, $options: 'i' } },
          { descriptionFull: { $regex: keywordRegex, $options: 'i' } },
          { 'vi.descriptionFull': { $regex: keywordRegex, $options: 'i' } },
          { tags: { $in: keywords.map((k) => new RegExp(k, 'i')) } },
          { categoryLevel1: { $in: keywords.map((k) => new RegExp(k, 'i')) } },
          { 'vi.categoryLevel1': { $in: keywords.map((k) => new RegExp(k, 'i')) } },
          { 'vi.categoryLevel2': { $in: keywords.map((k) => new RegExp(k, 'i')) } },
        ],
      });
    }

    // 3. Garment category filter
    if (criteria.category) {
      andClauses.push({
        $or: [
          { title: { $regex: criteria.category, $options: 'i' } },
          { 'vi.title': { $regex: criteria.category, $options: 'i' } },
          { categoryLevel1: { $regex: criteria.category, $options: 'i' } },
          { 'vi.categoryLevel1': { $regex: criteria.category, $options: 'i' } },
          { 'vi.categoryLevel2': { $regex: criteria.category, $options: 'i' } },
          { 'vi.classifications': { $regex: criteria.category, $options: 'i' } },
          { tags: { $regex: criteria.category, $options: 'i' } },
        ],
      });
    }

    // 4. Color filter
    if (criteria.color) {
      andClauses.push({
        $or: [
          { 'colors.name': { $regex: criteria.color, $options: 'i' } },
          { 'vi.colors.name': { $regex: criteria.color, $options: 'i' } },
          { 'attributes.colors.name': { $regex: criteria.color, $options: 'i' } },
          { 'variants.color': { $regex: criteria.color, $options: 'i' } },
          { title: { $regex: criteria.color, $options: 'i' } },
          { 'vi.title': { $regex: criteria.color, $options: 'i' } },
        ],
      });
    }

    // 5. Size filter
    if (criteria.size) {
      andClauses.push({
        $or: [
          { sizes: { $regex: `^${criteria.size}$`, $options: 'i' } },
          { 'vi.sizes': { $regex: `^${criteria.size}$`, $options: 'i' } },
          { 'attributes.sizes': { $regex: `^${criteria.size}$`, $options: 'i' } },
          { 'variants.size': { $regex: `^${criteria.size}$`, $options: 'i' } },
        ],
      });
    }

    try {
      const rawProducts = await this.productModel
        .find({ $and: andClauses })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const cards: ChatProductCard[] = [];

      for (const prod of rawProducts) {
        const card = await this.buildVerifiedProductCard(prod, criteria.color, criteria.size);

        // Price filtering strictly on effective price from DB
        if (criteria.maxPrice && card.price > criteria.maxPrice) {
          continue;
        }
        if (criteria.minPrice && card.price < criteria.minPrice) {
          continue;
        }

        // Stock filtering
        if (criteria.onlyInStock !== false && !card.inStock) {
          continue;
        }

        cards.push(card);
        if (cards.length >= limit) break;
      }

      return cards;
    } catch (err) {
      this.logger.error(`Error searching products with criteria: ${err.message}`, err.stack);
      return [];
    }
  }

  /**
   * Quick search compatibility wrapper
   */
  async searchProducts(queryText: string, limit = 4): Promise<ChatProductCard[]> {
    const parsed = this.parseCriteriaFromText(queryText);
    return this.searchProductsWithCriteria(parsed, limit);
  }

  /**
   * Check stock for a specific product and optional variant (color & size)
   */
  async checkProductStock(
    productId: string,
    color?: string,
    size?: string,
  ): Promise<{
    inStock: boolean;
    availableStock: number;
    specificVariantFound: boolean;
    availableColors: string[];
    availableSizes: string[];
  }> {
    try {
      const product: any = await this.productModel.findById(productId).lean();
      if (!product || product.visibility === false || product.vi?.visibility === false) {
        return {
          inStock: false,
          availableStock: 0,
          specificVariantFound: false,
          availableColors: [],
          availableSizes: [],
        };
      }

      // Check embedded variants first, or collection variants
      let variants: any[] = Array.isArray(product.variants) && product.variants.length > 0 ? product.variants : [];

      if (variants.length === 0 && this.productVariantModel && typeof this.productVariantModel.find === 'function') {
        const query: any = { isActive: { $ne: false } };
        if (Types.ObjectId.isValid(productId) && productId.length === 24) {
          query.productId = new Types.ObjectId(productId);
        } else {
          query.productId = productId;
        }
        variants = await this.productVariantModel.find(query).lean();
      }

      if (variants && variants.length > 0) {
        const availableVariants = variants.filter((v) => (v.stock || 0) > 0);
        const availableColors = Array.from(new Set(availableVariants.map((v) => v.color).filter(Boolean))) as string[];
        const availableSizes = Array.from(new Set(availableVariants.map((v) => v.size).filter(Boolean))) as string[];

        // If specific color and/or size requested, check that specific variant
        if (color || size) {
          const matched = variants.find((v) => {
            const matchColor = !color || (v.color && new RegExp(color, 'i').test(v.color));
            const matchSize = !size || (v.size && new RegExp(`^${size}$`, 'i').test(v.size));
            return matchColor && matchSize;
          });

          if (matched) {
            const stock = matched.stock || 0;
            return {
              inStock: stock > 0,
              availableStock: stock,
              specificVariantFound: true,
              availableColors,
              availableSizes,
            };
          } else {
            // Specific variant not found
            return {
              inStock: false,
              availableStock: 0,
              specificVariantFound: false,
              availableColors,
              availableSizes,
            };
          }
        }

        // No specific variant requested: sum available stock
        const totalStock = availableVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
        return {
          inStock: totalStock > 0,
          availableStock: totalStock,
          specificVariantFound: false,
          availableColors,
          availableSizes,
        };
      }

      // Single product without variants -> check quantity at root or in vi locale
      const singleStock = product.vi?.quantity ?? product.quantity ?? 0;
      const rawColors = product.vi?.colors || product.attributes?.colors || product.colors || [];
      const rawSizes = product.vi?.sizes || product.attributes?.sizes || product.sizes || [];

      return {
        inStock: singleStock > 0,
        availableStock: singleStock,
        specificVariantFound: false,
        availableColors: rawColors.map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean),
        availableSizes: rawSizes.map((s: any) => String(s)).filter(Boolean),
      };
    } catch (err) {
      this.logger.error(`Error checking product stock: ${err.message}`);
      return {
        inStock: false,
        availableStock: 0,
        specificVariantFound: false,
        availableColors: [],
        availableSizes: [],
      };
    }
  }

  /**
   * Find products for side-by-side comparison using real database attributes
   */
  async findProductsForComparison(message: string, candidateIds?: string[]): Promise<any[]> {
    try {
      let products: any[] = [];

      // If explicit candidate IDs are provided from session
      if (candidateIds && candidateIds.length >= 2) {
        const validOids = candidateIds
          .filter((id) => Types.ObjectId.isValid(id) && String(id).length === 24)
          .map((id) => new Types.ObjectId(id));
        const stringIds = candidateIds.filter((id) => typeof id === 'string');

        products = await this.productModel
          .find({
            _id: { $in: [...validOids, ...stringIds] },
            visibility: { $ne: false },
          })
          .lean();
      }

      if (products.length < 2) {
        // Query candidates by title/slug matching in message
        const allCandidates = await this.productModel
          .find({ visibility: { $ne: false }, 'vi.visibility': { $ne: false } })
          .sort({ createdAt: -1 })
          .limit(15)
          .lean();

        const lower = message.toLowerCase();
        const matched = allCandidates.filter((p) => {
          const title = (p.vi?.title || p.title || '').toLowerCase();
          const slug = (p.titleUrl || '').toLowerCase();
          const words = title.split(' ').filter((w: string) => w.length > 3);
          return (slug && lower.includes(slug)) || words.some((w: string) => lower.includes(w));
        });

        products = matched.length >= 2 ? matched.slice(0, 3) : allCandidates.slice(0, 2);
      }

      return products;
    } catch (err) {
      this.logger.error(`Error finding products for comparison: ${err.message}`);
      return [];
    }
  }

  /**
   * Get recommendations:
   * 1. Never use isSynthetic: true interactions
   * 2. Exclude hidden products
   * 3. Do not count VIEW as PURCHASE
   */
  async getRecommendations(user?: any, guestCartId?: string, limit = 4): Promise<ChatProductCard[]> {
    try {
      let rawProducts: any[] = [];

      // If user is logged in, try personalized recommendation
      if (user && user._id) {
        try {
          const recResult = await this.recommendationsService.getRecommendations(
            { limit } as any,
            user,
          );
          if (recResult && recResult.products && recResult.products.length > 0) {
            rawProducts = recResult.products;
          }
        } catch (e) {
          this.logger.debug(`Personalized rec fallback: ${e.message}`);
        }
      }

      // If no personalized items, get verified popular products excluding synthetic data
      if (rawProducts.length === 0) {
        try {
          // Aggregate real purchases from user_interactions where isSynthetic: false
          const realPopular = await this.interactionModel.aggregate([
            {
              $match: {
                eventType: 'PURCHASE',
                isSynthetic: { $ne: true },
              },
            },
            {
              $group: {
                _id: '$productId',
                purchaseCount: { $sum: 1 },
              },
            },
            { $sort: { purchaseCount: -1 } },
            { $limit: limit },
          ]);

          if (realPopular.length > 0) {
            const productIds = realPopular.map((item) => item._id);
            rawProducts = await this.productModel
              .find({ _id: { $in: productIds }, visibility: { $ne: false } })
              .lean();
          }
        } catch {
          // ignore aggregation error
        }
      }

      // Fallback: active visible products
      if (rawProducts.length === 0) {
        rawProducts = await this.productModel
          .find({ visibility: { $ne: false }, 'vi.visibility': { $ne: false } })
          .sort({ createdAt: -1 })
          .limit(limit * 2)
          .lean();
      }

      const cards: ChatProductCard[] = [];
      for (const prod of rawProducts) {
        // Enforce visibility
        if (prod.visibility === false || prod.vi?.visibility === false) continue;
        const card = await this.buildVerifiedProductCard(prod);
        if (card.inStock) {
          cards.push(card);
        }
        if (cards.length >= limit) break;
      }

      return cards;
    } catch (err) {
      this.logger.error(`Error getting recommendations: ${err.message}`);
      return [];
    }
  }

  /**
   * Build server-verified ChatProductCard from Product document
   */
  async buildVerifiedProductCard(
    prod: any,
    targetColor?: string,
    targetSize?: string,
  ): Promise<ChatProductCard> {
    const rawImage =
      prod.mainImage?.url ||
      (prod.images && prod.images.length > 0
        ? typeof prod.images[0] === 'string'
          ? prod.images[0]
          : prod.images[0].url || ''
        : '');

    // Accurate price calculation from vi locale or root:
    const isOnSale = Boolean(prod.vi?.onSale ?? prod.onSale ?? false);
    const regularPrice = Number(prod.vi?.regularPrice ?? prod.regularPrice ?? 0);
    const salePrice = Number(prod.vi?.salePrice ?? prod.salePrice ?? 0);

    const effectivePrice = isOnSale && salePrice > 0 ? salePrice : regularPrice;
    const originalPrice = isOnSale && salePrice > 0 ? regularPrice : undefined;

    // Check inventory from embedded variants or ProductVariant collection
    const stockInfo = await this.checkProductStock(prod._id.toString(), targetColor, targetSize);

    const rawColors = prod.vi?.colors || prod.attributes?.colors || prod.colors || [];
    const colors = rawColors.map((c: any) => (typeof c === 'string' ? c : c?.name || '')).filter(Boolean);

    const rawSizes = prod.vi?.sizes || prod.attributes?.sizes || prod.sizes || [];
    const sizes = rawSizes.map((s: any) => String(s)).filter(Boolean);

    const categoryText = Array.isArray(prod.categoryLevel1)
      ? prod.categoryLevel1.join(', ')
      : prod.vi?.categoryLevel2 || prod.vi?.categoryLevel1 || prod.categoryLevel1 || '';

    return {
      id: prod._id ? prod._id.toString() : '',
      title: prod.vi?.title || prod.title || '',
      titleUrl: prod.titleUrl || '',
      price: effectivePrice,
      originalPrice,
      onSale: isOnSale && salePrice > 0,
      imageUrl: rawImage,
      category: categoryText,
      colors,
      sizes,
      availableColors: stockInfo.availableColors.length > 0 ? stockInfo.availableColors : colors,
      availableSizes: stockInfo.availableSizes.length > 0 ? stockInfo.availableSizes : sizes,
      inStock: stockInfo.inStock,
      stockSummary: stockInfo.inStock ? `Còn ${stockInfo.availableStock} sản phẩm` : 'Tạm hết hàng',
    };
  }

  /**
   * Parse multi-criteria search filters from user query
   */
  parseCriteriaFromText(text: string): ProductSearchFilter {
    const lower = (text || '').toLowerCase();
    const criteria: ProductSearchFilter = { queryText: text, onlyInStock: true };

    // 1. Price extraction: "dưới 500k", "dưới 1 triệu", "< 800.000", "tầm 1tr"
    const underKMatch = lower.match(/dưới\s*(\d+)\s*(?:k|nghìn|ngàn)/i);
    const underTrieuMatch = lower.match(/dưới\s*(\d+(?:\.\d+)?)\s*(?:triệu|tr)/i);
    const underNumberMatch = lower.match(/(?:dưới|<)\s*(\d{1,3}(?:\.\d{3})+)/i);

    if (underKMatch) {
      criteria.maxPrice = parseInt(underKMatch[1], 10) * 1000;
    } else if (underTrieuMatch) {
      criteria.maxPrice = parseFloat(underTrieuMatch[1]) * 1000000;
    } else if (underNumberMatch) {
      criteria.maxPrice = parseInt(underNumberMatch[1].replace(/\./g, ''), 10);
    }

    // 2. Color extraction
    const colorsList = ['đen', 'trắng', 'đỏ', 'hồng', 'be', 'vàng', 'xanh', 'nâu', 'tím', 'cam', 'chấm bi'];
    for (const c of colorsList) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(lower)) {
        criteria.color = c;
        break;
      }
    }

    // 3. Size extraction
    const sizeMatch = lower.match(/\b(?:size|cỡ)\s*([sml]|xl|xxl)\b/i) || lower.match(/\b([sml]|xl|xxl)\b/i);
    if (sizeMatch) {
      criteria.size = sizeMatch[1].toUpperCase();
    }

    // 4. Garment category extraction
    if (lower.includes('đầm') || lower.includes('váy')) {
      criteria.category = 'đầm';
    } else if (lower.includes('áo')) {
      criteria.category = 'áo';
    } else if (lower.includes('chân váy')) {
      criteria.category = 'chân váy';
    } else if (lower.includes('set') || lower.includes('bộ')) {
      criteria.category = 'set';
    }

    return criteria;
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'cho', 'mình', 'em', 'tôi', 'bạn', 'có', 'không', 'những', 'các', 'mẫu',
      'nào', 'với', 'giúp', 'tìm', 'xem', 'hỏi', 'shop', 'chéri', 'ơi', 'ạ',
      'dưới', 'size', 'màu', 'giá', 'khoảng', 'tầm', 'còn', 'hàng',
    ]);
    return (text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !stopWords.has(w));
  }

  async getProductById(productId: string): Promise<any> {
    try {
      if (!productId || typeof this.productModel?.findById !== 'function') return null;
      if (!Types.ObjectId.isValid(productId) && productId.length !== 24) return null;
      return await this.productModel.findById(productId).lean();
    } catch {
      return null;
    }
  }
}
