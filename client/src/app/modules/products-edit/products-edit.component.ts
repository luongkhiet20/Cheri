import { filter, first, take, delay, startWith, map } from 'rxjs/operators';
import { Component, OnInit, Input, OnDestroy, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject, from, combineLatest } from 'rxjs';


import { ApiService } from '../../services/api.service';
import { languages } from '../../shared/constants';
import { Product, Category } from '../../shared/models';
import { SignalStore } from '../../store/signal.store';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';
import { toObservable } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-products-edit',
  templateUrl: './products-edit.component.html',
  styleUrls: ['./products-edit.component.css'],
  standalone: false
})
export class ProductsEditComponent implements OnInit, OnDestroy, OnChanges {
  @Input() action: string;
  @Input() titles: string[];
  @Input() productToEditTitleUrl: string;

  @Output() changeTab = new EventEmitter<number>();

  productEditForm: FormGroup;
  searchProductCtrl = new FormControl('');
  allProducts$: Observable<Product[]>;
  filteredProducts$: Observable<Product[]>;
  images$: Observable<string[]>;
  sendRequest = false;
  descriptionFullSub$: BehaviorSubject<{ [x: string]: string }> = new BehaviorSubject(
    languages.reduce((prev, lang) => ({ ...prev, [lang]: '' }), {})
  );
  product$: Observable<Product>;
  categories$: Observable<Category[]>;
  productSub: Subscription;
  languageOptions = languages;
  choosenLanguageSub$ = new BehaviorSubject(languages[0]);
  tag: string;

  presetColors = [
    { name: 'Đỏ Rượu', hex: '#74070E' },
    { name: 'Đen', hex: '#1A1A1A' },
    { name: 'Trắng', hex: '#FFFFFF' },
    { name: 'Kem Be', hex: '#F5EBE1' },
    { name: 'Hồng Pastel', hex: '#F7CAD0' },
    { name: 'Xanh Navy', hex: '#1B263B' },
    { name: 'Xanh Rêu', hex: '#4A5844' },
    { name: 'Nâu Tây', hex: '#6F4E37' },
    { name: 'Xám Khói', hex: '#8D99AE' },
  ];

  standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  categoriesTree: { [key: string]: string[] } = {
    'Đầm & Váy': ['Đầm Dạ Hội', 'Đầm Tiệc Cocktail', 'Đầm Dạo Phố', 'Đầm Chữ A', 'Đầm Body', 'Đầm Maxi', 'Đầm Suông'],
    'Áo': ['Sơ Mi Lụa', 'Áo Kiểu Sang Trọng', 'Áo Ren', 'Áo Croptop', 'Áo Len & Thun'],
    'Áo Khoác & Blazer': ['Blazer Dạ', 'Blazer Tweed', 'Áo Khoác Dáng Dài', 'Cardigan'],
    'Quần & Chân Váy': ['Chân Váy Xòe', 'Chân Váy Bút Chì', 'Quần Palazzo Ống Rộng', 'Quần Tây Âu'],
    'Set Bộ Thiết Kế': ['Set Áo & Chân Váy', 'Set Blazer & Quần', 'Set Dạ Tweed'],
    'Túi Xách & Ví': ['Túi Kẹp Nách', 'Túi Xách Tay', 'Túi Đeo Chéo', 'Ví Cầm Tay Clutch'],
    'Trang Sức & Phụ Kiện': ['Khuyên Tai', 'Vòng Cổ Ngọc Trai', 'Hoa Cài Áo Mạ Vàng', 'Nhẫn & Vòng Tay', 'Khăn Lụa & Thắt Lưng'],
    'Giày & Guốc': ['Giày Cao Gót', 'Guốc Mules', 'Sandal Sang Trọng', 'Giày Búp Bê']
  };

  customColorName = '';
  customColorHex = '#74070E';
  customSize = '';

  // CSV Import
  csvProducts: any[] = [];
  csvImporting = false;
  csvImportResult: { imported: number; errors: string[] } | null = null;
  csvFileName = '';

  constructor(private fb: FormBuilder, private store: SignalStore, private selectors: SignalStoreSelectors, private apiService: ApiService) {
    this.createForm();
    this.product$ = toObservable(this.selectors.product)
      .pipe(filter((product) => !!product && !!product.titleUrl && !product.title));
    this.categories$ = toObservable(this.selectors.categories);
    this.images$ = toObservable(this.selectors.productImages);
    this.allProducts$ = toObservable(this.selectors.allProducts);
    this.store.getCategories(languages[0]);
  }

  ngOnInit(): void {
    this.store.getImages();
    this.store.getAllProducts();
    if (this.productToEditTitleUrl) {
      this.store.getProduct(this.productToEditTitleUrl);
    }

    this.filteredProducts$ = combineLatest([
      this.allProducts$,
      this.searchProductCtrl.valueChanges.pipe(startWith('')),
    ]).pipe(
      map(([products, search]) => {
        if (!products || !products.length) return [];
        if (!search || typeof search !== 'string') return products;
        const q = search.toLowerCase().trim();
        return products.filter((p) => {
          const title = (p.title || p['vi']?.title || p.titleUrl || '').toLowerCase();
          const code = (p.titleUrl || '').toLowerCase();
          return title.includes(q) || code.includes(q);
        });
      })
    );

    this.productSub = this.product$.subscribe((product) => {
      const newForm = {
        titleUrl: product.titleUrl,
        mainImage: product.mainImage && product.mainImage.url ? product.mainImage.url : '',
        tags: product.tags,
        images: product.images || [],
        imageUrl: '',
        ...this.prepareLangEditForm(product),
      };

      const prepareDescFull = this.languageOptions
        .map((lang) => ({
          [lang]: product[lang]?.descriptionFull?.length ? product[lang].descriptionFull[0] : '',
        }))
        .reduce((prev, curr) => ({ ...prev, ...curr }), {});

      this.descriptionFullSub$.next(prepareDescFull);
      this.productEditForm.setValue(newForm);
      const displayName = product.title || product['vi']?.title || product.titleUrl;
      this.searchProductCtrl.setValue(displayName, { emitEvent: false });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productToEditTitleUrl'] && this.productToEditTitleUrl) {
      this.store.getProduct(this.productToEditTitleUrl);
    }
    if (changes['action'] && this.action === 'add') {
      this.createForm();
      this.sendRequest = false;
      this.manualTitleUrl = false;
      this.csvProducts = [];
      this.csvFileName = '';
      this.csvImportResult = null;
      this.searchProductCtrl.setValue('', { emitEvent: false });
      this.descriptionFullSub$.next(
        this.languageOptions.reduce((prev, lang) => ({ ...prev, [lang]: '' }), {})
      );
    }
  }

  onSelectProduct(titleUrl: string): void {
    if (titleUrl) {
      this.store.getProduct(titleUrl);
      this.productEditForm.patchValue({ titleUrl: titleUrl });
    }
  }

  ngOnDestroy(): void {
    if (this.productSub) {
      this.productSub.unsubscribe();
    }
  }

  onFileChanged(event) {
    const files = event.target.files;
    if (files.length === 0)
      return;

    const mimeType = files[0].type;
    if (mimeType.match(/image\/*/) == null) {
      console.log("Only images are supported.");
      return;
    }

    const uploadImage = this.apiService.uploadImage({ fileToUpload: files[0], titleUrl: this.productToEditTitleUrl });

    uploadImage.pipe(take(1))
      .subscribe((result: any) => {
        if (result && result.titleUrl) {
          this.store.storeProduct(result);
        } else if (result && result.all) {
          this.store.storeProductImages(result);
        }
      });
  }

  onEditorChange(value): void {
    this.choosenLanguageSub$.pipe(filter(Boolean), take(1)).subscribe((lang: string) => {
      this.productEditForm.get(lang).patchValue({ descriptionFull: value });
    });
  }

  createForm(): void {
    this.productEditForm = this.fb.group({
      titleUrl: [''],
      mainImage: '',
      tags: [[]],
      images: [],
      imageUrl: '',
      ...this.createLangForm(this.languageOptions),
    });
  }

  onRemoveImage(image: string, type: string): void {
    const titleUrl = type === 'product' ? { titleUrl: this.productEditForm.get('titleUrl').value } : {};

    this.store.removeImage({ image: image, ...titleUrl });
  }

  setLang(lang: string): void {
    this.choosenLanguageSub$.next('');
    from(lang)
      .pipe(delay(100))
      .subscribe(() => {
        this.choosenLanguageSub$.next(lang);
      });

    const prepareDescFull = this.languageOptions
      .map((language) => {
        const descriptionFull = this.productEditForm.get([language]).value.descriptionFull;
        return {
          [language]:
            typeof descriptionFull === 'string' ? descriptionFull : descriptionFull.length ? descriptionFull[0] : '',
        };
      })
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
    this.descriptionFullSub$.next(prepareDescFull);
  }

  addTag(): void {
    if (this.tag) {
      const formTags = this.productEditForm.value.tags.filter((tag) => tag !== this.tag);
      const tags = [...formTags, this.tag.replace(/ /g, '_').toLowerCase()];
      this.productEditForm.get('tags').setValue(tags);
      this.tag = '';
    }
  }

  removeTag(tagToRemove: string): void {
    const formTags = this.productEditForm.value.tags.filter((tag) => tag !== tagToRemove);
    this.productEditForm.get('tags').setValue(formTags);
  }

  addImageUrl(): void {
    const imageUrl = this.productEditForm.get('imageUrl').value;
    const titleUrl = this.productEditForm.get('titleUrl').value;
    if (imageUrl && titleUrl) {
      this.testImageUrl = imageUrl;
    }
  }

  checkImageUrl() {
    const imageUrl = this.productEditForm.get('imageUrl').value;
    const titleUrl = this.productEditForm.get('titleUrl').value;
    this.store.addProductImagesUrl({ image: imageUrl, titleUrl });
    this.testImageUrl = '';
  }

  openForm(): void {
    this.sendRequest = false;
  }

  findProduct(): void {
    const titleUrl = this.productEditForm.get('titleUrl').value;
    if (titleUrl) {
      this.store.getProduct(titleUrl);
    }
  }

  manualTitleUrl = false;

  generateSlug(text: string): string {
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
  }

  formatTitleUrl(event: any): void {
    const val = event?.target?.value || '';
    if (val) {
      const formatted = this.generateSlug(val);
      this.productEditForm.get('titleUrl')?.setValue(formatted);
    }
  }

  onTitleUrlInput(): void {
    this.manualTitleUrl = true;
  }

  onTitleInput(event: any, lang: string): void {
    if (this.action === 'add' && !this.manualTitleUrl) {
      const titleVal = event?.target?.value || '';
      this.productEditForm.get('titleUrl')?.setValue(this.generateSlug(titleVal));
    }
  }

  onSubmit(): void {
    const formVal = this.productEditForm.value;
    let titleUrl = formVal.titleUrl;

    if (!titleUrl || !titleUrl.trim()) {
      const chosenLang = this.choosenLanguageSub$.value || 'vi';
      const name =
        formVal[chosenLang]?.title ||
        formVal.vi?.title ||
        formVal.en?.title ||
        formVal.sk?.title ||
        formVal.cs?.title ||
        '';
      titleUrl = this.generateSlug(name) || `sp-${Date.now()}`;
    }

    switch (this.action) {
      case 'add':
        this.images$.pipe(first()).subscribe((images) => {
          if (images && images.length) {
            this.productEditForm.patchValue({ images: images });
          }

          const productPrepare = {
            ...this.productEditForm.value,
            titleUrl: titleUrl,
            mainImage: {
              url: this.productEditForm.value.mainImage || '',
              name: titleUrl,
            },
            tags: this.productEditForm.value.tags || [],
            images: this.productEditForm.value.images || [],
            ...this.prepareProductData(this.languageOptions, this.productEditForm.value),
          };

          this.store.addProduct(productPrepare);
        });
        break;

      case 'edit':
        const productPrepareEdit = {
          ...this.productEditForm.value,
          titleUrl: titleUrl,
          mainImage: {
            url: this.productEditForm.value.mainImage || '',
            name: titleUrl,
          },
          tags: this.productEditForm.value.tags || [],
          images: this.productEditForm.value.images || [],
          ...this.prepareProductData(this.languageOptions, this.productEditForm.value),
        };

        this.store.editProduct(productPrepareEdit);
        break;
    }

    this.sendRequest = true;
  }

  onRemoveSubmit(): void {
    this.store.removeProduct(this.productEditForm.get('titleUrl').value);
    this.sendRequest = true;
  }

  priceValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const regularPriceCtrl = control.get('regularPrice');
    const salePriceCtrl = control.get('salePrice');

    const regularPrice = Number(regularPriceCtrl?.value);
    const salePriceVal = salePriceCtrl?.value;
    const salePrice = Number(salePriceVal);

    if (salePriceVal !== '' && salePriceVal !== null && salePriceVal !== undefined && !isNaN(salePrice) && salePrice > 0) {
      if (regularPrice <= salePrice) {
        salePriceCtrl?.setErrors({ ...(salePriceCtrl?.errors || {}), priceInvalid: true });
        return { priceInvalid: true };
      } else {
        if (salePriceCtrl?.hasError('priceInvalid')) {
          const errors = { ...salePriceCtrl.errors };
          delete errors.priceInvalid;
          salePriceCtrl.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
    } else {
      if (salePriceCtrl?.hasError('priceInvalid')) {
        const errors = { ...salePriceCtrl.errors };
        delete errors.priceInvalid;
        salePriceCtrl.setErrors(Object.keys(errors).length ? errors : null);
      }
    }
    return null;
  };

  testImageUrl: string;
  filteredTitles$: Observable<string[]>;

  onProductTypeChange(type: string, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (!langGroup) return;

    langGroup.patchValue({ productType: type });
    if (type === 'clothing') {
      langGroup.patchValue({
        hasColors: true,
        hasSizes: true,
        hasClassification: true,
      });
    } else if (type === 'accessories') {
      langGroup.patchValue({
        hasColors: true,
        hasSizes: false,
        hasClassification: true,
      });
    }
  }

  toggleColor(color: { name: string; hex: string }, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (!langGroup) return;
    const currentColors: { name: string; hex: string }[] = langGroup.get('colors')?.value || [];
    const index = currentColors.findIndex(c => c.hex.toLowerCase() === color.hex.toLowerCase() || c.name === color.name);

    if (index > -1) {
      currentColors.splice(index, 1);
    } else {
      currentColors.push(color);
    }
    langGroup.get('colors')?.setValue([...currentColors]);
  }

  isColorSelected(color: { name: string; hex: string }, lang: string): boolean {
    const currentColors: { name: string; hex: string }[] = this.productEditForm.get([lang, 'colors'])?.value || [];
    return currentColors.some(c => c.hex.toLowerCase() === color.hex.toLowerCase() || c.name === color.name);
  }

  addCustomColor(lang: string): void {
    if (!this.customColorName || !this.customColorName.trim()) return;
    const color = {
      name: this.customColorName.trim(),
      hex: this.customColorHex || '#74070E',
    };
    this.toggleColor(color, lang);
    this.customColorName = '';
  }

  removeColor(index: number, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (!langGroup) return;
    const currentColors = [...(langGroup.get('colors')?.value || [])];
    currentColors.splice(index, 1);
    langGroup.get('colors')?.setValue(currentColors);
  }

  toggleSize(size: string, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (!langGroup) return;
    const currentSizes: string[] = langGroup.get('sizes')?.value || [];
    const index = currentSizes.indexOf(size);

    if (index > -1) {
      currentSizes.splice(index, 1);
    } else {
      currentSizes.push(size);
    }
    langGroup.get('sizes')?.setValue([...currentSizes]);
  }

  isSizeSelected(size: string, lang: string): boolean {
    const currentSizes: string[] = this.productEditForm.get([lang, 'sizes'])?.value || [];
    return currentSizes.includes(size);
  }

  addCustomSize(lang: string): void {
    if (!this.customSize || !this.customSize.trim()) return;
    this.toggleSize(this.customSize.trim().toUpperCase(), lang);
    this.customSize = '';
  }

  removeSize(size: string, lang: string): void {
    this.toggleSize(size, lang);
  }

  getLevel1Categories(): string[] {
    return Object.keys(this.categoriesTree);
  }

  getLevel2Categories(level1: string): string[] {
    return this.categoriesTree[level1] || [];
  }

  onLevel1Change(level1: string, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (langGroup) {
      langGroup.patchValue({
        categoryLevel1: level1,
        categoryLevel2: ''
      });
    }
  }

  private createLangForm(languageOptions: Array<string>) {
    return languageOptions
      .map((lang: string) => ({
        [lang]: this.fb.group({
          title: ['', Validators.required],
          description: '',
          regularPrice: ['', [Validators.required, Validators.min(1)]],
          salePrice: [''],
          descriptionFull: '',
          visibility: true,
          stock: 'onStock',
          stockDate: '',
          onSale: false,
          quantity: [''],
          shippingBasic: false,
          shippingBasicCost: '',
          shippingExtended: false,
          shippingExtendedCost: '',
          shipping: 'basic',
          shippingCost: '',
          productType: 'clothing',
          hasColors: true,
          colors: [[]],
          hasSizes: true,
          sizes: [[]],
          hasClassification: true,
          categoryLevel1: '',
          categoryLevel2: '',
        }, { validators: [this.priceValidator] }),
      }))
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
  }

  private prepareLangEditForm(product) {
    return this.languageOptions
      .map((lang: string) => {
        const productLang = product[lang] || {};
        const isBasic = productLang.shippingBasic !== undefined
          ? !!productLang.shippingBasic
          : (productLang.shipping === 'basic' || productLang.shipping === 'both');
        const isExtended = productLang.shippingExtended !== undefined
          ? !!productLang.shippingExtended
          : (productLang.shipping === 'extended' || productLang.shipping === 'both');

        return {
          [lang]: {
            title: productLang.title || '',
            description: productLang.description || '',
            regularPrice: productLang.regularPrice || '',
            salePrice: productLang.salePrice || '',
            descriptionFull: productLang.descriptionFull || '',
            visibility: productLang.visibility !== undefined ? !!productLang.visibility : true,
            stock: productLang.stock || 'onStock',
            stockDate: productLang.stockDate || '',
            onSale: !!productLang.onSale,
            quantity: productLang.quantity !== undefined ? productLang.quantity : '',
            shippingBasic: isBasic,
            shippingBasicCost: productLang.shippingBasicCost !== undefined ? productLang.shippingBasicCost : (productLang.shippingCost || ''),
            shippingExtended: isExtended,
            shippingExtendedCost: productLang.shippingExtendedCost !== undefined ? productLang.shippingExtendedCost : '',
            shipping: productLang.shipping || 'basic',
            shippingCost: productLang.shippingCost !== undefined ? productLang.shippingCost : '',
            productType: productLang.productType || 'clothing',
            hasColors: productLang.hasColors !== undefined ? !!productLang.hasColors : true,
            colors: productLang.colors || [],
            hasSizes: productLang.hasSizes !== undefined ? !!productLang.hasSizes : true,
            sizes: productLang.sizes || [],
            hasClassification: productLang.hasClassification !== undefined ? !!productLang.hasClassification : true,
            categoryLevel1: productLang.categoryLevel1 || '',
            categoryLevel2: productLang.categoryLevel2 || '',
          },
        };
      })
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
  }

  private prepareProductData(languageOptions: Array<string>, formData) {
    return languageOptions
      .map((lang: string) => {
        const langData = formData[lang] || {};
        const descFull = langData.descriptionFull;
        const descriptionFullArray = Array.isArray(descFull)
          ? descFull
          : (descFull ? [descFull] : []);
        const regularPrice = Number(langData.regularPrice) || 0;
        const salePriceNum = Number(langData.salePrice) || 0;
        const hasSalePrice = salePriceNum > 0 && salePriceNum < regularPrice;
        const effectiveSalePrice = hasSalePrice ? salePriceNum : regularPrice;

        const shippingBasic = !!langData.shippingBasic;
        const shippingExtended = !!langData.shippingExtended;
        const shippingBasicCost = Number(langData.shippingBasicCost) || 0;
        const shippingExtendedCost = Number(langData.shippingExtendedCost) || 0;
        let shippingType = 'none';
        if (shippingBasic && shippingExtended) {
          shippingType = 'both';
        } else if (shippingBasic) {
          shippingType = 'basic';
        } else if (shippingExtended) {
          shippingType = 'extended';
        }

        return {
          [lang]: {
            ...langData,
            title: langData.title || '',
            description: langData.description || '',
            regularPrice: regularPrice,
            salePrice: effectiveSalePrice,
            descriptionFull: descriptionFullArray,
            visibility: !!langData.visibility,
            onSale: hasSalePrice || !!langData.onSale,
            stock: langData.stock || 'onStock',
            stockDate: langData.stockDate || '',
            quantity: Number(langData.quantity) || 0,
            shipping: shippingType,
            shippingBasic: shippingBasic,
            shippingBasicCost: shippingBasicCost,
            shippingExtended: shippingExtended,
            shippingExtendedCost: shippingExtendedCost,
            shippingCost: shippingBasicCost || shippingExtendedCost || Number(langData.shippingCost) || 0,
            productType: langData.productType || 'clothing',
            hasColors: !!langData.hasColors,
            colors: langData.colors || [],
            hasSizes: !!langData.hasSizes,
            sizes: langData.sizes || [],
            hasClassification: !!langData.hasClassification,
            categoryLevel1: langData.categoryLevel1 || '',
            categoryLevel2: langData.categoryLevel2 || '',
          },
        };
      })
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
  }

  // ══════════════════════════════════════════════
  // CSV IMPORT METHODS
  // ══════════════════════════════════════════════

  onCsvFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    this.csvFileName = file.name;
    this.csvImportResult = null;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result as string;
      this.csvProducts = this.parseCsvToProducts(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  parseCsvToProducts(csvText: string): any[] {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) return [];

    // Parse header
    const headers = this.parseCsvLine(lines[0]);

    // Group rows by handle
    const handleGroups: { [handle: string]: any[] } = {};
    const handleOrder: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const row: { [key: string]: string } = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const handle = row['handle'] || '';
      if (!handle) continue;

      if (!handleGroups[handle]) {
        handleGroups[handle] = [];
        handleOrder.push(handle);
      }
      handleGroups[handle].push(row);
    }

    // Convert each group to a product
    const products: any[] = [];
    for (const handle of handleOrder) {
      const rows = handleGroups[handle];
      const product = this.csvGroupToProduct(handle, rows, headers);
      if (product) {
        products.push(product);
      }
    }

    return products;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  }

  private csvGroupToProduct(handle: string, rows: any[], headers: string[]): any {
    let productName = '';
    let description = '';
    let categorySlugs = '';
    let visibility = true;
    const variants: any[] = [];
    const mediaUrls: string[] = [];
    const sizes: string[] = [];
    let regularPrice = 0;
    let salePrice = 0;
    let quantity = 0;
    let onSale = false;

    for (const row of rows) {
      const fieldType = (row['fieldType'] || '').toUpperCase();

      if (fieldType === 'VARIANT') {
        const price = Number(row['price']) || 0;
        const sale = Number(row['salePrice']) || 0;
        const qty = Number(row['quantity'] || row['inventory']) || 0;
        const discount = (row['discount'] || '').toUpperCase() === 'TRUE';

        if (price > regularPrice) regularPrice = price;
        if (sale > 0 && (salePrice === 0 || sale < salePrice)) salePrice = sale;
        quantity += qty;
        if (discount) onSale = true;

        variants.push(row);
      } else if (fieldType === 'MEDIA') {
        // Extract media URL - look for http/https in any field
        for (const key of Object.keys(row)) {
          const val = row[key] || '';
          if (val.startsWith('http://') || val.startsWith('https://')) {
            if (!mediaUrls.includes(val)) {
              mediaUrls.push(val);
            }
          }
        }
      } else {
        // Header/info row – extract name, sizes, etc.
        const name = row['name'] || '';
        if (name && !productName) productName = name;
        if (row['plainDescription'] && !description) description = row['plainDescription'];
        if (row['categorySlugs'] && !categorySlugs) categorySlugs = row['categorySlugs'];
        if (row['visible'] !== undefined) {
          visibility = (row['visible'] || '').toUpperCase() !== 'FALSE';
        }

        // Check for size info in the row values (M, L, XL, XXL etc.)
        const sizePatterns = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
          'Freesize', 'Free Size', 'One Size'];
        for (const val of Object.values(row) as string[]) {
          const trimmed = (val || '').trim();
          if (sizePatterns.some(sp => sp.toUpperCase() === trimmed.toUpperCase()) && !sizes.includes(trimmed.toUpperCase())) {
            sizes.push(trimmed.toUpperCase());
          }
        }
      }
    }

    if (!productName && !regularPrice) return null;

    // Parse category slugs to tags
    const tags = categorySlugs
      ? categorySlugs.split(';').map(s => s.trim().replace(/ /g, '_').toLowerCase()).filter(Boolean)
      : [];

    const titleUrl = this.generateSlug(productName || handle);
    const mainImageUrl = mediaUrls.length > 0 ? mediaUrls[0] : '';
    const images = mediaUrls.length > 1 ? mediaUrls.slice(1) : [];

    const effectiveSalePrice = salePrice > 0 && salePrice < regularPrice ? salePrice : regularPrice;
    const stockStatus = quantity > 0 ? 'onStock' : 'unavailable';

    const langData = {
      title: productName,
      description: description,
      regularPrice: regularPrice,
      salePrice: effectiveSalePrice,
      descriptionFull: [],
      visibility: visibility,
      onSale: onSale || (salePrice > 0 && salePrice < regularPrice),
      stock: stockStatus,
      stockDate: '',
      quantity: quantity,
      shippingBasic: false,
      shippingBasicCost: 0,
      shippingExtended: false,
      shippingExtendedCost: 0,
      shipping: 'basic',
      shippingCost: 0,
      productType: 'clothing',
      hasColors: false,
      colors: [],
      hasSizes: sizes.length > 0,
      sizes: sizes,
      hasClassification: false,
      categoryLevel1: '',
      categoryLevel2: '',
    };

    return {
      titleUrl: titleUrl,
      mainImage: { url: mainImageUrl, name: titleUrl },
      images: images,
      tags: tags,
      _handle: handle,
      _variantCount: variants.length,
      _mediaCount: mediaUrls.length,
      ...this.languageOptions.reduce((prev, lang) => ({ ...prev, [lang]: { ...langData } }), {}),
    };
  }

  toggleCsvVisibility(cp: any): void {
    const current = this.isCsvVisible(cp);
    const newVal = !current;
    for (const lang of this.languageOptions) {
      if (cp[lang]) {
        cp[lang].visibility = newVal;
      }
    }
    cp.visibility = newVal;
  }

  isCsvVisible(cp: any): boolean {
    const lang = this.choosenLanguageSub$.value || 'vi';
    if (cp[lang] && cp[lang].visibility !== undefined) {
      return !!cp[lang].visibility;
    }
    return cp.visibility !== false;
  }

  applyCsvToForm(csvProduct: any): void {
    const lang = this.choosenLanguageSub$.value || 'vi';
    const langData = csvProduct[lang] || csvProduct['vi'] || {};

    this.productEditForm.patchValue({
      titleUrl: csvProduct.titleUrl || '',
      mainImage: csvProduct.mainImage?.url || '',
      tags: csvProduct.tags || [],
      images: csvProduct.images || [],
    });

    const isVisible = this.isCsvVisible(csvProduct);

    for (const l of this.languageOptions) {
      const lData = csvProduct[l] || langData;
      const langGroup = this.productEditForm.get([l]);
      if (langGroup) {
        langGroup.patchValue({
          title: lData.title || '',
          description: lData.description || '',
          regularPrice: lData.regularPrice || '',
          salePrice: lData.salePrice || '',
          visibility: isVisible,
          stock: lData.stock || 'onStock',
          onSale: !!lData.onSale,
          quantity: lData.quantity || '',
          hasSizes: lData.hasSizes || false,
          sizes: lData.sizes || [],
        });
      }
    }

    this.manualTitleUrl = true;

    // Cuộn mượt xuống form chỉnh sửa bên dưới
    setTimeout(() => {
      const formEl = document.querySelector('.product_edit-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  importAllCsvProducts(): void {
    if (!this.csvProducts.length || this.csvImporting) return;
    this.csvImporting = true;
    this.csvImportResult = null;

    // Prepare products for API
    const productsToImport = this.csvProducts.map(p => {
      const prepared = { ...p };
      delete prepared._handle;
      delete prepared._variantCount;
      delete prepared._mediaCount;
      return prepared;
    });

    this.store.importCsvProducts(productsToImport, (result: any) => {
      this.csvImporting = false;
      if (result && !result.error) {
        this.csvImportResult = result;
        this.csvProducts = [];
        this.csvFileName = '';
      } else {
        this.csvImportResult = { imported: 0, errors: ['Lỗi khi import sản phẩm'] };
      }
    });
  }

  clearCsvPreview(): void {
    this.csvProducts = [];
    this.csvFileName = '';
    this.csvImportResult = null;
  }
}
