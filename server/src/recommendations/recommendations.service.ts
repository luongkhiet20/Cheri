import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId } from 'mongoose';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

import { Product, ProductModel } from '../products/models/product.model';
import { ProductVariantDocument } from '../products/models/product-variant.model';
import { RecommendationImpressionDocument } from './schemas/recommendation-impression.schema';
import { InteractionDocument } from '../interactions/schemas/interaction.schema';
import { prepareProduct } from '../shared/utils/prepareUtils';
import { GetRecommendationsDto } from './dto/get-recommendations.dto';
import { RecordImpressionsDto } from './dto/record-impressions.dto';

// Centralized Hybrid Recommendation + Diversity Re-ranking + Exposure Rotation configuration
export const RECOMMENDATION_CONFIG = {
  DEFAULT_TOP_N: 10,
  CANDIDATE_POOL_SIZE: 30,
  PRIORITY_COUNT: 6,
  EXPLORATION_COUNT: 4,
  PRIORITY_RATIO: 0.6,
  MAX_PER_CATEGORY: 3,
  IMPRESSION_LOOKBACK_DAYS: 7,
  ANONYMIZATION_SALT: process.env.ML_SALT || 'cheri_ml_salt_2026_secured',
};

export interface RecommendationResponse {
  status: 'success' | 'fallback' | 'error';
  strategy: 'ml_model' | 'ml_bootstrap_model' | 'fallback_category' | 'fallback_popularity';
  modelUsed: string;
  isMachineLearning: boolean;
  dataSource?: string;
  currentProductId?: string;
  recommendationContextId?: string;
  candidatePoolSize?: number;
  priorityCount?: number;
  explorationCount?: number;
  count: number;
  products: Product[];
}

interface CandidateMeta {
  product_id: string;
  title?: string;
  category?: string;
  score?: number;
  _mlScore?: number;
  rank?: number;
  _mlRank?: number;
  display_rank?: number;
  selection_group?: string;
  reason?: string;
}

interface PythonCLIResult {
  status: string;
  strategy: 'ml_model' | 'ml_bootstrap_model' | 'fallback_category' | 'fallback_popularity';
  model_used: string;
  is_bootstrap?: boolean;
  data_source?: string;
  current_product_id?: string;
  candidate_pool_size?: number;
  priority_count?: number;
  exploration_count?: number;
  count: number;
  recommendations: CandidateMeta[];
}

interface ExposureEntry {
  impressionCount: number;
  hoursSinceLastShown: number;
  hasPositiveEngagement: boolean;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    @InjectModel('Product') private productModel: ProductModel,
    @InjectModel('ProductVariant')
    private productVariantModel: Model<ProductVariantDocument>,
    @InjectModel('RecommendationImpression')
    private impressionModel: Model<RecommendationImpressionDocument>,
    @InjectModel('Interaction')
    private interactionModel: Model<InteractionDocument>,
  ) {}

  /**
   * Produces the exact same SHA-256 16-hex pseudonymized user_key as Python's pseudonymize_user_key().
   */
  public computePseudonymizedUserKey(rawId: string, prefix: 'usr' | 'gst' = 'usr'): string {
    const cleanVal = String(rawId || '').trim().toLowerCase();
    if (!cleanVal) return `${prefix}_unknown`;
    if (/^(usr|gst)_[0-9a-f]{16}$/.test(cleanVal)) {
      return cleanVal;
    }
    const stripped = cleanVal.replace(/^(usr_|gst_)/, '');
    const hash = crypto
      .createHash('sha256')
      .update(`${stripped}:${RECOMMENDATION_CONFIG.ANONYMIZATION_SALT}`, 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${prefix}_${hash}`;
  }

  /**
   * Records recommendation impressions when products actually appear in the user's recommendation viewport.
   * Stored in the dedicated 'recommendation_impressions' collection (never mixed with 'user_interactions' or PURCHASE labels).
   */
  async recordImpressions(
    dto: RecordImpressionsDto,
    user?: any,
    session?: any,
    guestCartId?: string,
  ): Promise<{ success: boolean; recordedCount: number }> {
    try {
      if (!dto || !Array.isArray(dto.productIds) || dto.productIds.length === 0) {
        return { success: true, recordedCount: 0 };
      }

      const uniqueValidIds = Array.from(
        new Set(
          dto.productIds
            .map((id) => String(id || '').trim())
            .filter((id) => isValidObjectId(id)),
        ),
      ).slice(0, RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE);

      if (uniqueValidIds.length === 0) {
        return { success: true, recordedCount: 0 };
      }

      let userId: Types.ObjectId | null = null;
      let sessionId: string | null = null;
      let userKey: string;

      if (user && user._id && isValidObjectId(String(user._id))) {
        userId = new Types.ObjectId(String(user._id));
        sessionId =
          guestCartId?.trim() ||
          dto.sessionId?.trim() ||
          (session?.id ? String(session.id) : null);
        userKey = this.computePseudonymizedUserKey(String(user._id), 'usr');
      } else {
        sessionId =
          guestCartId?.trim() ||
          dto.sessionId?.trim() ||
          (session?.id ? String(session.id) : null);
        if (!sessionId) {
          return { success: true, recordedCount: 0 };
        }
        userKey = this.computePseudonymizedUserKey(sessionId, 'gst');
      }

      const currentProductId = dto.currentProductId ? String(dto.currentProductId).trim() : null;
      const contextId = dto.recommendationContextId ? String(dto.recommendationContextId).trim() : null;
      const strategy = dto.strategy ? String(dto.strategy).trim() : 'ml_bootstrap_model';
      const now = new Date();
      const dedupCutoff = new Date(now.getTime() - 15 * 1000); // 15-second technical deduplication window

      const recentQuery: any = {
        userKey,
        currentProductId,
        productId: { $in: uniqueValidIds.map((id) => new Types.ObjectId(id)) },
        shownAt: { $gte: dedupCutoff },
      };
      if (contextId) {
        recentQuery.recommendationContextId = contextId;
      }

      const existingRecent = await this.impressionModel
        .find(
          recentQuery,
          { productId: 1 },
        )
        .lean();

      const recentlyRecordedSet = new Set(
        existingRecent.map((doc: any) => String(doc.productId)),
      );

      const docsToInsert = uniqueValidIds
        .filter((pid) => !recentlyRecordedSet.has(pid))
        .map((pid) => ({
          userKey,
          userId,
          sessionId,
          productId: new Types.ObjectId(pid),
          currentProductId,
          recommendationContextId: contextId,
          strategy,
          shownAt: now,
        }));

      if (docsToInsert.length > 0) {
        await this.impressionModel.insertMany(docsToInsert, { ordered: false });
      }

      return { success: true, recordedCount: docsToInsert.length };
    } catch (err: any) {
      this.logger.warn(`Non-fatal error recording recommendation impressions: ${err?.message}`);
      return { success: false, recordedCount: 0 };
    }
  }

  /**
   * Main recommendation entrypoint:
   * 1. Resolves clean input and target user/product (default limit = 10).
   * 2. Attempts Python ML inference (Top-30 pool -> 6 Priority + 4 Exploration + Exposure Rotation).
   * 3. Falls back seamlessly to Native MongoDB algorithms with synchronized Diversity Re-ranking & Exposure Rotation.
   * 4. Hydrates and validates all items from MongoDB while preserving original scores and ranks.
   */
  async getRecommendations(
    dto: GetRecommendationsDto,
    user?: any,
    guestCartId?: string,
  ): Promise<RecommendationResponse> {
    const limit = Math.min(
      Math.max(Number(dto.limit) || RECOMMENDATION_CONFIG.DEFAULT_TOP_N, 1),
      24,
    );
    const lang = dto.lang || 'vi';
    const rawProductId = dto.productId ? String(dto.productId).trim() : undefined;
    const contextId = dto.recommendationContextId ? String(dto.recommendationContextId).trim() : undefined;

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
      contextId,
    });

    if (cliResult && Array.isArray(cliResult.recommendations) && cliResult.recommendations.length > 0) {
      const candidateIds = cliResult.recommendations
        .map((r) => r.product_id)
        .filter((id) => id && typeof id === 'string');

      const metaMap = new Map<string, CandidateMeta>();
      for (const r of cliResult.recommendations) {
        if (r && r.product_id) {
          metaMap.set(r.product_id, r);
        }
      }

      const hydrated = await this.hydrateProducts(candidateIds, lang, rawProductId, metaMap);

      if (hydrated.length >= Math.min(limit, 4)) {
        const isML =
          cliResult.strategy === 'ml_model' ||
          (cliResult.strategy as string) === 'ml_bootstrap_model';

        this.logger.log(
          `Recommendations served: strategy=${cliResult.strategy}, model=${cliResult.model_used}, count=${hydrated.length} (priority=${cliResult.priority_count ?? 'n/a'}, exploration=${cliResult.exploration_count ?? 'n/a'})`,
        );

        return {
          status: 'success',
          strategy: cliResult.strategy,
          modelUsed: cliResult.model_used || 'None',
          isMachineLearning: isML,
          dataSource: cliResult.data_source || (isML ? 'synthetic_bootstrap' : 'real_data'),
          currentProductId: rawProductId,
          recommendationContextId: contextId,
          candidatePoolSize: cliResult.candidate_pool_size,
          priorityCount: cliResult.priority_count,
          explorationCount: cliResult.exploration_count,
          count: Math.min(hydrated.length, limit),
          products: hydrated.slice(0, limit),
        };
      }
    }

    // Step 2: Native MongoDB Fallback with synchronized Top-30 Pool + 6/4 Diversity Re-ranking + Exposure Rotation
    const { exposureMap, purchasedSet } = await this.getExposureAndPurchasedHistory(
      user,
      guestCartId,
      contextId,
    );

    if (rawProductId) {
      return this.nativeFallbackByCategory(
        rawProductId,
        limit,
        lang,
        exposureMap,
        purchasedSet,
        contextId,
      );
    }

    return this.nativeFallbackByPopularity(
      undefined,
      limit,
      lang,
      exposureMap,
      purchasedSet,
      contextId,
    );
  }

  /**
   * Retrieves 7-day exposure history from 'recommendation_impressions' plus positive engagements
   * ('CLICK', 'ADD_TO_CART') and purchased products ('PURCHASE') from 'user_interactions'.
   */
  private async getExposureAndPurchasedHistory(
    user?: any,
    guestCartId?: string,
    contextId?: string,
  ): Promise<{ exposureMap: Map<string, ExposureEntry>; purchasedSet: Set<string> }> {
    const exposureMap = new Map<string, ExposureEntry>();
    const purchasedSet = new Set<string>();

    try {
      const orConditions: any[] = [];
      const interactionOrConditions: any[] = [];

      if (user && user._id && isValidObjectId(String(user._id))) {
        const uid = new Types.ObjectId(String(user._id));
        const hashedKey = this.computePseudonymizedUserKey(String(user._id), 'usr');
        orConditions.push({ userId: uid }, { userKey: hashedKey }, { userKey: `usr_${user._id}` });
        interactionOrConditions.push({ userId: uid });
      }
      if (guestCartId && guestCartId.trim()) {
        const cleanSess = guestCartId.trim();
        const hashedGst = this.computePseudonymizedUserKey(cleanSess, 'gst');
        orConditions.push({ sessionId: cleanSess }, { userKey: hashedGst }, { userKey: `gst_${cleanSess}` });
        interactionOrConditions.push({ sessionId: cleanSess });
      }

      if (orConditions.length === 0) {
        return { exposureMap, purchasedSet };
      }

      const engagedSet = new Set<string>();
      if (interactionOrConditions.length > 0) {
        const interactions = await this.interactionModel
          .find(
            {
              $or: interactionOrConditions,
              isSynthetic: { $ne: true },
              eventType: { $in: ['CLICK', 'ADD_TO_CART', 'PURCHASE'] },
            },
            { productId: 1, eventType: 1 },
          )
          .limit(300)
          .lean();

        for (const ev of interactions) {
          const pid = String(ev.productId || '');
          if (!pid) continue;
          if (ev.eventType === 'PURCHASE') {
            purchasedSet.add(pid);
          } else if (ev.eventType === 'CLICK' || ev.eventType === 'ADD_TO_CART') {
            engagedSet.add(pid);
          }
        }
      }

      const cutoff = new Date(
        Date.now() - RECOMMENDATION_CONFIG.IMPRESSION_LOOKBACK_DAYS * 24 * 3600 * 1000,
      );
      const impressionFilter: any = {
        $or: orConditions,
        shownAt: { $gte: cutoff },
      };
      if (contextId) {
        impressionFilter.recommendationContextId = contextId;
      }
      const impressions = await this.impressionModel
        .find(
          impressionFilter,
          { productId: 1, shownAt: 1 },
        )
        .sort({ shownAt: -1 })
        .limit(500)
        .lean();

      const nowMs = Date.now();
      for (const imp of impressions) {
        const pid = String(imp.productId || '');
        if (!pid) continue;
        const shownMs = imp.shownAt ? new Date(imp.shownAt).getTime() : nowMs;
        const hoursAgo = Math.max(0, (nowMs - shownMs) / 3600000);
        const existing = exposureMap.get(pid);
        if (!existing) {
          exposureMap.set(pid, {
            impressionCount: 1,
            hoursSinceLastShown: hoursAgo,
            hasPositiveEngagement: engagedSet.has(pid),
          });
        } else {
          existing.impressionCount += 1;
          if (hoursAgo < existing.hoursSinceLastShown) {
            existing.hoursSinceLastShown = hoursAgo;
          }
        }
      }

      for (const ep of engagedSet) {
        if (!exposureMap.has(ep)) {
          exposureMap.set(ep, {
            impressionCount: 0,
            hoursSinceLastShown: 999,
            hasPositiveEngagement: true,
          });
        }
      }
    } catch (err: any) {
      this.logger.debug(`Exposure history lookup skipped: ${err?.message}`);
    }

    return { exposureMap, purchasedSet };
  }

  /**
   * Computes Exposure Rotation decay and novelty multiplier for Native MongoDB Fallback,
   * mirroring Python's compute_exposure_rotation_factors().
   */
  private computeNativeExposureFactors(
    productId: string,
    exposureMap: Map<string, ExposureEntry>,
  ): { priorityDecay: number; explorationNovelty: number } {
    const entry = exposureMap.get(productId);
    if (!entry || entry.impressionCount <= 0) {
      return {
        priorityDecay: 1.0,
        explorationNovelty: entry?.hasPositiveEngagement ? 1.25 : 1.5,
      };
    }

    if (entry.hasPositiveEngagement) {
      return {
        priorityDecay: 0.96,
        explorationNovelty: 1.15,
      };
    }

    const countDecay = 1.0 / (1.0 + 0.35 * entry.impressionCount);
    let recencyFactor = 0.95;
    if (entry.hoursSinceLastShown < 0.5) recencyFactor = 0.55;
    else if (entry.hoursSinceLastShown < 6.0) recencyFactor = 0.72;
    else if (entry.hoursSinceLastShown < 24.0) recencyFactor = 0.85;

    return {
      priorityDecay: Math.max(0.25, countDecay * recencyFactor),
      explorationNovelty: Math.max(
        0.15,
        (1.0 / (1.0 + 0.65 * entry.impressionCount)) * recencyFactor,
      ),
    };
  }

  /**
   * Synchronized Top-30 Candidate Pool + 6 Priority (60%) / 4 Exploration (40%) Diversity Re-ranking
   * + Exposure Rotation for Native MongoDB Fallback.
   */
  public diversifyAndRotateNativeCandidates(
    rawCandidates: Array<{
      id: string;
      category: string;
      baseScore: number;
      origRank: number;
    }>,
    limit: number,
    exposureMap: Map<string, ExposureEntry>,
  ): {
    selected: Array<CandidateMeta>;
    poolSize: number;
    priorityCount: number;
    explorationCount: number;
  } {
    const poolSizeLimit = Math.max(RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE, limit);
    const pool = rawCandidates.slice(0, poolSizeLimit).map((c) => {
      const factors = this.computeNativeExposureFactors(c.id, exposureMap);
      const jitter = Math.random() * 0.012;
      const rotatedPriorityScore =
        c.baseScore * (0.55 + 0.45 * factors.priorityDecay) + c.baseScore * jitter;
      return {
        ...c,
        priorityDecay: factors.priorityDecay,
        explorationNovelty: factors.explorationNovelty,
        rotatedPriorityScore,
      };
    });

    if (pool.length === 0) {
      return { selected: [], poolSize: 0, priorityCount: 0, explorationCount: 0 };
    }

    const targetPriority =
      limit === RECOMMENDATION_CONFIG.DEFAULT_TOP_N
        ? Math.min(RECOMMENDATION_CONFIG.PRIORITY_COUNT, pool.length)
        : Math.min(Math.round(limit * RECOMMENDATION_CONFIG.PRIORITY_RATIO), pool.length);
    const targetExploration = Math.max(0, limit - targetPriority);
    const maxPerCat = RECOMMENDATION_CONFIG.MAX_PER_CATEGORY;

    const selectedIds = new Set<string>();
    const selectedList: Array<CandidateMeta> = [];
    const catCounts: Record<string, number> = {};

    // Group 1: Priority (60%)
    const prioritySorted = [...pool].sort(
      (a, b) => b.rotatedPriorityScore - a.rotatedPriorityScore || b.baseScore - a.baseScore || a.origRank - b.origRank,
    );

    for (const item of prioritySorted) {
      if (selectedList.length >= targetPriority) break;
      const cat = item.category || 'Khác';
      if ((catCounts[cat] || 0) < maxPerCat) {
        selectedIds.add(item.id);
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        selectedList.push({
          product_id: item.id,
          category: cat,
          score: Number(item.baseScore.toFixed(4)),
          _mlScore: Number(item.baseScore.toFixed(4)),
          rank: item.origRank,
          _mlRank: item.origRank,
          display_rank: selectedList.length + 1,
          selection_group: 'priority',
        });
      }
    }

    // Group 2: Exploration (40%) via Random Weighted Sampling
    const maxPoolScore = Math.max(...pool.map((p) => p.baseScore), 0.01);
    const qualityFloor = Math.max(0.005, 0.18 * maxPoolScore);
    let remaining = pool.filter((p) => !selectedIds.has(p.id));

    let explorationPicked = 0;
    while (explorationPicked < targetExploration && remaining.length > 0) {
      const eligible = remaining.filter((item) => {
        const cat = item.category || 'Khác';
        return (catCounts[cat] || 0) < maxPerCat && item.baseScore >= qualityFloor;
      });

      if (eligible.length === 0) break;

      const weights = eligible.map((item) => {
        const cat = item.category || 'Khác';
        const cCount = catCounts[cat] || 0;
        const suitability = Math.pow(Math.max(item.baseScore, 0.01) / maxPoolScore, 0.75);
        const catBoost = cCount === 0 ? 1.75 : cCount === 1 ? 1.25 : 0.8;
        return Math.max(1e-6, suitability * item.explorationNovelty * catBoost);
      });

      const totalWeight = weights.reduce((acc, w) => acc + w, 0);
      let r = Math.random() * totalWeight;
      let chosenIdx = 0;
      for (let i = 0; i < eligible.length; i++) {
        r -= weights[i];
        if (r <= 0) {
          chosenIdx = i;
          break;
        }
      }

      const chosen = eligible[chosenIdx];
      const cat = chosen.category || 'Khác';
      selectedIds.add(chosen.id);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
      selectedList.push({
        product_id: chosen.id,
        category: cat,
        score: Number(chosen.baseScore.toFixed(4)),
        _mlScore: Number(chosen.baseScore.toFixed(4)),
        rank: chosen.origRank,
        _mlRank: chosen.origRank,
        display_rank: selectedList.length + 1,
        selection_group: 'exploration',
      });
      remaining = remaining.filter((p) => p.id !== chosen.id);
      explorationPicked++;
    }

    // Backfill if needed under category cap
    if (selectedList.length < limit && remaining.length > 0) {
      for (const item of prioritySorted) {
        if (selectedList.length >= limit) break;
        if (selectedIds.has(item.id)) continue;
        const cat = item.category || 'Khác';
        if ((catCounts[cat] || 0) < maxPerCat) {
          selectedIds.add(item.id);
          catCounts[cat] = (catCounts[cat] || 0) + 1;
          selectedList.push({
            product_id: item.id,
            category: cat,
            score: Number(item.baseScore.toFixed(4)),
            _mlScore: Number(item.baseScore.toFixed(4)),
            rank: item.origRank,
            _mlRank: item.origRank,
            display_rank: selectedList.length + 1,
            selection_group: 'exploration_backfill',
          });
        }
      }
    }

    const actualPriority = selectedList.filter((s) => s.selection_group === 'priority').length;
    return {
      selected: selectedList,
      poolSize: pool.length,
      priorityCount: actualPriority,
      explorationCount: selectedList.length - actualPriority,
    };
  }

  /**
   * Safe execution of predict_recommendations.py via child_process.spawn.
   */
  private async invokePythonCLI(params: {
    productId?: string;
    userKey?: string;
    limit: number;
    contextId?: string;
  }): Promise<PythonCLIResult | null> {
    const pythonExe = this.resolvePythonExecutable();
    const scriptPath = path.resolve(process.cwd(), 'server', 'ml', 'src', 'predict_recommendations.py');

    if (!pythonExe || !fs.existsSync(scriptPath)) {
      this.logger.debug('Python executable or recommendation script not found. Using native fallback.');
      return null;
    }

    return new Promise<PythonCLIResult | null>((resolve) => {
      const args = [scriptPath, '--top-n', String(params.limit)];

      if (params.productId) {
        args.push('--product-id', params.productId);
      }
      if (params.userKey) {
        args.push('--user-id', params.userKey);
      }
      if (params.contextId) {
        args.push('--context-id', params.contextId);
      }

      const allowBootstrap = process.env.ENABLE_ML_BOOTSTRAP !== 'false';
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

      const timeoutMs = Number(process.env.ML_INFERENCE_TIMEOUT_MS) || 6000;
      const timer = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGKILL');
        this.logger.warn(`Python inference process timed out (exceeded ${timeoutMs}ms). Falling back.`);
        resolve(null);
      }, timeoutMs);

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
   * Native MongoDB Fallback 1: Category-based recommendation with Top-30 pool,
   * 6 Priority + 4 Exploration Diversity Re-ranking, and Exposure Rotation.
   */
  private async nativeFallbackByCategory(
    currentProductId: string,
    limit: number,
    lang: string,
    exposureMap: Map<string, ExposureEntry> = new Map(),
    purchasedSet: Set<string> = new Set(),
    contextId?: string,
  ): Promise<RecommendationResponse> {
    try {
      let currentProd: any = null;
      if (isValidObjectId(currentProductId)) {
        currentProd = await this.productModel.findById(currentProductId).lean();
      }
      if (!currentProd) {
        currentProd = await this.productModel.findOne({ titleUrl: currentProductId }).lean();
      }

      if (!currentProd) {
        return this.nativeFallbackByPopularity(undefined, limit, lang, exposureMap, purchasedSet, contextId);
      }

      const currId = currentProd._id;
      const targetCategory =
        currentProd.categoryLevel1 ||
        (currentProd.vi && currentProd.vi.categoryLevel1) ||
        currentProd.primary_category ||
        null;

      const categoryFilter = Array.isArray(targetCategory)
        ? { $in: targetCategory }
        : targetCategory;

      const excludedIds = [currId, ...Array.from(purchasedSet).filter(isValidObjectId).map((id) => new Types.ObjectId(id))];

      const sameCatQuery: any = {
        _id: { $nin: excludedIds },
        visibility: { $ne: false },
      };

      if (categoryFilter) {
        sameCatQuery.$or = [
          { categoryLevel1: categoryFilter },
          { 'vi.categoryLevel1': categoryFilter },
        ];
      }

      const sameCatDocs = await this.productModel
        .find(sameCatQuery)
        .sort({ quantity: -1, dateAdded: -1, createdAt: -1 })
        .limit(RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE)
        .lean();

      // Supplement pool with popular items from other categories only if same category has fewer items than requested limit
      let otherDocs: any[] = [];
      if (sameCatDocs.length < limit) {
        const otherExcluded = [
          ...excludedIds,
          ...sameCatDocs.map((d: any) => d._id),
        ];
        otherDocs = await this.productModel
          .find({
            _id: { $nin: otherExcluded },
            visibility: { $ne: false },
          })
          .sort({ quantity: -1, rating: -1, dateAdded: -1, createdAt: -1 })
          .limit(RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE - sameCatDocs.length)
          .lean();
      }

      const combinedDocs = [...sameCatDocs, ...otherDocs];
      const hydratedPool = await this.hydrateProducts(
        combinedDocs.map((d: any) => d._id.toString()),
        lang,
        currId.toString(),
      );

      // Filter out out-of-stock products
      const inStockPool = hydratedPool.filter((p: any) => Number(p.quantity ?? 1) > 0 && p.stock !== 'out');
      const activePool = inStockPool.length > 0 ? inStockPool : hydratedPool;

      const sameCatIdSet = new Set(sameCatDocs.map((d: any) => d._id.toString()));
      const rawCandidates = activePool.map((p: any, idx: number) => {
        const pid = String(p._id || p.id);
        const cat = p.categoryName || (Array.isArray(p.tags) && p.tags[0]) || 'Khác';
        const isSameCat = sameCatIdSet.has(pid);
        const baseScore = isSameCat
          ? Math.max(0.55, 0.85 - idx * 0.015)
          : Math.max(0.25, 0.60 - idx * 0.012);
        return {
          id: pid,
          category: String(cat),
          baseScore,
          origRank: idx + 1,
        };
      });

      const divResult = this.diversifyAndRotateNativeCandidates(rawCandidates, limit, exposureMap);
      const productMap = new Map<string, any>();
      for (const p of activePool) {
        productMap.set(String((p as any)._id || (p as any).id), p);
      }

      const finalProducts: Product[] = [];
      for (const meta of divResult.selected) {
        const prod = productMap.get(meta.product_id);
        if (prod) {
          finalProducts.push({
            ...prod,
            score: meta.score,
            _mlScore: meta._mlScore,
            rank: meta.rank,
            _mlRank: meta._mlRank,
            displayRank: meta.display_rank,
            selectionGroup: meta.selection_group,
          });
        }
      }

      return {
        status: 'fallback',
        strategy: 'fallback_category',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId,
        recommendationContextId: contextId,
        candidatePoolSize: divResult.poolSize,
        priorityCount: divResult.priorityCount,
        explorationCount: divResult.explorationCount,
        count: Math.min(finalProducts.length, limit),
        products: finalProducts.slice(0, limit),
      };
    } catch (err: any) {
      this.logger.error(`Error in nativeFallbackByCategory: ${err.message}`);
      return this.nativeFallbackByPopularity(currentProductId, limit, lang, exposureMap, purchasedSet, contextId);
    }
  }

  /**
   * Native MongoDB Fallback 2: Popularity-based recommendation with Top-30 pool,
   * 6 Priority + 4 Exploration Diversity Re-ranking, and Exposure Rotation.
   */
  private async nativeFallbackByPopularity(
    excludeProductId: string | undefined,
    limit: number,
    lang: string,
    exposureMap: Map<string, ExposureEntry> = new Map(),
    purchasedSet: Set<string> = new Set(),
    contextId?: string,
  ): Promise<RecommendationResponse> {
    try {
      const excludedIds: Types.ObjectId[] = Array.from(purchasedSet)
        .filter(isValidObjectId)
        .map((id) => new Types.ObjectId(id));

      if (excludeProductId && isValidObjectId(excludeProductId)) {
        excludedIds.push(new Types.ObjectId(excludeProductId));
      }

      const query: any = {
        visibility: { $ne: false },
      };
      if (excludedIds.length > 0) {
        query._id = { $nin: excludedIds };
      }

      const candidates = await this.productModel
        .find(query)
        .sort({ quantity: -1, rating: -1, dateAdded: -1, createdAt: -1 })
        .limit(RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE * 2)
        .lean();

      const hydratedPool = await this.hydrateProducts(
        candidates.map((c: any) => c._id.toString()),
        lang,
        excludeProductId,
      );

      const inStockPool = hydratedPool.filter((p: any) => Number(p.quantity ?? 1) > 0 && p.stock !== 'out');
      const activePool = (inStockPool.length > 0 ? inStockPool : hydratedPool).slice(
        0,
        RECOMMENDATION_CONFIG.CANDIDATE_POOL_SIZE,
      );

      const rawCandidates = activePool.map((p: any, idx: number) => {
        const pid = String(p._id || p.id);
        const cat = p.categoryName || (Array.isArray(p.tags) && p.tags[0]) || 'Khác';
        return {
          id: pid,
          category: String(cat),
          baseScore: Math.max(0.20, 0.75 - idx * 0.015),
          origRank: idx + 1,
        };
      });

      const divResult = this.diversifyAndRotateNativeCandidates(rawCandidates, limit, exposureMap);
      const productMap = new Map<string, any>();
      for (const p of activePool) {
        productMap.set(String((p as any)._id || (p as any).id), p);
      }

      const finalProducts: Product[] = [];
      for (const meta of divResult.selected) {
        const prod = productMap.get(meta.product_id);
        if (prod) {
          finalProducts.push({
            ...prod,
            score: meta.score,
            _mlScore: meta._mlScore,
            rank: meta.rank,
            _mlRank: meta._mlRank,
            displayRank: meta.display_rank,
            selectionGroup: meta.selection_group,
          });
        }
      }

      return {
        status: 'fallback',
        strategy: 'fallback_popularity',
        modelUsed: 'None',
        isMachineLearning: false,
        dataSource: 'native_fallback',
        currentProductId: excludeProductId,
        recommendationContextId: contextId,
        candidatePoolSize: divResult.poolSize,
        priorityCount: divResult.priorityCount,
        explorationCount: divResult.explorationCount,
        count: Math.min(finalProducts.length, limit),
        products: finalProducts.slice(0, limit),
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
        recommendationContextId: contextId,
        count: 0,
        products: [],
      };
    }
  }

  /**
   * Hydrates product IDs from MongoDB, enforcing visibility, in-stock priority, and variants.
   * Preserves candidate ordering and attaches original ML/ranking metadata ('score', '_mlScore', 'rank', '_mlRank').
   */
  private async hydrateProducts(
    productIds: string[],
    lang: string,
    excludeId?: string,
    metaMap?: Map<string, CandidateMeta>,
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
        const prepared: any = prepareProduct(doc, lang, false, itemVariants);
        const meta = metaMap?.get(id);
        if (meta) {
          if (meta.score !== undefined) prepared.score = meta.score;
          if (meta._mlScore !== undefined) prepared._mlScore = meta._mlScore;
          else if (meta.score !== undefined) prepared._mlScore = meta.score;
          if (meta.rank !== undefined) prepared.rank = meta.rank;
          if (meta._mlRank !== undefined) prepared._mlRank = meta._mlRank;
          else if (meta.rank !== undefined) prepared._mlRank = meta.rank;
          if (meta.display_rank !== undefined) prepared.displayRank = meta.display_rank;
          if (meta.selection_group !== undefined) prepared.selectionGroup = meta.selection_group;
        }
        preparedList.push(prepared);
      }
    }

    return preparedList;
  }
}
