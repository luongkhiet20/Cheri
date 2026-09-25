import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';

export interface ProductVariant {
  key: string;            // Identity key e.g. "class:áo|color:đỏ|size:m"
  classification?: string; // e.g. "Áo", "Quần Jean"
  color?: string;          // e.g. "Đỏ", "Đen"
  size?: string;           // e.g. "S", "M"
  sku: string;
  price: number;
  discountPrice: number;
  stock: number;
}

export interface ProductColor {
  name: string;
  hex: string;
}

@Component({
  selector: 'app-product-form',
  standalone: false,
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit {
  isEditMode = false;
  productId: string | null = null;
  isLoading = false;
  isSubmitting = false;
  isDirty = false;

  // Feedback messages
  errorMessage = '';
  successMessage = '';

  // Delete confirm dialog
  confirmDeleteOpen = false;

  // Main Form Model matching MongoDB `products` collection schema
  product: any = {
    titleUrl: '',
    mainImage: {
      url: '',
      name: ''
    },
    images: [] as string[],
    tags: [] as string[],
    visibility: true,
    variants: [] as ProductVariant[],
    vi: {
      title: '',
      description: '',
      descriptionFull: '',
      regularPrice: 0,
      salePrice: 0,
      onSale: false,
      stock: 'onStock',
      productType: 'clothing',
      hasClassification: false,
      classifications: [] as string[],
      hasColors: false,
      colors: [] as ProductColor[],
      hasSizes: false,
      sizes: [] as string[],
      categoryLevel1: '',
      categoryLevel2: '',
      quantity: 10,
      visibility: true
    }
  };

  // Helper getters and sync methods for Variant - Product Stock
  get totalVariantStock(): number {
    if (!this.product.variants || this.product.variants.length === 0) {
      return Number(this.product.vi?.quantity || 0);
    }
    return this.product.variants.reduce((sum: number, v: ProductVariant) => sum + (Number(v.stock) || 0), 0);
  }

  onVariantStockChange(): void {
    this.markDirty();
    this.syncVariantStockToProduct();
  }

  syncVariantStockToProduct(): void {
    if (this.product.variants && this.product.variants.length > 0) {
      const total = this.product.variants.reduce((sum: number, v: ProductVariant) => sum + (Number(v.stock) || 0), 0);
      this.product.vi.quantity = total;
      this.product.vi.stock = total > 0 ? 'onStock' : 'outOfStock';
    }
  }

  // Keep a map of existing variants to preserve price, discountPrice, stock, sku when attributes change
  variantCache = new Map<string, ProductVariant>();


  // Helpers for image input
  imageUrlInput = '';

  // Helpers for classifications
  classificationInput = '';
  suggestedClassifications = ['Áo', 'Quần Jean', 'Váy', 'Chân váy', 'Áo khoác', 'Set đồ', 'Phụ kiện'];

  // Helpers for colors
  newColorName = '';
  newColorHex = '#000000';
  suggestedColors = [
    { name: 'Đen', hex: '#000000' },
    { name: 'Trắng', hex: '#ffffff' },
    { name: 'Đỏ', hex: '#ef4444' },
    { name: 'Xanh Navy', hex: '#1e3a8a' },
    { name: 'Be', hex: '#d4b996' },
    { name: 'Hồng', hex: '#ec4899' },
    { name: 'Nâu', hex: '#78350f' }
  ];

  // Helpers for sizes
  newCustomSize = '';
  standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];

  // Helpers for tags
  tagInput = '';
  suggestedTags = ['bán-chạy', 'sale', 'mới-ra-mắt', 'hot-trend', 'hàng-mới', 'cao-cấp'];

  // Quick batch actions for variants (UI helpers only, not stored in DB)
  quickPrice: number | null = null;
  discountBatch: number | null = null;
  quickStock: number | null = null;

  categories: any[] = [];
  defaultCategories = [
    'Quần Áo',
    'Váy Đầm',
    'Áo Khoác',
    'Set Đồ Thời Trang',
    'Đồ Bộ Nữ',
    'Phụ Kiện Thời Trang',
    'Túi Xách & Balo',
    'Giày Dép'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: AdminService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadCategories();
    this.productId = this.route.snapshot.paramMap.get('id');
    if (this.productId) {
      this.isEditMode = true;
      this.loadProduct(this.productId);
    }
  }

  markDirty(): void {
    this.isDirty = true;
    this.cdr.markForCheck();
  }

  loadCategories(): void {
    this.apiService.getCategories().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.categories = res.data;
        } else {
          this.categories = this.defaultCategories.map(name => ({ name }));
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Lỗi tải danh mục, sử dụng danh mục chuẩn:', err);
        this.categories = this.defaultCategories.map(name => ({ name }));
        this.cdr.markForCheck();
      }
    });
  }

  loadProduct(id: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.apiService.getProductById(id).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res && res.success && res.raw) {
          const raw = res.raw;
          const vi = raw.vi || {};

          // Populate existing classifications
          let loadedClassifications: string[] = [];
          if (Array.isArray(vi.classifications)) {
            loadedClassifications = [...vi.classifications];
          }

          // Populate existing colors (normalize into { name, hex })
          let loadedColors: ProductColor[] = [];
          if (Array.isArray(vi.colors)) {
            loadedColors = vi.colors.map((c: any) => {
              if (typeof c === 'string') return { name: c, hex: '#4f46e5' };
              return { name: c.name || '', hex: c.hex || '#000000' };
            });
          }

          // Populate existing sizes
          let loadedSizes: string[] = [];
          if (Array.isArray(vi.sizes)) {
            loadedSizes = [...vi.sizes];
          }

          // Populate variants and cache them
          this.variantCache.clear();
          let loadedVariants: ProductVariant[] = [];
          if (Array.isArray(raw.variants)) {
            raw.variants.forEach((v: any) => {
              const k = this.buildVariantKey(v.classification, v.color, v.size);
              const variantObj: ProductVariant = {
                key: k,
                classification: v.classification || '',
                color: v.color || '',
                size: v.size || '',
                sku: v.sku || '',
                price: Number(v.price || 0),
                discountPrice: Number(v.discountPrice !== undefined ? v.discountPrice : (v.price || 0)),
                stock: Number(v.stock !== undefined ? v.stock : 0)
              };
              this.variantCache.set(k, variantObj);
              loadedVariants.push(variantObj);
            });
          }

          this.product = {
            titleUrl: raw.titleUrl || '',
            mainImage: {
              url: raw.mainImage?.url || '',
              name: raw.mainImage?.name || ''
            },
            images: Array.isArray(raw.images) ? [...raw.images] : [],
            tags: Array.isArray(raw.tags) ? [...raw.tags] : [],
            visibility: raw.visibility !== undefined ? raw.visibility : (vi.visibility !== undefined ? vi.visibility : true),
            variants: loadedVariants,
            vi: {
              title: vi.title || '',
              description: vi.description || '',
              descriptionFull: Array.isArray(vi.descriptionFull) ? vi.descriptionFull.join('\n') : (vi.descriptionFull || ''),
              regularPrice: vi.regularPrice || 0,
              salePrice: vi.salePrice || vi.regularPrice || 0,
              onSale: !!vi.onSale,
              stock: vi.stock || (vi.quantity > 0 ? 'onStock' : 'outOfStock'),
              productType: vi.productType || 'clothing',
              hasClassification: !!vi.hasClassification,
              classifications: loadedClassifications,
              hasColors: !!vi.hasColors,
              colors: loadedColors,
              hasSizes: !!vi.hasSizes,
              sizes: loadedSizes,
              categoryLevel1: vi.categoryLevel1 || '',
              categoryLevel2: vi.categoryLevel2 || '',
              quantity: vi.quantity !== undefined ? vi.quantity : 10,
              visibility: vi.visibility !== undefined ? !!vi.visibility : true
            }
          };

          // Re-evaluate variants with existing cache and sync stock
          this.recalculateVariants();
          this.syncVariantStockToProduct();
          this.isDirty = false;
        } else {
          this.errorMessage = 'Không tìm thấy sản phẩm trong cơ sở dữ liệu.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Lỗi kết nối cơ sở dữ liệu: ' + (err.error?.message || err.message);
        this.cdr.markForCheck();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 1. IMAGE MANAGEMENT (Upload / URL / Main / Remove)
  // ─────────────────────────────────────────────────────────────
  addImageFromUrl(): void {
    if (!this.imageUrlInput || !this.imageUrlInput.trim()) return;
    const url = this.imageUrlInput.trim();

    if (!this.product.images) this.product.images = [];
    if (!this.product.images.includes(url)) {
      this.product.images.push(url);
      if (!this.product.mainImage?.url) {
        this.product.mainImage = { url, name: this.product.vi.title || 'Ảnh sản phẩm' };
      }
      this.markDirty();
    }
    this.imageUrlInput = '';
  }

  onImageFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      if (!this.product.images) this.product.images = [];
      this.product.images.push(base64);
      if (!this.product.mainImage?.url) {
        this.product.mainImage = { url: base64, name: file.name };
      }
      this.markDirty();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  setAsMainImage(imgUrl: string): void {
    this.product.mainImage = {
      url: imgUrl,
      name: this.product.vi.title || 'Ảnh chính sản phẩm'
    };
    this.markDirty();
  }

  removeImage(index: number): void {
    const removedUrl = this.product.images[index];
    this.product.images.splice(index, 1);

    if (this.product.mainImage?.url === removedUrl) {
      if (this.product.images.length > 0) {
        this.product.mainImage = {
          url: this.product.images[0],
          name: this.product.vi.title || 'Ảnh chính sản phẩm'
        };
      } else {
        this.product.mainImage = { url: '', name: '' };
      }
    }
    this.markDirty();
  }

  // ─────────────────────────────────────────────────────────────
  // 2. TAGS MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  addTag(val?: string): void {
    const raw = (val !== undefined ? val : this.tagInput);
    if (!raw || !raw.trim()) return;
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-');

    if (!this.product.tags) this.product.tags = [];
    if (!this.product.tags.includes(t)) {
      this.product.tags.push(t);
      this.markDirty();
    }
    this.tagInput = '';
  }

  removeTag(tag: string): void {
    this.product.tags = this.product.tags.filter((t: string) => t !== tag);
    this.markDirty();
  }

  isTagAdded(tag: string): boolean {
    if (!this.product.tags) return false;
    const normalized = tag.toLowerCase().replace(/\s+/g, '-');
    return this.product.tags.includes(normalized);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CLASSIFICATION ATTRIBUTES (Áo, Quần Jean, Váy, etc.)
  // ─────────────────────────────────────────────────────────────
  onToggleClassification(): void {
    this.markDirty();
    this.recalculateVariants();
  }

  addClassification(val?: string): void {
    const raw = (val !== undefined ? val : this.classificationInput);
    if (!raw || !raw.trim()) return;
    const name = raw.trim();

    if (!this.product.vi.classifications) this.product.vi.classifications = [];
    const exists = this.product.vi.classifications.some(
      (c: string) => c.toLowerCase() === name.toLowerCase()
    );
    if (!exists) {
      this.product.vi.classifications.push(name);
      this.classificationInput = '';
      this.markDirty();
      this.recalculateVariants();
    }
  }

  isClassificationAdded(name: string): boolean {
    if (!this.product.vi.classifications) return false;
    return this.product.vi.classifications.some(
      (c: string) => c.toLowerCase() === name.toLowerCase()
    );
  }

  removeClassification(index: number): void {
    if (this.product.vi.classifications) {
      this.product.vi.classifications.splice(index, 1);
      this.markDirty();
      this.recalculateVariants();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. COLOR ATTRIBUTES (name, hex)
  // ─────────────────────────────────────────────────────────────
  onToggleColors(): void {
    this.markDirty();
    this.recalculateVariants();
  }

  isColorAdded(name: string): boolean {
    if (!this.product.vi.colors) return false;
    return this.product.vi.colors.some(
      (c: ProductColor) => c.name.toLowerCase() === name.toLowerCase()
    );
  }

  addSuggestedColor(name: string, hex: string): void {
    if (!this.product.vi.colors) this.product.vi.colors = [];
    if (!this.isColorAdded(name)) {
      this.product.vi.colors.push({ name, hex });
      this.markDirty();
      this.recalculateVariants();
    }
  }

  addColor(): void {
    if (!this.newColorName || !this.newColorName.trim()) return;
    const name = this.newColorName.trim();
    const hex = this.newColorHex || '#000000';

    if (!this.product.vi.colors) this.product.vi.colors = [];
    const exists = this.product.vi.colors.some((c: ProductColor) => c.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      this.product.vi.colors.push({ name, hex });
      this.newColorName = '';
      this.markDirty();
      this.recalculateVariants();
    }
  }

  removeColor(index: number): void {
    this.product.vi.colors.splice(index, 1);
    this.markDirty();
    this.recalculateVariants();
  }

  // ─────────────────────────────────────────────────────────────
  // 5. SIZE ATTRIBUTES
  // ─────────────────────────────────────────────────────────────
  onToggleSizes(): void {
    this.markDirty();
    this.recalculateVariants();
  }

  toggleStandardSize(size: string): void {
    if (!this.product.vi.sizes) this.product.vi.sizes = [];
    const index = this.product.vi.sizes.indexOf(size);
    if (index > -1) {
      this.product.vi.sizes.splice(index, 1);
    } else {
      this.product.vi.sizes.push(size);
    }
    this.markDirty();
    this.recalculateVariants();
  }

  isStandardSizeSelected(size: string): boolean {
    return this.product.vi.sizes && this.product.vi.sizes.includes(size);
  }

  addCustomSize(): void {
    if (!this.newCustomSize || !this.newCustomSize.trim()) return;
    const s = this.newCustomSize.trim().toUpperCase();
    if (!this.product.vi.sizes) this.product.vi.sizes = [];
    if (!this.product.vi.sizes.includes(s)) {
      this.product.vi.sizes.push(s);
      this.newCustomSize = '';
      this.markDirty();
      this.recalculateVariants();
    }
  }

  removeSize(size: string): void {
    this.product.vi.sizes = this.product.vi.sizes.filter((s: string) => s !== size);
    this.markDirty();
    this.recalculateVariants();
  }

  // ─────────────────────────────────────────────────────────────
  // 6. CARTESIAN PRODUCT VARIANT COMBINATION ALGORITHM (VERY IMPORTANT)
  // Combines: Classification × Colors × Sizes
  // Preserves existing variant prices, discount prices, stock & SKU!
  // ─────────────────────────────────────────────────────────────
  buildVariantKey(classification?: string, color?: string, size?: string): string {
    const parts: string[] = [];
    if (classification) parts.push(`class:${classification.trim().toLowerCase()}`);
    if (color) parts.push(`color:${color.trim().toLowerCase()}`);
    if (size) parts.push(`size:${size.trim().toLowerCase()}`);
    return parts.join('|');
  }

  recalculateVariants(): void {
    // Cache current variants on the form before recalculating
    if (Array.isArray(this.product.variants)) {
      this.product.variants.forEach((v: ProductVariant) => {
        if (v.key) {
          this.variantCache.set(v.key, { ...v });
        }
      });
    }

    const hasClass = !!this.product.vi.hasClassification && Array.isArray(this.product.vi.classifications) && this.product.vi.classifications.length > 0;
    const hasColors = !!this.product.vi.hasColors && Array.isArray(this.product.vi.colors) && this.product.vi.colors.length > 0;
    const hasSizes = !!this.product.vi.hasSizes && Array.isArray(this.product.vi.sizes) && this.product.vi.sizes.length > 0;

    // Case: No dimension active -> No variants
    if (!hasClass && !hasColors && !hasSizes) {
      this.product.variants = [];
      return;
    }

    const classList: (string | undefined)[] = hasClass ? this.product.vi.classifications : [undefined];
    const colorList: (ProductColor | undefined)[] = hasColors ? this.product.vi.colors : [undefined];
    const sizeList: (string | undefined)[] = hasSizes ? this.product.vi.sizes : [undefined];

    const newVariants: ProductVariant[] = [];
    const baseSku = (this.product.titleUrl || this.generateSlug(this.product.vi.title) || 'SP').toUpperCase();
    const defaultPrice = Number(this.product.vi.regularPrice || 0);
    const defaultDiscountPrice = Number(this.product.vi.salePrice || defaultPrice);
    const defaultStock = Number(this.product.vi.quantity || 10);

    for (const cls of classList) {
      for (const col of colorList) {
        for (const sz of sizeList) {
          const colName = col ? col.name : undefined;
          const key = this.buildVariantKey(cls, colName, sz);
          const existing = this.variantCache.get(key);

          // Generate auto SKU based on baseSku + classification + color + size
          const skuParts: string[] = [baseSku];
          if (cls) skuParts.push(this.slugify(cls));
          if (colName) skuParts.push(this.slugify(colName));
          if (sz) skuParts.push(this.slugify(sz));
          const autoSku = skuParts.join('-').toUpperCase();

          if (existing) {
            newVariants.push({
              key,
              classification: cls,
              color: colName,
              size: sz,
              sku: existing.sku || autoSku,
              price: existing.price !== undefined ? existing.price : defaultPrice,
              discountPrice: existing.discountPrice !== undefined ? existing.discountPrice : defaultDiscountPrice,
              stock: existing.stock !== undefined ? existing.stock : defaultStock
            });
          } else {
            newVariants.push({
              key,
              classification: cls,
              color: colName,
              size: sz,
              sku: autoSku,
              price: defaultPrice,
              discountPrice: defaultDiscountPrice,
              stock: defaultStock
            });
          }
        }
      }
    }

    this.product.variants = newVariants;
    this.syncVariantStockToProduct();
  }

  // Batch actions (UI state helpers)
  applyQuickPrice(): void {
    if (this.quickPrice === null || this.quickPrice < 0) return;
    this.product.variants.forEach((v: ProductVariant) => v.price = Number(this.quickPrice));
    this.markDirty();
  }

  applyDiscountBatch(): void {
    if (this.discountBatch === null || this.discountBatch < 0) return;
    this.product.variants.forEach((v: ProductVariant) => v.discountPrice = Number(this.discountBatch));
    this.markDirty();
  }

  applyQuickStock(): void {
    if (this.quickStock === null || this.quickStock < 0) return;
    this.product.variants.forEach((v: ProductVariant) => v.stock = Number(this.quickStock));
    this.syncVariantStockToProduct();
    this.markDirty();
  }


  // ─────────────────────────────────────────────────────────────
  // 7. FORM VALIDATION & SUBMIT
  // ─────────────────────────────────────────────────────────────
  onSubmit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    const vi = this.product.vi || {};

    if (!vi.title || !vi.title.trim()) {
      this.errorMessage = 'Tên sản phẩm (vi.title) không được để trống';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!vi.categoryLevel1 || !vi.categoryLevel1.trim()) {
      this.errorMessage = 'Vui lòng chọn Danh mục cấp 1 cho sản phẩm';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!this.product.mainImage?.url && (!this.product.images || this.product.images.length === 0)) {
      this.errorMessage = 'Vui lòng thêm ít nhất 1 hình ảnh cho sản phẩm';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!this.product.titleUrl || !this.product.titleUrl.trim()) {
      this.product.titleUrl = this.generateSlug(vi.title);
    }

    const hasVariants = Array.isArray(this.product.variants) && this.product.variants.length > 0;

    // Price validation for non-variant product
    if (!hasVariants) {
      if (vi.regularPrice < 0) {
        this.errorMessage = 'Giá niêm yết không được là số âm';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (vi.onSale || (vi.salePrice !== undefined && vi.salePrice > 0)) {
        if (Number(vi.salePrice) >= Number(vi.regularPrice)) {
          this.errorMessage = `Giá khuyến mãi (${Number(vi.salePrice).toLocaleString('vi-VN')}₫) phải nhỏ hơn giá niêm yết (${Number(vi.regularPrice).toLocaleString('vi-VN')}₫).`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    // Validation for Classification
    if (vi.hasClassification && (!vi.classifications || vi.classifications.length === 0)) {
      this.errorMessage = 'Bạn đã bật "Sản phẩm có nhiều phân loại". Vui lòng thêm ít nhất một phân loại (ví dụ: Áo, Quần Jean) hoặc tắt tùy chọn này.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validation for Colors
    if (vi.hasColors && (!vi.colors || vi.colors.length === 0)) {
      this.errorMessage = 'Bạn đã bật "Sản phẩm có nhiều màu sắc". Vui lòng thêm ít nhất một màu sắc hoặc tắt tùy chọn màu sắc.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validation for Sizes
    if (vi.hasSizes && (!vi.sizes || vi.sizes.length === 0)) {
      this.errorMessage = 'Bạn đã bật "Sản phẩm có nhiều kích cỡ". Vui lòng chọn ít nhất một kích cỡ hoặc tắt tùy chọn kích cỡ.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Validation for Variants
    if (hasVariants) {
      const skuSet = new Set<string>();
      for (let i = 0; i < this.product.variants.length; i++) {
        const v = this.product.variants[i];
        if (!v.sku || !v.sku.trim()) {
          this.errorMessage = `Biến thể #${i + 1} chưa có mã SKU. Vui lòng nhập SKU cho tất cả biến thể.`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        const normalizedSku = v.sku.trim().toUpperCase();
        if (skuSet.has(normalizedSku)) {
          this.errorMessage = `Mã SKU "${normalizedSku}" bị trùng giữa các biến thể. Mỗi biến thể phải có một SKU duy nhất.`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        skuSet.add(normalizedSku);

        if (v.price === undefined || v.price === null || isNaN(Number(v.price)) || Number(v.price) < 0) {
          this.errorMessage = `Giá bán của biến thể #${i + 1} (${v.sku}) phải là số >= 0.`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (v.discountPrice !== undefined && v.discountPrice !== null && Number(v.discountPrice) > 0) {
          if (Number(v.discountPrice) >= Number(v.price)) {
            this.errorMessage = `Biến thể #${i + 1} (${v.sku}): Giá khuyến mãi (${Number(v.discountPrice).toLocaleString('vi-VN')}₫) phải nhỏ hơn giá bán (${Number(v.price).toLocaleString('vi-VN')}₫).`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        }

        if (v.stock === undefined || v.stock === null || isNaN(Number(v.stock)) || Number(v.stock) < 0) {
          this.errorMessage = `Tồn kho của biến thể #${i + 1} (${v.sku}) phải là số >= 0.`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    this.isSubmitting = true;

    // Determine Single Source of Truth for Price and Stock
    let finalQuantity: number;
    let finalStock: string;
    let finalRegularPrice: number;
    let finalSalePrice: number;
    let finalOnSale: boolean;

    if (hasVariants) {
      finalQuantity = this.totalVariantStock;
      finalStock = finalQuantity > 0 ? 'onStock' : 'outOfStock';
      const prices = this.product.variants.map((v: ProductVariant) => Number(v.price || 0));
      finalRegularPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const discounted = this.product.variants.filter((v: ProductVariant) => Number(v.discountPrice) > 0 && Number(v.discountPrice) < Number(v.price));
      if (discounted.length > 0) {
        finalSalePrice = Math.min(...discounted.map((v: ProductVariant) => Number(v.discountPrice)));
        finalOnSale = true;
      } else {
        finalSalePrice = finalRegularPrice;
        finalOnSale = false;
      }
    } else {
      finalQuantity = Number(vi.quantity || 0);
      finalStock = vi.stock || (finalQuantity > 0 ? 'onStock' : 'outOfStock');
      finalRegularPrice = Number(vi.regularPrice || 0);
      finalSalePrice = Number(vi.salePrice !== undefined && vi.salePrice !== '' ? vi.salePrice : finalRegularPrice);
      finalOnSale = !!vi.onSale;
    }

    // Build payload without shipping fields and without manual stockDate
    const payload = {
      titleUrl: this.product.titleUrl.trim(),
      mainImage: this.product.mainImage,
      images: this.product.images || [],
      tags: this.product.tags || [],
      visibility: this.product.visibility !== false,
      variants: hasVariants ? this.product.variants : [],
      vi: {
        title: vi.title.trim(),
        description: vi.description || '',
        descriptionFull: typeof vi.descriptionFull === 'string'
          ? vi.descriptionFull.split('\n').filter((l: string) => l.trim().length > 0)
          : vi.descriptionFull,
        regularPrice: finalRegularPrice,
        salePrice: finalSalePrice,
        onSale: finalOnSale,
        quantity: finalQuantity,
        stock: finalStock,
        productType: vi.productType || 'clothing',
        hasClassification: !!vi.hasClassification,
        classifications: vi.hasClassification && Array.isArray(vi.classifications) ? vi.classifications : [],
        hasColors: !!vi.hasColors,
        colors: vi.hasColors && Array.isArray(vi.colors) ? vi.colors : [],
        hasSizes: !!vi.hasSizes,
        sizes: vi.hasSizes && Array.isArray(vi.sizes) ? vi.sizes : [],
        categoryLevel1: vi.categoryLevel1 ? vi.categoryLevel1.trim() : '',
        categoryLevel2: vi.categoryLevel2 ? vi.categoryLevel2.trim() : '',
        visibility: this.product.visibility !== false
      }
    };


    if (this.isEditMode && this.productId) {
      // UPDATE: PUT /api/products/:id
      this.apiService.updateProduct(this.productId, payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Cập nhật sản phẩm thành công vào cơ sở dữ liệu MongoDB!';
            this.isDirty = false;
            this.cdr.markForCheck();
            setTimeout(() => {
              this.router.navigate(['/admin/products', this.productId]);
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi cập nhật sản phẩm';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = 'Lỗi lưu sản phẩm: ' + (err.error?.message || err.message);
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    } else {
      // CREATE: POST /api/products
      this.apiService.createProduct(payload).subscribe({
        next: (res) => {
          this.isSubmitting = false;
          if (res.success) {
            this.successMessage = 'Thêm sản phẩm thành công vào cơ sở dữ liệu MongoDB!';
            this.isDirty = false;
            this.cdr.markForCheck();
            const newId = res.id || res.data?._id;
            setTimeout(() => {
              if (newId) {
                this.router.navigate(['/admin/products', newId]);
              } else {
                this.router.navigate(['/admin/products']);
              }
            }, 600);
          } else {
            this.errorMessage = res.message || 'Lỗi thêm sản phẩm';
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          this.isSubmitting = false;
          this.errorMessage = 'Lỗi thêm sản phẩm: ' + (err.error?.message || err.message);
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }

  onCancel(): void {
    if (this.isDirty) {
      const confirmLeave = confirm('Bạn có chắc muốn rời khỏi trang? Các thay đổi chưa được lưu sẽ bị mất.');
      if (!confirmLeave) return;
    }

    if (this.isEditMode && this.productId) {
      this.router.navigate(['/admin/products', this.productId]);
    } else {
      this.router.navigate(['/admin/products']);
    }
  }

  // Delete product action inside Edit mode
  onDeleteClick(): void {
    this.openConfirmDelete();
  }

  openConfirmDelete(): void {
    this.confirmDeleteOpen = true;
  }

  onConfirmDelete(): void {
    if (!this.productId) return;
    this.apiService.deleteProduct(this.productId).subscribe({
      next: (res) => {
        this.confirmDeleteOpen = false;
        if (res.success) {
          this.router.navigate(['/admin/products']);
        } else {
          this.errorMessage = res.message || 'Lỗi khi xóa sản phẩm';
        }
      },
      error: (err) => {
        this.confirmDeleteOpen = false;
        this.errorMessage = 'Lỗi khi xóa: ' + (err.error?.message || err.message);
      }
    });
  }

  onCancelDelete(): void {
    this.confirmDeleteOpen = false;
  }

  // Helpers
  generateSlug(title: string): string {
    if (!title) return '';
    return this.slugify(title);
  }

  slugify(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
