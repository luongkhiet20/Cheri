import { CartModel } from '../../cart/models/cart.model';
import { Product } from '../../products/models/product.model';
import { shippingCost, shippingTypes } from '../constans';

export const prepareProduct = (
  product,
  lang: string,
  light?: boolean,
  variants?: any[],
): Product => {
  const p = (product && typeof product.toObject === 'function') ? product.toObject() : (product || {});
  const langData = p[lang] || p.vi || p.en || p.sk || p.cs || {};

  // Human-readable title fallback from titleUrl or primary language
  const title =
    langData.title ||
    p.title ||
    (p.titleUrl
      ? p.titleUrl.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : 'Sản phẩm');

  // Commercial fields: resolve from variants if present, else fallback to language/root fields
  const allVariants = (Array.isArray(variants) && variants.length > 0)
    ? variants
    : (Array.isArray(p.variants) && p.variants.length > 0 ? p.variants : []);

  const activeVariants = allVariants.filter((v: any) => v && v.isActive !== false);

  let salePrice = 0;
  let regularPrice = 0;
  let onSale = false;
  let quantity = 0;
  let stock = 'out';

  if (activeVariants.length > 0) {
    // Derive price from variants (lowest effective sale price)
    let minPriceVariant = activeVariants[0];
    let minEffectivePrice = Infinity;

    for (const v of activeVariants) {
      const vRegular = Number(v.price) || 0;
      const vDiscount = Number(v.discountPrice) || 0;
      const vEff = (vDiscount > 0 && vDiscount < vRegular) ? vDiscount : vRegular;
      if (vEff < minEffectivePrice) {
        minEffectivePrice = vEff;
        minPriceVariant = v;
      }
      quantity += Math.max(0, Number(v.stock) || 0);
      if (vDiscount > 0 && vDiscount < vRegular) {
        onSale = true;
      }
    }

    if (minEffectivePrice !== Infinity) {
      const vReg = Number(minPriceVariant.price) || 0;
      const vDisc = Number(minPriceVariant.discountPrice) || 0;
      if (vDisc > 0 && vDisc < vReg) {
        salePrice = vDisc;
        regularPrice = vReg;
      } else {
        salePrice = vReg;
        regularPrice = vReg;
      }
    }
    stock = quantity > 0 ? 'onStock' : 'out';
  } else {
    // No variants: use language data or root document
    salePrice = Number(langData.salePrice !== undefined ? langData.salePrice : p.salePrice) || 0;
    regularPrice = Number(langData.regularPrice !== undefined ? langData.regularPrice : p.regularPrice) || salePrice;
    if (regularPrice < salePrice) regularPrice = salePrice;
    onSale = Boolean(
      langData.onSale !== undefined
        ? langData.onSale
        : (salePrice > 0 && regularPrice > 0 && salePrice < regularPrice)
    );
    quantity = Number(langData.quantity !== undefined ? langData.quantity : p.quantity) || 0;
    stock = langData.stock || (quantity > 0 ? 'onStock' : 'out');
  }

  // Main image fallback
  const mainImage = (p.mainImage && p.mainImage.url)
    ? p.mainImage
    : {
        url: (Array.isArray(p.images) && p.images[0]) || '',
        name: p.mainImage?.name || p.titleUrl || title,
      };

  // Visibility: both root (if explicitly set) and language visibility must permit
  const isGloballyVisible = p.visibility !== false;
  const isLangVisible = langData.visibility !== false || p.vi?.visibility === true || p.en?.visibility === true;
  const visibility = isGloballyVisible && isLangVisible;

  return {
    _id: p._id,
    id: p.id || (p._id ? p._id.toString() : ''),
    titleUrl: p.titleUrl || '',
    mainImage,
    images: p.images || [],
    tags: p.tags || [],
    rating: p.rating !== undefined ? p.rating : 5,
    _user: p._user,
    dateAdded: p.dateAdded,
    ...langData,
    title,
    regularPrice,
    salePrice,
    onSale,
    quantity,
    stock,
    visibility,
    descriptionFull: !light ? (langData.descriptionFull || []) : [],
  };
};

export const prepareCart = (cart, lang: string, config): CartModel => {
  const cartLangItems = cart.items.length
    ? cart.items
        .map((cartItem: any) => {
          const prepareItem = prepareProduct(cartItem.item, lang, true);
          const price: number = prepareItem.salePrice;
          const shipingCostType: string = prepareItem.shipping;
          return {
            item: prepareItem,
            id: cartItem.id,
            qty: cartItem.qty,
            price,
            shipingCostType,
          };
        })
        .filter(
          (cartItem: any) =>
            cartItem.item.visibility && cartItem.item.salePrice,
        )
    : [];

  const { totalPrice, totalQty }: { totalPrice: number; totalQty: number } =
    cartLangItems.reduce(
      (prev, item) => ({
        totalPrice: prev.totalPrice + item.price * item.qty,
        totalQty: prev.totalQty + item.qty,
      }),
      { totalPrice: 0, totalQty: 0 },
    );

  const shippingTypeCheck = cartLangItems.find(
    (item) => item.shipingCostType === shippingTypes[1],
  );
  const shippingType = shippingTypeCheck ? shippingTypes[1] : shippingTypes[0];
  const shippingByLang =
    config &&
    config[lang] &&
    config[lang].shippingCost &&
    config[lang].shippingCost[shippingType]
      ? config[lang].shippingCost[shippingType]
      : shippingCost[lang || 'en'][shippingType];
  const shippingTypeCost =
    totalPrice >= shippingByLang.limit ? 0 : shippingByLang.cost;

  return {
    items: cartLangItems,
    shippingCost: totalPrice ? shippingTypeCost : 0,
    shippingLimit: shippingByLang.limit,
    shippingType: totalPrice ? (shippingTypeCost ? shippingType : 'free') : '',
    totalPrice: totalPrice ? totalPrice + shippingTypeCost : totalPrice,
    totalQty,
  };
};

export const toSlug = (text: string): string => {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

