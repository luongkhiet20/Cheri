/**
 * cms.models.ts — MODEL DÙNG CHUNG cho Home + About (và mọi trang CMS sau này).
 * Thay thế: home-cms.models.ts + about-cms.models.ts (trùng ~80%).
 */

// ───────────────────────── Types cơ bản ─────────────────────────
export type CoreSectionType =
  | 'hero' | 'banner' | 'image-text' | 'editorial' | 'quote' | 'cta' | 'spacer';
export type HomeSectionType = CoreSectionType | 'product-slider' | 'product-grid';
/** Đề xuất mở rộng cho About (bật khi cần): */
export type AboutSectionType = CoreSectionType | 'gallery' | 'timeline' | 'stats';
/** @deprecated alias — use HomeSectionType | AboutSectionType */
export type SectionType = HomeSectionType | AboutSectionType;
/** @deprecated alias — use SectionCategory */
export type AboutSectionCategory = SectionCategory;

export type SectionCategory = 'CONTENT' | 'PRODUCT' | 'EDITORIAL' | 'LAYOUT';

export type MotionPresetType = 'minimal' | 'subtle' | 'normal' | 'editorial' | 'luxury' | 'dynamic';
export type AnimationPreset =
  | 'none' | 'fade' | 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right'
  | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down'
  | 'zoom-in' | 'zoom-out' | 'scale' | 'reveal' | 'image-reveal' | 'split-reveal'
  | 'stagger' | 'parallax' | 'image-zoom' | 'text-reveal';

export type TypographyPresetType = 'minimal' | 'editorial' | 'classic' | 'romantic' | 'modern' | 'luxury';
export type TextTransformType = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export interface TypographyPresetOption {
  id: string;
  value: TypographyPresetType;
  name: string;
  label: string;
  badge: string;
  description?: string;
  previewFont: string;
  typography: SectionTypography;
}

// ───────────── Khóa typography / màu: KHÔNG dùng index-signature `any` ─────────────
export type TypographyElementKey =
  | 'heading' | 'subheading' | 'body' | 'button' | 'eyebrow' | 'quote'
  | 'tagline1' | 'tagline2' | 'author' | 'viewAllText';

export type ColorKey =
  | 'backgroundColor' | 'titleColor' | 'subtitleColor' | 'bodyColor' | 'quoteColor'
  | 'buttonTextColor' | 'buttonBackgroundColor' | 'buttonHoverTextColor' | 'buttonHoverBackgroundColor'
  | 'tagline1Color' | 'tagline2Color' | 'authorColor' | 'viewAllColor'
  | 'descriptionColor'; // dùng cho slide carousel

export interface TypographyConfig {
  fontFamily?: string;
  fontSize?: number;       // px
  fontWeight?: number;     // 100–900
  lineHeight?: number;
  letterSpacing?: number;  // px
  textTransform?: TextTransformType;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export type SectionTypography =
  { preset?: TypographyPresetType | 'custom' } & Partial<Record<TypographyElementKey, TypographyConfig>>;
export type SectionColors = Partial<Record<ColorKey, string>>;

// ───────────────────────── Media / Carousel ─────────────────────────
export interface SectionMediaItem {
  url: string; alt?: string; width?: number; height?: number; objectPosition?: string;
}
export interface CarouselSlideItem {
  id: string;
  url: string;
  mobileUrl?: string;
  alt?: string;
  title?: string;
  description?: string;
  linkUrl?: string;
  enabled: boolean;
  isLocalPreview?: boolean;
  typography?: Partial<Record<'title' | 'description', TypographyConfig>>;
  colors?: Partial<Record<'titleColor' | 'descriptionColor', string>>;
}
export interface CarouselConfig {
  autoplay: boolean; autoplayInterval: number /* giây */; showDots: boolean; showArrows: boolean; loop: boolean;
}
export interface SectionMedia {
  desktop?: SectionMediaItem | null;
  mobile?: SectionMediaItem | null;
  overlayOpacity?: number;
  carouselSlides?: CarouselSlideItem[];
}

// ───────────────────────── Content / Layout / Animation ─────────────────────────
export interface SectionContent {
  eyebrow?: string; title?: string; description?: string; quote?: string; author?: string;
  tagline1?: string; tagline2?: string;
  buttonText?: string; buttonLink?: string;
  secondaryButtonText?: string; secondaryButtonLink?: string;
  viewAllText?: string; viewAllLink?: string;          // chỉ Home dùng, giữ trong core để đồng nhất
}
export interface SectionLayout {
  variant: string;
  alignment?: 'left' | 'center' | 'right';
  contentPosition?: 'top' | 'middle' | 'bottom';
  imageWidth?: number; contentWidth?: number; columns?: number; gap?: number;
  fullWidth?: boolean;
  minHeight?: string;
  mobileMinHeight?: string;                              // ⬅ About đang THIẾU
  carouselConfig?: CarouselConfig;
}
export interface SectionAnimation {
  preset: AnimationPreset;
  trigger?: 'viewport' | 'load';
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number; delay?: number;
  intensity?: 'subtle' | 'normal' | 'strong';
  threshold?: number; once?: boolean;
}

// ───────────────────────── Settings ─────────────────────────
export interface BaseSettings {
  enableGlow?: boolean; overlay?: boolean; spacerHeight?: number;
  bgColor?: string; textColor?: string;
  /** ⬇ ĐỀ XUẤT trường mới, dùng chung 2 trang */
  hideOnDesktop?: boolean;
  hideOnMobile?: boolean;
  paddingTop?: number;
  paddingBottom?: number;
  anchorId?: string;           // #id để link nhảy tới section
  customClass?: string;
  publishAt?: string;          // ISO — lên lịch hiển thị
  unpublishAt?: string;
}
export interface ProductSettings {
  source?: 'featured' | 'latest' | 'sale' | 'manual';
  limit?: number; itemsPerView?: number; manualProductIds?: string[];
}
export type HomeSettings = BaseSettings & ProductSettings;

// ───────────────────────── Section generic ─────────────────────────
export interface CmsSection<T extends string = string, S extends BaseSettings = BaseSettings> {
  id: string;
  name: string;
  type: T;
  category: SectionCategory;
  enabled: boolean;
  order: number;
  content: SectionContent;
  media: SectionMedia;
  layout: SectionLayout;
  animation: SectionAnimation;
  motionPreset?: MotionPresetType;
  isCustomAnimation?: boolean;
  typography?: SectionTypography;
  colors?: SectionColors;
  settings: S;
}
export type HomeSection = CmsSection<HomeSectionType, HomeSettings>;
export type AboutSection = CmsSection<AboutSectionType, BaseSettings>;

/** Tài liệu của 1 trang — thêm SEO + version (cả 2 trang đang THIẾU) */
export interface PageSeo { metaTitle?: string; metaDescription?: string; ogImage?: string; noIndex?: boolean; }
export interface PageDoc<S extends CmsSection = CmsSection> {
  sections: S[];
  seo?: PageSeo;
  publishedAt?: string;
  version?: number;
  updatedBy?: string;
}

// ───────────────────────── UI helper types ─────────────────────────
export interface FontOption {
  id: string; name: string; fontFamily: string; category: 'Serif' | 'Sans-Serif' | 'System';
  description?: string; label?: string; value?: string; style?: string;
}
export interface SectionTypeOption<T extends string = string> {
  type: T; category: SectionCategory; name: string; description?: string; iconSvg: string; badge?: string;
}
export interface ConfigurableTypographyTarget {
  id: string;                    // "secId:title" | "secId:slide_X:title"
  sectionId: string; sectionName: string; sectionType: string;
  slideId?: string; slideIndex?: number; slideTitle?: string;
  fieldKey: string; fieldLabel: string; groupLabel: string; fullPathLabel: string;
  typoElementKey: TypographyElementKey | 'heading' | 'body';
  colorKey: ColorKey;
  isButton?: boolean; isSlide?: boolean;
  /** @deprecated display label for backwards compat */
  label?: string;
  /** @deprecated element role for backwards compat */
  role?: string;
}
