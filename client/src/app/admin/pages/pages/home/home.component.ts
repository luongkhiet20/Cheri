import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ApiService } from '../../../../services/api.service';
import {
  HomeSection,
  SectionType,
  SectionCategory,
  AnimationPreset,
  MotionPresetType,
  SectionTypeOption,
  TypographyPresetType,
  TypographyElementKey,
  TypographyConfig,
  SectionTypography,
  SectionColors,
  FontOption,
  CarouselConfig,
  CarouselSlideItem,
  ConfigurableTypographyTarget,
  SectionAnimation,
} from './home-cms.models';
import {
  INITIAL_HOME_SECTIONS,
  SECTION_TYPE_OPTIONS,
  AVAILABLE_FONTS,
  TYPOGRAPHY_PRESETS,
  CHERI_COLOR_PRESETS,
  ColorPreset,
  getDefaultTypographyForType,
  getDefaultColorsForType,
  getDefaultCarouselConfig,
  createDefaultSection,
} from './home-cms.constants';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  // ── State Kết Nối Backend API & MongoDB ─────────────────────────
  isLoadingDraft = false;
  isPublishing = false;
  loadError = '';
  lastPublishedAt: Date | null = null;
  isUploadingDesktop = false;
  isUploadingMobile = false;
  hasUnsavedChanges = false;

  // ── State Danh Sách Section ─────────────────────────────────────
  sections: HomeSection[] = [];
  selectedSection: HomeSection | null = null;

  // ── State Điều Khiển UI Modal / Drawer ───────────────────────────
  isEditorOpen = false;
  editorActiveTab: 'content' | 'media' | 'layout' | 'typography' | 'animation' | 'settings' = 'content';
  activeTypographyElement: TypographyElementKey = 'heading';

  selectedTypographyPreset: TypographyPresetType = 'editorial';
  activeContentFieldKey: string = 'title';
  activeTargetId: string = '';
  activeTargetSectionId: string = '';
  configurableSectionGroups: {
    section: HomeSection;
    sectionId: string;
    sectionName: string;
    targets: ConfigurableTypographyTarget[];
  }[] = [];
  allConfigurableTargets: ConfigurableTypographyTarget[] = [];
  activeTarget: ConfigurableTypographyTarget | null = null;

  get selectedPresetForQuickApply(): TypographyPresetType {
    return this.selectedTypographyPreset;
  }
  set selectedPresetForQuickApply(val: TypographyPresetType) {
    this.selectedTypographyPreset = val;
  }

  get fontOptions(): FontOption[] {
    return this.availableFonts.map((f) => ({
      ...f,
      label: f.label || f.name,
      value: f.value || f.fontFamily,
      style: f.style || f.category,
    }));
  }

  get brandColorPalette(): ColorPreset[] {
    return this.cheriColorPresets;
  }

  get pageDoc(): { sections: HomeSection[] } {
    return { sections: this.sections };
  }

  readonly availableFonts: FontOption[] = AVAILABLE_FONTS;
  readonly typographyPresets = TYPOGRAPHY_PRESETS;
  readonly cheriColorPresets = CHERI_COLOR_PRESETS;
  readonly hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  activeColorProperty: keyof SectionColors = 'titleColor';
  colorErrors: { [key: string]: string } = {};

  isAddModalOpen = false;
  selectedAddCategory: 'ALL' | SectionCategory = 'ALL';
  sectionTypeOptions: SectionTypeOption[] = SECTION_TYPE_OPTIONS;

  // ── State Carousel Trình Chiếu ──────────────────────────────────
  activeSlideIndices: { [sectionId: string]: number } = {};
  isUploadingCarousel = false;
  carouselUploadError = '';
  carouselUploadProgress = 0;
  isDraggingOverDropzone = false;
  editingSlideIndex = -1;
  private carouselAutoplayTimer: any = null;
  private touchStartX = 0;
  private touchEndX = 0;

  // ── State Xem Trước (Live Preview & Full Preview) ────────────────
  previewViewport: 'desktop' | 'mobile' = 'desktop';
  isAnimationPlaying = false;
  isFullPreviewOpen = false;
  fullPreviewViewport: 'desktop' | 'mobile' = 'desktop';

  // Danh sách sản phẩm thực tế từ backend phục vụ Live Preview khối sản phẩm
  realProducts: any[] = [];
  isLoadingProducts = false;

  get previewProducts(): any[] {
    return this.getFilteredProductsForAdmin(this.selectedSection);
  }

  // ── State Dialog Xóa ─────────────────────────────────────────────
  isDeleteDialogOpen = false;
  sectionToDelete: HomeSection | null = null;

  // ── Danh sách Preset Animation ──────────────────────────────────
  readonly animationPresets: { value: AnimationPreset; label: string }[] = [
    { value: 'none', label: 'Không hiệu ứng (None)' },
    { value: 'fade', label: 'Mờ dần (Fade)' },
    { value: 'fade-up', label: 'Trượt lên mờ dần (Fade Up)' },
    { value: 'fade-down', label: 'Trượt xuống mờ dần (Fade Down)' },
    { value: 'fade-left', label: 'Trượt từ phải sang (Fade Left)' },
    { value: 'fade-right', label: 'Trượt từ trái sang (Fade Right)' },
    { value: 'slide-left', label: 'Trượt qua trái (Slide Left)' },
    { value: 'slide-right', label: 'Trượt qua phải (Slide Right)' },
    { value: 'zoom-in', label: 'Thu phóng vào (Zoom In)' },
    { value: 'zoom-out', label: 'Thu phóng ra (Zoom Out)' },
    { value: 'reveal', label: 'Mở màn từ từ (Reveal)' },
    { value: 'image-reveal', label: 'Lộ ảnh sang trọng (Image Reveal)' },
    { value: 'split-reveal', label: 'Tách chữ & ảnh (Split Reveal)' },
    { value: 'stagger', label: 'Xuất hiện so le (Stagger)' },
    { value: 'parallax', label: 'Cuộn chiều sâu (Parallax)' },
    { value: 'image-zoom', label: 'Phóng to ảnh chậm (Image Zoom)' },
    { value: 'text-reveal', label: 'Lộ chữ nghệ thuật (Text Reveal)' },
  ];

  readonly motionPresets: { value: MotionPresetType; label: string; desc: string }[] = [
    { value: 'minimal', label: 'Minimal', desc: 'Đơn giản, chuyển động rất nhẹ' },
    { value: 'subtle', label: 'Subtle', desc: 'Tinh tế, chuyển động êm dịu' },
    { value: 'normal', label: 'Normal', desc: 'Tiêu chuẩn trang nhã' },
    { value: 'editorial', label: 'Editorial', desc: 'Phong cách tạp chí thời trang' },
    { value: 'luxury', label: 'Luxury', desc: 'Đẳng cấp, chuyển động chậm rãi' },
    { value: 'dynamic', label: 'Dynamic', desc: 'Sôi nổi, nổi bật và sống động' },
  ];

  constructor(
    private notificationService: NotificationService,
    private apiService: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadHomeConfigFromBackend();
    this.loadRealProducts();
  }

  loadRealProducts(): void {
    this.isLoadingProducts = true;
    this.apiService.getProducts({ pageSize: 12 }).subscribe({
      next: (res: any) => {
        this.isLoadingProducts = false;
        const prods = res?.products || res?.data?.products || (Array.isArray(res) ? res : []);
        this.realProducts = Array.isArray(prods) ? prods : [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingProducts = false;
        this.realProducts = [];
        this.cdr.markForCheck();
      },
    });
  }

  getFilteredProductsForAdmin(section: HomeSection | null): any[] {
    if (!section || !this.realProducts || this.realProducts.length === 0) return [];
    const source = section.settings?.source || 'featured';
    const limit = section.settings?.limit || 8;
    let filtered = [...this.realProducts];
    if (source === 'sale') {
      const saleItems = filtered.filter((p: any) => p.onSale && p.salePrice);
      if (saleItems.length > 0) filtered = saleItems;
    } else if (source === 'manual' && section.settings?.manualProductIds?.length) {
      const ids = section.settings.manualProductIds;
      const manualItems = filtered.filter((p: any) => ids.includes(p._id || p.id));
      if (manualItems.length > 0) filtered = manualItems;
    }
    return filtered.slice(0, limit);
  }

  getProductCardInfo(p: any): { id: string; name: string; category: string; price: string; badge: string; imageUrl: string } {
    const name = p.title || p.name || 'Sản phẩm';
    const category = typeof p.category === 'string' ? p.category : (p.category?.name || p.tags?.[0] || 'Thời trang');
    const priceVal = p.salePrice || p.regularPrice || p.price || 0;
    const price = typeof priceVal === 'number' ? priceVal.toLocaleString('vi-VN') + ' đ' : String(priceVal);
    const badge = p.onSale ? 'SALE' : (p.isNew ? 'NEW' : '');
    const imageUrl = p.mainImage?.url || (Array.isArray(p.images) && p.images[0]) || '';
    return {
      id: p._id || p.id,
      name,
      category,
      price,
      badge,
      imageUrl,
    };
  }

  ngOnDestroy(): void {
    this.stopCarouselAutoplay();
  }

  // ── Khởi tạo & Tải Cấu Hình từ Backend API ────────────────────────
  loadHomeConfigFromBackend(): void {
    this.isLoadingDraft = true;
    this.loadError = '';
    this.cdr.markForCheck();

    this.apiService.getHomeAdmin().subscribe({
      next: (res: any) => {
        this.isLoadingDraft = false;

        // Nếu API trả về error
        if (res && res.error) {
          const errMsg = res.error?.message || res.error?.error || 'Lỗi xác thực hoặc kết nối';
          this.loadError = 'Không thể tải cấu hình từ máy chủ: ' + errMsg;
          this.notificationService.error(this.loadError);
          this.sections = JSON.parse(JSON.stringify(INITIAL_HOME_SECTIONS));
          this.postLoadSetup();
          return;
        }

        const serverSections = res?.data?.sections || res?.sections;
        if (Array.isArray(serverSections) && serverSections.length > 0) {
          this.sections = serverSections;
          this.lastPublishedAt = res.data?.publishedAt ? new Date(res.data.publishedAt) : null;
          this.hasUnsavedChanges = false;
        } else {
          // Khởi tạo từ mẫu chuẩn nếu cơ sở dữ liệu hoàn toàn trống
          this.sections = JSON.parse(JSON.stringify(INITIAL_HOME_SECTIONS));
          this.hasUnsavedChanges = false;
        }

        this.postLoadSetup();
      },
      error: (err: any) => {
        this.isLoadingDraft = false;
        this.loadError = 'Lỗi kết nối khi tải cấu hình trang chủ';
        this.notificationService.error(this.loadError);
        this.sections = JSON.parse(JSON.stringify(INITIAL_HOME_SECTIONS));
        this.postLoadSetup();
      },
    });
  }

  postLoadSetup(): void {
    if (this.sections.length > 0) {
      this.selectedSection = this.sections[0];
      this.ensureSectionTypography(this.selectedSection);
      this.ensureCarouselConfig(this.selectedSection);
      this.updateActiveTypographyElementForSection(this.selectedSection);
    }
    this.refreshTypographyTargets();
    this.startCarouselAutoplay();
    this.cdr.markForCheck();
  }

  // ── Drag & Drop Reorder ──────────────────────────────────────────
  onDrop(event: CdkDragDrop<HomeSection[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(this.sections, event.previousIndex, event.currentIndex);
    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã cập nhật thứ tự các section');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Thao Tác Xuất Bản Duy Nhất (Publish qua API) ──────────────────
  validateSectionsForPublish(): { valid: boolean; message: string } {
    if (!this.sections || !Array.isArray(this.sections) || this.sections.length === 0) {
      return { valid: false, message: 'Danh sách section trống. Vui lòng thêm ít nhất 1 section.' };
    }

    const enabledSecs = this.sections.filter((s) => s.enabled);
    if (enabledSecs.length === 0) {
      return { valid: false, message: 'Tất cả các section đang bị ẩn. Vui lòng bật ít nhất 1 section để hiển thị trang chủ.' };
    }

    for (const sec of enabledSecs) {
      const name = sec.name || sec.type;
      switch (sec.type) {
        case 'hero':
          if (sec.layout?.variant === 'carousel') {
            const slides = (sec.media?.carouselSlides || []).filter((s) => s && s.enabled !== false && !!s.url?.trim());
            if (slides.length === 0) {
              return {
                valid: false,
                message: `Section "${name}": Carousel cần ít nhất 1 slide có hình ảnh hợp lệ trước khi xuất bản.`
              };
            }
          } else {
            const hasImg = !!sec.media?.desktop?.url?.trim();
            const hasTitle = !!sec.content?.title?.trim();
            if (!hasImg && !hasTitle) {
              return {
                valid: false,
                message: `Section "${name}": Hero Banner cần có ít nhất hình ảnh nền hoặc tiêu đề trước khi xuất bản.`
              };
            }
          }
          break;

        case 'banner':
          if (sec.layout?.variant === 'carousel') {
            const slides = (sec.media?.carouselSlides || []).filter((s) => s && s.enabled !== false && !!s.url?.trim());
            if (slides.length === 0) {
              return {
                valid: false,
                message: `Section "${name}": Carousel cần ít nhất 1 slide có hình ảnh hợp lệ trước khi xuất bản.`
              };
            }
          } else {
            const hasImg = !!sec.media?.desktop?.url?.trim();
            const hasTitle = !!sec.content?.title?.trim();
            if (!hasImg && !hasTitle) {
              return {
                valid: false,
                message: `Section "${name}": Banner cần có ít nhất hình ảnh hoặc tiêu đề trước khi xuất bản.`
              };
            }
          }
          break;

        case 'editorial': {
          const hasImg = !!sec.media?.desktop?.url?.trim();
          const hasTitle = !!sec.content?.title?.trim();
          const hasQuote = !!sec.content?.quote?.trim();
          if (!hasImg && !hasTitle && !hasQuote) {
            return {
              valid: false,
              message: `Section "${name}": Editorial cần có hình ảnh hoặc tiêu đề/trích dẫn trước khi xuất bản.`
            };
          }
          break;
        }

        case 'image-text': {
          const hasImg = !!sec.media?.desktop?.url?.trim();
          const hasTitle = !!sec.content?.title?.trim();
          if (!hasImg && !hasTitle) {
            return {
              valid: false,
              message: `Section "${name}": Khối Hình ảnh + Chữ cần có hình ảnh hoặc tiêu đề trước khi xuất bản.`
            };
          }
          break;
        }

        case 'quote': {
          const hasQuote = !!sec.content?.quote?.trim();
          if (!hasQuote) {
            return {
              valid: false,
              message: `Section "${name}": Khối Trích dẫn cần có nội dung trích dẫn trước khi xuất bản.`
            };
          }
          break;
        }

        case 'cta': {
          const hasTitle = !!sec.content?.title?.trim();
          const hasDesc = !!sec.content?.description?.trim();
          if (!hasTitle && !hasDesc) {
            return {
              valid: false,
              message: `Section "${name}": Khối CTA cần có tiêu đề hoặc mô tả trước khi xuất bản.`
            };
          }
          break;
        }

        case 'product-slider':
        case 'product-grid': {
          const hasTitle = !!sec.content?.title?.trim();
          if (!hasTitle) {
            return {
              valid: false,
              message: `Section "${name}": Khối sản phẩm cần có tiêu đề hiển thị trước khi xuất bản.`
            };
          }
          break;
        }
      }
    }

    return { valid: true, message: '' };
  }

  onPublish(): void {
    if (this.isPublishing) return;

    const validation = this.validateSectionsForPublish();
    if (!validation.valid) {
      this.notificationService.error(validation.message);
      return;
    }

    if (this.checkForLargeBase64(this.sections)) {
      this.notificationService.error(
        'Phát hiện một số ảnh đang ở dạng dữ liệu tạm thời. Vui lòng tải ảnh lên máy chủ qua nút Tải ảnh trước khi xuất bản.'
      );
      return;
    }

    this.isPublishing = true;
    this.cdr.markForCheck();

    this.apiService.publishHome({ sections: this.sections }).subscribe({
      next: (res: any) => {
        this.isPublishing = false;
        if (res && res.error) {
          const msg = res.error?.message || res.error?.error || 'Lỗi máy chủ khi xuất bản';
          this.notificationService.error('Không thể xuất bản trang chủ: ' + msg);
          this.cdr.markForCheck();
          return;
        }

        this.lastPublishedAt = new Date();
        this.hasUnsavedChanges = false;

        this.notificationService.success('Đã xuất bản cấu hình Trang chủ lên máy chủ thành công!');
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isPublishing = false;
        this.notificationService.error(
          'Lỗi kết nối khi xuất bản. Cấu hình công khai hiện tại vẫn được giữ nguyên an toàn.'
        );
        this.cdr.markForCheck();
      },
    });
  }

  onOpenLiveSite(): void {
    window.open('/vi', '_blank');
  }

  // ── Quản lý Trạng thái Section (Enable / Edit / Duplicate / Delete)
  onToggleEnabled(section: HomeSection, event: MouseEvent): void {
    event.stopPropagation();
    section.enabled = !section.enabled;
    const msg = section.enabled
      ? `Đã bật hiển thị "${section.name}"`
      : `Đã ẩn section "${section.name}"`;
    this.notificationService.success(msg);
    this.cdr.markForCheck();
  }

  onSelectSection(section: HomeSection): void {
    this.selectedSection = section;
    this.ensureSectionTypography(section);
    this.updateActiveTypographyElementForSection(section);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onEditSection(section: HomeSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedSection = section;
    this.ensureSectionTypography(section);
    this.updateActiveTypographyElementForSection(section);
    this.isEditorOpen = true;
    this.editorActiveTab = 'content';
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCloseEditor(): void {
    this.isEditorOpen = false;
    this.cdr.markForCheck();
  }

  onDuplicateSection(section: HomeSection, event: MouseEvent): void {
    event.stopPropagation();
    const cloned: HomeSection = JSON.parse(JSON.stringify(section));
    cloned.id = `sec-${section.type}-${Date.now().toString(36)}`;
    cloned.name = `${section.name} (Bản sao)`;
    cloned.order = this.sections.length + 1;
    this.ensureSectionTypography(cloned);

    // Chèn ngay sau section hiện tại
    const index = this.sections.findIndex((s) => s.id === section.id);
    if (index !== -1) {
      this.sections.splice(index + 1, 0, cloned);
    } else {
      this.sections.push(cloned);
    }

    // Cập nhật lại order
    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    this.selectedSection = cloned;
    this.updateActiveTypographyElementForSection(cloned);
    this.notificationService.success(`Đã nhân bản "${section.name}"`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onPromptDeleteSection(section: HomeSection, event: MouseEvent): void {
    event.stopPropagation();
    this.sectionToDelete = section;
    this.isDeleteDialogOpen = true;
    this.cdr.markForCheck();
  }

  onConfirmDelete(): void {
    if (!this.sectionToDelete) return;

    const delId = this.sectionToDelete.id;
    const delName = this.sectionToDelete.name;
    this.sections = this.sections.filter((s) => s.id !== delId);
    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    if (this.selectedSection?.id === delId) {
      this.selectedSection = this.sections[0] || null;
      if (!this.selectedSection) {
        this.isEditorOpen = false;
      }
    }

    this.isDeleteDialogOpen = false;
    this.sectionToDelete = null;
    this.notificationService.success(`Đã xóa section "${delName}"`);
    this.cdr.markForCheck();
  }

  onCancelDelete(): void {
    this.isDeleteDialogOpen = false;
    this.sectionToDelete = null;
    this.cdr.markForCheck();
  }

  // ── Thêm Section Mới (Add Section Modal) ─────────────────────────
  onOpenAddModal(): void {
    this.selectedAddCategory = 'ALL';
    this.isAddModalOpen = true;
    this.cdr.markForCheck();
  }

  onCloseAddModal(): void {
    this.isAddModalOpen = false;
    this.cdr.markForCheck();
  }

  get filteredSectionOptions(): SectionTypeOption[] {
    if (this.selectedAddCategory === 'ALL') {
      return this.sectionTypeOptions;
    }
    return this.sectionTypeOptions.filter((opt) => opt.category === this.selectedAddCategory);
  }

  onSelectNewSectionType(option: SectionTypeOption): void {
    const newSec = createDefaultSection(option.type, this.sections.length + 1);
    this.ensureSectionTypography(newSec);
    this.updateActiveTypographyElementForSection(newSec);
    this.sections.push(newSec);
    this.selectedSection = newSec;
    this.isAddModalOpen = false;
    this.isEditorOpen = true;
    this.editorActiveTab = 'content';
    this.notificationService.success(`Đã thêm section "${option.name}"`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Motion Preset & Animation Controls ───────────────────────────
  onApplyMotionPreset(preset: MotionPresetType): void {
    if (!this.selectedSection) return;
    this.selectedSection.motionPreset = preset;
    this.selectedSection.isCustomAnimation = false;

    switch (preset) {
      case 'minimal':
        this.selectedSection.animation = {
          preset: 'fade',
          duration: 400,
          delay: 0,
          intensity: 'subtle',
          once: true,
        };
        break;
      case 'subtle':
        this.selectedSection.animation = {
          preset: 'fade-up',
          duration: 600,
          delay: 50,
          intensity: 'subtle',
          once: true,
        };
        break;
      case 'normal':
        this.selectedSection.animation = {
          preset: 'fade-up',
          duration: 750,
          delay: 100,
          intensity: 'normal',
          once: true,
        };
        break;
      case 'editorial':
        this.selectedSection.animation = {
          preset: this.selectedSection.type === 'editorial' ? 'split-reveal' : 'reveal',
          duration: 900,
          delay: 150,
          intensity: 'normal',
          once: true,
        };
        break;
      case 'luxury':
        this.selectedSection.animation = {
          preset: 'image-zoom',
          duration: 1200,
          delay: 200,
          intensity: 'subtle',
          once: true,
        };
        break;
      case 'dynamic':
        this.selectedSection.animation = {
          preset: 'zoom-in',
          duration: 650,
          delay: 0,
          intensity: 'strong',
          once: true,
        };
        break;
    }

    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onSwitchToCustomAnimation(): void {
    if (!this.selectedSection) return;
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCustomAnimationChange(): void {
    if (!this.selectedSection) return;
    this.ensureSectionAnimation(this.selectedSection);
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCustomAnimationPresetChange(preset: AnimationPreset): void {
    if (!this.selectedSection) return;
    const anim = this.ensureSectionAnimation(this.selectedSection);
    anim.preset = preset;
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCustomAnimationDurationChange(duration: any): void {
    if (!this.selectedSection) return;
    const anim = this.ensureSectionAnimation(this.selectedSection);
    const parsed = Number(duration);
    anim.duration = !isNaN(parsed) && parsed > 0 ? parsed : 750;
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCustomAnimationDelayChange(delay: any): void {
    if (!this.selectedSection) return;
    const anim = this.ensureSectionAnimation(this.selectedSection);
    const parsed = Number(delay);
    anim.delay = !isNaN(parsed) && parsed >= 0 ? parsed : 0;
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCustomAnimationIntensityChange(intensity: 'subtle' | 'normal' | 'strong'): void {
    if (!this.selectedSection) return;
    const anim = this.ensureSectionAnimation(this.selectedSection);
    anim.intensity = intensity;
    this.selectedSection.isCustomAnimation = true;
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  ensureSectionAnimation(section: HomeSection | null | undefined): SectionAnimation {
    if (!section) {
      return {
        preset: 'fade-up',
        duration: 750,
        delay: 100,
        intensity: 'normal',
        once: true,
      };
    }
    if (!section.animation) {
      section.animation = {
        preset: 'fade-up',
        duration: 750,
        delay: 100,
        intensity: 'normal',
        once: true,
      };
    }
    if (!section.animation.preset) {
      section.animation.preset = 'fade-up';
    }
    if (typeof section.animation.duration !== 'number' || isNaN(section.animation.duration)) {
      section.animation.duration = 750;
    }
    if (typeof section.animation.delay !== 'number' || isNaN(section.animation.delay)) {
      section.animation.delay = 0;
    }
    if (!section.animation.intensity) {
      section.animation.intensity = 'normal';
    }
    return section.animation;
  }

  getSectionAnimationClass(section: HomeSection | null | undefined): string {
    if (!section || !this.isAnimationPlaying) return '';
    const anim = section.animation;
    if (!anim || !anim.preset || anim.preset === 'none') return '';
    return `anim-${anim.preset} anim-intensity-${anim.intensity || 'normal'}`;
  }

  getSectionAnimationStyle(section: HomeSection | null | undefined): Record<string, string> {
    if (!section || !section.animation || section.animation.preset === 'none') {
      return {};
    }
    const duration = (typeof section.animation.duration === 'number' && section.animation.duration > 0)
      ? `${section.animation.duration}ms`
      : '750ms';
    const delay = (typeof section.animation.delay === 'number' && section.animation.delay >= 0)
      ? `${section.animation.delay}ms`
      : '0ms';

    return {
      'animation-duration': duration,
      'animation-delay': delay,
      '--anim-duration': duration,
      '--anim-delay': delay,
    };
  }

  // ── Media Upload (Thực tế qua Backend API & Cloudinary/Server) ───
  onFileSelected(event: Event, target: 'desktop' | 'mobile'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    input.value = '';

    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validImageTypes.includes(file.type)) {
      this.notificationService.error(`File "${file.name}" không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, GIF, SVG.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notificationService.error(`File "${file.name}" quá lớn (tối đa 10MB).`);
      return;
    }

    if (target === 'desktop') {
      this.isUploadingDesktop = true;
    } else {
      this.isUploadingMobile = true;
    }
    this.cdr.markForCheck();

    this.apiService.uploadImage({ fileToUpload: file, titleUrl: '' }).subscribe({
      next: (res: any) => {
        if (target === 'desktop') {
          this.isUploadingDesktop = false;
        } else {
          this.isUploadingMobile = false;
        }

        const uploadedUrl = this.extractUploadedImageUrl(res);
        if (!uploadedUrl) {
          const errMsg = res?.error?.message || res?.error || 'Máy chủ không trả về URL ảnh hợp lệ';
          this.notificationService.error(`Tải ảnh ${target} thất bại: ` + errMsg);
          this.cdr.markForCheck();
          return;
        }

        if (!this.selectedSection) return;
        if (!this.selectedSection.media) {
          this.selectedSection.media = {};
        }

        if (target === 'desktop') {
          this.selectedSection.media.desktop = {
            url: uploadedUrl,
            alt: file.name.replace(/\.[^/.]+$/, ''),
          };
        } else {
          this.selectedSection.media.mobile = {
            url: uploadedUrl,
            alt: file.name.replace(/\.[^/.]+$/, ''),
          };
        }

        this.hasUnsavedChanges = true;
        this.notificationService.success(
          `Đã tải ảnh ${target === 'desktop' ? 'Desktop' : 'Mobile'} lên máy chủ thành công!`
        );
        this.triggerAnimationPreview();
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (target === 'desktop') {
          this.isUploadingDesktop = false;
        } else {
          this.isUploadingMobile = false;
        }
        this.notificationService.error(`Lỗi tải ảnh: ${err?.message || 'Không thể kết nối máy chủ'}`);
        this.cdr.markForCheck();
      },
    });
  }

  onRemoveImage(target: 'desktop' | 'mobile'): void {
    if (!this.selectedSection?.media) return;
    if (target === 'desktop') {
      this.selectedSection.media.desktop = null;
    } else {
      this.selectedSection.media.mobile = null;
    }
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã gỡ bỏ ảnh');
    this.cdr.markForCheck();
  }

  // ── Carousel Helper & Navigation ────────────────────────────────
  ensureCarouselConfig(section: HomeSection): CarouselConfig {
    if (!section.layout) {
      section.layout = { variant: 'centered' };
    }
    if (!section.layout.carouselConfig) {
      section.layout.carouselConfig = getDefaultCarouselConfig();
    }
    return section.layout.carouselConfig;
  }

  getCarouselSlides(section: HomeSection | null): CarouselSlideItem[] {
    if (!section) return [];
    if (!section.media) {
      section.media = {};
    }
    if (!section.media.carouselSlides) {
      section.media.carouselSlides = [];
    }
    return section.media.carouselSlides;
  }

  getEnabledSlides(section: HomeSection | null): CarouselSlideItem[] {
    const slides = this.getCarouselSlides(section);
    return slides.filter((s) => s.enabled);
  }

  getCarouselActiveIndex(sectionId: string): number {
    return this.activeSlideIndices[sectionId] || 0;
  }

  getActiveSlide(section: HomeSection): CarouselSlideItem | null {
    const slides = this.getEnabledSlides(section);
    if (slides.length === 0) return null;
    const idx = this.getCarouselActiveIndex(section.id) % slides.length;
    return slides[idx] || slides[0] || null;
  }

  onNextSlide(section: HomeSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const slides = this.getEnabledSlides(section);
    if (slides.length <= 1) return;
    const current = this.getCarouselActiveIndex(section.id);
    const cfg = this.ensureCarouselConfig(section);

    if (current < slides.length - 1) {
      this.activeSlideIndices[section.id] = current + 1;
    } else if (cfg.loop) {
      this.activeSlideIndices[section.id] = 0;
    }
    this.cdr.markForCheck();
  }

  onPrevSlide(section: HomeSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    const slides = this.getEnabledSlides(section);
    if (slides.length <= 1) return;
    const current = this.getCarouselActiveIndex(section.id);
    const cfg = this.ensureCarouselConfig(section);

    if (current > 0) {
      this.activeSlideIndices[section.id] = current - 1;
    } else if (cfg.loop) {
      this.activeSlideIndices[section.id] = slides.length - 1;
    }
    this.cdr.markForCheck();
  }

  onGoToSlide(section: HomeSection, index: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.activeSlideIndices[section.id] = index;
    this.cdr.markForCheck();
  }

  // ── Swipe Touch Handler for Mobile Preview ───────────────────────
  onTouchStart(event: TouchEvent): void {
    if (event.changedTouches && event.changedTouches.length > 0) {
      this.touchStartX = event.changedTouches[0].screenX;
    }
  }

  onTouchEnd(section: HomeSection, event: TouchEvent): void {
    if (event.changedTouches && event.changedTouches.length > 0) {
      this.touchEndX = event.changedTouches[0].screenX;
      const diff = this.touchStartX - this.touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          this.onNextSlide(section);
        } else {
          this.onPrevSlide(section);
        }
      }
    }
  }

  // ── Autoplay Manager ─────────────────────────────────────────────
  startCarouselAutoplay(): void {
    this.stopCarouselAutoplay();
    this.carouselAutoplayTimer = setInterval(() => {
      if (this.selectedSection && this.selectedSection.layout?.variant === 'carousel') {
        const cfg = this.ensureCarouselConfig(this.selectedSection);
        if (cfg.autoplay) {
          this.onNextSlide(this.selectedSection);
        }
      }
    }, 4500);
  }

  stopCarouselAutoplay(): void {
    if (this.carouselAutoplayTimer) {
      clearInterval(this.carouselAutoplayTimer);
      this.carouselAutoplayTimer = null;
    }
  }

  // ── Quản lý Upload & Slide Operations ────────────────────────────
  onCarouselDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOverDropzone = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.onProcessImageFiles(event.dataTransfer.files);
    }
  }

  onCarouselDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOverDropzone = true;
  }

  onCarouselDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOverDropzone = false;
  }

  onCarouselFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.onProcessImageFiles(input.files);
      input.value = '';
    }
  }

  onProcessImageFiles(files: FileList | File[]): void {
    if (!this.selectedSection) return;
    const fileArray = Array.from(files);
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

    const validFiles: File[] = [];
    for (const file of fileArray) {
      if (!validImageTypes.includes(file.type)) {
        this.notificationService.error(`File "${file.name}" không hợp lệ (chấp nhận JPG, PNG, WEBP, GIF, SVG).`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.notificationService.error(`File "${file.name}" quá lớn (tối đa 10MB).`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    this.carouselUploadError = '';
    this.isUploadingCarousel = true;
    this.carouselUploadProgress = 10;
    this.cdr.markForCheck();

    let uploadedSuccessCount = 0;
    let processedIndex = 0;
    const total = validFiles.length;

    const uploadNext = (index: number) => {
      if (index >= total) {
        this.isUploadingCarousel = false;
        this.carouselUploadProgress = 100;
        if (uploadedSuccessCount > 0) {
          this.hasUnsavedChanges = true;
          this.notificationService.success(
            `Đã tải lên máy chủ thành công ${uploadedSuccessCount}/${total} ảnh vào Carousel!`
          );
          this.triggerAnimationPreview();
        }
        this.cdr.markForCheck();
        return;
      }

      const file = validFiles[index];
      this.apiService.uploadImage({ fileToUpload: file, titleUrl: '' }).subscribe({
        next: (res: any) => {
          const uploadedUrl = this.extractUploadedImageUrl(res);
          if (uploadedUrl && this.selectedSection) {
            const slides = this.getCarouselSlides(this.selectedSection);
            slides.push({
              id: `slide-${Date.now()}-${index}`,
              url: uploadedUrl,
              alt: file.name.replace(/\.[^/.]+$/, ''),
              title: '',
              description: '',
              linkUrl: '',
              enabled: true,
              isLocalPreview: false,
            });
            uploadedSuccessCount++;
          } else {
            this.notificationService.error(`Tải file "${file.name}" thất bại.`);
          }
          processedIndex++;
          this.carouselUploadProgress = Math.round((processedIndex / total) * 100);
          this.cdr.markForCheck();
          uploadNext(index + 1);
        },
        error: () => {
          this.notificationService.error(`Lỗi tải file "${file.name}".`);
          processedIndex++;
          this.carouselUploadProgress = Math.round((processedIndex / total) * 100);
          this.cdr.markForCheck();
          uploadNext(index + 1);
        },
      });
    };

    uploadNext(0);
  }

  onAddEmptySlide(): void {
    if (!this.selectedSection) return;
    const slides = this.getCarouselSlides(this.selectedSection);
    const newSlide: CarouselSlideItem = {
      id: `slide-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      url: '',
      alt: '',
      title: '',
      description: '',
      linkUrl: '',
      enabled: true,
    };
    slides.push(newSlide);
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã thêm 1 slide mới');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onRemoveSlide(index: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!this.selectedSection) return;
    const slides = this.getCarouselSlides(this.selectedSection);
    slides.splice(index, 1);
    const activeIdx = this.getCarouselActiveIndex(this.selectedSection.id);
    if (activeIdx >= slides.length) {
      this.activeSlideIndices[this.selectedSection.id] = Math.max(0, slides.length - 1);
    }
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã xóa slide khỏi Carousel');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onMoveSlide(fromIndex: number, toIndex: number, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    if (!this.selectedSection) return;
    const slides = this.getCarouselSlides(this.selectedSection);
    if (toIndex < 0 || toIndex >= slides.length) return;
    const [moved] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, moved);
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã đổi thứ tự slide');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onDropSlide(event: CdkDragDrop<CarouselSlideItem[]>): void {
    if (!this.selectedSection) return;
    const slides = this.getCarouselSlides(this.selectedSection);
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(slides, event.previousIndex, event.currentIndex);
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã cập nhật thứ tự các slide');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onReplaceSlideImage(index: number, event: Event, target: 'desktop' | 'mobile'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    input.value = '';

    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!validImageTypes.includes(file.type)) {
      this.notificationService.error('File không đúng định dạng ảnh.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.notificationService.error('Ảnh quá lớn (tối đa 10MB).');
      return;
    }

    this.apiService.uploadImage({ fileToUpload: file, titleUrl: '' }).subscribe({
      next: (res: any) => {
        const uploadedUrl = this.extractUploadedImageUrl(res);
        if (!uploadedUrl) {
          this.notificationService.error('Tải ảnh thất bại: Máy chủ không trả về URL');
          return;
        }
        if (!this.selectedSection) return;
        const slides = this.getCarouselSlides(this.selectedSection);
        if (slides[index]) {
          if (target === 'desktop') {
            slides[index].url = uploadedUrl;
            slides[index].isLocalPreview = false;
          } else {
            slides[index].mobileUrl = uploadedUrl;
          }
          this.hasUnsavedChanges = true;
          this.notificationService.success(
            `Đã cập nhật ảnh ${target === 'desktop' ? 'Desktop' : 'Mobile'} cho slide #${index + 1}`
          );
          this.triggerAnimationPreview();
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => {
        this.notificationService.error('Lỗi tải ảnh thay thế: ' + (err?.message || 'Lỗi server'));
      },
    });
  }

  // ── Helper Trích xuất URL ảnh & Kiểm tra Base64 ──────────────────
  extractUploadedImageUrl(res: any): string {
    if (!res) return '';
    if (typeof res === 'string' && (res.startsWith('http') || res.startsWith('/'))) {
      return res;
    }
    if (res.secure_url) return res.secure_url;
    if (res.url) return res.url;
    if (res.all && Array.isArray(res.all) && res.all.length > 0) {
      return res.all[res.all.length - 1];
    }
    return '';
  }

  checkForLargeBase64(sections: HomeSection[]): boolean {
    if (!Array.isArray(sections)) return false;
    for (const sec of sections) {
      if (sec.media?.desktop?.url && sec.media.desktop.url.startsWith('data:image')) {
        return true;
      }
      if (sec.media?.mobile?.url && sec.media.mobile.url.startsWith('data:image')) {
        return true;
      }
      if (Array.isArray(sec.media?.carouselSlides)) {
        for (const slide of sec.media.carouselSlides) {
          if (slide.url && slide.url.startsWith('data:image')) {
            return true;
          }
          if (slide.mobileUrl && slide.mobileUrl.startsWith('data:image')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  onToggleSlideEnabled(slide: CarouselSlideItem, event: MouseEvent): void {
    event.stopPropagation();
    slide.enabled = !slide.enabled;
    this.notificationService.success(slide.enabled ? 'Đã bật hiển thị slide' : 'Đã ẩn slide');
    this.cdr.markForCheck();
  }

  // ── Preview Animation Trigger ────────────────────────────────────
  triggerAnimationPreview(): void {
    this.isAnimationPlaying = false;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.isAnimationPlaying = true;
      this.cdr.markForCheck();
    }, 50);
  }

  // ── Full Page Preview Modal ──────────────────────────────────────
  onOpenFullPreview(): void {
    this.isFullPreviewOpen = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCloseFullPreview(): void {
    this.isFullPreviewOpen = false;
    this.cdr.markForCheck();
  }

  get enabledSections(): HomeSection[] {
    return this.sections.filter((s) => s.enabled);
  }

  getSectionTypeBadgeClass(type: SectionType): string {
    switch (type) {
      case 'hero':
      case 'banner':
      case 'cta':
        return 'badge-type-content';
      case 'product-slider':
      case 'product-grid':
        return 'badge-type-product';
      case 'editorial':
      case 'quote':
      case 'image-text':
        return 'badge-type-editorial';
      case 'spacer':
      default:
        return 'badge-type-layout';
    }
  }

  getSectionTypeName(type: SectionType): string {
    const opt = this.sectionTypeOptions.find((o) => o.type === type);
    return opt ? opt.name : type.toUpperCase();
  }

  // ── Quản lý Cấu hình Typography (Font Chữ & Kiểu Chữ) ───────────
  ensureSectionTypography(section: HomeSection): SectionTypography {
    if (!section.typography) {
      section.typography = JSON.parse(JSON.stringify(getDefaultTypographyForType(section.type)));
    }
    return section.typography;
  }

  updateActiveTypographyElementForSection(section: HomeSection): void {
    if (!section) return;
    this.refreshTypographyTargets();
    const targets = this.getTargetsForSection(section.id);
    if (targets.length > 0) {
      const exists = targets.some((t) => t.id === this.activeTargetId);
      if (!exists) {
        this.onSelectTarget(targets[0].id);
      }
    }
  }

  // ── Tự động tạo danh sách phân đoạn & phần tử cấu hình động ────
  refreshTypographyTargets(): void {
    const groups: {
      section: HomeSection;
      sectionId: string;
      sectionName: string;
      targets: ConfigurableTypographyTarget[];
    }[] = [];
    const allTargets: ConfigurableTypographyTarget[] = [];

    for (const sec of this.sections) {
      if (sec.type === 'spacer') continue; // Bỏ qua phân đoạn spacer không có văn bản

      const secTargets: ConfigurableTypographyTarget[] = [];
      const secName = sec.name || this.getSectionTypeName(sec.type);
      const isCarousel = sec.layout?.variant === 'carousel' || (sec.media?.carouselSlides && sec.media.carouselSlides.length > 0);

      if (isCarousel) {
        // Cấu hình từng slide của Carousel
        const slides = sec.media?.carouselSlides || [];
        slides.forEach((slide, idx) => {
          const slideLabel = slide.title ? `Slide ${idx + 1} (${slide.title})` : `Slide ${idx + 1}`;
          const titleTarget: ConfigurableTypographyTarget = {
            id: `${sec.id}:slide_${slide.id || idx}:title`,
            sectionId: sec.id,
            sectionName: secName,
            sectionType: sec.type,
            slideId: slide.id,
            slideIndex: idx,
            slideTitle: slide.title,
            fieldKey: 'title',
            fieldLabel: 'Tiêu đề slide',
            groupLabel: `Carousel / ${slideLabel}`,
            fullPathLabel: `Carousel / Slide ${idx + 1} → Tiêu đề slide`,
            typoElementKey: 'heading',
            colorKey: 'titleColor',
            isSlide: true,
          };
          const descTarget: ConfigurableTypographyTarget = {
            id: `${sec.id}:slide_${slide.id || idx}:description`,
            sectionId: sec.id,
            sectionName: secName,
            sectionType: sec.type,
            slideId: slide.id,
            slideIndex: idx,
            slideTitle: slide.title,
            fieldKey: 'description',
            fieldLabel: 'Mô tả slide',
            groupLabel: `Carousel / ${slideLabel}`,
            fullPathLabel: `Carousel / Slide ${idx + 1} → Mô tả slide`,
            typoElementKey: 'body',
            colorKey: 'descriptionColor',
            isSlide: true,
          };
          secTargets.push(titleTarget, descTarget);
          allTargets.push(titleTarget, descTarget);
        });

        // Nếu Carousel wrapper có thêm eyebrow hoặc buttonText
        if (sec.content?.eyebrow) {
          const ebTarget: ConfigurableTypographyTarget = {
            id: `${sec.id}:eyebrow`,
            sectionId: sec.id,
            sectionName: secName,
            sectionType: sec.type,
            fieldKey: 'eyebrow',
            fieldLabel: 'Dòng mở đầu (Eyebrow)',
            groupLabel: `${secName} (Khung Carousel)`,
            fullPathLabel: `${secName} → Dòng mở đầu`,
            typoElementKey: 'eyebrow',
            colorKey: 'subtitleColor',
          };
          secTargets.unshift(ebTarget);
          allTargets.push(ebTarget);
        }
        if (sec.content?.buttonText) {
          const btnTarget: ConfigurableTypographyTarget = {
            id: `${sec.id}:buttonText`,
            sectionId: sec.id,
            sectionName: secName,
            sectionType: sec.type,
            fieldKey: 'buttonText',
            fieldLabel: 'Chữ trên nút (Button)',
            groupLabel: `${secName} (Khung Carousel)`,
            fullPathLabel: `${secName} → Chữ trên nút`,
            typoElementKey: 'button',
            colorKey: 'buttonTextColor',
            isButton: true,
          };
          secTargets.push(btnTarget);
          allTargets.push(btnTarget);
        }
      } else {
        // Phân đoạn thông thường
        switch (sec.type) {
          case 'hero':
          case 'banner':
          case 'image-text': {
            const eb: ConfigurableTypographyTarget = {
              id: `${sec.id}:eyebrow`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'eyebrow',
              fieldLabel: 'Dòng mở đầu (Eyebrow)',
              groupLabel: `${secName} (${this.getSectionTypeName(sec.type)})`,
              fullPathLabel: `${this.getSectionTypeName(sec.type)} → Dòng mở đầu`,
              typoElementKey: 'eyebrow',
              colorKey: 'subtitleColor',
            };
            const title: ConfigurableTypographyTarget = {
              id: `${sec.id}:title`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'title',
              fieldLabel: 'Tiêu đề chính',
              groupLabel: `${secName} (${this.getSectionTypeName(sec.type)})`,
              fullPathLabel: `${this.getSectionTypeName(sec.type)} → Tiêu đề chính`,
              typoElementKey: 'heading',
              colorKey: 'titleColor',
            };
            const desc: ConfigurableTypographyTarget = {
              id: `${sec.id}:description`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'description',
              fieldLabel: 'Đoạn mô tả',
              groupLabel: `${secName} (${this.getSectionTypeName(sec.type)})`,
              fullPathLabel: `${this.getSectionTypeName(sec.type)} → Đoạn mô tả`,
              typoElementKey: 'body',
              colorKey: 'bodyColor',
            };
            const btn: ConfigurableTypographyTarget = {
              id: `${sec.id}:buttonText`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'buttonText',
              fieldLabel: 'Chữ trên nút',
              groupLabel: `${secName} (${this.getSectionTypeName(sec.type)})`,
              fullPathLabel: `${this.getSectionTypeName(sec.type)} → Chữ trên nút`,
              typoElementKey: 'button',
              colorKey: 'buttonTextColor',
              isButton: true,
            };
            secTargets.push(eb, title, desc, btn);
            allTargets.push(eb, title, desc, btn);
            break;
          }

          case 'editorial': {
            const title: ConfigurableTypographyTarget = {
              id: `${sec.id}:title`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'title',
              fieldLabel: 'Tiêu đề',
              groupLabel: `${secName} (Editorial)`,
              fullPathLabel: `Editorial → Tiêu đề`,
              typoElementKey: 'heading',
              colorKey: 'titleColor',
            };
            const quote: ConfigurableTypographyTarget = {
              id: `${sec.id}:quote`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'quote',
              fieldLabel: 'Trích dẫn',
              groupLabel: `${secName} (Editorial)`,
              fullPathLabel: `Editorial → Trích dẫn`,
              typoElementKey: 'quote',
              colorKey: 'quoteColor',
            };
            const tag1: ConfigurableTypographyTarget = {
              id: `${sec.id}:tagline1`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'tagline1',
              fieldLabel: 'Tagline 1',
              groupLabel: `${secName} (Editorial)`,
              fullPathLabel: `Editorial → Tagline 1`,
              typoElementKey: 'tagline1',
              colorKey: 'tagline1Color',
            };
            const tag2: ConfigurableTypographyTarget = {
              id: `${sec.id}:tagline2`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'tagline2',
              fieldLabel: 'Tagline 2',
              groupLabel: `${secName} (Editorial)`,
              fullPathLabel: `Editorial → Tagline 2`,
              typoElementKey: 'tagline2',
              colorKey: 'tagline2Color',
            };
            const btn: ConfigurableTypographyTarget = {
              id: `${sec.id}:buttonText`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'buttonText',
              fieldLabel: 'Chữ trên nút',
              groupLabel: `${secName} (Editorial)`,
              fullPathLabel: `Editorial → Chữ trên nút`,
              typoElementKey: 'button',
              colorKey: 'buttonTextColor',
              isButton: true,
            };
            secTargets.push(title, quote, tag1, tag2, btn);
            allTargets.push(title, quote, tag1, tag2, btn);
            break;
          }

          case 'product-slider':
          case 'product-grid': {
            const title: ConfigurableTypographyTarget = {
              id: `${sec.id}:title`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'title',
              fieldLabel: 'Tiêu đề khối sản phẩm',
              groupLabel: `${secName} (Sản phẩm)`,
              fullPathLabel: `Sản phẩm → Tiêu đề khối`,
              typoElementKey: 'heading',
              colorKey: 'titleColor',
            };
            const viewAll: ConfigurableTypographyTarget = {
              id: `${sec.id}:viewAllText`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'viewAllText',
              fieldLabel: 'Chữ nút xem tất cả',
              groupLabel: `${secName} (Sản phẩm)`,
              fullPathLabel: `Sản phẩm → Nút xem tất cả`,
              typoElementKey: 'button',
              colorKey: 'buttonTextColor',
              isButton: true,
            };
            secTargets.push(title, viewAll);
            allTargets.push(title, viewAll);
            break;
          }

          case 'quote': {
            const quote: ConfigurableTypographyTarget = {
              id: `${sec.id}:quote`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'quote',
              fieldLabel: 'Nội dung trích dẫn',
              groupLabel: `${secName} (Quote)`,
              fullPathLabel: `Quote → Nội dung trích dẫn`,
              typoElementKey: 'quote',
              colorKey: 'quoteColor',
            };
            const author: ConfigurableTypographyTarget = {
              id: `${sec.id}:author`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'author',
              fieldLabel: 'Tác giả / Nguồn',
              groupLabel: `${secName} (Quote)`,
              fullPathLabel: `Quote → Tác giả / Nguồn`,
              typoElementKey: 'subheading',
              colorKey: 'authorColor',
            };
            secTargets.push(quote, author);
            allTargets.push(quote, author);
            break;
          }

          case 'cta': {
            const title: ConfigurableTypographyTarget = {
              id: `${sec.id}:title`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'title',
              fieldLabel: 'Tiêu đề',
              groupLabel: `${secName} (CTA)`,
              fullPathLabel: `CTA → Tiêu đề`,
              typoElementKey: 'heading',
              colorKey: 'titleColor',
            };
            const desc: ConfigurableTypographyTarget = {
              id: `${sec.id}:description`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'description',
              fieldLabel: 'Mô tả',
              groupLabel: `${secName} (CTA)`,
              fullPathLabel: `CTA → Mô tả`,
              typoElementKey: 'body',
              colorKey: 'bodyColor',
            };
            const btn: ConfigurableTypographyTarget = {
              id: `${sec.id}:buttonText`,
              sectionId: sec.id,
              sectionName: secName,
              sectionType: sec.type,
              fieldKey: 'buttonText',
              fieldLabel: 'Chữ trên nút CTA',
              groupLabel: `${secName} (CTA)`,
              fullPathLabel: `CTA → Chữ trên nút CTA`,
              typoElementKey: 'button',
              colorKey: 'buttonTextColor',
              isButton: true,
            };
            secTargets.push(title, desc, btn);
            allTargets.push(title, desc, btn);
            break;
          }
        }
      }

      if (secTargets.length > 0) {
        groups.push({ section: sec, sectionId: sec.id, sectionName: secName, targets: secTargets });
      }
    }

    for (const t of allTargets) {
      if (!t.label) t.label = t.fieldLabel;
      if (!t.role) t.role = t.typoElementKey;
    }

    this.configurableSectionGroups = groups;
    this.allConfigurableTargets = allTargets;

    // Thiết lập active target mặc định nếu chưa có hoặc không hợp lệ
    if (this.selectedSection) {
      this.activeTargetSectionId = this.selectedSection.id;
      const foundInCurrent = allTargets.find((t) => t.sectionId === this.selectedSection!.id);
      if (foundInCurrent) {
        if (!this.activeTarget || this.activeTarget.sectionId !== this.selectedSection.id) {
          this.activeTarget = foundInCurrent;
          this.activeTargetId = foundInCurrent.id;
        }
      } else if (allTargets.length > 0) {
        this.activeTarget = allTargets[0];
        this.activeTargetId = allTargets[0].id;
        this.activeTargetSectionId = allTargets[0].sectionId;
      }
    } else if (allTargets.length > 0) {
      this.activeTarget = allTargets[0];
      this.activeTargetId = allTargets[0].id;
      this.activeTargetSectionId = allTargets[0].sectionId;
    }
  }

  onSelectTarget(targetId: string): void {
    const target = this.allConfigurableTargets.find((t) => t.id === targetId);
    if (!target) return;
    this.activeTarget = target;
    this.activeTargetId = target.id;
    this.activeTargetSectionId = target.sectionId;

    const section = this.sections.find((s) => s.id === target.sectionId);
    if (section) {
      this.selectedSection = section;
      if (target.isSlide && target.slideIndex !== undefined) {
        this.activeSlideIndices[section.id] = target.slideIndex;
      }
    }

    this.activeTypographyElement = target.typoElementKey;
    this.activeColorProperty = target.colorKey as any;
    this.cdr.markForCheck();
  }

  onSelectTargetSection(sectionId: string): void {
    this.activeTargetSectionId = sectionId;
    const sec = this.sections.find((s) => s.id === sectionId);
    if (sec) {
      this.selectedSection = sec;
      const group = this.configurableSectionGroups.find((g) => g.section.id === sectionId);
      if (group && group.targets.length > 0) {
        this.onSelectTarget(group.targets[0].id);
      }
    }
    this.cdr.markForCheck();
  }

  getTargetsForSection(sectionId: string): ConfigurableTypographyTarget[] {
    const group = this.configurableSectionGroups.find((g) => g.section.id === sectionId);
    return group ? group.targets : [];
  }

  getSlidesForSection(sectionOrId: HomeSection | string | null | undefined): CarouselSlideItem[] {
    if (!sectionOrId) return [];
    const sec = typeof sectionOrId === 'string'
      ? this.sections.find((s) => s.id === sectionOrId)
      : sectionOrId;
    if (!sec?.media?.carouselSlides) return [];
    return sec.media.carouselSlides;
  }

  getSlideTargets(sectionId: string, slideId: string): ConfigurableTypographyTarget[] {
    return this.allConfigurableTargets.filter(
      (t) => t.sectionId === sectionId && t.slideId === slideId
    );
  }

  getNonSlideTargets(sectionId: string): ConfigurableTypographyTarget[] {
    return this.allConfigurableTargets.filter(
      (t) => t.sectionId === sectionId && !t.isSlide
    );
  }

  // ── PHẦN 1: CẤU HÌNH KIỂU CHỮ (TYPOGRAPHY PRESETS) ───────────────
  onSelectTypographyPreset(preset: TypographyPresetType): void {
    this.selectedTypographyPreset = preset;
    this.cdr.markForCheck();
  }

  getSelectedPresetLabel(): string {
    const found = this.typographyPresets.find(
      (p) => p.id === this.selectedTypographyPreset || p.value === this.selectedTypographyPreset
    );
    return found ? found.name : 'Editorial';
  }

  onApplyQuickPresetToAll(): void {
    const presetKey = this.selectedTypographyPreset;
    const foundPreset = this.typographyPresets.find(
      (p) => p.id === presetKey || p.value === presetKey
    );
    if (!foundPreset) return;

    const baseTypo = foundPreset.typography;

    // Duyệt qua tất cả các section trên trang chủ
    for (const sec of this.sections) {
      if (sec.type === 'spacer') continue;

      const typo = this.ensureSectionTypography(sec);
      typo.preset = presetKey;

      if (baseTypo.heading) typo.heading = JSON.parse(JSON.stringify(baseTypo.heading));
      if (baseTypo.body) typo.body = JSON.parse(JSON.stringify(baseTypo.body));
      if (baseTypo.eyebrow) typo.eyebrow = JSON.parse(JSON.stringify(baseTypo.eyebrow));
      if (baseTypo.button) typo.button = JSON.parse(JSON.stringify(baseTypo.button));
      if (baseTypo.quote) typo.quote = JSON.parse(JSON.stringify(baseTypo.quote));
      if (baseTypo.subheading) typo.subheading = JSON.parse(JSON.stringify(baseTypo.subheading));
      typo.tagline1 = baseTypo.eyebrow ? JSON.parse(JSON.stringify(baseTypo.eyebrow)) : undefined;
      typo.tagline2 = baseTypo.eyebrow ? JSON.parse(JSON.stringify(baseTypo.eyebrow)) : undefined;

      // Phân cấp kiểu chữ theo loại nội dung
      if (sec.type === 'hero' && typo.heading) {
        typo.heading.fontSize = Math.max(44, (baseTypo.heading?.fontSize || 36) + 8);
        typo.heading.lineHeight = 1.15;
      } else if ((sec.type === 'product-slider' || sec.type === 'product-grid') && typo.heading) {
        typo.heading.fontSize = Math.min(32, (baseTypo.heading?.fontSize || 36));
      }

      // Áp dụng cho các slide của Carousel nếu có
      if (sec.media?.carouselSlides && Array.isArray(sec.media.carouselSlides)) {
        for (const slide of sec.media.carouselSlides) {
          if (!slide.typography) slide.typography = {};
          if (baseTypo.heading) {
            slide.typography.title = JSON.parse(JSON.stringify(baseTypo.heading));
            slide.typography.title.fontSize = Math.max(38, (baseTypo.heading?.fontSize || 36) + 4);
          }
          if (baseTypo.body) {
            slide.typography.description = JSON.parse(JSON.stringify(baseTypo.body));
          }
        }
      }
    }

    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.notificationService.success(
      `Đã áp dụng nhanh bộ phối font "${foundPreset.label}" cho toàn bộ nội dung trang chủ!`
    );
    this.cdr.markForCheck();
  }

  onResetGlobalDefaultFonts(): void {
    for (const sec of this.sections) {
      sec.typography = JSON.parse(JSON.stringify(getDefaultTypographyForType(sec.type)));
      if (sec.media?.carouselSlides && Array.isArray(sec.media.carouselSlides)) {
        for (const slide of sec.media.carouselSlides) {
          slide.typography = undefined;
        }
      }
    }
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.notificationService.success('Đã khôi phục toàn bộ font chữ trang chủ về cấu hình mặc định Chéri.');
    this.cdr.markForCheck();
  }

  onResetGlobalDefaultColors(): void {
    if (this.hasUnsavedChanges) {
      const confirmReset = window.confirm(
        'Bạn có chắc chắn muốn khôi phục màu chữ của tất cả các phần tử trang chủ về mặc định chuẩn Chéri không?'
      );
      if (!confirmReset) return;
    }

    for (const sec of this.sections) {
      const defaultColors = getDefaultColorsForType(sec.type);
      if (!sec.colors) sec.colors = {};
      sec.colors.titleColor = defaultColors.titleColor;
      sec.colors.subtitleColor = defaultColors.subtitleColor;
      sec.colors.bodyColor = defaultColors.bodyColor;
      sec.colors.quoteColor = defaultColors.quoteColor;
      sec.colors.buttonTextColor = defaultColors.buttonTextColor;
      sec.colors.tagline1Color = undefined;
      sec.colors.tagline2Color = undefined;
      sec.colors.authorColor = undefined;

      if (sec.media?.carouselSlides && Array.isArray(sec.media.carouselSlides)) {
        for (const slide of sec.media.carouselSlides) {
          slide.colors = undefined;
        }
      }
    }

    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.notificationService.success('Đã khôi phục màu chữ của tất cả các phần tử về mặc định.');
    this.cdr.markForCheck();
  }

  // ── PHẦN 2: TÙY CHỈNH TỪNG PHẦN TỬ (ATTRIBUTES CONTROLS) ─────────
  getActiveTargetTypographyConfig(): TypographyConfig {
    const target = this.activeTarget;
    if (!target) return { fontFamily: 'inherit', fontSize: 16, fontWeight: 400 };

    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return { fontFamily: 'inherit', fontSize: 16, fontWeight: 400 };

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide) {
        if (!slide.typography) slide.typography = {};
        const key = target.fieldKey; // 'title' or 'description'
        if (!slide.typography[key]) {
          const baseKey: TypographyElementKey = key === 'title' ? 'heading' : 'body';
          const baseTypo = this.ensureSectionTypography(section)[baseKey];
          slide.typography[key] = baseTypo
            ? JSON.parse(JSON.stringify(baseTypo))
            : {
                fontFamily: 'inherit',
                fontSize: key === 'title' ? 38 : 15,
                fontWeight: key === 'title' ? 600 : 400,
                lineHeight: key === 'title' ? 1.25 : 1.6,
                letterSpacing: 0,
                textTransform: 'none',
                textAlign: 'left',
              };
        }
        return slide.typography[key]!;
      }
    }

    const typo = this.ensureSectionTypography(section);
    const elKey = target.typoElementKey;
    if (!typo[elKey]) {
      let defaultVal: TypographyConfig = {
        fontFamily: 'inherit',
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        textTransform: 'none',
        textAlign: 'left',
      };
      if (elKey === 'tagline1' || elKey === 'tagline2') {
        defaultVal = typo.eyebrow ? JSON.parse(JSON.stringify(typo.eyebrow)) : defaultVal;
      } else if (elKey === 'author') {
        defaultVal = typo.subheading ? JSON.parse(JSON.stringify(typo.subheading)) : defaultVal;
      } else if (elKey === 'viewAllText') {
        defaultVal = typo.button ? JSON.parse(JSON.stringify(typo.button)) : defaultVal;
      }
      typo[elKey] = defaultVal;
    }
    return typo[elKey] as TypographyConfig;
  }

  onTargetTypographyPropChange(prop?: string, value?: any): void {
    if (prop && value !== undefined) {
      const cfg = this.getActiveTargetTypographyConfig();
      if (cfg) {
        (cfg as any)[prop] = value;
      }
    }
    const target = this.activeTarget;
    if (!target) return;
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (section) {
      const typo = this.ensureSectionTypography(section);
      typo.preset = 'custom';
    }
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  validateTargetNumericProp(
    prop: keyof TypographyConfig,
    min: number,
    max: number,
    defaultVal: number
  ): void {
    const config = this.getActiveTargetTypographyConfig();
    let val = config[prop] as number;
    if (val === undefined || val === null || isNaN(val)) {
      (config as any)[prop] = defaultVal;
    } else if (val < min) {
      (config as any)[prop] = min;
    } else if (val > max) {
      (config as any)[prop] = max;
    }
    this.onTargetTypographyPropChange();
  }

  getActiveTargetColor(): string {
    const target = this.activeTarget;
    if (!target) return '#1A1A1A';

    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return '#1A1A1A';

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide && slide.colors) {
        const colorKey = target.fieldKey === 'title' ? 'titleColor' : 'descriptionColor';
        if (slide.colors[colorKey]) return slide.colors[colorKey]!;
      }
      const sColors = this.ensureSectionColors(section);
      return target.fieldKey === 'title'
        ? (sColors.titleColor || '#FFFFFF')
        : (sColors.bodyColor || '#E5E7EB');
    }

    const colors = this.ensureSectionColors(section);
    const val = (colors as any)[target.colorKey];
    if (val) return val;
    if (target.colorKey === 'tagline1Color' || target.colorKey === 'tagline2Color') {
      return colors.subtitleColor || this.getDefaultColorForProp('subtitleColor');
    }
    if (target.colorKey === 'authorColor') {
      return colors.subtitleColor || this.getDefaultColorForProp('subtitleColor');
    }
    return this.getDefaultColorForProp(target.colorKey as any);
  }

  getActiveTargetColorPickerValue(): string {
    const hex = this.getActiveTargetColor();
    if (this.hexRegex.test(hex)) {
      return hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    }
    return '#1A1A1A';
  }

  onTargetColorPickerChange(val: string): void {
    this.setActiveTargetColor(val);
  }

  onTargetHexChange(val: string): void {
    const target = this.activeTarget;
    if (!target) return;
    let cleanVal = (val || '').trim();
    if (cleanVal && !cleanVal.startsWith('#')) cleanVal = '#' + cleanVal;
    if (this.hexRegex.test(cleanVal)) {
      delete this.colorErrors[target.id];
      this.setActiveTargetColor(cleanVal);
    } else {
      this.colorErrors[target.id] = 'Mã HEX không hợp lệ (Ví dụ: #74070E)';
      this.cdr.markForCheck();
    }
  }

  onApplyTargetBrandColor(hex: string): void {
    const target = this.activeTarget;
    if (target) {
      delete this.colorErrors[target.id];
    }
    this.setActiveTargetColor(hex);
  }

  setActiveTargetColor(hex: string): void {
    const target = this.activeTarget;
    if (!target) return;

    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return;

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide) {
        if (!slide.colors) slide.colors = {};
        const colorKey = target.fieldKey === 'title' ? 'titleColor' : 'descriptionColor';
        slide.colors[colorKey] = hex.toUpperCase();
        this.hasUnsavedChanges = true;
        this.triggerAnimationPreview();
        this.cdr.markForCheck();
        return;
      }
    }

    const colors = this.ensureSectionColors(section);
    (colors as any)[target.colorKey] = hex.toUpperCase();
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetCurrentTargetElement(): void {
    const target = this.activeTarget;
    if (!target) return;
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return;

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide) {
        if (slide.typography) delete slide.typography[target.fieldKey];
        const colorKey = target.fieldKey === 'title' ? 'titleColor' : 'descriptionColor';
        if (slide.colors) delete slide.colors[colorKey];
        this.hasUnsavedChanges = true;
        this.notificationService.success(`Đã đặt lại kiểu chữ & màu của ${target.fieldLabel}`);
        this.triggerAnimationPreview();
        this.cdr.markForCheck();
        return;
      }
    }

    const defaults = getDefaultTypographyForType(section.type);
    const typo = this.ensureSectionTypography(section);
    if (defaults && (defaults as any)[target.typoElementKey]) {
      typo[target.typoElementKey] = JSON.parse(JSON.stringify((defaults as any)[target.typoElementKey]));
    } else {
      typo[target.typoElementKey] = { fontFamily: 'inherit', fontSize: 16, fontWeight: 400 };
    }

    const defaultColors = getDefaultColorsForType(section.type);
    const colors = this.ensureSectionColors(section);
    if (defaultColors && (defaultColors as any)[target.colorKey]) {
      (colors as any)[target.colorKey] = (defaultColors as any)[target.colorKey];
    } else {
      (colors as any)[target.colorKey] = '#1A1A1A';
    }

    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã đặt lại kiểu chữ & màu của ${target.fieldLabel}`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetCurrentTargetElementColor(): void {
    const target = this.activeTarget;
    if (!target) return;
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return;

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide && slide.colors) {
        const colorKey = target.fieldKey === 'title' ? 'titleColor' : 'descriptionColor';
        delete slide.colors[colorKey];
        this.hasUnsavedChanges = true;
        this.notificationService.success(`Đã khôi phục màu mặc định cho ${target.fieldLabel}`);
        this.triggerAnimationPreview();
        this.cdr.markForCheck();
        return;
      }
    }

    const defaultColors = getDefaultColorsForType(section.type);
    const colors = this.ensureSectionColors(section);
    if (defaultColors && (defaultColors as any)[target.colorKey]) {
      (colors as any)[target.colorKey] = (defaultColors as any)[target.colorKey];
    } else {
      (colors as any)[target.colorKey] = '#1A1A1A';
    }

    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã khôi phục màu mặc định cho ${target.fieldLabel}`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Thiết kế riêng cho chữ trên nút (Button Background Styling) ──
  getActiveTargetButtonBg(): string {
    const target = this.activeTarget;
    if (!target) return '#74070E';
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return '#74070E';
    const colors = this.ensureSectionColors(section);
    return colors.buttonBackgroundColor || '#74070E';
  }

  getActiveTargetButtonBgPickerValue(): string {
    const hex = this.getActiveTargetButtonBg();
    if (this.hexRegex.test(hex)) {
      return hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
    }
    return '#74070E';
  }

  onTargetButtonBgPickerChange(val: string): void {
    const target = this.activeTarget;
    if (!target) return;
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return;
    const colors = this.ensureSectionColors(section);
    colors.buttonBackgroundColor = val.toUpperCase();
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onTargetButtonBgHexChange(val: string): void {
    const target = this.activeTarget;
    if (!target) return;
    let clean = (val || '').trim();
    if (clean && !clean.startsWith('#')) clean = '#' + clean;
    if (this.hexRegex.test(clean)) {
      const section = this.sections.find((s) => s.id === target.sectionId);
      if (!section) return;
      const colors = this.ensureSectionColors(section);
      colors.buttonBackgroundColor = clean.toUpperCase();
      this.hasUnsavedChanges = true;
      this.triggerAnimationPreview();
      this.cdr.markForCheck();
    }
  }

  onResetTargetButtonBg(): void {
    const target = this.activeTarget;
    if (!target) return;
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return;
    const defaults = getDefaultColorsForType(section.type);
    const colors = this.ensureSectionColors(section);
    colors.buttonBackgroundColor = defaults.buttonBackgroundColor || '#74070E';
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã đặt lại màu nền nút về mặc định');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Live Element Preview Stage Helpers ───────────────────────────
  getActiveTargetStyle(): Record<string, string> {
    const target = this.activeTarget;
    if (!target) return {};
    const cfg = this.getActiveTargetTypographyConfig();
    const style: Record<string, string> = {};

    if (cfg.fontFamily && cfg.fontFamily !== 'inherit') style['font-family'] = cfg.fontFamily;
    if (cfg.fontSize) style['font-size'] = `${cfg.fontSize}px`;
    if (cfg.fontWeight) style['font-weight'] = `${cfg.fontWeight}`;
    if (cfg.lineHeight) style['line-height'] = `${cfg.lineHeight}`;
    if (cfg.letterSpacing !== undefined && cfg.letterSpacing !== null) style['letter-spacing'] = `${cfg.letterSpacing}px`;
    if (cfg.textTransform && cfg.textTransform !== 'none') style['text-transform'] = cfg.textTransform;
    if (cfg.textAlign) style['text-align'] = cfg.textAlign;
    style['color'] = this.getActiveTargetColor();

    return style;
  }

  getActiveTargetSampleText(): string {
    const target = this.activeTarget;
    if (!target) return 'Chéri Paris';
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return 'Chéri Paris';

    if (target.isSlide && target.slideId) {
      const slide = section.media?.carouselSlides?.find((s) => s.id === target.slideId);
      if (slide) {
        if (target.fieldKey === 'title' && slide.title) return slide.title;
        if (target.fieldKey === 'description' && slide.description) return slide.description;
        return target.fieldKey === 'title'
          ? 'Bộ Sưu Tập Haute Couture Mùa Thu'
          : 'Đắm mình trong nét thanh lịch cổ điển của kinh đô thời trang Paris.';
      }
    }

    const content = section.content;
    if (content) {
      const val = (content as any)[target.fieldKey];
      if (val && typeof val === 'string' && val.trim().length > 0) return val;
    }

    switch (target.fieldKey) {
      case 'eyebrow': return 'BỘ SƯU TẬP MỚI 2026';
      case 'title': return 'Nét Đẹp Vượt Thời Gian';
      case 'description': return 'Chất liệu lụa tơ tằm thượng hạng kết hợp phom dáng Parisian thanh lịch, tôn vinh khí chất phái đẹp.';
      case 'buttonText': return 'Khám Phá Ngay';
      case 'viewAllText': return 'Xem Tất Cả Sản Phẩm';
      case 'quote': return 'Thời trang có thể phai tàn, nhưng phong cách là bất tử.';
      case 'tagline1': return 'Parisian Elegance';
      case 'tagline2': return 'Haute Couture Craft';
      case 'author': return 'Coco Chanel';
      default: return 'Chéri Paris';
    }
  }

  getPreviewStageBgColor(): string {
    const target = this.activeTarget;
    if (!target) return '#FAF8F5';
    const section = this.sections.find((s) => s.id === target.sectionId);
    if (!section) return '#FAF8F5';
    if (section.type === 'hero' || section.type === 'banner') {
      return '#1A1A1A';
    }
    if (section.colors?.backgroundColor && section.colors.backgroundColor !== 'transparent') {
      return section.colors.backgroundColor;
    }
    return '#FAF8F5';
  }

  getFontWeightName(weight?: number): string {
    switch (weight) {
      case 100: return 'Thin (100)';
      case 200: return 'Extra Light (200)';
      case 300: return 'Light (300)';
      case 400: return 'Regular (400)';
      case 500: return 'Medium (500)';
      case 600: return 'Semi Bold (600)';
      case 700: return 'Bold (700)';
      case 800: return 'Extra Bold (800)';
      case 900: return 'Black (900)';
      default: return `${weight || 400}`;
    }
  }

  formatDecimal(val?: number | null, decimals: number = 1): string {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toFixed(decimals);
  }

  onOpenTypographyTab(targetSectionId?: string): void {
    if (targetSectionId) {
      const found = this.sections.find((s) => s.id === targetSectionId);
      if (found) this.selectedSection = found;
    } else if (!this.selectedSection && this.sections.length > 0) {
      this.selectedSection = this.sections[0];
    }
    this.refreshTypographyTargets();
    this.isEditorOpen = true;
    this.editorActiveTab = 'typography';
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  getSlideTypographyStyle(
    section: HomeSection | null | undefined,
    slide: CarouselSlideItem | null | undefined,
    field: 'title' | 'description'
  ): Record<string, string> {
    if (!section) return {};
    const baseElement: TypographyElementKey = field === 'title' ? 'heading' : 'body';
    const baseStyle = this.getTypographyStyle(section, baseElement);
    if (!slide) return baseStyle;

    const style = { ...baseStyle };
    const cfg = slide.typography?.[field];
    if (cfg) {
      if (cfg.fontFamily && cfg.fontFamily !== 'inherit') style['font-family'] = cfg.fontFamily;
      if (cfg.fontSize) style['font-size'] = `${cfg.fontSize}px`;
      if (cfg.fontWeight) style['font-weight'] = `${cfg.fontWeight}`;
      if (cfg.lineHeight) style['line-height'] = `${cfg.lineHeight}`;
      if (cfg.letterSpacing !== undefined && cfg.letterSpacing !== null) style['letter-spacing'] = `${cfg.letterSpacing}px`;
      if (cfg.textTransform && cfg.textTransform !== 'none') style['text-transform'] = cfg.textTransform;
      if (cfg.textAlign) style['text-align'] = cfg.textAlign;
    }
    const colorKey = field === 'title' ? 'titleColor' : 'descriptionColor';
    if (slide.colors?.[colorKey]) {
      style['color'] = slide.colors[colorKey]!;
    }
    return style;
  }

  getElementLabel(key?: TypographyElementKey): string {
    switch (key) {
      case 'heading': return 'Tiêu đề chính (Heading)';
      case 'eyebrow': return 'Dòng mở đầu (Eyebrow)';
      case 'body': return 'Nội dung mô tả (Body)';
      case 'button': return 'Nút bấm (CTA Button)';
      case 'quote': return 'Trích dẫn (Quote)';
      case 'subheading': return 'Tiêu đề phụ / Tác giả';
      case 'tagline1': return 'Tagline 1';
      case 'tagline2': return 'Tagline 2';
      case 'author': return 'Tác giả / Nguồn';
      case 'viewAllText': return 'Nút xem tất cả';
      default: return key || 'Phần tử';
    }
  }

  getFontFamilyName(fontFamily?: string): string {
    if (!fontFamily || fontFamily === 'inherit') return 'System Default';
    const found = this.availableFonts.find((f) => f.fontFamily === fontFamily);
    return found ? found.name : fontFamily.split(',')[0].replace(/['"]/g, '');
  }

  getTypographyStyle(
    section: HomeSection | null | undefined,
    element: TypographyElementKey
  ): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};

    // 1. Thuộc tính Typography
    if (section.typography) {
      let cfg = (section.typography as any)[element];
      if (!cfg) {
        if (element === 'tagline1' || element === 'tagline2') {
          cfg = section.typography.eyebrow;
        } else if (element === 'author') {
          cfg = section.typography.subheading;
        } else if (element === 'viewAllText') {
          cfg = section.typography.button;
        }
      }

      if (cfg) {
        if (cfg.fontFamily && cfg.fontFamily !== 'inherit') {
          style['font-family'] = cfg.fontFamily;
        }
        if (cfg.fontSize) {
          style['font-size'] = `${cfg.fontSize}px`;
        }
        if (cfg.fontWeight) {
          style['font-weight'] = `${cfg.fontWeight}`;
        }
        if (cfg.lineHeight) {
          style['line-height'] = `${cfg.lineHeight}`;
        }
        if (cfg.letterSpacing !== undefined && cfg.letterSpacing !== null) {
          style['letter-spacing'] = `${cfg.letterSpacing}px`;
        }
        if (cfg.textTransform && cfg.textTransform !== 'none') {
          style['text-transform'] = cfg.textTransform;
        }
        if (cfg.textAlign) {
          style['text-align'] = cfg.textAlign;
        }
      }
    }

    // 2. Thuộc tính Màu sắc (Colors)
    if (section.colors) {
      if (element === 'heading' && section.colors.titleColor) {
        style['color'] = section.colors.titleColor;
      } else if (element === 'tagline1') {
        style['color'] = section.colors.tagline1Color || section.colors.subtitleColor || '#74070E';
      } else if (element === 'tagline2') {
        style['color'] = section.colors.tagline2Color || section.colors.subtitleColor || '#74070E';
      } else if (element === 'author') {
        style['color'] = section.colors.authorColor || section.colors.subtitleColor || '#6B7280';
      } else if ((element === 'subheading' || element === 'eyebrow') && section.colors.subtitleColor) {
        style['color'] = section.colors.subtitleColor;
      } else if (element === 'body' && section.colors.bodyColor) {
        style['color'] = section.colors.bodyColor;
      } else if (element === 'quote' && section.colors.quoteColor) {
        style['color'] = section.colors.quoteColor;
      } else if (element === 'button' || element === 'viewAllText') {
        if (section.colors.buttonTextColor) {
          style['color'] = section.colors.buttonTextColor;
        }
        if (section.colors.buttonBackgroundColor && element === 'button') {
          style['background-color'] = section.colors.buttonBackgroundColor;
        }
      }
    }

    return style;
  }

  // ── Quản lý Màu Sắc (Colors) ────────────────────────────────────
  ensureSectionColors(section: HomeSection | null): SectionColors {
    if (!section) return {};
    if (!section.colors) {
      section.colors = JSON.parse(JSON.stringify(getDefaultColorsForType(section.type)));
    }
    return section.colors;
  }

  getCurrentColor(prop: keyof SectionColors): string {
    const colors = this.ensureSectionColors(this.selectedSection);
    return colors[prop] || this.getDefaultColorForProp(prop);
  }

  getDefaultColorForProp(prop: keyof SectionColors): string {
    if (!this.selectedSection) return '#1A1A1A';
    const defaults = getDefaultColorsForType(this.selectedSection.type);
    return defaults[prop] || '#1A1A1A';
  }

  getColorPickerValue(prop: keyof SectionColors): string {
    const val = this.getCurrentColor(prop);
    if (this.hexRegex.test(val)) {
      if (val.length === 4) {
        return '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
      }
      return val;
    }
    return '#1A1A1A';
  }

  onColorPickerChange(prop: keyof SectionColors, value: string): void {
    if (!this.selectedSection) return;
    const colors = this.ensureSectionColors(this.selectedSection);
    colors[prop] = value.toUpperCase();
    delete this.colorErrors[prop as string];
    this.activeColorProperty = prop;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onHexInputChange(prop: keyof SectionColors, value: string): void {
    if (!this.selectedSection) return;
    this.activeColorProperty = prop;
    let cleanVal = (value || '').trim();
    if (cleanVal && !cleanVal.startsWith('#')) {
      cleanVal = '#' + cleanVal;
    }
    if (!cleanVal) {
      delete this.colorErrors[prop as string];
      return;
    }
    if (this.hexRegex.test(cleanVal)) {
      const colors = this.ensureSectionColors(this.selectedSection);
      if (cleanVal.length === 4) {
        cleanVal = '#' + cleanVal[1] + cleanVal[1] + cleanVal[2] + cleanVal[2] + cleanVal[3] + cleanVal[3];
      }
      colors[prop] = cleanVal.toUpperCase();
      delete this.colorErrors[prop as string];
      this.triggerAnimationPreview();
    } else {
      this.colorErrors[prop as string] = 'Mã HEX không hợp lệ (VD: #74070E)';
    }
    this.cdr.markForCheck();
  }

  onApplyColorPreset(presetHex: string): void {
    if (!this.selectedSection) return;
    const prop = this.activeColorProperty || 'titleColor';
    const colors = this.ensureSectionColors(this.selectedSection);
    colors[prop] = presetHex.toUpperCase();
    delete this.colorErrors[prop as string];
    this.notificationService.success(`Đã áp dụng ${presetHex} cho ${this.getColorPropertyLabel(prop)}`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetColorProperty(prop: keyof SectionColors): void {
    if (!this.selectedSection) return;
    const defaults = getDefaultColorsForType(this.selectedSection.type);
    const colors = this.ensureSectionColors(this.selectedSection);
    colors[prop] = defaults[prop] || '#1A1A1A';
    delete this.colorErrors[prop as string];
    this.notificationService.success(`Đã khôi phục ${this.getColorPropertyLabel(prop)} về mặc định`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetAllColors(): void {
    if (!this.selectedSection) return;
    this.selectedSection.colors = JSON.parse(JSON.stringify(getDefaultColorsForType(this.selectedSection.type)));
    this.colorErrors = {};
    this.notificationService.success('Đã khôi phục tất cả màu sắc của section về mặc định');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetSectionTypography(): void {
    if (!this.selectedSection) return;
    this.selectedSection.typography = JSON.parse(
      JSON.stringify(getDefaultTypographyForType(this.selectedSection.type))
    );
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetEntireTab4(): void {
    if (!this.selectedSection) return;
    this.onResetSectionTypography();
    this.onResetAllColors();
    this.notificationService.success('Đã khôi phục toàn bộ Kiểu chữ & Màu sắc về mặc định');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  getColorPropertyLabel(prop: keyof SectionColors): string {
    switch (prop) {
      case 'backgroundColor': return 'Màu nền Section';
      case 'titleColor': return 'Màu tiêu đề';
      case 'subtitleColor': return 'Màu tiêu đề phụ / Eyebrow';
      case 'bodyColor': return 'Màu nội dung mô tả';
      case 'quoteColor': return 'Màu trích dẫn';
      case 'buttonTextColor': return 'Màu chữ nút CTA';
      case 'buttonBackgroundColor': return 'Màu nền nút CTA';
      case 'buttonHoverTextColor': return 'Màu chữ nút khi hover';
      case 'buttonHoverBackgroundColor': return 'Màu nền nút khi hover';
      default: return String(prop);
    }
  }

  getAvailableColorProperties(section: HomeSection | null): { key: keyof SectionColors; label: string; description: string }[] {
    if (!section) return [];
    const list: { key: keyof SectionColors; label: string; description: string }[] = [];

    list.push({
      key: 'backgroundColor',
      label: 'Màu nền Section',
      description: 'Màu nền của toàn bộ khối phân đoạn',
    });

    if (section.type !== 'quote' && section.type !== 'spacer') {
      list.push({
        key: 'titleColor',
        label: 'Màu tiêu đề chính',
        description: 'Tiêu đề khối hoặc banner',
      });
    }

    if (section.type === 'hero' || section.type === 'editorial' || section.type === 'banner' || section.type === 'image-text' || section.type === 'quote') {
      list.push({
        key: 'subtitleColor',
        label: section.type === 'quote' ? 'Màu tác giả / nguồn' : 'Màu tiêu đề phụ / Eyebrow',
        description: 'Dòng chữ mở đầu hoặc tác giả trích dẫn',
      });
    }

    if (section.type === 'hero' || section.type === 'editorial' || section.type === 'banner' || section.type === 'image-text' || section.type === 'cta') {
      list.push({
        key: 'bodyColor',
        label: 'Màu nội dung mô tả',
        description: 'Đoạn văn bản miêu tả chi tiết',
      });
    }

    if (section.type === 'quote' || section.type === 'editorial') {
      list.push({
        key: 'quoteColor',
        label: 'Màu trích dẫn',
        description: 'Khối trích dẫn nghệ thuật',
      });
    }

    if (section.type !== 'quote' && section.type !== 'spacer') {
      list.push({
        key: 'buttonTextColor',
        label: 'Màu chữ nút CTA',
        description: 'Màu chữ trên nút kêu gọi hành động',
      });
      list.push({
        key: 'buttonBackgroundColor',
        label: 'Màu nền nút CTA',
        description: 'Màu nền nút kêu gọi hành động',
      });
      list.push({
        key: 'buttonHoverTextColor',
        label: 'Màu chữ nút khi hover',
        description: 'Màu chữ khi rê chuột vào nút',
      });
      list.push({
        key: 'buttonHoverBackgroundColor',
        label: 'Màu nền nút khi hover',
        description: 'Màu nền khi rê chuột vào nút',
      });
    }

    return list;
  }

  getSectionContainerStyle(section: HomeSection | null | undefined): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};
    if (section.colors?.backgroundColor) {
      style['background-color'] = section.colors.backgroundColor;
    } else if (section.settings?.bgColor) {
      style['background-color'] = section.settings.bgColor;
    }
    if (section.colors?.buttonTextColor) {
      style['--sec-btn-color'] = section.colors.buttonTextColor;
    }
    if (section.colors?.buttonBackgroundColor) {
      style['--sec-btn-bg'] = section.colors.buttonBackgroundColor;
    }
    if (section.colors?.buttonHoverTextColor) {
      style['--sec-btn-hover-color'] = section.colors.buttonHoverTextColor;
    }
    if (section.colors?.buttonHoverBackgroundColor) {
      style['--sec-btn-hover-bg'] = section.colors.buttonHoverBackgroundColor;
    }
    Object.assign(style, this.getSectionAnimationStyle(section));
    return style;
  }

  /**
   * Tính toán kích thước, tỷ lệ và chiều cao tối ưu cho Banner/Carousel
   * đảm bảo Live Preview đồng bộ 100% với Storefront thực tế và responsive.
   */
  getBannerStyle(section: HomeSection | null, viewport: 'desktop' | 'mobile'): Record<string, string> {
    if (!section) return {};
    const containerStyle = this.getSectionContainerStyle(section);
    const style: Record<string, string> = { ...containerStyle };
    if (section.settings?.textColor) {
      style['color'] = section.settings.textColor;
    }
    if (viewport === 'mobile') {
      style['min-height'] = section.layout?.mobileMinHeight || '320px';
    } else {
      style['min-height'] = section.layout?.minHeight || '480px';
    }
    return style;
  }
}
