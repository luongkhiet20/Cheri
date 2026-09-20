import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { GetProductsDto } from './dto/get-products';
import {
  Product,
  ProductModel,
  ProductsWithPagination,
} from './models/product.model';
import { GetProductDto } from './dto/get-product';
import { Category, CategoryModel } from './models/category.model';
import { User } from '../auth/models/user.model';
import { prepareProduct, toSlug } from '../shared/utils/prepareUtils';
import { languages, paginationLimit } from '../shared/constans';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel('Product') private productModel: ProductModel,
    @InjectModel('Category') private categoryModel: Model<CategoryModel>,
  ) {}

  async getProducts(
    getProductsDto: GetProductsDto,
    lang: string,
  ): Promise<ProductsWithPagination> {
    const { page, sort, category, search, maxPrice } = getProductsDto;
    const searchQuery = search ? { titleUrl: new RegExp(search, 'i') } : {};
    const categoryQuery = category
      ? { [`tags`]: new RegExp(category, 'i') }
      : {};
    const maxPriceQuery = maxPrice
      ? { [`${lang}.salePrice`]: { $lte: maxPrice } }
      : {};

    const visibilityQuery = {
      $or: [
        { [`${lang}.visibility`]: true },
        { [`vi.visibility`]: true },
        { [`en.visibility`]: true },
      ],
    };

    const query = {
      ...searchQuery,
      ...categoryQuery,
      ...maxPriceQuery,
      ...visibilityQuery,
    };
    const options = {
      page: parseFloat(page) || 1,
      sort: this.prepareSort(sort, lang),
      limit: paginationLimit,
      lang: lang || 'vi',
      price: 'salePrice',
    };

    const productsWithPagination = await this.productModel.paginate(
      query,
      options,
    );

    return {
      ...productsWithPagination,
      all: (productsWithPagination.all || []).map((product) =>
        prepareProduct(product, lang, true),
      ),
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
    const found = await this.productModel.findOne({ titleUrl: name });

    if (!found) {
      throw new NotFoundException(`Product with title ${name} not found`);
    }

    return lang ? prepareProduct(found, lang) : found;
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

    const newProduct = Object.assign(productReq, {
      _user: user ? user._id : undefined,
      dateAdded: Date.now(),
      images: productReq.images || [],
    });

    try {
      const product = new this.productModel(newProduct);
      await product.save();
      await this.addCategory(product);
    } catch (err) {
      console.error('Error adding product:', err);
      throw new BadRequestException();
    }
  }

  async editProduct(productReq): Promise<void> {
    const { titleUrl } = productReq;
    const found = await this.productModel.findOneAndUpdate(
      { titleUrl },
      productReq,
      { upsert: true, new: true },
    );

    if (!found) {
      throw new NotFoundException(`Product with title ${titleUrl} not found`);
    } else {
      await this.addCategory(productReq);
    }
  }

  async deleteProductByName(titleUrl: string): Promise<void> {
    const found = await this.productModel.findOneAndDelete({ titleUrl });

    if (!found) {
      throw new NotFoundException(`Product with title ${titleUrl} not found`);
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

        const newProduct = Object.assign(productReq, {
          _user: user ? user._id : undefined,
          dateAdded: Date.now(),
          images: productReq.images || [],
        });

        const product = new this.productModel(newProduct);
        await product.save();
        await this.addCategory(product);
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
