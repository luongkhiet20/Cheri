import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { Product, ProductModel } from '../products/models/product.model';
import { ProductVariantDocument } from '../products/models/product-variant.model';
import { prepareProduct } from '../shared/utils/prepareUtils';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';

export interface RecommendationResponse {
  status: 'success' | 'fallback' | 'error';
  strategy: 'ml_model' | 'ml_bootstrap_model' | 'fallback_category' | 'fallback_popularity';
  modelUsed: string;
  isMachineLearning: boolean;
  dataSource?: string;
  currentProductId?: string;
  count: number;
  products: Product[];
}

interface PythonCLIResult {
  status: string;
  strategy: 'ml_model' | 'ml_bootstrap_model' | 'fallback_category' | 'fallback_popularity';
  model_used: string;
  is_bootstrap?: boolean;
  data_source?: string;
  current_product_id?: string;
  count: number;
  recommendations: Array<{
    product_id: string;
    title?: string;
    category?: string;
    score?: number;
    reason?: string;
  }>;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectModel('Product') private productModel: ProductModel,
    @InjectModel('ProductVariant')
    private productVariantModel: Model<ProductVariantDocument>,
  ) {}

  /**
   * Main recommendation entrypoint:
   * 1. Resolves clean input and target user/product.
   * 2. Attempts Python ML inference if Python environment is available.
   * 3. Falls back seamlessly to Native MongoDB algorithms if Python fails or is absent.
   * 4. Hydrates and validates all items from MongoDB to guarantee data freshness and visibility.
   */
  async getRecommendations(
    dto: GetRecommendationsDto,
    user?: any,
    guestCartId?: string,
  ): Promise<RecommendationResponse> {
    const limit = Math.min(Math.max(Number(dto.limit) || 8, 1), 24);
    const lang = dto.lang || 'vi';
    const rawProductId = dto.productId ? String(dto.productId).trim() : undefined;

    // Resolve user identifier safely without exposing PII
    let userKey: string | undefined = undefined;
    if (user && user._id) {
      userKey = `usr_${user._id.toString()}`;
    } else if (guestCartId && guestCartId.trim()) {
      userKey = `gst_${guestCartId.trim()}`;
    }

    // Step 1: Try Python CLI inference
    const cliResult = await this.invokePythonCLI({
      productId: rawProductId,
      userKey,
      limit,
    });

    if (cliResult && Array.isArray(cliResult.recommendations) && cliResult.recommendations.length > 0) {
      const candidateIds = cliResult.recommendations
        .map((r) => r.product_id)
        .filter((id) => id && typeof id === 'string');

      const hydrated = await this.hydrateProducts(candidateIds, lang, rawProductId);

      if (hydrated.length >= Math.min(limit, 4)) {
        const isML =
          cliResult.strategy === 'ml_model' ||
          (cliResult.strategy as string) === 'ml_bootstrap_model';

        this.logger.log(
          `Recommendations served: strategy=${cliResult.strategy}, model=${cliResult.model_used}, count=${hydrated.length}`,
        );

        return {
          status: 'success',
          strategy: cliResult.strategy,
          modelUsed: cliResult.model_used || 'None',
          isMachineLearning: isML,
          dataSource: cliResult.data_source || (isML ? 'synthetic_bootstrap' : 'real_data'),
          currentProductId: rawProductId,
          count: hydrated.length,
          products: hydrated.slice(0, limit),
        };
      }
    }

    // Step 2: Native MongoDB Fallback (Guaranteed to work in serverless/Vercel environments)
    if (rawProductId) {
      const catFallback = await this.nativeFallbackByCategory(rawProductId, limit, lang);
      if (catFallback.products.length >= limit) {
        return catFallback;
      }
      // If category has few items, pad with Popularity fallback
      const popFallback = await this.nativeFallbackByPopularity(rawProductId, limit, lang);
      const existingIds = new Set(catFallback.products.map((p: any) => p._id.toString()));
      const paddedProducts = [
        ...catFallback.products,
        ...popFallback.products.filter((p: any) => !existingIds.has(p._id.toString())),
      ].slice(0, limit);

      return {
        status: 'fallback',
        strategy: 'fallback_category',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId: rawProductId,
        count: paddedProducts.length,
        products: paddedProducts,
      };
    }

    // Fallback Popularity when no current product specified
    return this.nativeFallbackByPopularity(undefined, limit, lang);
  }

  /**
   * Safe execution of predict_recommendations.py via child_process.spawn.
   * Enforces 3000ms timeout, array-only arguments, and strict JSON validation.
   */
  private async invokePythonCLI(params: {
    productId?: string;
    userKey?: string;
    limit: number;
  }): Promise<PythonCLIResult | null> {
    const pythonExe = this.resolvePythonExecutable();
    const scriptPath = path.resolve(process.cwd(), 'server', 'ml', 'src', 'predict_recommendations.py');

    if (!pythonExe || !fs.existsSync(scriptPath)) {
      this.logger.debug('Python executable or recommendation script not found. Using native fallback.');
      return null;
    }

    return new Promise<PythonCLIResult | null>((resolve) => {
      const args = [
        scriptPath,
        '--top-n',
        String(params.limit),
      ];

      if (params.productId) {
        args.push('--product-id', params.productId);
      }
      if (params.userKey) {
        args.push('--user-id', params.userKey);
      }

      // Server-side authorization for bootstrap model:
      // Controlled strictly via server configuration, never client query parameter.
      const allowBootstrap =
        process.env.ENABLE_ML_BOOTSTRAP !== 'false';

      if (allowBootstrap) {
        args.push('--allow-bootstrap');
      }

      let stdoutBuffer = '';
      let stderrBuffer = '';
      let isTimedOut = false;

      const proc = spawn(pythonExe, args, {
        cwd: process.cwd(),
        shell: false,
        windowsHide: true,
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGKILL');
        this.logger.warn('Python inference process timed out (exceeded 3000ms). Falling back.');
        resolve(null);
      }, 3000);

      proc.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString('utf-8');
      });

      proc.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString('utf-8');
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        this.logger.warn(`Failed to spawn Python process: ${err.message}`);
        resolve(null);
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (isTimedOut) return;

        if (code !== 0) {
          this.logger.warn(`Python inference exited with code ${code}: ${stderrBuffer.slice(0, 200)}`);
          return resolve(null);
        }

        try {
          const parsed = JSON.parse(stdoutBuffer.trim());
          if (parsed && parsed.status === 'success' && Array.isArray(parsed.recommendations)) {
            return resolve(parsed as PythonCLIResult);
          }
          resolve(null);
        } catch (e) {
          this.logger.warn(`Failed to parse JSON from Python inference stdout: ${e}`);
          resolve(null);
        }
      });
    });
  }

  /**
   * Resolves the best available Python binary path across environments.
   */
  private resolvePythonExecutable(): string | null {
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
      return process.env.PYTHON_PATH;
    }

    const venvPaths = [
      path.resolve(process.cwd(), 'server', 'ml', '.venv', 'Scripts', 'python.exe'),
      path.resolve(process.cwd(), 'server', 'ml', '.venv', 'bin', 'python'),
      path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
      path.resolve(process.cwd(), '.venv', 'bin', 'python'),
    ];

    for (const vp of venvPaths) {
      if (fs.existsSync(vp)) {
        return vp;
      }
    }

    return null;
  }

  /**
   * Native MongoDB Fallback 1: Category-based recommendation.
   */
  private async nativeFallbackByCategory(
    currentProductId: string,
    limit: number,
    lang: string,
  ): Promise<RecommendationResponse> {
    try {
      // Find current product to identify its primary category
      let currentProd: any = null;
      if (isValidObjectId(currentProductId)) {
        currentProd = await this.productModel.findById(currentProductId).lean();
      }
      if (!currentProd) {
        currentProd = await this.productModel.findOne({ titleUrl: currentProductId }).lean();
      }

      if (!currentProd) {
        // Current product doesn't exist, fallback to popularity
        return this.nativeFallbackByPopularity(undefined, limit, lang);
      }

      const currId = currentProd._id;
      const targetCategory =
        currentProd.categoryLevel1 ||
        (currentProd.vi && currentProd.vi.categoryLevel1) ||
        (currentProd.primary_category) ||
        null;

      const categoryFilter = Array.isArray(targetCategory)
        ? { $in: targetCategory }
        : targetCategory;

      const query: any = {
        _id: { $ne: currId },
        visibility: { $ne: false },
      };

      if (categoryFilter) {
        query.$or = [
          { categoryLevel1: categoryFilter },
          { 'vi.categoryLevel1': categoryFilter },
        ];
      }

      const rawCandidates = await this.productModel
        .find(query)
        .sort({ quantity: -1, dateAdded: -1, createdAt: -1 })
        .limit(limit * 2)
        .lean();

      const candidateIds = rawCandidates.map((c: any) => c._id.toString());
      const hydrated = await this.hydrateProducts(candidateIds, lang, currId.toString());

      return {
        status: 'fallback',
        strategy: 'fallback_category',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId: currentProductId,
        count: Math.min(hydrated.length, limit),
        products: hydrated.slice(0, limit),
      };
    } catch (err: any) {
      this.logger.error(`Error in nativeFallbackByCategory: ${err.message}`);
      return this.nativeFallbackByPopularity(currentProductId, limit, lang);
    }
  }

  /**
   * Native MongoDB Fallback 2: Popularity-based recommendation with category diversity.
   */
  private async nativeFallbackByPopularity(
    excludeProductId: string | undefined,
    limit: number,
    lang: string,
  ): Promise<RecommendationResponse> {
    try {
      const query: any = {
        visibility: { $ne: false },
      };

      if (excludeProductId && isValidObjectId(excludeProductId)) {
        query._id = { $ne: excludeProductId };
      }

      // Fetch active items prioritized by stock and recency
      const candidates = await this.productModel
        .find(query)
        .sort({ quantity: -1, rating: -1, dateAdded: -1, createdAt: -1 })
        .limit(limit * 3)
        .lean();

      // Apply category diversity (max 3 items per category)
      const selected: any[] = [];
      const catCounts: Record<string, number> = {};
      const remaining: any[] = [];

      for (const item of candidates) {
        const cat = Array.isArray(item.categoryLevel1)
          ? item.categoryLevel1[0]
          : item.categoryLevel1 || (item.vi && item.vi.categoryLevel1) || 'other';

        const count = catCounts[cat] || 0;
        if (count < 3) {
          selected.push(item);
          catCounts[cat] = count + 1;
          if (selected.length >= limit) break;
        } else {
          remaining.push(item);
        }
      }

      if (selected.length < limit && remaining.length > 0) {
        selected.push(...remaining.slice(0, limit - selected.length));
      }

      const candidateIds = selected.map((c: any) => c._id.toString());
      const hydrated = await this.hydrateProducts(candidateIds, lang, excludeProductId);

      return {
        status: 'fallback',
        strategy: 'fallback_popularity',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId: excludeProductId,
        count: Math.min(hydrated.length, limit),
        products: hydrated.slice(0, limit),
      };
    } catch (err: any) {
      this.logger.error(`Error in nativeFallbackByPopularity: ${err.message}`);
      return {
        status: 'error',
        strategy: 'fallback_popularity',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId: excludeProductId,
        count: 0,
        products: [],
      };
    }
  }

  /**
   * Hydrates product IDs from MongoDB, enforcing visibility, in-stock priority, and variants.
   * Preserves candidate ordering while ensuring strict data freshness.
   */
  private async hydrateProducts(
    productIds: string[],
    lang: string,
    excludeId?: string,
  ): Promise<Product[]> {
    if (!productIds || productIds.length === 0) {
      return [];
    }

    const validIds = productIds.filter((id) => isValidObjectId(id));
    if (validIds.length === 0) {
      return [];
    }

    const excludeStr = excludeId ? excludeId.toString() : '';

    const docs = await this.productModel
      .find({
        _id: { $in: validIds },
        visibility: { $ne: false },
      })
      .lean();

    if (!docs || docs.length === 0) {
      return [];
    }

    // Fetch variants in bulk
    const foundIds = docs.map((d: any) => d._id);
    const variants = await this.productVariantModel
      .find({ productId: { $in: foundIds }, isActive: true })
      .lean();

    const variantMap = new Map<string, any[]>();
    for (const v of variants) {
      const pid = v.productId.toString();
      if (!variantMap.has(pid)) variantMap.set(pid, []);
      variantMap.get(pid)!.push(v);
    }

    // Map by ID for order preservation
    const docMap = new Map<string, any>();
    for (const d of docs) {
      docMap.set(d._id.toString(), d);
    }

    const preparedList: Product[] = [];
    for (const id of productIds) {
      if (id === excludeStr) continue;
      const doc = docMap.get(id);
      if (doc) {
        const itemVariants = variantMap.get(id) || doc.variants || [];
        const prepared = prepareProduct(doc, lang, false, itemVariants);
        preparedList.push(prepared);
      }
    }

    return preparedList;
  }
}
