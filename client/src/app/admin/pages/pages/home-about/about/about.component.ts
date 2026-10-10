import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { ApiService } from '../../../../../services/api.service';
import {
  AboutSection,
  AboutSectionType,
  AboutSectionCategory,
  AnimationPreset,
  MotionPresetType,
  SectionTypeOption,
  TypographyPresetType,
  TypographyElementKey,
  TypographyConfig,
  SectionTypography,
  SectionColors,
  FontOption,
  SectionAnimation,
} from '../cms-core/cms.models';
import {
  INITIAL_ABOUT_SECTIONS,
  ABOUT_SECTION_TYPE_OPTIONS,
  AVAILABLE_FONTS,
  TYPOGRAPHY_PRESETS,
  CHERI_COLOR_PRESETS,
  getDefaultColorsForType,
  getDefaultTypographyForType,
  createDefaultAboutSection,
} from '../cms-core/cms.constants';
import { BreadcrumbItem } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';

@Component({
  selector: 'app-about',
  standalone: false,
  templateUrl: './about.html',
  styleUrls: ['./about.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit, OnDestroy {
  breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Quản lý trang' },
    { label: 'Giới thiệu' }
  ];

  // ── State Kết Nối Backend API & MongoDB (pages_about) ────────────
  isLoadingDraft = false;
  isPublishing = false;
  loadError = '';
  lastPublishedAt: Date | null = null;
  isUploadingDesktop = false;
  isUploadingMobile = false;
  hasUnsavedChanges = false;

  // ── State Danh Sách Section ─────────────────────────────────────
  sections: AboutSection[] = [];
  selectedSection: AboutSection | null = null;

  // ── State Điều Khiển UI Modal / Drawer ───────────────────────────
  isEditorOpen = false;
  editorActiveTab: 'content' | 'media' | 'layout' | 'typography' | 'animation' | 'settings' = 'content';
  activeTypographyElement: TypographyElementKey = 'heading';

  // ── State Cấu Hình Màu Sắc & Kiểu Chữ (Tab 4 — Typography & Colors) ─
  activeColorProperty: keyof SectionColors = 'titleColor';
  colorErrors: { [key: string]: string } = {};
  readonly cheriColorPresets = CHERI_COLOR_PRESETS;
  private readonly hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

  readonly availableFonts: FontOption[] = AVAILABLE_FONTS;
  readonly typographyPresets = TYPOGRAPHY_PRESETS;
  selectedTypographyPreset: TypographyPresetType = 'editorial';

  readonly allContentFields: {
    key: string;
    label: string;
    typoElementKey: TypographyElementKey;
    colorKey: keyof SectionColors;
    icon: string;
    description: string;
  }[] = [
    {
      key: 'title',
      label: 'Tiêu đề phân đoạn',
      typoElementKey: 'heading',
      colorKey: 'titleColor',
      icon: 'H',
      description: 'Tiêu đề chính của phân đoạn',
    },
    {
      key: 'quote',
      label: 'Đoạn trích dẫn nghệ thuật',
      typoElementKey: 'quote',
      colorKey: 'quoteColor',
      icon: '“',
      description: 'Khối trích dẫn nghệ thuật hoặc danh ngôn',
    },
    {
      key: 'tagline1',
      label: 'Tagline 1',
      typoElementKey: 'eyebrow',
      colorKey: 'subtitleColor',
      icon: 'T1',
      description: 'Dòng chữ mở đầu / Nhãn thương hiệu 1',
    },
    {
      key: 'tagline2',
      label: 'Tagline 2',
      typoElementKey: 'eyebrow',
      colorKey: 'subtitleColor',
      icon: 'T2',
      description: 'Dòng phụ / Nhãn thương hiệu 2',
    },
    {
      key: 'description',
      label: 'Nội dung chi tiết',
      typoElementKey: 'body',
      colorKey: 'bodyColor',
      icon: '¶',
      description: 'Đoạn văn bản miêu tả chi tiết thông điệp',
    },
    {
      key: 'eyebrow',
      label: 'Dòng mở đầu (Eyebrow)',
      typoElementKey: 'eyebrow',
      colorKey: 'subtitleColor',
      icon: 'T0',
      description: 'Dòng chữ mở đầu trước tiêu đề chính',
    },
    {
      key: 'author',
      label: 'Tác giả / Người phát ngôn',
      typoElementKey: 'subheading',
      colorKey: 'subtitleColor',
      icon: '—',
      description: 'Tác giả trích dẫn hoặc người phát ngôn',
    },
    {
      key: 'buttonText',
      label: 'Văn bản nút liên kết',
      typoElementKey: 'button',
      colorKey: 'buttonTextColor',
      icon: '↗',
      description: 'Văn bản hiển thị trên nút bấm kêu gọi hành động',
    },
  ];

  activeContentFieldKey: string = 'title';

  // ── Modal Thêm Phân Đoạn Mới (5 loại phân đoạn chuẩn hóa cho About CMS) ──
  isAddModalOpen = false;
  sectionTypeOptions: SectionTypeOption[] = ABOUT_SECTION_TYPE_OPTIONS;

  // ── State Xem Trước (Live Preview & Full Preview) ────────────────
  previewViewport: 'desktop' | 'mobile' = 'desktop';
  isAnimationPlaying = false;
  isFullPreviewOpen = false;
  fullPreviewViewport: 'desktop' | 'mobile' = 'desktop';

  // ── State Dialog Xóa ─────────────────────────────────────────────
  isDeleteDialogOpen = false;
  sectionToDelete: AboutSection | null = null;

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
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadAboutConfigFromBackend();
  }

  ngOnDestroy(): void {}

  // ── Khởi tạo & Tải Cấu Hình từ Backend API (pages_about) ─────────
  loadAboutConfigFromBackend(): void {
    this.isLoadingDraft = true;
    this.loadError = '';
    this.cdr.markForCheck();

    this.apiService.getAboutAdmin().subscribe({
      next: (res: any) => {
        this.isLoadingDraft = false;

        if (res && res.error) {
          const errMsg = res.error?.message || res.error?.error || 'Lỗi xác thực hoặc kết nối';
          this.loadError = 'Không thể tải cấu hình từ máy chủ: ' + errMsg;
          this.notificationService.error(this.loadError);
          this.sections = JSON.parse(JSON.stringify(INITIAL_ABOUT_SECTIONS));
          this.postLoadSetup();
          return;
        }

        const serverSections = res?.data?.sections || res?.sections;
        if (Array.isArray(serverSections) && serverSections.length > 0) {
          this.sections = serverSections;
          this.lastPublishedAt = res.data?.publishedAt ? new Date(res.data.publishedAt) : null;
          this.hasUnsavedChanges = false;
        } else {
          this.sections = JSON.parse(JSON.stringify(INITIAL_ABOUT_SECTIONS));
          this.hasUnsavedChanges = false;
        }

        this.postLoadSetup();
      },
      error: () => {
        this.isLoadingDraft = false;
        this.loadError = 'Lỗi kết nối khi tải cấu hình trang Giới thiệu';
        this.notificationService.error(this.loadError);
        this.sections = JSON.parse(JSON.stringify(INITIAL_ABOUT_SECTIONS));
        this.postLoadSetup();
      },
    });
  }

  private postLoadSetup(): void {
    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
      this.ensureSectionTypography(sec);
      this.ensureSectionAnimation(sec);
    });

    if (this.sections.length > 0) {
      this.selectedSection = this.sections[0];
      this.updateActiveTypographyElementForSection(this.selectedSection);
      this.updateActiveContentFieldForSection(this.selectedSection);
    } else {
      this.selectedSection = null;
    }

    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Sắp Xếp Section (CDK Drag-Drop) ──────────────────────────────
  onDrop(event: CdkDragDrop<AboutSection[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    moveItemInArray(this.sections, event.previousIndex, event.currentIndex);
    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã cập nhật thứ tự các phân đoạn');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  // ── Xuất Bản Cấu Hình (Publish vào pages_about) ───────────────────
  validateSectionsForPublish(): { valid: boolean; message: string } {
    if (!this.sections || !Array.isArray(this.sections) || this.sections.length === 0) {
      return { valid: false, message: 'Danh sách phân đoạn trống. Vui lòng thêm ít nhất 1 phân đoạn.' };
    }

    const enabledSecs = this.sections.filter((s) => s.enabled);
    if (enabledSecs.length === 0) {
      return { valid: false, message: 'Tất cả các phân đoạn đang bị ẩn. Vui lòng bật ít nhất 1 phân đoạn.' };
    }

    for (const sec of enabledSecs) {
      if (sec.type === 'spacer') continue;
      const name = sec.name || 'Phân đoạn';
      const hasImg = !!sec.media?.desktop?.url?.trim();
      const hasTitle = !!sec.content?.title?.trim();
      const hasQuote = !!sec.content?.quote?.trim();
      const hasDesc = !!sec.content?.description?.trim();

      if (!hasImg && !hasTitle && !hasQuote && !hasDesc) {
        return {
          valid: false,
          message: `Phân đoạn "${name}" cần có ít nhất hình ảnh, tiêu đề, trích dẫn hoặc mô tả trước khi xuất bản.`
        };
      }
    }

    return { valid: true, message: 'Hợp lệ' };
  }

  onPublish(): void {
    if (this.isPublishing || this.isLoadingDraft) return;

    const validation = this.validateSectionsForPublish();
    if (!validation.valid) {
      this.notificationService.error(validation.message);
      return;
    }

    if (this.checkForLargeBase64(this.sections)) {
      this.notificationService.error(
        'Phát hiện một số ảnh đang ở dạng tạm thời. Vui lòng tải ảnh lên máy chủ qua nút Tải ảnh trước khi xuất bản.'
      );
      return;
    }

    this.isPublishing = true;
    this.cdr.markForCheck();

    this.apiService.publishAbout({ sections: this.sections }).subscribe({
      next: (res: any) => {
        this.isPublishing = false;
        if (res && res.error) {
          const msg = res.error?.message || res.error?.error || 'Lỗi máy chủ khi xuất bản';
          this.notificationService.error('Không thể xuất bản trang Giới thiệu: ' + msg);
          this.cdr.markForCheck();
          return;
        }

        this.lastPublishedAt = new Date();
        this.hasUnsavedChanges = false;
        this.notificationService.success('Đã xuất bản cấu hình trang Giới thiệu (About) lên máy chủ thành công!');
        this.cdr.markForCheck();
      },
      error: () => {
        this.isPublishing = false;
        this.notificationService.error(
          'Lỗi kết nối khi xuất bản. Cấu hình công khai hiện tại vẫn được giữ nguyên an toàn.'
        );
        this.cdr.markForCheck();
      },
    });
  }

  onOpenLiveSite(): void {
    window.open('/vi/about', '_blank');
  }

  // ── Quản Lý Trạng Thái Phân Đoạn (Enable / Edit / Duplicate / Delete)
  onToggleEnabled(section: AboutSection, event: MouseEvent): void {
    event.stopPropagation();
    section.enabled = !section.enabled;
    const msg = section.enabled
      ? `Đã bật hiển thị "${section.name}"`
      : `Đã ẩn phân đoạn "${section.name}"`;
    this.notificationService.success(msg);
    this.hasUnsavedChanges = true;
    this.cdr.markForCheck();
  }

  onSelectSection(section: AboutSection): void {
    this.selectedSection = section;
    this.ensureSectionTypography(section);
    this.updateActiveTypographyElementForSection(section);
    this.updateActiveContentFieldForSection(section);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onEditSection(section: AboutSection, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.selectedSection = section;
    this.ensureSectionTypography(section);
    this.updateActiveTypographyElementForSection(section);
    this.updateActiveContentFieldForSection(section);
    this.isEditorOpen = true;
    this.editorActiveTab = 'content';
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onCloseEditor(): void {
    this.isEditorOpen = false;
    this.cdr.markForCheck();
  }

  onDuplicateSection(section: AboutSection, event: MouseEvent): void {
    event.stopPropagation();
    const cloned: AboutSection = JSON.parse(JSON.stringify(section));
    const randSuffix = Math.random().toString(36).substring(2, 7);
    cloned.id = `sec-about-${section.type}-${Date.now().toString(36)}-${randSuffix}`;
    cloned.name = `${section.name} (Bản sao)`;
    cloned.order = this.sections.length + 1;
    this.ensureSectionTypography(cloned);

    const index = this.sections.findIndex((s) => s.id === section.id);
    if (index !== -1) {
      this.sections.splice(index + 1, 0, cloned);
    } else {
      this.sections.push(cloned);
    }

    this.sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    this.selectedSection = cloned;
    this.updateActiveTypographyElementForSection(cloned);
    this.updateActiveContentFieldForSection(cloned);
    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã nhân bản "${section.name}"`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onPromptDeleteSection(section: AboutSection, event: MouseEvent): void {
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
    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã xóa phân đoạn "${delName}"`);
    this.cdr.markForCheck();
  }

  onCancelDelete(): void {
    this.isDeleteDialogOpen = false;
    this.sectionToDelete = null;
    this.cdr.markForCheck();
  }

  // ── Thêm Phân Đoạn Mới (Add Section Modal - Chỉ Phân Đoạn Mới) ──
  onOpenAddModal(): void {
    this.isAddModalOpen = true;
    this.cdr.markForCheck();
  }

  onCloseAddModal(): void {
    this.isAddModalOpen = false;
    this.cdr.markForCheck();
  }

  onSelectNewSectionType(option: SectionTypeOption): void {
    // Chỉ tạo Phân Đoạn Mới với cấu trúc chuẩn
    const newSec = createDefaultAboutSection(option.type as AboutSectionType, this.sections.length + 1);
    this.ensureSectionTypography(newSec);
    this.updateActiveTypographyElementForSection(newSec);
    this.updateActiveContentFieldForSection(newSec);
    this.sections.push(newSec);
    this.selectedSection = newSec;
    this.isAddModalOpen = false;
    this.isEditorOpen = true;
    this.editorActiveTab = 'content';
    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã thêm "${option.name}"`);
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
          preset: 'split-reveal',
          duration: 900,
          delay: 150,
          intensity: 'normal',
          once: true,
        };
        break;
      case 'luxury':
        this.selectedSection.animation = {
          preset: 'image-reveal',
          duration: 1100,
          delay: 200,
          intensity: 'subtle',
          once: true,
        };
        break;
      case 'dynamic':
        this.selectedSection.animation = {
          preset: 'zoom-in',
          duration: 800,
          delay: 50,
          intensity: 'strong',
          once: true,
        };
        break;
    }

    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã áp dụng chuyển động "${preset.toUpperCase()}"`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onSwitchToCustomAnimation(): void {
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

  ensureSectionAnimation(section: AboutSection | null | undefined): SectionAnimation {
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

  getSectionAnimationClass(section: AboutSection | null | undefined): string {
    if (!section || !this.isAnimationPlaying) return '';
    const anim = section.animation;
    if (!anim || !anim.preset || anim.preset === 'none') return '';
    return `anim-${anim.preset} anim-intensity-${anim.intensity || 'normal'}`;
  }

  getSectionAnimationStyle(section: AboutSection | null | undefined): Record<string, string> {
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

  // ── Media Upload (Thực tế qua Backend API) ──────────────────────
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
    this.notificationService.success(`Đã gỡ ảnh ${target === 'desktop' ? 'Desktop' : 'Mobile'}`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

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

  checkForLargeBase64(sections: AboutSection[]): boolean {
    if (!Array.isArray(sections)) return false;
    for (const sec of sections) {
      if (sec.media?.desktop?.url && sec.media.desktop.url.startsWith('data:image')) {
        return true;
      }
      if (sec.media?.mobile?.url && sec.media.mobile.url.startsWith('data:image')) {
        return true;
      }
    }
    return false;
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

  get enabledSections(): AboutSection[] {
    return this.sections.filter((s) => s.enabled);
  }

  getSectionTypeBadgeClass(type: AboutSectionType): string {
    switch (type) {
      case 'hero':
      case 'banner':
      case 'cta':
        return 'badge-type-content';
      case 'editorial':
      case 'quote':
      case 'image-text':
        return 'badge-type-editorial';
      case 'spacer':
      default:
        return 'badge-type-layout';
    }
  }

  getSectionTypeName(type: AboutSectionType): string {
    const opt = this.sectionTypeOptions.find((o) => o.type === type);
    return opt ? opt.name : 'Phân đoạn';
  }

  // ── Quản lý Cấu hình Typography (Font Chữ & Kiểu Chữ) ───────────
  ensureSectionTypography(section: AboutSection): SectionTypography {
    if (!section.typography) {
      section.typography = JSON.parse(JSON.stringify(getDefaultTypographyForType(section.type)));
    }
    return section.typography;
  }

  updateActiveTypographyElementForSection(section: AboutSection): void {
    const available = this.getAvailableTypographyElements(section);
    if (available.length > 0) {
      const exists = available.some((el) => el.key === this.activeTypographyElement);
      if (!exists) {
        this.activeTypographyElement = available[0].key;
      }
    }
  }

  getAvailableTypographyElements(section: AboutSection | null): { key: TypographyElementKey; label: string }[] {
    if (!section) return [];
    switch (section.type) {
      case 'editorial':
        return [
          { key: 'heading', label: 'Tiêu đề chính (Heading)' },
          { key: 'quote', label: 'Trích dẫn (Quote)' },
          { key: 'eyebrow', label: 'Tagline / Nhãn (Eyebrow)' },
          { key: 'button', label: 'Nút bấm (Button)' },
        ];
      case 'image-text':
      case 'hero':
      case 'banner':
        return [
          { key: 'heading', label: 'Tiêu đề chính (Heading)' },
          { key: 'eyebrow', label: 'Dòng mở đầu (Eyebrow)' },
          { key: 'body', label: 'Đoạn mô tả (Body)' },
          { key: 'button', label: 'Nút bấm (Button)' },
        ];
      case 'quote':
        return [
          { key: 'quote', label: 'Nội dung trích dẫn (Quote)' },
          { key: 'subheading', label: 'Tác giả / Nguồn (Author)' },
        ];
      case 'cta':
        return [
          { key: 'heading', label: 'Tiêu đề chính (Heading)' },
          { key: 'body', label: 'Đoạn mô tả (Body)' },
          { key: 'button', label: 'Nút kêu gọi (CTA Button)' },
        ];
      case 'spacer':
        return [];
      default:
        return [
          { key: 'heading', label: 'Tiêu đề chính (Heading)' },
          { key: 'body', label: 'Nội dung mô tả (Body)' },
        ];
    }
  }

  getCurrentElementTypography(elementKey?: TypographyElementKey): TypographyConfig {
    if (!this.selectedSection) {
      return { fontFamily: 'inherit' };
    }
    const typo = this.ensureSectionTypography(this.selectedSection);
    const key = elementKey || this.activeTypographyElement;
    if (!typo[key]) {
      typo[key] = {
        fontFamily: 'inherit',
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.5,
        letterSpacing: 0,
        textTransform: 'none',
        textAlign: 'left',
      };
    }
    return typo[key]!;
  }

  onSelectTypographyElement(key: TypographyElementKey): void {
    this.activeTypographyElement = key;
    this.cdr.markForCheck();
  }

  onSelectPreset(preset: TypographyPresetType): void {
    this.selectedTypographyPreset = preset;
    this.cdr.markForCheck();
  }

  getSelectedPresetLabel(): string {
    const found = this.typographyPresets.find(
      (p) => p.id === this.selectedTypographyPreset || p.value === this.selectedTypographyPreset
    );
    return found ? found.name : 'Editorial';
  }

  onApplyPresetToAll(): void {
    if (!this.selectedSection) return;
    const preset = this.selectedTypographyPreset;
    const foundPreset = this.typographyPresets.find(
      (p) => p.id === preset || p.value === preset
    );
    if (!foundPreset) return;

    const typo = this.ensureSectionTypography(this.selectedSection);
    typo.preset = preset;

    const presetTypo = foundPreset.typography;
    if (presetTypo) {
      if (presetTypo.heading) typo.heading = JSON.parse(JSON.stringify(presetTypo.heading));
      if (presetTypo.subheading) typo.subheading = JSON.parse(JSON.stringify(presetTypo.subheading));
      if (presetTypo.body) typo.body = JSON.parse(JSON.stringify(presetTypo.body));
      if (presetTypo.button) typo.button = JSON.parse(JSON.stringify(presetTypo.button));
      if (presetTypo.eyebrow) typo.eyebrow = JSON.parse(JSON.stringify(presetTypo.eyebrow));
      if (presetTypo.quote) typo.quote = JSON.parse(JSON.stringify(presetTypo.quote));
    }

    this.hasUnsavedChanges = true;
    this.notificationService.success(
      `Đã áp dụng bộ phối font "${foundPreset.label}" cho toàn bộ phần tử của phân đoạn`
    );
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onApplyTypographyPreset(preset: TypographyPresetType): void {
    this.selectedTypographyPreset = preset;
    this.onApplyPresetToAll();
  }

  getAvailableContentFields(section: AboutSection | null): {
    key: string;
    label: string;
    typoElementKey: TypographyElementKey;
    colorKey: keyof SectionColors;
    icon: string;
    description: string;
  }[] {
    if (!section) return this.allContentFields;
    switch (section.type) {
      case 'editorial':
        return this.allContentFields.filter((f) => f.key !== 'eyebrow' && f.key !== 'author');
      case 'image-text':
        return this.allContentFields.filter(
          (f) => f.key === 'eyebrow' || f.key === 'title' || f.key === 'description' || f.key === 'buttonText'
        );
      case 'quote':
        return [
          {
            key: 'quote',
            label: 'Đoạn trích dẫn nghệ thuật',
            typoElementKey: 'quote',
            colorKey: 'quoteColor',
            icon: '“',
            description: 'Khối trích dẫn nghệ thuật hoặc thông điệp',
          },
          {
            key: 'author',
            label: 'Tác giả / Người phát ngôn',
            typoElementKey: 'subheading',
            colorKey: 'subtitleColor',
            icon: '—',
            description: 'Tác giả trích dẫn hoặc người phát ngôn',
          },
        ];
      case 'cta':
        return this.allContentFields.filter(
          (f) => f.key === 'title' || f.key === 'description' || f.key === 'buttonText'
        );
      case 'spacer':
        return [];
      default:
        return this.allContentFields;
    }
  }

  onSelectContentField(key: string): void {
    this.activeContentFieldKey = key;
    const field = this.getActiveFieldConfig();
    if (field) {
      this.activeTypographyElement = field.typoElementKey;
      this.activeColorProperty = field.colorKey;
    }
    this.cdr.markForCheck();
  }

  getActiveFieldConfig() {
    const available = this.getAvailableContentFields(this.selectedSection);
    let found = available.find((f) => f.key === this.activeContentFieldKey);
    if (!found && available.length > 0) {
      this.activeContentFieldKey = available[0].key;
      found = available[0];
    }
    return found || this.allContentFields[0];
  }

  getActiveTypographyConfig(): TypographyConfig {
    const field = this.getActiveFieldConfig();
    return this.getCurrentElementTypography(field ? field.typoElementKey : 'heading');
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

  onTypographyPropChange(): void {
    if (!this.selectedSection) return;
    const typo = this.ensureSectionTypography(this.selectedSection);
    typo.preset = 'custom';
    this.hasUnsavedChanges = true;
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  validateNumericProp(prop: keyof TypographyConfig, min: number, max: number, defaultVal: number): void {
    const config = this.getActiveTypographyConfig();
    let val = config[prop] as number;
    if (val === undefined || val === null || isNaN(val)) {
      (config as any)[prop] = defaultVal;
    } else if (val < min) {
      (config as any)[prop] = min;
    } else if (val > max) {
      (config as any)[prop] = max;
    }
    this.onTypographyPropChange();
  }

  getActiveColorValue(): string {
    const field = this.getActiveFieldConfig();
    const colorKey = field ? field.colorKey : 'titleColor';
    return this.getCurrentColor(colorKey);
  }

  onActiveColorPickerChange(val: string): void {
    const field = this.getActiveFieldConfig();
    const colorKey = field ? field.colorKey : 'titleColor';
    this.onColorPickerChange(colorKey, val);
  }

  onActiveHexInputChange(val: string): void {
    const field = this.getActiveFieldConfig();
    const colorKey = field ? field.colorKey : 'titleColor';
    this.onHexInputChange(colorKey, val);
  }

  onApplyActiveColorPreset(hex: string): void {
    const field = this.getActiveFieldConfig();
    const colorKey = field ? field.colorKey : 'titleColor';
    if (!this.selectedSection) return;
    const colors = this.ensureSectionColors(this.selectedSection);
    colors[colorKey] = hex.toUpperCase();
    delete this.colorErrors[colorKey as string];
    this.hasUnsavedChanges = true;
    this.notificationService.success(
      `Đã áp dụng màu ${hex} cho "${field.label}"`
    );
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetCurrentElement(): void {
    this.onResetElementTypography();
    this.onResetCurrentElementColor();
  }

  onResetCurrentElementColor(): void {
    const field = this.getActiveFieldConfig();
    if (field) {
      this.onResetColorProperty(field.colorKey);
    }
  }

  updateActiveContentFieldForSection(section: AboutSection): void {
    const available = this.getAvailableContentFields(section);
    if (available.length > 0) {
      const exists = available.some((f) => f.key === this.activeContentFieldKey);
      if (!exists) {
        this.activeContentFieldKey = available[0].key;
      }
    }
    if (section.typography?.preset && section.typography.preset !== 'custom') {
      this.selectedTypographyPreset = section.typography.preset as TypographyPresetType;
    }
  }

  onResetSectionTypography(): void {
    if (!this.selectedSection) return;
    this.selectedSection.typography = JSON.parse(
      JSON.stringify(getDefaultTypographyForType(this.selectedSection.type))
    );
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã khôi phục cài đặt kiểu chữ mặc định cho phân đoạn');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetElementTypography(): void {
    if (!this.selectedSection) return;
    const defaults = getDefaultTypographyForType(this.selectedSection.type);
    const typo = this.ensureSectionTypography(this.selectedSection);
    const key = this.activeTypographyElement;
    if (defaults && defaults[key]) {
      typo[key] = JSON.parse(JSON.stringify(defaults[key]));
    } else {
      typo[key] = { fontFamily: 'inherit' };
    }
    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã khôi phục font mặc định cho ${this.getElementLabel(key)}`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  getElementLabel(key: TypographyElementKey): string {
    switch (key) {
      case 'heading': return 'Tiêu đề chính (Heading)';
      case 'eyebrow': return 'Dòng mở đầu (Eyebrow)';
      case 'body': return 'Nội dung mô tả (Body)';
      case 'button': return 'Nút bấm (CTA Button)';
      case 'quote': return 'Trích dẫn (Quote)';
      case 'subheading': return 'Tiêu đề phụ / Tác giả';
      default: return key;
    }
  }

  getFontFamilyName(fontFamily?: string): string {
    if (!fontFamily || fontFamily === 'inherit') return 'System Default';
    const found = this.availableFonts.find((f) => f.fontFamily === fontFamily);
    return found ? found.name : fontFamily.split(',')[0].replace(/['"]/g, '');
  }

  getTypographyStyle(
    section: AboutSection | null | undefined,
    element: TypographyElementKey
  ): Record<string, string> {
    if (!section) return {};
    const style: Record<string, string> = {};

    // 1. Thuộc tính Typography
    if (section.typography) {
      const cfg = section.typography[element];
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
      } else if ((element === 'subheading' || element === 'eyebrow') && section.colors.subtitleColor) {
        style['color'] = section.colors.subtitleColor;
      } else if (element === 'body' && section.colors.bodyColor) {
        style['color'] = section.colors.bodyColor;
      } else if (element === 'quote' && section.colors.quoteColor) {
        style['color'] = section.colors.quoteColor;
      } else if (element === 'button') {
        if (section.colors.buttonTextColor) {
          style['color'] = section.colors.buttonTextColor;
        }
        if (section.colors.buttonBackgroundColor) {
          style['background-color'] = section.colors.buttonBackgroundColor;
        }
      }
    }

    return style;
  }

  // ── Quản lý Màu Sắc (Colors) ────────────────────────────────────
  ensureSectionColors(section: AboutSection | null): SectionColors {
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
    this.hasUnsavedChanges = true;
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
      this.hasUnsavedChanges = true;
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
    this.hasUnsavedChanges = true;
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
    this.hasUnsavedChanges = true;
    this.notificationService.success(`Đã khôi phục ${this.getColorPropertyLabel(prop)} về mặc định`);
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetAllColors(): void {
    if (!this.selectedSection) return;
    this.selectedSection.colors = JSON.parse(JSON.stringify(getDefaultColorsForType(this.selectedSection.type)));
    this.colorErrors = {};
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã khôi phục tất cả màu sắc của phân đoạn về mặc định');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  onResetEntireTab4(): void {
    if (!this.selectedSection) return;
    this.onResetSectionTypography();
    this.onResetAllColors();
    this.hasUnsavedChanges = true;
    this.notificationService.success('Đã khôi phục toàn bộ Kiểu chữ & Màu sắc về mặc định');
    this.triggerAnimationPreview();
    this.cdr.markForCheck();
  }

  getColorPropertyLabel(prop: keyof SectionColors): string {
    switch (prop) {
      case 'backgroundColor': return 'Màu nền Phân đoạn';
      case 'titleColor': return 'Màu tiêu đề';
      case 'subtitleColor': return 'Màu tiêu đề phụ / Eyebrow';
      case 'bodyColor': return 'Màu nội dung mô tả';
      case 'quoteColor': return 'Màu trích dẫn';
      case 'buttonTextColor': return 'Màu chữ nút CTA';
      case 'buttonBackgroundColor': return 'Màu nền nút CTA';
      case 'buttonHoverTextColor': return 'Màu chữ nút khi hover';
      case 'buttonHoverBackgroundColor': return 'Màu nền nút khi hover';
      default: return prop;
    }
  }

  getAvailableColorProperties(section: AboutSection | null): { key: keyof SectionColors; label: string; description: string }[] {
    if (!section) return [];
    const list: { key: keyof SectionColors; label: string; description: string }[] = [];

    list.push({
      key: 'backgroundColor',
      label: 'Màu nền Phân đoạn',
      description: 'Màu nền của toàn bộ khối phân đoạn',
    });

    if (section.type !== 'quote' && section.type !== 'spacer') {
      list.push({
        key: 'titleColor',
        label: 'Màu tiêu đề chính',
        description: 'Tiêu đề khối hoặc câu chuyện',
      });
    }

    if (section.type === 'editorial' || section.type === 'image-text' || section.type === 'hero' || section.type === 'banner' || section.type === 'quote') {
      list.push({
        key: 'subtitleColor',
        label: section.type === 'quote' ? 'Màu tác giả / nguồn' : 'Màu tiêu đề phụ / Eyebrow',
        description: 'Dòng chữ mở đầu hoặc tác giả trích dẫn',
      });
    }

    if (section.type === 'editorial' || section.type === 'image-text' || section.type === 'hero' || section.type === 'banner' || section.type === 'cta') {
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

  getSectionContainerStyle(section: AboutSection | null | undefined): Record<string, string> {
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
}

export { AboutComponent as About };
