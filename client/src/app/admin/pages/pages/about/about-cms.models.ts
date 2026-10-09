export type AboutSectionType =
  | 'editorial'
  | 'image-text'
  | 'banner'
  | 'hero'
  | 'quote'
  | 'cta'
  | 'spacer';

export type AboutSectionCategory = 'CONTENT' | 'EDITORIAL' | 'LAYOUT';

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
}

export interface CarouselConfig {
  autoplay: boolean;
  autoplayInterval: number;
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
  author?: string;
}

export interface SectionLayout {
  variant: string;
  alignment?: 'left' | 'center' | 'right';
  contentPosition?: 'top' | 'middle' | 'bottom';
  imageWidth?: number;
  contentWidth?: number;
  gap?: number;
  fullWidth?: boolean;
  minHeight?: string;
  carouselConfig?: CarouselConfig;
}

export interface SectionAnimation {
  preset: AnimationPreset;
  trigger?: 'viewport' | 'load';
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  duration?: number;
  delay?: number;
  intensity?: 'subtle' | 'normal' | 'strong';
  threshold?: number;
  once?: boolean;
}

export interface SectionSettings {
  enableGlow?: boolean;
  overlay?: boolean;
  spacerHeight?: number;
  bgColor?: string;
  textColor?: string;
}

export type TypographyPresetType = 'minimal' | 'editorial' | 'classic' | 'romantic' | 'modern' | 'luxury';

export type TextTransformType = 'none' | 'uppercase' | 'lowercase' | 'capitalize';

export type TypographyElementKey = 'heading' | 'subheading' | 'body' | 'button' | 'eyebrow' | 'quote';

export interface TypographyConfig {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: TextTransformType;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
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
}

export interface SectionTypography {
  preset?: TypographyPresetType | 'custom';
  heading?: TypographyConfig;
  subheading?: TypographyConfig;
  body?: TypographyConfig;
  button?: TypographyConfig;
  eyebrow?: TypographyConfig;
  quote?: TypographyConfig;
}

export interface FontOption {
  id: string;
  name: string;
  fontFamily: string;
  category: 'Serif' | 'Sans-Serif' | 'System';
  description?: string;
}

export interface AboutSection {
  id: string;
  name: string;
  type: AboutSectionType;
  category: AboutSectionCategory;
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
  type: AboutSectionType;
  category: AboutSectionCategory;
  name: string;
  description?: string;
  iconSvg: string;
  badge?: string;
}
