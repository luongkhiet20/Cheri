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
    let hasVariantStockField = false;

    for (const v of activeVariants) {
      const vRegular = Number(v.price) || 0;
      const vDiscount = Number(v.discountPrice) || 0;
      const vEff = (vDiscount > 0 && vDiscount < vRegular) ? vDiscount : vRegular;
      if (vEff < minEffectivePrice) {
        minEffectivePrice = vEff;
        minPriceVariant = v;
      }
      const vRawStock = v.stock !== undefined ? v.stock : v.quantity;
      if (vRawStock !== undefined && vRawStock !== null && vRawStock !== '') {
        hasVariantStockField = true;
        quantity += Math.max(0, Number(vRawStock) || 0);
      }
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
    if (!hasVariantStockField) {
      quantity = 999;
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

    const rawStock = langData.stock !== undefined ? langData.stock : p.stock;
    const rawQty = langData.quantity !== undefined ? langData.quantity : p.quantity;

    if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
      quantity = Math.max(0, Number(rawQty) || 0);
    } else if (rawStock !== undefined && rawStock !== null && !isNaN(Number(rawStock)) && rawStock !== '') {
      quantity = Math.max(0, Number(rawStock) || 0);
    } else {
      if (rawStock === 'out' || rawStock === 'outOfStock' || rawStock === 'unavailable' || rawStock === '0') {
        quantity = 0;
      } else {
        quantity = 999;
      }
    }

    if (rawStock === 'out' || rawStock === 'outOfStock' || rawStock === 'unavailable' || rawStock === '0') {
      stock = 'out';
    } else {
      stock = quantity > 0 ? 'onStock' : 'out';
    }
  }

  // Main image fallback
  const mainImage = (p.mainImage && p.mainImage.url)
    ? p.mainImage
    : {
        url: (Array.isArray(p.images) && p.images[0]) || '',
        name: p.mainImage?.name || p.titleUrl || title,
      };

  // Visibility: both root and language/vi visibility must permit
  const isGloballyVisible = p.visibility !== false;
  const isLangVisible = langData.visibility !== false && (p.vi?.visibility !== false);
  const visibility = isGloballyVisible && isLangVisible;

  return {
    _id: p._id,
    id: p.id || (p._id ? p._id.toString() : ''),
    sku: p.sku || '',
    titleUrl: p.titleUrl || '',
    mainImage,
    images: p.images || [],
    tags: p.tags || [],
    rating: p.rating !== undefined ? p.rating : 5,
    _user: p._user,
    dateAdded: p.dateAdded,
    hasClassification: p.hasClassification ?? langData.hasClassification,
    hasColors: p.hasColors ?? langData.hasColors,
    hasSizes: p.hasSizes ?? langData.hasSizes,
    classifications: p.classifications || langData.classifications || [],
    colors: p.colors || langData.colors || [],
    sizes: p.sizes || langData.sizes || [],
    variants: allVariants,
    shippingBasicCost: p.shippingBasicCost !== undefined ? p.shippingBasicCost : langData.shippingBasicCost,
    shippingExtendedCost: p.shippingExtendedCost !== undefined ? p.shippingExtendedCost : langData.shippingExtendedCost,
    shippingCost: p.shippingCost !== undefined ? p.shippingCost : langData.shippingCost,
    shipping: p.shipping || langData.shipping,
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
          const allVariants = Array.isArray(prepareItem.variants) ? prepareItem.variants : [];

          // Find active/selected variant
          let variant = cartItem.variant || null;
          if (!variant && allVariants.length > 0) {
            if (cartItem.variantId) {
              variant = allVariants.find(
                (v: any) =>
                  (v._id && v._id.toString() === cartItem.variantId) ||
                  v.id === cartItem.variantId ||
                  v.sku === cartItem.variantId,
              );
            }
            if (
              !variant &&
              (cartItem.selectedClassification ||
                cartItem.selectedColor ||
                cartItem.selectedSize)
            ) {
              variant = allVariants.find((v: any) => {
                const mClass =
                  !cartItem.selectedClassification ||
                  v.classification === cartItem.selectedClassification;
                const mColor =
                  !cartItem.selectedColor || v.color === cartItem.selectedColor;
                const mSize =
                  !cartItem.selectedSize || v.size === cartItem.selectedSize;
                return mClass && mColor && mSize;
              });
            }
            if (!variant) {
              variant = allVariants[0];
            }
          }

          let price: number = prepareItem.salePrice;
          let regularPrice: number = prepareItem.regularPrice;
          let stock: number = prepareItem.quantity;
          let sku: string = prepareItem.sku || '';

          if (variant) {
            const vReg = Number(variant.price) || regularPrice;
            const vDisc = Number(variant.discountPrice) || 0;
            if (vDisc > 0 && vDisc < vReg) {
              price = vDisc;
              regularPrice = vReg;
            } else {
              price = vReg;
              regularPrice = vReg;
            }
            stock = Math.max(0, Number(variant.stock) || 0);
            sku = variant.sku || sku;
          }

          const shipingCostType: string = prepareItem.shipping;
          return {
            item: prepareItem,
            id: cartItem.id,
            qty: cartItem.qty,
            price,
            regularPrice,
            stock,
            sku,
            variantId: variant
              ? (variant._id?.toString() || variant.id || variant.sku)
              : (cartItem.variantId || null),
            selectedClassification: variant
              ? variant.classification
              : (cartItem.selectedClassification || null),
            selectedColor: variant
              ? variant.color
              : (cartItem.selectedColor || null),
            selectedSize: variant
              ? variant.size
              : (cartItem.selectedSize || null),
            variant,
            isSelected: cartItem.isSelected !== false,
            shipingCostType,
          };
        })
        .filter(
          (cartItem: any) =>
            cartItem.item.visibility && (cartItem.price > 0 || cartItem.item.salePrice > 0),
        )
    : [];

  const deduplicatedItems: any[] = [];
  for (const cItem of cartLangItems) {
    const pId = (cItem.item?._id || cItem.item?.id || (typeof cItem.id === 'string' && cItem.id.includes('_') ? cItem.id.split('_')[0] : cItem.id))?.toString();
    const vId = (cItem.variantId !== undefined && cItem.variantId !== null && cItem.variantId !== '') ? String(cItem.variantId).trim() : null;
    const existing = deduplicatedItems.find((d: any) => {
      const dPId = (d.item?._id || d.item?.id || (typeof d.id === 'string' && d.id.includes('_') ? d.id.split('_')[0] : d.id))?.toString();
      const dVId = (d.variantId !== undefined && d.variantId !== null && d.variantId !== '') ? String(d.variantId).trim() : null;
      return (d.id === cItem.id) || (dPId && pId && dPId === pId && dVId === vId);
    });
    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + (Number(cItem.qty) || 0);
    } else {
      deduplicatedItems.push(cItem);
    }
  }

  const { totalPrice, totalQty }: { totalPrice: number; totalQty: number } =
    deduplicatedItems.reduce(
      (prev, item) => ({
        totalPrice: prev.totalPrice + item.price * item.qty,
        totalQty: prev.totalQty + item.qty,
      }),
      { totalPrice: 0, totalQty: 0 },
    );

  const shippingTypeCheck = deduplicatedItems.find(
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
    items: deduplicatedItems,
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

