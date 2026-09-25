import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';

import { GetProductsDto } from './dto/get-products';
import {
  Product,
  ProductModel,
  ProductsWithPagination,
} from './models/product.model';
import { GetProductDto } from './dto/get-product';
import { Category, CategoryModel } from './models/category.model';
import { ProductVariantDocument } from './models/product-variant.model';
import { User } from '../auth/models/user.model';
import { prepareProduct, toSlug } from '../shared/utils/prepareUtils';
import { languages, paginationLimit } from '../shared/constans';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel('Product') private productModel: ProductModel,
    @InjectModel('Category') private categoryModel: Model<CategoryModel>,
    @InjectModel('ProductVariant')
    private productVariantModel: Model<ProductVariantDocument>,
  ) {}

  async getProducts(
    getProductsDto: GetProductsDto,
    lang: string,
  ): Promise<ProductsWithPagination> {
    const { page, sort, category, search, maxPrice, minPrice, stock, rating, pageSize } = getProductsDto;
    const searchQuery = search ? { titleUrl: new RegExp(search, 'i') } : {};
    // Category filter: single or multiple (comma-separated or array)
    let categoryQuery: any = {};
    if (category) {
      const cats = (Array.isArray(category) ? category : String(category).split(','))
        .map((c: string) => c.trim())
        .filter(Boolean);
      if (cats.length === 1) {
        categoryQuery = { [`tags`]: new RegExp(cats[0], 'i') };
      } else if (cats.length > 1) {
        categoryQuery = {
          $or: cats.map((c: string) => ({ [`tags`]: new RegExp(c, 'i') })),
        };
      }
    }

    // Price range: min and max
    const priceField = `${lang}.salePrice`;
    const priceQuery: any = {};
    if (maxPrice) priceQuery[priceField] = { ...(priceQuery[priceField] || {}), $lte: Number(maxPrice) };
    if (minPrice) priceQuery[priceField] = { ...(priceQuery[priceField] || {}), $gte: Number(minPrice) };

    // Stock filter: onStock / unavailable / out
    const stockQuery = stock && stock !== 'all'
      ? {
          $or: [
            { [`${lang}.stock`]: stock },
            { [`vi.stock`]: stock },
          ],
        }
      : {};

    // Rating filter: single or multiple tiers (e.g. 5, 4, 3, 2, 1)
    let ratingQuery: any = {};
    if (rating !== undefined && rating !== null && rating !== '' && rating !== 0 && rating !== '0') {
      const ratings = (Array.isArray(rating) ? rating : String(rating).split(','))
        .map((r: any) => Number(r))
        .filter((r: number) => !isNaN(r) && r > 0);
      if (ratings.length === 1) {
        const r = ratings[0];
        ratingQuery = r === 5
          ? { rating: { $gte: 5 } }
          : { rating: { $gte: r, $lt: r + 1 } };
      } else if (ratings.length > 1) {
        ratingQuery = {
          $or: ratings.map((r: number) =>
            r === 5 ? { rating: { $gte: 5 } } : { rating: { $gte: r, $lt: r + 1 } }
          ),
        };
      }
    }

    const visibilityQuery = {
      visibility: { $ne: false },
      $or: [
        { [`${lang}.visibility`]: true },
        { [`vi.visibility`]: true },
        { [`en.visibility`]: true },
      ],
    };

    const query = {
      ...searchQuery,
      ...categoryQuery,
      ...priceQuery,
      ...stockQuery,
      ...ratingQuery,
      ...visibilityQuery,
    };
    const options = {
      page: parseFloat(page) || 1,
      sort: this.prepareSort(sort, lang),
      limit: Number(pageSize) || paginationLimit,
      lang: lang || 'vi',
      price: 'salePrice',
    };

    const productsWithPagination = await this.productModel.paginate(
      query,
      options,
    );

    const productIds = (productsWithPagination.all || []).map((product: any) => product._id);
    const variantsList = await this.productVariantModel
      .find({ productId: { $in: productIds }, isActive: true })
      .lean();
    const variantMap = new Map<string, any[]>();
    for (const v of variantsList) {
      const pid = v.productId.toString();
      if (!variantMap.has(pid)) variantMap.set(pid, []);
      variantMap.get(pid)!.push(v);
    }

    return {
      ...productsWithPagination,
      all: (productsWithPagination.all || []).map((product) => {
        const pid = product._id ? product._id.toString() : '';
        const attachedVariants = variantMap.get(pid) || product.variants || [];
        return prepareProduct(product, lang, true, attachedVariants);
      }),
    };
  }

  async getCategories(lang: string): Promise<Category[]> {
    const query = { [`${lang}.visibility`]: true };
    const categories = await this.categoryModel
      .find(query)
      .sort(`${lang}.position`);
    return this.prepareCategories(categories, lang);
  }

  async getProductsTitles(search: string): Promise<string[]> {
    const products = await this.productModel.find({
      titleUrl: new RegExp(search, 'i'),
    });
    return products.map((product) => product.titleUrl);
  }

  async getProductByName(
    name: string,
    getProductDto: GetProductDto,
  ): Promise<Product> {
    const { lang } = getProductDto;
    let found = await this.productModel.findOne({ titleUrl: name });
    if (!found && isValidObjectId(name)) {
      found = await this.productModel.findById(name);
    }
    if (!found) {
      found = await this.productModel.findOne({ id: name });
    }

    if (!found) {
      throw new NotFoundException(`Product with title ${name} not found`);
    }

    const variants = await this.productVariantModel
      .find({ productId: found._id })
      .lean();
    const attachedVariants = (variants && variants.length > 0) ? variants : (found.variants || []);
    const prepared = lang ? prepareProduct(found, lang, false, attachedVariants) : found;
    const result =
      prepared && typeof (prepared as any).toObject === 'function'
        ? (prepared as any).toObject()
        : { ...prepared };
    result.variants = attachedVariants;
    return result;
  }

  async getProductVariants(productId: string): Promise<any[]> {
    let pDoc: any = null;
    let query: any = {};
    if (isValidObjectId(productId)) {
      query = { productId };
      pDoc = await this.productModel.findById(productId);
    } else {
      pDoc = await this.productModel.findOne({
        $or: [{ titleUrl: productId }, { id: productId }, { sku: productId }],
      });
      if (pDoc) {
        query = { productId: pDoc._id };
      } else {
        return [];
      }
    }
    const variants = await this.productVariantModel.find(query).lean();
    if (variants && variants.length > 0) return variants;
    if (pDoc && Array.isArray(pDoc.variants) && pDoc.variants.length > 0) {
      return pDoc.variants;
    }
    return [];
  }

  async syncProductVariants(
    productId: any,
    baseSku: string,
    variants: any[],
  ): Promise<void> {
    if (!productId) return;
    try {
      await this.productVariantModel.deleteMany({ productId });
      if (!variants || !Array.isArray(variants) || variants.length === 0) {
        return;
      }

      const cleanBaseSku = (baseSku || 'SKU').toString().trim().toUpperCase();
      const docsToInsert = variants
        .map((v, index) => {
          if (!v) return null;
          const sku = (
            v.sku ||
            `${cleanBaseSku}-VAR-${index + 1}-${Date.now().toString().slice(-4)}`
          )
            .toString()
            .trim();

          const color =
            v.color ||
            v.attributes?.['Màu sắc'] ||
            v.attributes?.['Màu'] ||
            v.attributes?.color ||
            '';
          const size =
            v.size ||
            v.attributes?.['Kích thước'] ||
            v.attributes?.['Size'] ||
            v.attributes?.size ||
            '';
          const classification =
            v.classification ||
            v.attributes?.['Phân loại'] ||
            v.attributes?.classification ||
            '';

          const price = Math.max(0, Number(v.price) || 0);
          const discountPrice = Math.max(
            0,
            Number(v.discountPrice !== undefined ? v.discountPrice : v.salePrice) || 0,
          );
          const stock = Math.max(
            0,
            Number(v.stock !== undefined ? v.stock : v.quantity) || 0,
          );
          const isActive =
            v.isActive !== undefined
              ? Boolean(v.isActive)
              : v.status !== undefined
              ? Boolean(v.status)
              : true;

          return {
            productId,
            sku,
            color: String(color).trim(),
            size: String(size).trim(),
            classification: String(classification).trim(),
            price,
            discountPrice,
            stock,
            isActive,
          };
        })
        .filter(Boolean);

      if (docsToInsert.length > 0) {
        const seenSkus = new Set<string>();
        const uniqueDocs = [];
        for (const doc of docsToInsert) {
          let uniqueSku = doc.sku;
          let counter = 1;
          while (seenSkus.has(uniqueSku)) {
            uniqueSku = `${doc.sku}-${counter++}`;
          }
          seenSkus.add(uniqueSku);
          uniqueDocs.push({ ...doc, sku: uniqueSku });
        }
        await this.productVariantModel.insertMany(uniqueDocs);
      }
    } catch (err) {
      console.error('Error syncing product variants:', err);
    }
  }

  async addProduct(productReq, user: User): Promise<void> {
    if (!productReq.titleUrl || !productReq.titleUrl.trim()) {
      const titleName =
        productReq.vi?.title ||
        productReq.en?.title ||
        productReq.sk?.title ||
        productReq.cs?.title ||
        productReq.title ||
        '';
      productReq.titleUrl = toSlug(titleName) || `san-pham-${Date.now()}`;
    }

    let found = await this.productModel.findOne({
      titleUrl: productReq.titleUrl,
    });
    if (found) {
      productReq.titleUrl = `${productReq.titleUrl}-${Date.now().toString().slice(-4)}`;
    }

    if (productReq.mainImage && !productReq.mainImage.name) {
      productReq.mainImage.name = productReq.titleUrl;
    }

    // Extract and detach variants to ensure products collection never stores variants: []
    const rawVariants =
      productReq.variants ||
      productReq.vi?.variants ||
      productReq.en?.variants ||
      [];
    delete productReq.variants;
    for (const lang of languages) {
      if (productReq[lang] && productReq[lang].variants) {
        delete productReq[lang].variants;
      }
    }

    // Root level fields sync from vi (or primary language)
    const primaryLang = productReq.vi || productReq.en || {};
    if (primaryLang.title && !productReq.title) productReq.title = primaryLang.title;
    if (primaryLang.regularPrice !== undefined && productReq.regularPrice === undefined) productReq.regularPrice = primaryLang.regularPrice;
    if (primaryLang.salePrice !== undefined && productReq.salePrice === undefined) productReq.salePrice = primaryLang.salePrice;
    if (primaryLang.quantity !== undefined && productReq.quantity === undefined) productReq.quantity = primaryLang.quantity;
    if (primaryLang.visibility !== undefined && productReq.visibility === undefined) productReq.visibility = primaryLang.visibility;
    if (primaryLang.description && !productReq.description) productReq.description = primaryLang.description;

    const newProduct = Object.assign(productReq, {
      _user: user ? user._id : undefined,
      dateAdded: Date.now(),
      images: productReq.images || [],
    });

    try {
      const product = new this.productModel(newProduct);
      await product.save();
      await this.addCategory(product);
      if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        await this.syncProductVariants(
          product._id,
          product.sku || product.titleUrl,
          rawVariants,
        );
      }
    } catch (err) {
      console.error('Error adding product:', err);
      throw new BadRequestException();
    }
  }

  async editProduct(productReq): Promise<void> {
    const { titleUrl, _id, id } = productReq;
    let query: any = {};
    if (_id && isValidObjectId(_id)) {
      query = { _id };
    } else if (titleUrl) {
      query = { titleUrl };
    } else if (id) {
      query = { id };
    }

    const rawVariants =
      productReq.variants !== undefined
        ? productReq.variants
        : productReq.vi?.variants !== undefined
        ? productReq.vi.variants
        : productReq.en?.variants;

    delete productReq.variants;
    for (const lang of languages) {
      if (productReq[lang] && productReq[lang].variants) {
        delete productReq[lang].variants;
      }
    }

    // Sync root level fields from primary lang if present
    const primary = productReq.vi || productReq.en;
    if (primary) {
      if (primary.title && !productReq.title) productReq.title = primary.title;
      if (primary.regularPrice !== undefined && productReq.regularPrice === undefined) productReq.regularPrice = primary.regularPrice;
      if (primary.salePrice !== undefined && productReq.salePrice === undefined) productReq.salePrice = primary.salePrice;
      if (primary.quantity !== undefined && productReq.quantity === undefined) productReq.quantity = primary.quantity;
      if (primary.visibility !== undefined && productReq.visibility === undefined) productReq.visibility = primary.visibility;
      if (primary.description && !productReq.description) productReq.description = primary.description;
    }

    // Build atomic $set update so partial language updates don't wipe out other subdocument fields
    const updateSet: Record<string, any> = {};
    for (const [key, value] of Object.entries(productReq)) {
      if (key === '_id' || key === 'id') continue;
      if (languages.includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [subKey, subVal] of Object.entries(value)) {
          updateSet[`${key}.${subKey}`] = subVal;
        }
      } else {
        updateSet[key] = value;
      }
    }

    let found = await this.productModel.findOneAndUpdate(
      query,
      { $set: updateSet },
      { upsert: true, new: true },
    );

    if (!found && titleUrl) {
      found = await this.productModel.findOneAndUpdate(
        { titleUrl },
        { $set: updateSet },
        { upsert: true, new: true },
      );
    }

    if (!found) {
      throw new NotFoundException(`Product with title ${titleUrl || id || _id} not found`);
    } else {
      await this.addCategory(productReq);
      if (rawVariants !== undefined && Array.isArray(rawVariants)) {
        await this.syncProductVariants(
          found._id,
          found.sku || found.titleUrl,
          rawVariants,
        );
      }
    }
  }

  async deleteProductByName(titleUrl: string): Promise<void> {
    let found = await this.productModel.findOneAndDelete({ titleUrl });
    if (!found && isValidObjectId(titleUrl)) {
      found = await this.productModel.findByIdAndDelete(titleUrl);
    }
    if (!found) {
      found = await this.productModel.findOneAndDelete({ id: titleUrl });
    }

    if (!found) {
      throw new NotFoundException(`Product with title ${titleUrl} not found`);
    } else {
      await this.productVariantModel.deleteMany({ productId: found._id });
    }
  }

  async getAllProducts(lang: string): Promise<Product[]> {
    const products = await this.productModel.find({});
    return products.map((product) => prepareProduct(product, lang));
  }

  async importProducts(productsReq: any[], user: User): Promise<{ imported: number; errors: string[] }> {
    const results = { imported: 0, errors: [] };

    for (const productReq of productsReq) {
      try {
        if (!productReq.titleUrl || !productReq.titleUrl.trim()) {
          const titleName =
            productReq.vi?.title ||
            productReq.en?.title ||
            productReq.title ||
            '';
          productReq.titleUrl = toSlug(titleName) || `san-pham-${Date.now()}`;
        }

        let found = await this.productModel.findOne({
          titleUrl: productReq.titleUrl,
        });
        if (found) {
          productReq.titleUrl = `${productReq.titleUrl}-${Date.now().toString().slice(-4)}`;
        }

        if (productReq.mainImage && !productReq.mainImage.name) {
          productReq.mainImage.name = productReq.titleUrl;
        }

        const rawVariants =
          productReq.variants ||
          productReq.vi?.variants ||
          productReq.en?.variants ||
          [];
        delete productReq.variants;
        for (const lang of languages) {
          if (productReq[lang] && productReq[lang].variants) {
            delete productReq[lang].variants;
          }
        }

        const newProduct = Object.assign(productReq, {
          _user: user ? user._id : undefined,
          dateAdded: Date.now(),
          images: productReq.images || [],
        });

        const product = new this.productModel(newProduct);
        await product.save();
        await this.addCategory(product);
        if (Array.isArray(rawVariants) && rawVariants.length > 0) {
          await this.syncProductVariants(
            product._id,
            product.sku || product.titleUrl,
            rawVariants,
          );
        }
        results.imported++;
      } catch (err) {
        console.error('Error importing product:', err);
        results.errors.push(productReq.titleUrl || 'unknown');
      }
    }

    return results;
  }

  async getAllCategories(lang: string) {
    const categories = await this.categoryModel.find({});
    const products = await this.productModel.find({});
    return this.prepareAllCategories(categories, products);
  }

  async editCategory(categoryReq): Promise<void> {
    const { titleUrl } = categoryReq;
    const found = await this.categoryModel.findOneAndUpdate(
      { titleUrl },
      categoryReq,
      { upsert: true, new: true },
    );

    if (!found) {
      throw new NotFoundException(`Category with title ${titleUrl} not found`);
    }
  }

  async deleteCategoryByName(titleUrl: string): Promise<void> {
    const found = await this.categoryModel.findOneAndDelete({ titleUrl });

    if (!found) {
      throw new NotFoundException(`Category with title ${titleUrl} not found`);
    } else {
      const products = await this.productModel.find({});
      this.removeCategoryFromProducts(titleUrl, products);
    }
  }

  private prepareSort = (sortParams, lang: string): string => {
    switch (sortParams) {
      case 'newest':
        return `-dateAdded`;
      case 'oldest':
        return `dateAdded`;
      case 'priceasc':
        return `${lang}.salePrice`;
      case 'pricedesc':
        return `-${lang}.salePrice`;
      case 'nameasc':
        return `${lang}.title`;
      case 'namedesc':
        return `-${lang}.title`;
      case 'ratingdesc':
        return `-rating`;
      case 'ratingasc':
        return `rating`;
      default:
        return `-dateAdded`;
    }
  };

  private prepareCategories = (categories, lang: string): Category[] => {
    return categories.map((category) => ({
      titleUrl: category.titleUrl,
      mainImage: category.mainImage,
      dateAdded: category.dateAdded,
      subCategories: category.subCategories,
      title: category[lang] ? category[lang].title : category.titleUrl,
      description: category[lang] ? category[lang].description : '',
      visibility: category[lang] ? category[lang].visibility : false,
      menuHidden: category[lang] ? category[lang].menuHidden : false,
    }));
  };

  private addCategory = async (product): Promise<void> => {
    if (!product.tags || !Array.isArray(product.tags)) return;
    const uniqueTags = product.tags.filter((cat, i, arr) => arr.indexOf(cat) === i && !!cat);
    for (const category of uniqueTags) {
      const titleUrl = category.replace(/ /g, '_').toLowerCase();
      const addCategoryData = {
        titleUrl,
        mainImage: {
          url: product.mainImage ? product.mainImage.url : '',
          name: product.mainImage ? product.mainImage.name : titleUrl,
        },
        dateAdded: Date.now(),
        ...languages.reduce(
          (prev, lang) => ({
            ...prev,
            [lang]: {
              title: category,
              description: '',
              visibility: product.tags.includes(category),
            },
          }),
          {},
        ),
      };
      const found = await this.categoryModel.findOne({ titleUrl });
      if (!found) {
        const newCategory = new this.categoryModel(addCategoryData);
        await newCategory.save();
      }
    }
  };

  private prepareAllCategories = (categories, products) => {
    return categories.map((category) => {
      const productsWithCategory = products
        .filter((product) => {
          return !!product.tags.includes(category.titleUrl);
        })
        .map((product) => product.titleUrl);
      return { category, productsWithCategory };
    });
  };

  private removeCategoryFromProducts = (category: string, products) => {
    products.forEach(async (product) => {
      const productHasCategory = product.tags.includes(category);
      if (!productHasCategory) {
        return;
      }
      const productReq = {
        ...product.toObject(),
        tags: product.tags.filter((tag) => tag !== category),
      };
      const found = await this.productModel.findOneAndUpdate(
        { titleUrl: product.titleUrl },
        productReq,
        {
          upsert: true,
        },
      );
    });
  };
}
