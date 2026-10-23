import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductsService } from '../../products/products.service';
import { RecommendationsService } from '../../recommendations/recommendations.service';
import { ChatProductCard } from '../interfaces/chatbot-response.interface';
import { ProductVariantDocument } from '../../products/models/product-variant.model';

export interface ProductSearchFilter {
  queryText?: string;
  category?: 'đầm' | 'áo' | 'quần' | 'chân váy' | 'set' | string;
  minPrice?: number;
  maxPrice?: number;
  color?: string;
  size?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'relevance';
  onlyInStock?: boolean;
}

@Injectable()
export class ChatbotProductService {
  private readonly logger = new Logger(ChatbotProductService.name);

  // Color alias dictionary for robust bilingual & synonym normalization
  private readonly colorMap: Record<string, string[]> = {
    đỏ: ['đỏ', 'red', 'scarlet', 'crimson', 'ruby'],
    đen: ['đen', 'black'],
    trắng: ['trắng', 'white', 'ivory', 'kem'],
    be: ['be', 'beige'],
    hồng: ['hồng', 'pink', 'rose'],
    vàng: ['vàng', 'yellow', 'gold'],
    xanh: ['xanh', 'blue', 'navy', 'xanh navy', 'xanh dương', 'xanh lá', 'green'],
    xám: ['xám', 'ghi', 'grey', 'gray'],
    nâu: ['nâu', 'brown', 'caramel'],
    tím: ['tím', 'purple', 'violet', 'lavender'],
    cam: ['cam', 'orange'],
    'chấm bi': ['chấm bi', 'polka dot', 'polka'],
    'rằn ri': ['rằn ri', 'camo', 'camouflage'],
  };

  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('ProductVariant') private productVariantModel: Model<ProductVariantDocument>,
    @InjectModel('Interaction') private interactionModel: Model<any>,
    private productsService: ProductsService,
    private recommendationsService: RecommendationsService,
  ) {}

  /**
   * Search active, visible products with detailed criteria (category, color, size, price, stock)
   * Evaluates effectivePrice and sort order across the candidate pool before limiting.
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

    // 2. Strict category filtering based on MongoDB actual structure
    if (criteria.category) {
      const cat = criteria.category.toLowerCase().trim();

      if (cat === 'chân váy') {
        // Skirts only
        andClauses.push({
          $and: [
            {
              $or: [
                { 'vi.categoryLevel2': /chân váy/i },
                { 'variants.classification': /chân váy/i },
                { 'vi.title': /chân váy|skirt/i },
                { title: /chân váy|skirt/i },
              ],
            },
            { 'vi.categoryLevel2': { $nin: ['Áo nữ', 'Quần nữ', 'Set trang phục', 'Phụ kiện'] } },
          ],
        });
      } else if (cat === 'đầm' || cat === 'váy') {
        // Dresses only: exclude sets, corsets, standalone pants, and skirts
        andClauses.push({
          $and: [
            {
              $or: [
                { 'vi.categoryLevel2': 'Đầm & Váy' },
                { 'vi.categoryLevel2': /đầm & váy/i },
                { 'variants.classification': { $in: ['Đầm & Váy', 'Váy'] } },
                {
                  $and: [
                    { 'vi.categoryLevel2': 'Thời trang nữ' },
                    {
                      $or: [
                        { 'vi.title': /đầm|dress/i },
                        { title: /đầm|dress/i },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              'vi.categoryLevel2': {
                $nin: ['Set trang phục', 'Áo nữ', 'Quần nữ', 'Phụ kiện', 'Chân váy'],
              },
            },
            { 'vi.title': { $not: /^(set|áo corset|quần\b)/i } },
            { title: { $not: /^(set|áo corset|quần\b)/i } },
          ],
        });
      } else if (cat === 'quần') {
        // Pants / Jeans only
        andClauses.push({
          $and: [
            {
              $or: [
                { 'vi.categoryLevel2': 'Quần nữ' },
                { 'vi.categoryLevel2': /quần/i },
                { 'variants.classification': /quần/i },
                { 'vi.title': /quần|pant|jean/i },
                { title: /quần|pant|jean/i },
              ],
            },
            {
              'vi.categoryLevel2': {
                $nin: ['Đầm & Váy', 'Set trang phục', 'Áo nữ', 'Chân váy', 'Phụ kiện'],
              },
            },
          ],
        });
      } else if (cat === 'áo') {
        // Tops / Shirts only
        andClauses.push({
          $and: [
            {
              $or: [
                { 'vi.categoryLevel2': 'Áo nữ' },
                { 'vi.categoryLevel2': /áo nữ/i },
                { 'variants.classification': /áo/i },
                { 'vi.title': /\b(áo|top|corset|blazer|hoodie|sơ mi|croptop)\b/i },
                { title: /\b(áo|top|corset|blazer|hoodie|sơ mi|croptop)\b/i },
              ],
            },
            {
              'vi.categoryLevel2': {
                $nin: ['Đầm & Váy', 'Quần nữ', 'Chân váy', 'Phụ kiện'],
              },
            },
          ],
        });
      } else if (cat === 'set' || cat === 'set đồ' || cat === 'bộ') {
        // Sets / Outfits
        andClauses.push({
          $or: [
            { 'vi.categoryLevel2': /set trang phục/i },
            { 'variants.classification': /set trang phục|full set/i },
            { 'vi.title': /\b(set|bộ trang phục|bộ đồ)\b/i },
            { title: /\b(set|bộ trang phục|bộ đồ)\b/i },
          ],
        });
      }
    }

    // 3. Color filtering with alias expansion
    if (criteria.color) {
      const colorAliases = this.getColorAliases(criteria.color);
      const colorRegex = colorAliases.join('|');
      andClauses.push({
        $or: [
          { 'colors.name': { $regex: colorRegex, $options: 'i' } },
          { 'vi.colors.name': { $regex: colorRegex, $options: 'i' } },
          { 'attributes.colors.name': { $regex: colorRegex, $options: 'i' } },
          { 'variants.color': { $regex: colorRegex, $options: 'i' } },
          { title: { $regex: colorRegex, $options: 'i' } },
          { 'vi.title': { $regex: colorRegex, $options: 'i' } },
        ],
      });
    }

    // 4. Size filtering
    if (criteria.size) {
      const sizePattern = `^${criteria.size}$`;
      andClauses.push({
        $or: [
          { sizes: { $regex: sizePattern, $options: 'i' } },
          { 'vi.sizes': { $regex: sizePattern, $options: 'i' } },
          { 'attributes.sizes': { $regex: sizePattern, $options: 'i' } },
          { 'variants.size': { $regex: sizePattern, $options: 'i' } },
        ],
      });
    }

    try {
      // Fetch matching candidate set (up to 150 items to evaluate effectivePrice and sort properly)
      const sortObj: any = criteria.sortBy === 'newest'
        ? { createdAt: -1, dateAdded: -1 }
        : { createdAt: -1 };

      const rawProducts = await this.productModel
        .find({ $and: andClauses })
        .sort(sortObj)
        .limit(150)
        .lean();
      const candidateCards: ChatProductCard[] = [];

      for (const prod of rawProducts) {
        // Enforce visibility
        if (prod.visibility === false || prod.vi?.visibility === false) continue;

        const card = await this.buildVerifiedProductCard(prod, criteria.color, criteria.size);

        // Price filtering strictly on effectivePrice
        if (criteria.maxPrice !== undefined && card.price > criteria.maxPrice) {
          continue;
        }
        if (criteria.minPrice !== undefined && card.price < criteria.minPrice) {
          continue;
        }

        // Stock filtering
        if (criteria.onlyInStock !== false && !card.inStock) {
          continue;
        }

        candidateCards.push(card);
      }

      // Sort candidate cards across the ENTIRE matched dataset
      if (criteria.sortBy === 'price_asc') {
        candidateCards.sort((a, b) => a.price - b.price);
      } else if (criteria.sortBy === 'price_desc') {
        candidateCards.sort((a, b) => b.price - a.price);
      } else if (criteria.sortBy === 'newest') {
        // If cards already sorted by createdAt, maintain or sort by ID/date
      }

      return candidateCards.slice(0, limit);
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
          const colorAliases = color ? this.getColorAliases(color) : [];
          const colorRegex = colorAliases.length > 0 ? new RegExp(colorAliases.join('|'), 'i') : null;

          const matched = variants.find((v) => {
            const matchColor = !colorRegex || (v.color && colorRegex.test(v.color));
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
  getColorAliases(color: string): string[] {
    if (!color) return [];
    const lower = color.toLowerCase().trim();
    for (const [key, aliases] of Object.entries(this.colorMap)) {
      if (key === lower || aliases.includes(lower)) {
        return aliases;
      }
    }
    return [lower];
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

    // Strip "Sale " prefix from title if present
    const rawTitle = prod.vi?.title || prod.title || '';
    const cleanTitle = rawTitle.replace(/^Sale\s+/i, '').trim();

    return {
      id: prod._id ? prod._id.toString() : '',
      title: cleanTitle,
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
   * Parse multi-criteria search filters from user query with conversation context awareness
   */
  parseCriteriaFromText(text: string, context?: any): ProductSearchFilter {
    const lower = (text || '').toLowerCase().trim();
    const criteria: ProductSearchFilter = { queryText: text, onlyInStock: true };

    // 1. Sort order parsing: rẻ nhất, giá thấp nhất, đắt nhất, mới nhất
    if (/(?:rẻ nhất|giá rẻ nhất|giá thấp nhất|giá rẻ|thấp nhất|rẻ)/i.test(lower)) {
      criteria.sortBy = 'price_asc';
    } else if (/(?:đắt nhất|cao nhất|giá cao nhất)/i.test(lower)) {
      criteria.sortBy = 'price_desc';
    } else if (/(?:mới nhất|mới về|hàng mới|sản phẩm mới)/i.test(lower)) {
      criteria.sortBy = 'newest';
    }

    // Helper: Parse currency string like "500k", "1tr", "1.5 triệu", "1tr5", "800.000"
    const parseAmount = (str: string): number | null => {
      if (!str) return null;
      const s = str.trim().toLowerCase();
      // "1tr5" or "1 triệu 5"
      const trSplit = s.match(/^(\d+)\s*(?:tr|triệu)\s*(\d+)$/);
      if (trSplit) {
        return parseInt(trSplit[1], 10) * 1000000 + parseInt(trSplit[2], 10) * 100000;
      }
      // "1.5tr", "1,5 triệu"
      const trDecimal = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu)$/);
      if (trDecimal) {
        return Math.round(parseFloat(trDecimal[1].replace(',', '.')) * 1000000);
      }
      // "500k", "500 nghìn", "500 ngàn"
      const kMatch = s.match(/^(\d+)\s*(?:k|nghìn|ngàn)$/);
      if (kMatch) {
        return parseInt(kMatch[1], 10) * 1000;
      }
      // "500.000", "1.000.000"
      const dotNumber = s.match(/^(\d{1,3}(?:\.\d{3})+)$/);
      if (dotNumber) {
        return parseInt(dotNumber[1].replace(/\./g, ''), 10);
      }
      // raw number like "500000"
      const rawNum = s.match(/^(\d{5,8})$/);
      if (rawNum) {
        return parseInt(rawNum[1], 10);
      }
      return null;
    };

    // 2. Price range parsing: "từ 500k đến 1 triệu", "500k - 1tr", "khoảng 500k đến 1 triệu"
    const rangeMatch =
      lower.match(/(?:từ|khoảng)\s*([0-9.,k\snghìngàntriệutr]+?)\s*(?:đến|tới|-)\s*([0-9.,k\snghìngàntriệutr]+)/i) ||
      lower.match(/(\d+\s*(?:k|nghìn|ngàn|tr|triệu))\s*-\s*(\d+\s*(?:k|nghìn|ngàn|tr|triệu))/i);

    if (rangeMatch) {
      const minVal = parseAmount(rangeMatch[1]);
      const maxVal = parseAmount(rangeMatch[2]);
      if (minVal !== null) criteria.minPrice = minVal;
      if (maxVal !== null) criteria.maxPrice = maxVal;
    } else {
      // Upper bound price parsing: "dưới 500k", "tối đa 1 triệu", "không quá 1tr", "<= 1tr", "< 800.000"
      const underMatch = lower.match(
        /(?:dưới|tối đa|không quá|<=|<)\s*([0-9.,]+(?:\s*(?:k|nghìn|ngàn|triệu|tr))?|\d{1,3}(?:\.\d{3})+)/i,
      );
      if (underMatch) {
        const parsed = parseAmount(underMatch[1]);
        if (parsed !== null) criteria.maxPrice = parsed;
      }

      // Lower bound price parsing: "trên 500k", "tối thiểu 500k", "từ 500k trở lên"
      const aboveMatch = lower.match(
        /(?:trên|tối thiểu|từ|>=|>)\s*([0-9.,]+(?:\s*(?:k|nghìn|ngàn|triệu|tr))?|\d{1,3}(?:\.\d{3})+)(?:\s*(?:trở lên))?/i,
      );
      if (aboveMatch && !rangeMatch) {
        const parsed = parseAmount(aboveMatch[1]);
        if (parsed !== null) criteria.minPrice = parsed;
      }
    }

    // 3. Color extraction with alias dictionary and Unicode word boundaries
    for (const [normColor, aliases] of Object.entries(this.colorMap)) {
      for (const alias of aliases) {
        if (new RegExp(`(?<!\\p{L})${alias}(?!\\p{L})`, 'iu').test(lower)) {
          criteria.color = normColor;
          break;
        }
      }
      if (criteria.color) break;
    }

    // 4. Size extraction with Unicode word boundaries
    const sizeMatch =
      lower.match(/(?:size|cỡ)\s*([sml]|xl|xxl)(?!\p{L})/iu) ||
      lower.match(/(?<!\p{L})(xl|xxl)(?!\p{L})/iu) ||
      lower.match(/(?<=\s)([sml])(?=\s*(?:còn|hết|ko|không|\?|$))/iu);

    if (sizeMatch) {
      const s = sizeMatch[1].replace(/size\s*/i, '').toUpperCase();
      if (['S', 'M', 'L', 'XL', 'XXL'].includes(s)) {
        criteria.size = s;
      }
    }

    // 5. Garment category extraction (Order of precedence: Chân váy -> Set -> Quần -> Áo -> Đầm/Váy)
    if (lower.includes('chân váy') || lower.includes('skirt')) {
      criteria.category = 'chân váy';
    } else if (lower.includes('set') || lower.includes('bộ')) {
      criteria.category = 'set';
    } else if (/(?:quần|jeans|jean|bottom|trousers|pants)\b/i.test(lower)) {
      criteria.category = 'quần';
    } else if (/(?:áo|croptop|top|corset|blazer|sơ mi|hoodie)\b/i.test(lower)) {
      criteria.category = 'áo';
    } else if (lower.includes('đầm') || lower.includes('váy') || lower.includes('dress')) {
      criteria.category = 'đầm';
    } else if (context?.currentCategory) {
      // Inherit context category if user asks follow-up (e.g. "Có mẫu nào dưới 1 triệu không?")
      criteria.category = context.currentCategory;
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
