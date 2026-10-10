export type SectionType =
  | 'hero'
  | 'product-slider'
  | 'product-grid'
  | 'editorial'
  | 'banner'
  | 'image-text'
  | 'quote'
  | 'cta'
  | 'spacer';

export type SectionCategory = 'CONTENT' | 'PRODUCT' | 'EDITORIAL' | 'LAYOUT';

export type MotionPresetType =
  | 'minimal'
  | 'subtle'
  | 'normal'
  | 'editorial'
  | 'luxury'
  | 'dynamic';

export type AnimationPreset =
  | 'none'
  | 'fade'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'scale'
  | 'reveal'
  | 'image-reveal'
  | 'split-reveal'
  | 'stagger'
  | 'parallax'
  | 'image-zoom'
  | 'text-reveal';

export interface SectionMediaItem {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  objectPosition?: string;
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
  typography?: {
    title?: TypographyConfig;
    description?: TypographyConfig;
    [key: string]: TypographyConfig | undefined;
  };
  colors?: {
    titleColor?: string;
    descriptionColor?: string;
    [key: string]: string | undefined;
  };
}

export interface CarouselConfig {
  autoplay: boolean;
  autoplayInterval: number; // giây (ví dụ: 4)
  showDots: boolean;
  showArrows: boolean;
  loop: boolean;
}

export interface SectionMedia {
  desktop?: SectionMediaItem | null;
  mobile?: SectionMediaItem | null;
  overlayOpacity?: number;
  carouselSlides?: CarouselSlideItem[];
}

export interface SectionContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  quote?: string;
  tagline1?: string;
  tagline2?: string;
  buttonText?: string;
  buttonLink?: string;
  secondaryButtonText?: string;
  secondaryButtonLink?: string;
  viewAllText?: string;
  viewAllLink?: string;
  author?: string;
}

export interface SectionLayout {
  variant: string;
  alignment?: 'left' | 'center' | 'right';
  contentPosition?: 'top' | 'middle' | 'bottom';
  imageWidth?: number; // 40, 50, 60
  contentWidth?: number;
  columns?: number;
  gap?: number;
  fullWidth?: boolean;
  minHeight?: string;
  mobileMinHeight?: string;
  carouselConfig?: CarouselConfig;
}

export interface SectionAnimation {
  preset: AnimationPreset;
  trigger?: 'viewport' | 'load';
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number; // ms
  delay?: number; // ms
  intensity?: 'subtle' | 'normal' | 'strong';
  threshold?: number;
  once?: boolean;
}

export interface SectionSettings {
  source?: 'featured' | 'latest' | 'sale' | 'manual';
  limit?: number;
  itemsPerView?: number;
  manualProductIds?: string[];
  enableGlow?: boolean;
  overlay?: boolean;
  spacerHeight?: number;
  bgColor?: string;
  textColor?: string;
}

export type TypographyPresetType = 'minimal' | 'editorial' | 'classic' | 'romantic' | 'modern' | 'luxury';

export type TextTransformType = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export type TypographyElementKey =
  | 'heading'
  | 'subheading'
  | 'body'
  | 'button'
  | 'eyebrow'
  | 'quote'
  | 'tagline1'
  | 'tagline2'
  | 'author'
  | 'viewAllText';

export interface TypographyConfig {
  fontFamily?: string;
  fontSize?: number; // px
  fontWeight?: number; // 100 - 900
  lineHeight?: number;
  letterSpacing?: number; // px
  textTransform?: TextTransformType;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface SectionTypography {
  preset?: TypographyPresetType | 'custom';
  heading?: TypographyConfig;
  subheading?: TypographyConfig;
  body?: TypographyConfig;
  button?: TypographyConfig;
  eyebrow?: TypographyConfig;
  quote?: TypographyConfig;
  author?: TypographyConfig;
  viewAllText?: TypographyConfig;
  [key: string]: any;
}

export interface SectionColors {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  bodyColor?: string;
  quoteColor?: string;
  buttonTextColor?: string;
  buttonBackgroundColor?: string;
  buttonHoverTextColor?: string;
  buttonHoverBackgroundColor?: string;
  tagline1Color?: string;
  tagline2Color?: string;
  authorColor?: string;
  [key: string]: string | undefined;
}

export interface ConfigurableTypographyTarget {
  id: string; // e.g. "sec_123:title" or "sec_123:slide_456:title"
  sectionId: string;
  sectionName: string;
  sectionType: SectionType;
  slideId?: string;
  slideIndex?: number;
  slideTitle?: string;
  fieldKey: string;
  fieldLabel: string;
  label?: string;
  groupLabel: string;
  fullPathLabel: string;
  typoElementKey: TypographyElementKey;
  role?: string;
  colorKey: string;
  isButton?: boolean;
  isSlide?: boolean;
}

export interface FontOption {
  id: string;
  name: string;
  fontFamily: string;
  category: 'Serif' | 'Sans-Serif' | 'System';
  description?: string;
  label?: string;
  value?: string;
  style?: string;
}

export interface HomeSection {
  id: string;
  name: string;
  type: SectionType;
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
  settings: SectionSettings;
}

export interface SectionTypeOption {
  type: SectionType;
  category: SectionCategory;
  name: string;
  description?: string;
  iconSvg: string;
  badge?: string;
}
