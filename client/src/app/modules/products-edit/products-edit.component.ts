import { filter, first, take, delay, startWith, map } from 'rxjs/operators';
import { Component, OnInit, Input, OnDestroy, Output, EventEmitter, OnChanges, SimpleChanges, Optional, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject, from, combineLatest } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../services/api.service';
import { languages } from '../../shared/constants';
import { Product, Category, ProductVariant } from '../../shared/models';
import { SignalStore } from '../../store/signal.store';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';
import { TranslateService } from '../../services/translate.service';
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
    'Áo': [],
    'Váy': [],
    'Quần': [],
    'Đầm': [],
    'Trang Sức': [],
    'Khăn choàng': [],
    'Phụ Kiện': [],
  };

  customColorName = '';
  customColorHex = '#74070E';
  customSize = '';
  customClassification = '';

  // Biến thể (Variants) Batch Update
  quickPrice: number | null = null;
  quickStock: number | null = null;
  batchVariantPrice: number | null = null;
  batchVariantStock: number | null = null;
  batchVariantStatus: '' | 'active' | 'inactive' = '';

  // Image upload mode
  imageUploadMode: 'upload' | 'url' = 'upload';

  // CSV Import
  csvProducts: any[] = [];
  csvImporting = false;
  csvImportResult: { imported: number; errors: string[] } | null = null;
  csvFileName = '';

  // Async Button States
  isSubmitting = false;
  isDeleting = false;
  isUploadingImage = false;
  isAddingImageUrl = false;
  removingImage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private store: SignalStore,
    private selectors: SignalStoreSelectors,
    private apiService: ApiService,
    @Optional() private snackBar?: MatSnackBar,
    @Optional() private cdr?: ChangeDetectorRef,
    @Optional() private route?: ActivatedRoute,
    @Optional() private router?: Router,
    @Optional() private translate?: TranslateService
  ) {
    this.createForm();
    this.product$ = toObservable(this.selectors.product)
      .pipe(filter((product) => !!product && (!!product.titleUrl || !!product._id || !!product.id)));
    this.categories$ = toObservable(this.selectors.categories);
    this.images$ = toObservable(this.selectors.productImages);
    this.allProducts$ = toObservable(this.selectors.allProducts);
    this.store.getCategories(languages[0]);
  }

  showToast(message: string, isError: boolean = false): void {
    if (this.snackBar) {
      this.snackBar.open(message, 'Đóng', {
        duration: isError ? 4000 : 2500,
        horizontalPosition: 'right',
        verticalPosition: 'top',
      });
    }
  }

  ngOnInit(): void {
    this.store.getImages();
    this.store.getAllProducts();

    if (this.route) {
      this.route.params.subscribe((params) => {
        const id = params['id'];
        const url = this.router?.url || '';
        if (id && id !== 'new' && id !== 'add') {
          this.action = 'edit';
          this.productToEditTitleUrl = id;
          this.store.getProduct(id);
        } else if (
          id === 'new' ||
          id === 'add' ||
          url.includes('/products/add') ||
          url.includes('/products/edit/new') ||
          url.includes('/products/edit/add') ||
          !this.action
        ) {
          this.action = 'add';
          this.productToEditTitleUrl = '';
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
      });
    } else if (this.productToEditTitleUrl) {
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

    this.productSub = this.product$.subscribe((product: any) => {
      if (!product || this.action === 'add') return;
      const newForm = {
        titleUrl: product.titleUrl || '',
        mainImage: product.mainImage && product.mainImage.url ? product.mainImage.url : (typeof product.mainImage === 'string' ? product.mainImage : ''),
        tags: product.tags || [],
        images: product.images || [],
        imageUrl: '',
        ...this.prepareLangEditForm(product),
      };

      const prepareDescFull = this.languageOptions
        .map((lang) => ({
          [lang]: product[lang]?.descriptionFull?.length ? product[lang].descriptionFull[0] : (product.descriptionFull?.[0] || ''),
        }))
        .reduce((prev, curr) => ({ ...prev, ...curr }), {});

      this.descriptionFullSub$.next(prepareDescFull);
      this.productEditForm.patchValue(newForm);
      this.languageOptions.forEach((lang) => {
        const variants = product[lang]?.variants || product.variants || [];
        this.setVariantsFormArray(lang, variants);
      });
      const displayName = product.title || product['vi']?.title || product.titleUrl || '';
      this.searchProductCtrl.setValue(displayName, { emitEvent: false });
    });
  }

  goBackToProducts(): void {
    this.changeTab.emit(0);
    const lang = this.translate?.lang || 'vi';
    if (this.router) {
      this.router.navigate([`/${lang}/dashboard/products`]);
    }
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

  onFileChanged(event: any) {
    const files = event?.target?.files;
    if (!files || files.length === 0)
      return;

    const file = files[0];
    const fileName = (file.name || '').toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const hasValidMime = validMimeTypes.includes((file.type || '').toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      this.showToast('Chỉ chấp nhận tệp hình ảnh định dạng JPG, PNG hoặc WEBP!', true);
      if (event?.target) event.target.value = '';
      return;
    }

    this.isUploadingImage = true;
    this.cdr?.detectChanges();

    const titleUrlToUpload = this.productToEditTitleUrl || this.productEditForm.get('titleUrl')?.value || '';
    const uploadImage = this.apiService.uploadImage({ fileToUpload: file, titleUrl: titleUrlToUpload });

    uploadImage.pipe(take(1))
      .subscribe({
        next: (result: any) => {
          if (result && !result.error) {
            this.isUploadingImage = false;
            let newImageUrl: string = '';
            if (result && result.titleUrl) {
              this.store.storeProduct(result);
              if (Array.isArray(result.images) && result.images.length) {
                newImageUrl = result.images[result.images.length - 1];
              } else if (result.mainImage?.url) {
                newImageUrl = result.mainImage.url;
              }
            } else if (result && result.all) {
              this.store.storeProductImages(result);
              if (Array.isArray(result.all) && result.all.length) {
                newImageUrl = result.all[result.all.length - 1];
              }
            }

            if (newImageUrl) {
              this.addImageToForm(newImageUrl);
            }
            this.showToast('Tải hình ảnh lên thành công!');
            if (event?.target) {
              event.target.value = '';
            }
            this.cdr?.detectChanges();
          } else {
            this.fallbackLocalImageRead(file, event);
          }
        },
        error: (err: any) => {
          console.warn('Lỗi kết nối upload ảnh, chuyển sang chế độ đọc ảnh trực tiếp:', err);
          this.fallbackLocalImageRead(file, event);
        }
      });
  }

  addImageToForm(url: string): void {
    if (!url) return;
    const currentImages = this.productEditForm.get('images')?.value || [];
    const imagesList: string[] = Array.isArray(currentImages)
      ? currentImages.map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean)
      : [];

    if (!imagesList.includes(url)) {
      const updated = [...imagesList, url];
      this.productEditForm.get('images')?.setValue(updated);
      const currentMain = this.productEditForm.get('mainImage')?.value;
      const currentMainUrl = typeof currentMain === 'string' ? currentMain : currentMain?.url;
      if (!currentMainUrl) {
        this.productEditForm.get('mainImage')?.setValue(url);
      }
    }
    const storeImages = this.selectors?.productImages?.() || [];
    if (!storeImages.includes(url)) {
      this.store.storeProductImages({ all: [...storeImages, url] });
    }
    this.cdr?.detectChanges();
  }

  fallbackLocalImageRead(file: File, event?: any): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.isUploadingImage = false;
      const dataUrl = e.target?.result;
      if (dataUrl) {
        this.addImageToForm(dataUrl);
        this.showToast('Tải hình ảnh lên thành công!');
      } else {
        this.showToast('Không thể tải hình ảnh. Vui lòng thử lại!', true);
      }
      if (event?.target) event.target.value = '';
      this.cdr?.detectChanges();
    };
    reader.onerror = () => {
      this.isUploadingImage = false;
      this.showToast('Lỗi khi đọc tệp ảnh từ thiết bị!', true);
      if (event?.target) event.target.value = '';
      this.cdr?.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  getDisplayImages(): string[] {
    const list: string[] = [];
    const formImages = this.productEditForm?.get('images')?.value;
    if (Array.isArray(formImages)) {
      formImages.forEach((img: any) => {
        const url = typeof img === 'string' ? img : img?.url;
        if (url && !list.includes(url)) list.push(url);
      });
    }

    const mainImage = this.productEditForm?.get('mainImage')?.value;
    const mainImageUrl = typeof mainImage === 'string' ? mainImage : mainImage?.url;
    if (mainImageUrl && !list.includes(mainImageUrl)) {
      list.unshift(mainImageUrl);
    }

    return list;
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
      images: [[]],
      imageUrl: '',
      ...this.createLangForm(this.languageOptions),
    });
  }

  isMainImage(image: string): boolean {
    const mainImg = this.productEditForm?.get('mainImage')?.value;
    const mainUrl = typeof mainImg === 'string' ? mainImg : mainImg?.url;
    return !!mainUrl && mainUrl === image;
  }

  setAsMainImage(image: string): void {
    if (!image) return;
    this.productEditForm.get('mainImage')?.setValue(image);
    this.showToast('Đã đặt làm ảnh chính!');
    this.cdr?.detectChanges();
  }

  onImageError(event: any, image: string): void {
    console.warn('Không thể tải hình ảnh:', image);
    if (event?.target) {
      event.target.src =
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f8edef"/><text x="50" y="50" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="11" fill="%2374070E">Ảnh lỗi</text></svg>';
    }
  }

  onRemoveImage(image: string, type: string): void {
    if (this.removingImage === image) return;
    this.removingImage = image;
    this.cdr?.detectChanges();

    const formImages = this.productEditForm.get('images')?.value || [];
    const remaining = (Array.isArray(formImages) ? formImages : [])
      .map((img: any) => (typeof img === 'string' ? img : img?.url))
      .filter((imgUrl: string) => imgUrl && imgUrl !== image);

    this.productEditForm.get('images')?.setValue(remaining);

    const currentMain = this.productEditForm.get('mainImage')?.value;
    const currentMainUrl = typeof currentMain === 'string' ? currentMain : currentMain?.url;
    if (currentMainUrl === image) {
      this.productEditForm.get('mainImage')?.setValue(remaining.length ? remaining[0] : '');
    }

    const storeImages = this.selectors?.productImages?.() || [];
    if (storeImages.includes(image)) {
      this.store.storeProductImages({ all: storeImages.filter((img: string) => img !== image) });
    }

    const titleUrlVal = this.productToEditTitleUrl || this.productEditForm.get('titleUrl')?.value;
    const titleUrl = type === 'product' && titleUrlVal ? { titleUrl: titleUrlVal } : {};

    this.store.removeImage({ image: image, ...titleUrl }, (res: any) => {
      this.removingImage = null;
      if (res && !res.error) {
        this.showToast('Đã xóa hình ảnh thành công!');
      } else {
        this.showToast('Đã gỡ ảnh khỏi sản phẩm thành công!');
      }
      this.cdr?.detectChanges();
    });
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
    const rawUrl = (this.productEditForm.get('imageUrl')?.value || '').trim();
    if (!rawUrl) {
      this.showToast('Vui lòng nhập đường dẫn URL hình ảnh!', true);
      return;
    }

    let validUrl = rawUrl;
    if (
      !/^https?:\/\//i.test(validUrl) &&
      !/^data:image\//i.test(validUrl) &&
      !/^\/\//.test(validUrl) &&
      !validUrl.startsWith('/')
    ) {
      if (validUrl.includes('.') && !validUrl.includes(' ')) {
        validUrl = 'https://' + validUrl;
      } else {
        this.showToast('Đường dẫn URL không hợp lệ (phải bắt đầu bằng http:// hoặc https://)!', true);
        return;
      }
    }

    const currentImages = this.productEditForm.get('images')?.value || [];
    const imagesList: string[] = Array.isArray(currentImages)
      ? currentImages.map((img: any) => (typeof img === 'string' ? img : img?.url)).filter(Boolean)
      : [];

    const currentMain = this.productEditForm.get('mainImage')?.value;
    const currentMainUrl = typeof currentMain === 'string' ? currentMain : currentMain?.url;

    if (imagesList.includes(validUrl) || currentMainUrl === validUrl) {
      this.showToast('Hình ảnh này đã có trong danh sách!', true);
      return;
    }

    this.isAddingImageUrl = true;
    this.cdr?.detectChanges();

    this.addImageToForm(validUrl);
    this.productEditForm.get('imageUrl')?.setValue('');
    this.showToast('Đã thêm hình ảnh từ URL thành công!');

    const titleUrl = this.productToEditTitleUrl || this.productEditForm.get('titleUrl')?.value || '';
    if (this.action === 'edit' && titleUrl) {
      this.store.addProductImagesUrl({ image: validUrl, titleUrl }, () => {
        this.isAddingImageUrl = false;
        this.cdr?.detectChanges();
      });
    } else {
      this.isAddingImageUrl = false;
      this.cdr?.detectChanges();
    }
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

  /**
   * Kiểm tra xem ngôn ngữ hiện tại có đang chọn ít nhất 1 thuộc tính biến thể (Màu, Size, Phân loại) hay không
   */
  hasVariantAttributes(lang: string): boolean {
    const langGroup = this.productEditForm?.get([lang]);
    if (!langGroup) return false;
    const hasColors = !!langGroup.get('hasColors')?.value && (langGroup.get('colors')?.value || []).length > 0;
    const hasSizes = !!langGroup.get('hasSizes')?.value && (langGroup.get('sizes')?.value || []).length > 0;
    const rawCat = langGroup.get('categoryLevel1')?.value;
    const hasClass = !!langGroup.get('hasClassification')?.value && (Array.isArray(rawCat) ? rawCat.length > 0 : !!rawCat);
    return hasColors || hasSizes || hasClass;
  }

  get isFormValid(): boolean {
    if (!this.productEditForm) return false;
    const chosenLang = this.choosenLanguageSub$.value || 'vi';
    const group = this.productEditForm.get([chosenLang]) || this.productEditForm.get(['vi']);
    if (!group) return false;

    const title = group.get('title')?.value;
    const hasTitle = !!title && String(title).trim().length > 0;

    const variantsArray = this.getVariantsFormArray(chosenLang);
    const hasVariants = variantsArray && variantsArray.length > 0;

    let hasPrice = false;
    if (hasVariants) {
      hasPrice = variantsArray.controls.some(ctrl => Number(ctrl.get('price')?.value) > 0);
    } else {
      const regularPrice = group.get('regularPrice')?.value;
      hasPrice = regularPrice !== null && regularPrice !== '' && !isNaN(Number(regularPrice)) && Number(regularPrice) > 0;
    }

    const hasPriceError = group.hasError('priceInvalid') || group.get('salePrice')?.hasError('priceInvalid');

    return hasTitle && hasPrice && !hasPriceError;
  }

  onSubmit(): void {
    if (this.isSubmitting) return;

    if (!this.isFormValid) {
      this.showToast('Vui lòng nhập Tên sản phẩm và Giá bán (VNĐ) hợp lệ!', true);
      return;
    }

    const formVal = this.productEditForm.value;
    let titleUrl = formVal.titleUrl;

    const chosenLang = this.choosenLanguageSub$.value || 'vi';
    const activeData = formVal[chosenLang] || formVal.vi || {};

    if (!titleUrl || !titleUrl.trim()) {
      const name =
        activeData.title ||
        formVal.vi?.title ||
        formVal.en?.title ||
        formVal.sk?.title ||
        formVal.cs?.title ||
        '';
      titleUrl = this.generateSlug(name) || `sp-${Date.now()}`;
      this.productEditForm.patchValue({ titleUrl });
    }

    this.isSubmitting = true;
    this.cdr?.detectChanges();

    const formTitle = activeData.title || 'Sản phẩm';
    const currentImages = (this.productEditForm.value.images || [])
      .map((img: any) => (typeof img === 'string' ? img : img?.url))
      .filter(Boolean);
    const mainImageUrl = this.productEditForm.value.mainImage || (currentImages.length ? currentImages[0] : '');

    switch (this.action) {
      case 'add':
        const productPrepare = {
          ...this.productEditForm.value,
          titleUrl: titleUrl,
          mainImage: {
            url: mainImageUrl,
            name: titleUrl,
          },
          tags: this.productEditForm.value.tags || [],
          images: currentImages,
          ...this.prepareProductData(this.languageOptions, this.productEditForm.value),
        };

        this.store.addProduct(productPrepare, (res: any) => {
          this.isSubmitting = false;
          if (res && !res.error) {
            this.sendRequest = true;
            this.showToast(`Thêm mới sản phẩm "${formTitle}" thành công!`);
          } else {
            console.error('Lỗi khi thêm sản phẩm:', res?.error);
            const errMsg = res?.error?.error?.message || res?.error?.message || (typeof res?.error === 'string' ? res?.error : 'Thêm sản phẩm thất bại. Vui lòng kiểm tra lại thông tin!');
            this.showToast(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg, true);
          }
          this.cdr?.detectChanges();
        });
        break;

      case 'edit':
        const productPrepareEdit = {
          ...this.productEditForm.value,
          titleUrl: titleUrl,
          mainImage: {
            url: mainImageUrl,
            name: titleUrl,
          },
          tags: this.productEditForm.value.tags || [],
          images: currentImages,
          ...this.prepareProductData(this.languageOptions, this.productEditForm.value),
        };

        this.store.editProduct(productPrepareEdit, (res: any) => {
          this.isSubmitting = false;
          if (res && !res.error) {
            this.sendRequest = true;
            this.showToast(`Lưu thay đổi sản phẩm "${formTitle}" thành công!`);
          } else {
            console.error('Lỗi khi cập nhật sản phẩm:', res?.error);
            const errMsg = res?.error?.error?.message || res?.error?.message || (typeof res?.error === 'string' ? res?.error : 'Lưu sản phẩm thất bại. Vui lòng thử lại!');
            this.showToast(Array.isArray(errMsg) ? errMsg.join(', ') : errMsg, true);
          }
          this.cdr?.detectChanges();
        });
        break;

      default:
        this.isSubmitting = false;
        this.cdr?.detectChanges();
        break;
    }
  }

  onRemoveSubmit(): void {
    if (this.isDeleting) return;

    const titleUrl = this.productEditForm.get('titleUrl')?.value;
    if (!titleUrl) {
      this.showToast('Không tìm thấy mã định danh sản phẩm để xóa!', true);
      return;
    }

    if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm này? Thao tác này không thể hoàn tác.')) {
      return;
    }

    this.isDeleting = true;
    this.cdr?.detectChanges();

    this.store.removeProduct(titleUrl, (res: any) => {
      this.isDeleting = false;
      if (res && !res.error) {
        this.sendRequest = true;
        this.showToast('Đã xóa sản phẩm thành công!');
      } else {
        const errMsg = res?.error?.message || res?.error || 'Xóa sản phẩm thất bại. Vui lòng thử lại!';
        this.showToast(errMsg, true);
      }
      this.cdr?.detectChanges();
    });
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
    this.generateVariants(lang, true);
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
    this.generateVariants(lang, true);
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
    this.generateVariants(lang, true);
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

  get categories(): string[] {
    return Object.keys(this.categoriesTree);
  }

  getLevel1Categories(): string[] {
    return Object.keys(this.categoriesTree);
  }

  getLevel2Categories(level1: string): string[] {
    return this.categoriesTree[level1] || [];
  }

  addClassification(lang: string): void {
    if (!this.customClassification || !this.customClassification.trim()) return;
    const catName = this.customClassification.trim();
    if (!this.categoriesTree[catName]) {
      this.categoriesTree[catName] = [];
    }
    this.toggleCategory(catName, lang);
    this.customClassification = '';
    this.showToast(`Đã thêm danh mục "${catName}"!`);
  }

  toggleCategory(cat: string, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (!langGroup) return;
    const currentCats: string[] = langGroup.get('categoryLevel1')?.value || [];
    const index = currentCats.indexOf(cat);

    if (index > -1) {
      currentCats.splice(index, 1);
    } else {
      currentCats.push(cat);
    }
    langGroup.get('categoryLevel1')?.setValue([...currentCats]);
    this.generateVariants(lang, true);
  }

  isCategorySelected(cat: string, lang: string): boolean {
    const currentCats: string[] = this.productEditForm.get([lang, 'categoryLevel1'])?.value || [];
    return currentCats.includes(cat);
  }

  removeCategory(cat: string, lang: string): void {
    this.toggleCategory(cat, lang);
  }

  onLevel1Change(level1: string, lang: string): void {
    const langGroup = this.productEditForm.get([lang]);
    if (langGroup) {
      langGroup.patchValue({
        categoryLevel1: level1,
        categoryLevel2: ''
      });
      this.generateVariants(lang, true);
    }
  }

  /**
   * Lấy FormArray variants của một ngôn ngữ
   */
  getVariantsFormArray(lang: string): FormArray {
    const langGroup = this.productEditForm?.get([lang]);
    return (langGroup?.get('variants') as FormArray) || this.fb.array([]);
  }

  /**
   * Tạo FormGroup cho 1 biến thể với cấu trúc chuẩn Reactive Forms
   */
  createVariantGroup(v?: any): FormGroup {
    return this.fb.group({
      sku: [v?.sku || '', [Validators.required]],
      attributes: [v?.attributes || {}],
      price: [v?.price !== undefined ? Number(v.price) : 0, [Validators.required, Validators.min(0)]],
      stock: [v?.stock !== undefined ? Number(v.stock) : 0, [Validators.required, Validators.min(0)]],
      status: [v?.status !== undefined ? Boolean(v.status) : true],
    });
  }

  /**
   * Đổ dữ liệu vào FormArray variants
   */
  setVariantsFormArray(lang: string, variants: any[]): void {
    const formArray = this.getVariantsFormArray(lang);
    if (!formArray) return;
    formArray.clear();
    if (Array.isArray(variants)) {
      variants.forEach((v) => {
        formArray.push(this.createVariantGroup(v));
      });
    }
  }

  /**
   * Hàm chuẩn hóa SKU không dấu viết hoa
   */
  slugify(text: string): string {
    if (!text) return '';
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'D')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim();
  }

  formatSkuSegment(text: string): string {
    return this.slugify(text);
  }

  /**
   * Sinh mã SKU tự động theo thuộc tính (VD: "AO-DO-S")
   * Thứ tự ưu tiên: Phân loại -> Màu sắc -> Kích thước
   */
  generateVariantSku(attributes: Record<string, string>): string {
    if (!attributes) return `VAR-${Date.now()}`;
    const parts: string[] = [];

    // 1. Phân loại
    const classification = attributes['Phân loại'] || attributes['classification'];
    if (classification) {
      parts.push(this.slugify(classification));
    }

    // 2. Màu sắc
    const color = attributes['Màu sắc'] || attributes['color'];
    if (color) {
      parts.push(this.slugify(color));
    }

    // 3. Kích thước
    const size = attributes['Kích thước'] || attributes['size'];
    if (size) {
      parts.push(this.slugify(size));
    }

    // Các thuộc tính khác nếu có
    for (const key of Object.keys(attributes)) {
      if (!['Phân loại', 'classification', 'Màu sắc', 'color', 'Kích thước', 'size'].includes(key) && attributes[key]) {
        parts.push(this.slugify(attributes[key]));
      }
    }

    return parts.filter(Boolean).join('-') || `VAR-${Date.now()}`;
  }

  /**
   * Helper tạo khóa duy nhất từ attributes để map bảo lưu biến thể cũ
   */
  private getAttributeKey(attributes: Record<string, string>): string {
    if (!attributes) return '';
    return Object.keys(attributes)
      .sort()
      .map((k) => `${k}:${attributes[k]}`)
      .join('|');
  }

  /**
   * Lấy danh sách các cột thuộc tính đang kích hoạt và có dữ liệu để hiển thị động trên bảng
   */
  getActiveAttributeColumns(lang: string): { key: string; label: string }[] {
    const langGroup = this.productEditForm?.get([lang]);
    if (!langGroup) return [];
    const cols: { key: string; label: string }[] = [];

    // Nhóm 1: Phân loại danh mục
    const hasClass = !!langGroup.get('hasClassification')?.value;
    const catVal = langGroup.get('categoryLevel1')?.value;
    const hasCats = Array.isArray(catVal) ? catVal.length > 0 : !!catVal;
    if (hasClass && hasCats) {
      cols.push({ key: 'classification', label: 'Phân loại' });
    }

    // Nhóm 2: Màu sắc
    const hasColors = !!langGroup.get('hasColors')?.value;
    const colors = langGroup.get('colors')?.value || [];
    if (hasColors && colors.length > 0) {
      cols.push({ key: 'color', label: 'Màu sắc' });
    }

    // Nhóm 3: Kích thước
    const hasSizes = !!langGroup.get('hasSizes')?.value;
    const sizes = langGroup.get('sizes')?.value || [];
    if (hasSizes && sizes.length > 0) {
      cols.push({ key: 'size', label: 'Kích thước' });
    }

    return cols;
  }

  /**
   * Lấy giá trị thuộc tính cho cell hiển thị
   */
  getVariantAttributeValue(control: AbstractControl, col: { key: string; label: string }): string {
    const attrs = control?.get('attributes')?.value || {};
    return attrs[col.label] || attrs[col.key] || attrs[col.label.toLowerCase()] || '—';
  }

  /**
   * Lấy mã hex của màu sắc để hiển thị pill-swatch đồng bộ
   */
  getColorHex(colorName: string, lang: string): string {
    if (!colorName || colorName === '—') return 'transparent';
    const langGroup = this.productEditForm?.get([lang]);
    const colors: { name: string; hex: string }[] = langGroup?.get('colors')?.value || [];
    const found = colors.find((c) => (c.name || '').toLowerCase() === colorName.toLowerCase());
    if (found?.hex) return found.hex;
    const preset = this.presetColors.find((c) => (c.name || '').toLowerCase() === colorName.toLowerCase());
    if (preset?.hex) return preset.hex;
    return '#74070E';
  }

  /**
   * Thuật toán Cartesian Product (Tích Descartes) linh hoạt:
   * 1. Tự động kiểm tra cờ bật/tắt (hasColors, hasSizes, hasClassification).
   * 2. Chỉ đưa các nhóm thuộc tính vào tích Descartes khi cờ tương ứng = true VÀ mảng dữ liệu có ít nhất 1 phần tử.
   * 3. Trường hợp số lượng thuộc tính biến động (1, 2 hoặc 3): Tự co giãn linh hoạt mà không lỗi mảng rỗng.
   * 4. Bảo toàn dữ liệu (Data Persistence): Giữ nguyên price và stock cũ nếu SKU hoặc thuộc tính trùng.
   */
  generateVariants(lang: string, preserveExisting = true): void {
    const langGroup = this.productEditForm?.get([lang]);
    if (!langGroup) return;

    const variantsArray = this.getVariantsFormArray(lang);
    if (!variantsArray) return;

    interface AttrGroup {
      key: string;
      label: string;
      values: string[];
    }
    const groups: AttrGroup[] = [];

    // Nhóm 1: Phân loại sản phẩm (hasClassification)
    const hasClass = !!langGroup.get('hasClassification')?.value;
    const rawCategory = langGroup.get('categoryLevel1')?.value;
    let categoryValues: string[] = [];
    if (Array.isArray(rawCategory)) {
      categoryValues = rawCategory.filter((c: any) => c && String(c).trim());
    } else if (typeof rawCategory === 'string' && rawCategory.trim()) {
      categoryValues = [rawCategory.trim()];
    }
    if (hasClass && categoryValues.length > 0) {
      groups.push({ key: 'classification', label: 'Phân loại', values: categoryValues });
    }

    // Nhóm 2: Màu sắc (hasColors)
    const hasColors = !!langGroup.get('hasColors')?.value;
    const colors = (langGroup.get('colors')?.value || [])
      .map((c: any) => (typeof c === 'string' ? c : c?.name))
      .filter((name: string) => name && name.trim());
    if (hasColors && colors.length > 0) {
      groups.push({ key: 'color', label: 'Màu sắc', values: colors });
    }

    // Nhóm 3: Kích thước (hasSizes)
    const hasSizes = !!langGroup.get('hasSizes')?.value;
    const sizes = (langGroup.get('sizes')?.value || [])
      .filter((s: string) => s && String(s).trim());
    if (hasSizes && sizes.length > 0) {
      groups.push({ key: 'size', label: 'Kích thước', values: sizes });
    }

    // Nếu không có nhóm nào được bật hoặc chưa có dữ liệu thuộc tính
    if (groups.length === 0) {
      variantsArray.clear();
      this.cdr?.detectChanges();
      return;
    }

    // Thuật toán tích Descartes tổng quát (Cartesian Product)
    const combinations = groups.reduce<Record<string, string>[]>(
      (acc, group) => {
        const next: Record<string, string>[] = [];
        for (const item of acc) {
          for (const val of group.values) {
            next.push({
              ...item,
              [group.label]: val,
              [group.key]: val,
            });
          }
        }
        return next;
      },
      [{}]
    );

    // Lấy giá và tồn kho mặc định từ Section 4
    const defaultPrice = Number(langGroup.get('regularPrice')?.value) || 0;
    const defaultStock = Number(langGroup.get('quantity')?.value) || 0;

    // Lưu trữ biến thể cũ để bảo lưu giá / tồn kho / status theo SKU hoặc attributes
    const existingVariants: any[] = preserveExisting ? variantsArray.value : [];
    const existingMap = new Map<string, any>();
    for (const v of existingVariants) {
      if (!v) continue;
      const attrKey = this.getAttributeKey(v.attributes);
      if (attrKey) existingMap.set(attrKey, v);
      if (v.sku) existingMap.set(v.sku, v);
    }

    // Xóa và tạo mới các FormGroups
    variantsArray.clear();
    for (const attrs of combinations) {
      const sku = this.generateVariantSku(attrs);
      const attrKey = this.getAttributeKey(attrs);
      const existing = existingMap.get(attrKey) || existingMap.get(sku);

      // Cặp tên thuộc tính hiển thị: {"Phân loại": "...", "Màu sắc": "...", "Kích thước": "..."}
      const cleanAttrs: Record<string, string> = {};
      if (attrs['Phân loại']) cleanAttrs['Phân loại'] = attrs['Phân loại'];
      if (attrs['Màu sắc']) cleanAttrs['Màu sắc'] = attrs['Màu sắc'];
      if (attrs['Kích thước']) cleanAttrs['Kích thước'] = attrs['Kích thước'];

      const variantGroup = this.createVariantGroup({
        sku: existing?.sku || sku,
        attributes: cleanAttrs,
        price: existing?.price !== undefined ? Number(existing.price) : defaultPrice,
        stock: existing?.stock !== undefined ? Number(existing.stock) : defaultStock,
        status: existing?.status !== undefined ? Boolean(existing.status) : true,
      });

      variantsArray.push(variantGroup);
    }

    // Đồng bộ giá và tồn kho lên form cha để hợp lệ form
    const firstValidPrice = variantsArray.controls
      .map(c => Number(c.get('price')?.value) || 0)
      .find(p => p > 0) || defaultPrice;
    if (firstValidPrice > 0 && (!langGroup.get('regularPrice')?.value || Number(langGroup.get('regularPrice')?.value) === 0)) {
      langGroup.get('regularPrice')?.setValue(firstValidPrice);
    }
    const totalStock = this.getVariantsTotalStock(lang);
    if (totalStock > 0) {
      langGroup.get('quantity')?.setValue(totalStock);
    }

    this.cdr?.detectChanges();
  }

  /**
   * Áp dụng nhanh cho tất cả (Batch Update)
   */
  applyBatchUpdate(lang: string): void {
    const formArray = this.getVariantsFormArray(lang);
    if (!formArray || formArray.length === 0) {
      this.showToast('Không có biến thể nào để áp dụng!', true);
      return;
    }

    const hasPrice = this.quickPrice !== null && this.quickPrice !== undefined && String(this.quickPrice).trim() !== '' && !isNaN(Number(this.quickPrice)) && Number(this.quickPrice) >= 0;
    const hasStock = this.quickStock !== null && this.quickStock !== undefined && String(this.quickStock).trim() !== '' && !isNaN(Number(this.quickStock)) && Number(this.quickStock) >= 0;

    if (!hasPrice && !hasStock) {
      this.showToast('Vui lòng nhập Giá chung hoặc Kho chung để áp dụng nhanh!', true);
      return;
    }

    const langGroup = this.productEditForm?.get([lang]);

    formArray.controls.forEach((control: AbstractControl) => {
      if (hasPrice) {
        control.get('price')?.setValue(Number(this.quickPrice));
      }
      if (hasStock) {
        control.get('stock')?.setValue(Number(this.quickStock));
      }
    });

    if (hasPrice && langGroup) {
      langGroup.get('regularPrice')?.setValue(Number(this.quickPrice));
    }
    if (hasStock && langGroup) {
      langGroup.get('quantity')?.setValue(this.getVariantsTotalStock(lang));
    }

    this.showToast(`Đã áp dụng nhanh cho ${formArray.length} biến thể!`);
    this.cdr?.detectChanges();
  }

  applyBatchVariants(lang: string): void {
    this.applyBatchUpdate(lang);
  }

  updateVariantField(index: number, field: 'price' | 'stock' | 'sku' | 'status', value: any, lang: string): void {
    const formArray = this.getVariantsFormArray(lang);
    if (!formArray) return;
    const control = formArray.at(index);
    if (control) {
      let parsedVal: any = value;
      if (field === 'price' || field === 'stock') {
        parsedVal = Math.max(0, Number(value) || 0);
      } else if (field === 'status') {
        parsedVal = Boolean(value);
      } else {
        parsedVal = String(value);
      }
      control.get(field)?.setValue(parsedVal);
    }
  }

  removeVariant(index: number, lang: string): void {
    const formArray = this.getVariantsFormArray(lang);
    if (formArray && index >= 0 && index < formArray.length) {
      formArray.removeAt(index);
      this.cdr?.detectChanges();
    }
  }

  getVariantsTotalStock(lang: string): number {
    const formArray = this.getVariantsFormArray(lang);
    if (!formArray) return 0;
    return formArray.controls.reduce((sum, ctrl) => sum + (Number(ctrl.get('stock')?.value) || 0), 0);
  }

  getActiveVariantsCount(lang: string): number {
    const formArray = this.getVariantsFormArray(lang);
    if (!formArray) return 0;
    return formArray.controls.filter((ctrl) => ctrl.get('status')?.value !== false).length;
  }

  private createLangForm(languageOptions: Array<string>) {
    return languageOptions
      .map((lang: string) => ({
        [lang]: this.fb.group({
          title: ['', lang === 'vi' ? [Validators.required] : []],
          description: '',
          regularPrice: ['', lang === 'vi' ? [Validators.required, Validators.min(1)] : []],
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
          categoryLevel1: [[]],
          categoryLevel2: '',
          variants: this.fb.array([]),
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
            categoryLevel1: productLang.categoryLevel1 || [],
            categoryLevel2: productLang.categoryLevel2 || '',
            variants: productLang.variants || [],
          },
        };
      })
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
  }

  private prepareProductData(languageOptions: Array<string>, formData) {
    const chosenLang = this.choosenLanguageSub$.value || 'vi';
    const activeData = formData[chosenLang] || formData['vi'] || {};

    return languageOptions
      .map((lang: string) => {
        const rawLangData = formData[lang] || {};
        const title = (rawLangData.title && String(rawLangData.title).trim()) ? rawLangData.title.trim() : (activeData.title || '');
        const descFull = rawLangData.descriptionFull || activeData.descriptionFull;
        const descriptionFullArray = Array.isArray(descFull)
          ? descFull
          : (descFull ? [descFull] : []);
        const rawRegPrice = rawLangData.regularPrice !== undefined && rawLangData.regularPrice !== ''
          ? rawLangData.regularPrice
          : activeData.regularPrice;
        const regularPrice = Number(rawRegPrice) || 0;
        const rawSalePrice = rawLangData.salePrice !== undefined && rawLangData.salePrice !== ''
          ? rawLangData.salePrice
          : activeData.salePrice;
        const salePriceNum = Number(rawSalePrice) || 0;
        const hasSalePrice = salePriceNum > 0 && salePriceNum < regularPrice;
        const effectiveSalePrice = hasSalePrice ? salePriceNum : regularPrice;

        const shippingBasic = !!(rawLangData.shippingBasic !== undefined ? rawLangData.shippingBasic : activeData.shippingBasic);
        const shippingExtended = !!(rawLangData.shippingExtended !== undefined ? rawLangData.shippingExtended : activeData.shippingExtended);
        const shippingBasicCost = Number(rawLangData.shippingBasicCost !== undefined ? rawLangData.shippingBasicCost : activeData.shippingBasicCost) || 0;
        const shippingExtendedCost = Number(rawLangData.shippingExtendedCost !== undefined ? rawLangData.shippingExtendedCost : activeData.shippingExtendedCost) || 0;
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
            ...rawLangData,
            title: title,
            description: rawLangData.description || activeData.description || '',
            regularPrice: regularPrice,
            salePrice: effectiveSalePrice,
            descriptionFull: descriptionFullArray,
            visibility: rawLangData.visibility !== undefined ? !!rawLangData.visibility : (activeData.visibility !== undefined ? !!activeData.visibility : true),
            onSale: hasSalePrice || !!rawLangData.onSale,
            stock: rawLangData.stock || activeData.stock || 'onStock',
            stockDate: rawLangData.stockDate || activeData.stockDate || '',
            quantity: Number(rawLangData.quantity !== undefined ? rawLangData.quantity : activeData.quantity) || 0,
            shipping: shippingType,
            shippingBasic: shippingBasic,
            shippingBasicCost: shippingBasicCost,
            shippingExtended: shippingExtended,
            shippingExtendedCost: shippingExtendedCost,
            shippingCost: shippingBasicCost || shippingExtendedCost || Number(rawLangData.shippingCost) || 0,
            productType: rawLangData.productType || activeData.productType || 'clothing',
            hasColors: rawLangData.hasColors !== undefined ? !!rawLangData.hasColors : (activeData.hasColors !== undefined ? !!activeData.hasColors : true),
            colors: rawLangData.colors || activeData.colors || [],
            hasSizes: rawLangData.hasSizes !== undefined ? !!rawLangData.hasSizes : (activeData.hasSizes !== undefined ? !!activeData.hasSizes : true),
            sizes: rawLangData.sizes || activeData.sizes || [],
            hasClassification: rawLangData.hasClassification !== undefined ? !!rawLangData.hasClassification : (activeData.hasClassification !== undefined ? !!activeData.hasClassification : true),
            categoryLevel1: rawLangData.categoryLevel1 || activeData.categoryLevel1 || '',
            categoryLevel2: rawLangData.categoryLevel2 || activeData.categoryLevel2 || '',
            variants: rawLangData.variants || activeData.variants || [],
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
    this.cdr?.detectChanges();

    // Prepare products for API
    const countToImport = this.csvProducts.length;
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
        const importedCount = result.imported ?? countToImport;
        this.csvProducts = [];
        this.csvFileName = '';
        this.showToast(`Đã nhập thành công ${importedCount} sản phẩm từ file CSV!`);
      } else {
        const errorMsg = result?.error?.message || result?.error || 'Lỗi khi nhập sản phẩm từ CSV';
        this.csvImportResult = { imported: 0, errors: [errorMsg] };
        this.showToast(errorMsg, true);
      }
      this.cdr?.detectChanges();
    });
  }

  clearCsvPreview(): void {
    this.csvProducts = [];
    this.csvFileName = '';
    this.csvImportResult = null;
  }
}
