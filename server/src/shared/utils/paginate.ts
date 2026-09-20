import { PaginateOptions, Product } from '../../products/models/product.model';

function paginateSchema(
  query,
  options: PaginateOptions,
): Promise<{ all: Product[]; pagination; maxPrice: number; minPrice: number }> {
  query = query || {};
  options = Object.assign({}, options);

  const sort = options.sort;
  // eslint-disable-next-line no-prototype-builtins
  const limit = options.hasOwnProperty('limit') ? options.limit : 10;
  const page = options.page || 1;
  // eslint-disable-next-line no-prototype-builtins
  const skip = options.hasOwnProperty('page') ? (page - 1) * limit : 0;
  const all = limit
    ? this.find(query).lean().sort(sort).skip(skip).limit(limit).exec()
    : this.find(query).lean().exec();
  const countDocuments = this.countDocuments(query).exec();
  const maxPrice = this.findOne({})
    .lean()
    .sort(`-${options.lang}.${options.price}`)
    .select(`${options.lang}.${options.price} vi.${options.price}`);
  const minPrice = this.findOne({})
    .lean()
    .sort(`${options.lang}.${options.price}`)
    .select(`${options.lang}.${options.price} vi.${options.price}`);

  return Promise.all([all, countDocuments, maxPrice, minPrice]).then(
    function (values) {
      const getPrice = (doc, fallback) => {
        if (!doc) return fallback;
        if (doc[options.lang] && doc[options.lang][options.price] !== undefined) {
          return doc[options.lang][options.price];
        }
        if (doc.vi && doc.vi[options.price] !== undefined) {
          return doc.vi[options.price];
        }
        return fallback;
      };

      return Promise.resolve({
        all: values[0],
        pagination: {
          total: values[1],
          limit: limit,
          page: page,
          pages: Math.ceil(values[1] / limit) || 1,
        },
        maxPrice: getPrice(values[2], 5000000),
        minPrice: getPrice(values[3], 0),
      });
    },
  );
}

export const paginateFn = paginateSchema;

export const pagination = (schema): void => {
  schema.statics.paginate = paginateSchema;
  const paginate = paginateFn;
};
