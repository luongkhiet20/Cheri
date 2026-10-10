/**
 * cms.constants.ts - CONSTANTS dung chung cho Home + About.
 * Gop tu: home-cms.constants.ts + about-cms.constants.ts.
 */
import {
  HomeSection, AboutSection, HomeSectionType, AboutSectionType,
  FontOption, FontGroup, SectionTypography, SectionColors, CarouselConfig, SectionTypeOption,
  TypographyPresetOption,
} from './cms.models';

export interface ColorPreset { name: string; hex: string; label: string; }

export const CHERI_COLOR_PRESETS: ColorPreset[] = [
  { name: 'Burgundy', hex: '#74070E', label: 'Do Burgundy' },
  { name: 'Cherry Red', hex: '#990000', label: 'Do Cherry' },
  { name: 'Deep Burgundy', hex: '#5B1018', label: 'Do tram' },
  { name: 'White', hex: '#FFFFFF', label: 'Trang' },
  { name: 'Black', hex: '#111111', label: 'Den' },
  { name: 'Dark Gray', hex: '#374151', label: 'Xam dam' },
  { name: 'Neutral Gray', hex: '#6B7280', label: 'Xam trung tinh' },
  { name: 'Light Gray', hex: '#E5E7EB', label: 'Xam nhat' },
];

export function getDefaultCarouselConfig(): CarouselConfig {
  return { autoplay: true, autoplayInterval: 4, showDots: true, showArrows: true, loop: true };
}
// ─────────────────── Available Fonts (61 fonts: 56 Google Fonts + 5 System) ───────────────────
export const AVAILABLE_FONTS: FontOption[] = [
  // ── 1. Sans-Serif (20 fonts) ──
  { id: 'inter', name: 'Inter', label: 'Inter', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", value: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Inter:wght@300;400;500;600;700' },
  { id: 'montserrat', name: 'Montserrat', label: 'Montserrat', fontFamily: "'Montserrat', sans-serif", value: "'Montserrat', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Montserrat:wght@300;400;500;600;700' },
  { id: 'poppins', name: 'Poppins', label: 'Poppins', fontFamily: "'Poppins', sans-serif", value: "'Poppins', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Poppins:wght@300;400;500;600;700' },
  { id: 'roboto', name: 'Roboto', label: 'Roboto', fontFamily: "'Roboto', sans-serif", value: "'Roboto', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Roboto:wght@300;400;500;700' },
  { id: 'lato', name: 'Lato', label: 'Lato', fontFamily: "'Lato', sans-serif", value: "'Lato', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Lato:wght@300;400;700' },
  { id: 'opensans', name: 'Open Sans', label: 'Open Sans', fontFamily: "'Open Sans', sans-serif", value: "'Open Sans', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Open+Sans:wght@300;400;600;700' },
  { id: 'dmsans', name: 'DM Sans', label: 'DM Sans', fontFamily: "'DM Sans', sans-serif", value: "'DM Sans', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'DM+Sans:wght@300;400;500;700' },
  { id: 'plusjakartasans', name: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans', fontFamily: "'Plus Jakarta Sans', sans-serif", value: "'Plus Jakarta Sans', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Plus+Jakarta+Sans:wght@300;400;500;600;700' },
  { id: 'jost', name: 'Jost', label: 'Jost', fontFamily: "'Jost', sans-serif", value: "'Jost', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Jost:wght@300;400;500;600' },
  { id: 'outfit', name: 'Outfit', label: 'Outfit', fontFamily: "'Outfit', sans-serif", value: "'Outfit', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Outfit:wght@300;400;500;600' },
  { id: 'raleway', name: 'Raleway', label: 'Raleway', fontFamily: "'Raleway', sans-serif", value: "'Raleway', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Raleway:wght@300;400;500;600' },
  { id: 'nunito', name: 'Nunito', label: 'Nunito', fontFamily: "'Nunito', sans-serif", value: "'Nunito', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Nunito:wght@300;400;600;700' },
  { id: 'worksans', name: 'Work Sans', label: 'Work Sans', fontFamily: "'Work Sans', sans-serif", value: "'Work Sans', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Work+Sans:wght@300;400;500;600' },
  { id: 'manrope', name: 'Manrope', label: 'Manrope', fontFamily: "'Manrope', sans-serif", value: "'Manrope', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Manrope:wght@300;400;500;600' },
  { id: 'urbanist', name: 'Urbanist', label: 'Urbanist', fontFamily: "'Urbanist', sans-serif", value: "'Urbanist', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Urbanist:wght@300;400;500;600' },
  { id: 'syne', name: 'Syne', label: 'Syne', fontFamily: "'Syne', sans-serif", value: "'Syne', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Syne:wght@400;500;700' },
  { id: 'tenorsans', name: 'Tenor Sans', label: 'Tenor Sans', fontFamily: "'Tenor Sans', sans-serif", value: "'Tenor Sans', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Tenor+Sans' },
  { id: 'questrial', name: 'Questrial', label: 'Questrial', fontFamily: "'Questrial', sans-serif", value: "'Questrial', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Questrial' },
  { id: 'marcellussc', name: 'Marcellus SC', label: 'Marcellus SC', fontFamily: "'Marcellus SC', sans-serif", value: "'Marcellus SC', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Marcellus+SC' },
  { id: 'epilogue', name: 'Epilogue', label: 'Epilogue', fontFamily: "'Epilogue', sans-serif", value: "'Epilogue', sans-serif", category: 'Sans-Serif', style: 'Sans-Serif', googleFont: 'Epilogue:wght@300;400;600' },

  // ── 2. Serif (18 fonts) ──
  { id: 'playfair', name: 'Playfair Display', label: 'Playfair Display', fontFamily: "'Playfair Display', Georgia, serif", value: "'Playfair Display', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'cormorant', name: 'Cormorant Garamond', label: 'Cormorant Garamond', fontFamily: "'Cormorant Garamond', Garamond, serif", value: "'Cormorant Garamond', Garamond, serif", category: 'Serif', style: 'Serif', googleFont: 'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'lora', name: 'Lora', label: 'Lora', fontFamily: "'Lora', Georgia, serif", value: "'Lora', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Lora:ital,wght@0,400;0,500;0,600;1,400' },
  { id: 'cinzel', name: 'Cinzel', label: 'Cinzel', fontFamily: "'Cinzel', Georgia, serif", value: "'Cinzel', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Cinzel:wght@400;600;700' },
  { id: 'bodonimoda', name: 'Bodoni Moda', label: 'Bodoni Moda', fontFamily: "'Bodoni Moda', Georgia, serif", value: "'Bodoni Moda', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Bodoni+Moda:ital,wght@0,400;0,600;0,700;1,400' },
  { id: 'prata', name: 'Prata', label: 'Prata', fontFamily: "'Prata', Georgia, serif", value: "'Prata', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Prata' },
  { id: 'marcellus', name: 'Marcellus', label: 'Marcellus', fontFamily: "'Marcellus', Georgia, serif", value: "'Marcellus', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Marcellus' },
  { id: 'castorotitling', name: 'Castoro Titling', label: 'Castoro Titling', fontFamily: "'Castoro Titling', Georgia, serif", value: "'Castoro Titling', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Castoro+Titling' },
  { id: 'ebgaramond', name: 'EB Garamond', label: 'EB Garamond', fontFamily: "'EB Garamond', Garamond, Georgia, serif", value: "'EB Garamond', Garamond, Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'EB+Garamond:ital,wght@0,400;0,600;1,400' },
  { id: 'merriweather', name: 'Merriweather', label: 'Merriweather', fontFamily: "'Merriweather', Georgia, serif", value: "'Merriweather', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Merriweather:wght@300;400;700' },
  { id: 'italiana', name: 'Italiana', label: 'Italiana', fontFamily: "'Italiana', Georgia, serif", value: "'Italiana', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Italiana' },
  { id: 'bellefair', name: 'Bellefair', label: 'Bellefair', fontFamily: "'Bellefair', Georgia, serif", value: "'Bellefair', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Bellefair' },
  { id: 'aboreto', name: 'Aboreto', label: 'Aboreto', fontFamily: "'Aboreto', Georgia, serif", value: "'Aboreto', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Aboreto' },
  { id: 'oranienbaum', name: 'Oranienbaum', label: 'Oranienbaum', fontFamily: "'Oranienbaum', Georgia, serif", value: "'Oranienbaum', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Oranienbaum' },
  { id: 'spectral', name: 'Spectral', label: 'Spectral', fontFamily: "'Spectral', Georgia, serif", value: "'Spectral', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Spectral:wght@300;400;600' },
  { id: 'vollkorn', name: 'Vollkorn', label: 'Vollkorn', fontFamily: "'Vollkorn', Georgia, serif", value: "'Vollkorn', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Vollkorn:ital,wght@0,400;0,600;1,400' },
  { id: 'baskervville', name: 'Baskervville', label: 'Baskervville', fontFamily: "'Baskervville', Georgia, serif", value: "'Baskervville', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Baskervville:ital@0;1' },
  { id: 'cardo', name: 'Cardo', label: 'Cardo', fontFamily: "'Cardo', Georgia, serif", value: "'Cardo', Georgia, serif", category: 'Serif', style: 'Serif', googleFont: 'Cardo:ital,wght@0,400;0,700;1,400' },

  // ── 3. Display (10 fonts) ──
  { id: 'abrilfatface', name: 'Abril Fatface', label: 'Abril Fatface', fontFamily: "'Abril Fatface', Georgia, serif", value: "'Abril Fatface', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Abril+Fatface' },
  { id: 'yesevaone', name: 'Yeseva One', label: 'Yeseva One', fontFamily: "'Yeseva One', Georgia, serif", value: "'Yeseva One', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Yeseva+One' },
  { id: 'rozhaone', name: 'Rozha One', label: 'Rozha One', fontFamily: "'Rozha One', Georgia, serif", value: "'Rozha One', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Rozha+One' },
  { id: 'dmserifdisplay', name: 'DM Serif Display', label: 'DM Serif Display', fontFamily: "'DM Serif Display', Georgia, serif", value: "'DM Serif Display', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'DM+Serif+Display' },
  { id: 'forum', name: 'Forum', label: 'Forum', fontFamily: "'Forum', Georgia, serif", value: "'Forum', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Forum' },
  { id: 'gloock', name: 'Gloock', label: 'Gloock', fontFamily: "'Gloock', Georgia, serif", value: "'Gloock', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Gloock' },
  { id: 'stintultraexpanded', name: 'Stint Ultra Expanded', label: 'Stint Ultra Expanded', fontFamily: "'Stint Ultra Expanded', Georgia, serif", value: "'Stint Ultra Expanded', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Stint+Ultra+Expanded' },
  { id: 'belleza', name: 'Belleza', label: 'Belleza', fontFamily: "'Belleza', sans-serif", value: "'Belleza', sans-serif", category: 'Display', style: 'Display', googleFont: 'Belleza' },
  { id: 'federo', name: 'Federo', label: 'Federo', fontFamily: "'Federo', sans-serif", value: "'Federo', sans-serif", category: 'Display', style: 'Display', googleFont: 'Federo' },
  { id: 'cinzeldec', name: 'Cinzel Decorative', label: 'Cinzel Decorative', fontFamily: "'Cinzel Decorative', Georgia, serif", value: "'Cinzel Decorative', Georgia, serif", category: 'Display', style: 'Display', googleFont: 'Cinzel+Decorative:wght@400;700' },

  // ── 4. Script (8 fonts) ──
  { id: 'corinthia', name: 'Corinthia', label: 'Corinthia', fontFamily: "'Corinthia', cursive, 'Cormorant Garamond', serif", value: "'Corinthia', cursive, 'Cormorant Garamond', serif", category: 'Script', style: 'Script', googleFont: 'Corinthia:wght@400;700' },
  { id: 'greatvibes', name: 'Great Vibes', label: 'Great Vibes', fontFamily: "'Great Vibes', cursive, 'Brush Script MT', serif", value: "'Great Vibes', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Great+Vibes' },
  { id: 'alexbrush', name: 'Alex Brush', label: 'Alex Brush', fontFamily: "'Alex Brush', cursive, 'Brush Script MT', serif", value: "'Alex Brush', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Alex+Brush' },
  { id: 'allura', name: 'Allura', label: 'Allura', fontFamily: "'Allura', cursive, 'Brush Script MT', serif", value: "'Allura', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Allura' },
  { id: 'pinyonscript', name: 'Pinyon Script', label: 'Pinyon Script', fontFamily: "'Pinyon Script', cursive, 'Brush Script MT', serif", value: "'Pinyon Script', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Pinyon+Script' },
  { id: 'parisienne', name: 'Parisienne', label: 'Parisienne', fontFamily: "'Parisienne', cursive, 'Brush Script MT', serif", value: "'Parisienne', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Parisienne' },
  { id: 'monsieurladoulaise', name: 'Monsieur La Doulaise', label: 'Monsieur La Doulaise', fontFamily: "'Monsieur La Doulaise', cursive, 'Brush Script MT', serif", value: "'Monsieur La Doulaise', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Monsieur+La+Doulaise' },
  { id: 'meaculpa', name: 'Mea Culpa', label: 'Mea Culpa', fontFamily: "'Mea Culpa', cursive, 'Brush Script MT', serif", value: "'Mea Culpa', cursive, 'Brush Script MT', serif", category: 'Script', style: 'Script', googleFont: 'Mea+Culpa' },

  // ── 5. System Default (5 fonts) ──
  { id: 'system', name: 'System Default', label: 'System Default', fontFamily: 'inherit', value: 'inherit', category: 'System', style: 'He thong' },
  { id: 'arial', name: 'Arial', label: 'Arial', fontFamily: 'Arial, Helvetica, sans-serif', value: 'Arial, Helvetica, sans-serif', category: 'System', style: 'He thong' },
  { id: 'georgia', name: 'Georgia', label: 'Georgia', fontFamily: 'Georgia, serif', value: 'Georgia, serif', category: 'System', style: 'He thong' },
  { id: 'times', name: 'Times New Roman', label: 'Times New Roman', fontFamily: "'Times New Roman', Times, serif", value: "'Times New Roman', Times, serif", category: 'System', style: 'He thong' },
  { id: 'segoe', name: 'Segoe UI', label: 'Segoe UI', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", value: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", category: 'System', style: 'He thong' },
];

export const FONT_GROUPS: FontGroup[] = [
  {
    name: 'Sans-serif',
    category: 'Sans-Serif',
    fonts: AVAILABLE_FONTS.filter((f) => f.category === 'Sans-Serif'),
  },
  {
    name: 'Serif',
    category: 'Serif',
    fonts: AVAILABLE_FONTS.filter((f) => f.category === 'Serif'),
  },
  {
    name: 'Display',
    category: 'Display',
    fonts: AVAILABLE_FONTS.filter((f) => f.category === 'Display'),
  },
  {
    name: 'Script',
    category: 'Script',
    fonts: AVAILABLE_FONTS.filter((f) => f.category === 'Script'),
  },
  {
    name: 'Hệ thống (System)',
    category: 'System',
    fonts: AVAILABLE_FONTS.filter((f) => f.category === 'System'),
  },
];

const loadedGoogleFonts = new Set<string>();

/**
 * Tải font Google theo yêu cầu (on-demand lazy loading).
 * Tránh tải hàng loạt 50+ font cùng lúc, chỉ tải khi font được chọn hoặc hiển thị.
 */
export function ensureGoogleFontLoaded(fontFamilyOrName?: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined' || !fontFamilyOrName) return;
  const target = fontFamilyOrName.trim();
  if (!target || target === 'inherit') return;

  const font = AVAILABLE_FONTS.find((f) => {
    if (f.fontFamily === target || f.id === target) return true;
    const cleanTarget = target.toLowerCase();
    const cleanFontName = f.name.toLowerCase();
    return cleanTarget.includes(cleanFontName);
  });

  if (!font || !font.googleFont) return;
  if (loadedGoogleFonts.has(font.id)) return;
  loadedGoogleFonts.add(font.id);

  const linkId = `google-font-${font.id}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFont}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Quét danh sách sections và chỉ tải những Google Fonts đang thực sự được dùng.
 */
export function ensureFontsLoadedForSections(sections?: any[]): void {
  if (!sections || !Array.isArray(sections)) return;
  for (const s of sections) {
    if (s?.typography) {
      for (const k of Object.keys(s.typography)) {
        const item = s.typography[k];
        if (item?.fontFamily) {
          ensureGoogleFontLoaded(item.fontFamily);
        }
      }
    }
    if (s?.media?.carouselSlides && Array.isArray(s.media.carouselSlides)) {
      for (const slide of s.media.carouselSlides) {
        if (slide?.typography) {
          if (slide.typography.title?.fontFamily) ensureGoogleFontLoaded(slide.typography.title.fontFamily);
          if (slide.typography.description?.fontFamily) ensureGoogleFontLoaded(slide.typography.description.fontFamily);
        }
      }
    }
  }
}

// ─────────────────── Typography Presets ───────────────────
export const TYPOGRAPHY_PRESETS: TypographyPresetOption[] = [
  {
    id: 'minimal', value: 'minimal', name: 'Toi Gian Hien Dai (Minimal)', label: 'Minimal',
    badge: 'Toi gian, hien dai', description: 'Tối giản, hiện đại', previewFont: `'Inter', sans-serif`,
    typography: {
      preset: 'minimal',
      eyebrow: { fontFamily: `'Inter', sans-serif`, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' },
      heading: { fontFamily: `'Inter', sans-serif`, fontSize: 36, fontWeight: 600, lineHeight: 1.25, letterSpacing: -0.5 },
      subheading: { fontFamily: `'Inter', sans-serif`, fontSize: 18, fontWeight: 400, lineHeight: 1.5 },
      body: { fontFamily: `'Inter', sans-serif`, fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
      button: { fontFamily: `'Inter', sans-serif`, fontSize: 14, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' },
      quote: { fontFamily: `'Inter', sans-serif`, fontSize: 22, fontWeight: 300, lineHeight: 1.6 },
      author: { fontFamily: `'Inter', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase' },
      tagline1: { fontFamily: `'Inter', sans-serif`, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' },
      tagline2: { fontFamily: `'Inter', sans-serif`, fontSize: 12, fontWeight: 400, letterSpacing: 1 },
      viewAllText: { fontFamily: `'Inter', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 0.5 },
    },
  },
  {
    id: 'editorial', value: 'editorial', name: 'Tap Chi Thoi Trang (Editorial)', label: 'Editorial',
    badge: 'Phong cach tap chi thoi trang', description: 'Phong cách tạp chí thời trang', previewFont: `'Cormorant Garamond', Georgia, serif`,
    typography: {
      preset: 'editorial',
      eyebrow: { fontFamily: `'Inter', sans-serif`, fontSize: 11, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase' },
      heading: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 44, fontWeight: 500, lineHeight: 1.15, letterSpacing: 0.5 },
      subheading: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 22, fontWeight: 400, lineHeight: 1.4 },
      body: { fontFamily: `'Inter', sans-serif`, fontSize: 15, fontWeight: 300, lineHeight: 1.7 },
      button: { fontFamily: `'Inter', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' },
      quote: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 28, fontWeight: 400, lineHeight: 1.5 },
      author: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 14, fontWeight: 400, letterSpacing: 0.5 },
      tagline1: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 20, fontWeight: 400, lineHeight: 1.4 },
      tagline2: { fontFamily: `'Inter', sans-serif`, fontSize: 11, fontWeight: 400, letterSpacing: 2, textTransform: 'uppercase' },
      viewAllText: { fontFamily: `'Inter', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase' },
    },
  },
  {
    id: 'classic', value: 'classic', name: 'Co Dien Thanh Lich (Classic)', label: 'Classic',
    badge: 'Co dien, thanh lich', description: 'Cổ điển, thanh lịch', previewFont: `'Playfair Display', Georgia, serif`,
    typography: {
      preset: 'classic',
      eyebrow: { fontFamily: `'Montserrat', sans-serif`, fontSize: 11, fontWeight: 500, letterSpacing: 3.5, textTransform: 'uppercase' },
      heading: { fontFamily: `'Playfair Display', Georgia, serif`, fontSize: 48, fontWeight: 400, lineHeight: 1.15, letterSpacing: 1 },
      subheading: { fontFamily: `'Lora', Georgia, serif`, fontSize: 20, fontWeight: 400, lineHeight: 1.45 },
      body: { fontFamily: `'Lora', Georgia, serif`, fontSize: 16, fontWeight: 400, lineHeight: 1.75 },
      button: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase' },
      quote: { fontFamily: `'Playfair Display', Georgia, serif`, fontSize: 26, fontWeight: 400, lineHeight: 1.6 },
      author: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' },
      tagline1: { fontFamily: `'Playfair Display', Georgia, serif`, fontSize: 18, fontWeight: 400, lineHeight: 1.5 },
      tagline2: { fontFamily: `'Montserrat', sans-serif`, fontSize: 11, fontWeight: 400, letterSpacing: 2 },
      viewAllText: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' },
    },
  },
  {
    id: 'romantic', value: 'romantic', name: 'Lang Man Mem Mai (Romantic)', label: 'Romantic',
    badge: 'Lang man, mem mai', description: 'Lãng mạn, mềm mại', previewFont: `'Playfair Display', Georgia, serif`,
    typography: {
      preset: 'romantic',
      eyebrow: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' },
      heading: { fontFamily: `'Playfair Display', Georgia, serif`, fontSize: 42, fontWeight: 400, lineHeight: 1.2, letterSpacing: 0.5 },
      subheading: { fontFamily: `'Lora', Georgia, serif`, fontSize: 18, fontWeight: 400, lineHeight: 1.5 },
      body: { fontFamily: `'Inter', sans-serif`, fontSize: 15, fontWeight: 300, lineHeight: 1.7 },
      button: { fontFamily: `'Montserrat', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase' },
      quote: { fontFamily: `'Corinthia', cursive, 'Cormorant Garamond', serif`, fontSize: 34, fontWeight: 400, lineHeight: 1.4 },
      author: { fontFamily: `'Lora', Georgia, serif`, fontSize: 13, fontWeight: 400, letterSpacing: 0.5 },
      tagline1: { fontFamily: `'Corinthia', cursive, 'Cormorant Garamond', serif`, fontSize: 22, fontWeight: 400, lineHeight: 1.5 },
      tagline2: { fontFamily: `'Montserrat', sans-serif`, fontSize: 11, fontWeight: 400, letterSpacing: 2 },
      viewAllText: { fontFamily: `'Montserrat', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 1.5 },
    },
  },
  {
    id: 'modern', value: 'modern', name: 'Hien Dai Ro Net (Modern)', label: 'Modern',
    badge: 'Hien dai, ro net', description: 'Hiện đại, rõ nét', previewFont: `'Montserrat', sans-serif`,
    typography: {
      preset: 'modern',
      eyebrow: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase' },
      heading: { fontFamily: `'Montserrat', sans-serif`, fontSize: 38, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.5 },
      subheading: { fontFamily: `'Roboto', sans-serif`, fontSize: 18, fontWeight: 500, lineHeight: 1.4 },
      body: { fontFamily: `'Roboto', sans-serif`, fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
      button: { fontFamily: `'Montserrat', sans-serif`, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' },
      quote: { fontFamily: `'Montserrat', sans-serif`, fontSize: 22, fontWeight: 500, lineHeight: 1.6 },
      author: { fontFamily: `'Roboto', sans-serif`, fontSize: 13, fontWeight: 500, letterSpacing: 0.5 },
      tagline1: { fontFamily: `'Montserrat', sans-serif`, fontSize: 14, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' },
      tagline2: { fontFamily: `'Roboto', sans-serif`, fontSize: 12, fontWeight: 400, letterSpacing: 1 },
      viewAllText: { fontFamily: `'Montserrat', sans-serif`, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase' },
    },
  },
  {
    id: 'luxury', value: 'luxury', name: 'Sang Trong Tinh Te (Luxury)', label: 'Luxury',
    badge: 'Sang trong, dang cap', description: 'Sang trọng, đẳng cấp', previewFont: `'Playfair Display', Georgia, serif`,
    typography: {
      preset: 'luxury',
      eyebrow: { fontFamily: `'Montserrat', sans-serif`, fontSize: 11, fontWeight: 500, letterSpacing: 4, textTransform: 'uppercase' },
      heading: { fontFamily: `'Playfair Display', Georgia, serif`, fontSize: 52, fontWeight: 400, lineHeight: 1.1, letterSpacing: 1 },
      subheading: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 24, fontWeight: 300, lineHeight: 1.5 },
      body: { fontFamily: `'Lora', Georgia, serif`, fontSize: 16, fontWeight: 400, lineHeight: 1.8 },
      button: { fontFamily: `'Montserrat', sans-serif`, fontSize: 12, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' },
      quote: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 32, fontWeight: 300, lineHeight: 1.6, letterSpacing: 0.5 },
      author: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 16, fontWeight: 400, letterSpacing: 1 },
      tagline1: { fontFamily: `'Cormorant Garamond', Georgia, serif`, fontSize: 24, fontWeight: 300, lineHeight: 1.5 },
      tagline2: { fontFamily: `'Montserrat', sans-serif`, fontSize: 10, fontWeight: 400, letterSpacing: 4, textTransform: 'uppercase' },
      viewAllText: { fontFamily: `'Montserrat', sans-serif`, fontSize: 11, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase' },
    },
  },
];

// ─────────────────── Default Colors ───────────────────
export function getDefaultColorsForType(type: string): SectionColors {
  switch (type) {
    case 'hero': case 'banner':
      return { backgroundColor: '#1A1A1A', titleColor: '#FFFFFF', subtitleColor: '#FAF8F5', bodyColor: '#E5E7EB', buttonTextColor: '#FFFFFF', buttonBackgroundColor: '#74070E', buttonHoverTextColor: '#FFFFFF', buttonHoverBackgroundColor: '#59050B' };
    case 'editorial':
      return { backgroundColor: '#FAF8F5', titleColor: '#1A1A1A', subtitleColor: '#74070E', bodyColor: '#333333', quoteColor: '#74070E', buttonTextColor: '#FFFFFF', buttonBackgroundColor: '#74070E', buttonHoverTextColor: '#FFFFFF', buttonHoverBackgroundColor: '#59050B', tagline1Color: '#74070E', tagline2Color: '#6B7280', authorColor: '#1A1A1A' };
    case 'quote':
      return { backgroundColor: '#FFFFFF', quoteColor: '#1A1A1A', subtitleColor: '#74070E', authorColor: '#6B7280' };
    case 'cta':
      return { backgroundColor: '#FAF4EF', titleColor: '#1A1A1A', bodyColor: '#555555', buttonTextColor: '#FFFFFF', buttonBackgroundColor: '#74070E', buttonHoverTextColor: '#FFFFFF', buttonHoverBackgroundColor: '#59050B' };
    case 'product-slider': case 'product-grid':
      return { backgroundColor: '#FAF8F5', titleColor: '#1A1A1A', buttonTextColor: '#74070E', buttonBackgroundColor: 'transparent', buttonHoverTextColor: '#59050B', buttonHoverBackgroundColor: '#FDF2F3', viewAllColor: '#74070E' };
    case 'spacer': return { backgroundColor: 'transparent' };
    default:
      return { backgroundColor: '#FFFFFF', titleColor: '#1A1A1A', subtitleColor: '#74070E', bodyColor: '#333333', buttonTextColor: '#FFFFFF', buttonBackgroundColor: '#74070E', buttonHoverTextColor: '#FFFFFF', buttonHoverBackgroundColor: '#59050B' };
  }
}

// ─────────────────── Default Typography ───────────────────
export function getDefaultTypographyForType(type: string): SectionTypography {
  const PF = `'Playfair Display', Georgia, serif`;
  const CG = `'Cormorant Garamond', Garamond, serif`;
  const MT = `'Montserrat', sans-serif`;
  const LR = `'Lora', Georgia, serif`;
  const IT = `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
  switch (type) {
    case 'hero': return { preset: 'luxury', heading: { fontFamily: PF, fontSize: 40, fontWeight: 600, lineHeight: 1.25, letterSpacing: 0.5, textTransform: 'none', textAlign: 'center' }, eyebrow: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', textAlign: 'center' }, body: { fontFamily: IT, fontSize: 16, fontWeight: 400, lineHeight: 1.6, textTransform: 'none', textAlign: 'center' }, button: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' } };
    case 'editorial': return { preset: 'editorial', heading: { fontFamily: PF, fontSize: 34, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'none', textAlign: 'left' }, quote: { fontFamily: CG, fontSize: 20, fontWeight: 400, lineHeight: 1.7, textTransform: 'none', textAlign: 'left' }, eyebrow: { fontFamily: MT, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'left' }, button: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left' } };
    case 'banner': return { preset: 'luxury', heading: { fontFamily: PF, fontSize: 32, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'none', textAlign: 'center' }, eyebrow: { fontFamily: MT, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' }, body: { fontFamily: IT, fontSize: 15, fontWeight: 400, lineHeight: 1.6, textTransform: 'none', textAlign: 'center' }, button: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' } };
    case 'image-text': return { preset: 'editorial', heading: { fontFamily: PF, fontSize: 30, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'none', textAlign: 'left' }, eyebrow: { fontFamily: MT, fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'left' }, body: { fontFamily: IT, fontSize: 15, fontWeight: 400, lineHeight: 1.6, textTransform: 'none', textAlign: 'left' }, button: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'left' } };
    case 'quote': return { preset: 'editorial', quote: { fontFamily: CG, fontSize: 26, fontWeight: 400, lineHeight: 1.8, letterSpacing: 0.5, textTransform: 'none', textAlign: 'center' }, subheading: { fontFamily: MT, fontSize: 13, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' }, author: { fontFamily: MT, fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' } };
    case 'cta': return { preset: 'luxury', heading: { fontFamily: PF, fontSize: 28, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'none', textAlign: 'center' }, body: { fontFamily: IT, fontSize: 15, fontWeight: 400, lineHeight: 1.6, textTransform: 'none', textAlign: 'center' }, button: { fontFamily: MT, fontSize: 14, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', textAlign: 'center' } };
    case 'product-slider': case 'product-grid': return { preset: 'luxury', heading: { fontFamily: PF, fontSize: 26, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5, textTransform: 'none', textAlign: 'left' }, button: { fontFamily: IT, fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.5, textTransform: 'none', textAlign: 'right' }, viewAllText: { fontFamily: IT, fontSize: 14, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.5, textTransform: 'none', textAlign: 'right' } };
    default: return {};
  }
}

// ─────────────────── Section Type Options ───────────────────
export const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  { type: 'hero', category: 'CONTENT', name: 'Hero Banner', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>` },
  { type: 'banner', category: 'CONTENT', name: 'Banner Quang Ba', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>` },
  { type: 'image-text', category: 'CONTENT', name: 'Hinh anh + Chu', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="18" rx="1"/><line x1="14" y1="6" x2="21" y2="6"/><line x1="14" y1="10" x2="19" y2="10"/><line x1="14" y1="14" x2="21" y2="14"/></svg>` },
  { type: 'quote', category: 'CONTENT', name: 'Trich Dan / Thong Diep', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/></svg>` },
  { type: 'cta', category: 'CONTENT', name: 'Keu Goi Hanh Dong (CTA)', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>` },
  { type: 'product-slider', category: 'PRODUCT', name: 'Slider San Pham', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="4" width="6" height="16" rx="1"/><rect x="16" y="4" width="6" height="16" rx="1"/></svg>` },
  { type: 'product-grid', category: 'PRODUCT', name: 'Luoi San Pham', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>` },
  { type: 'editorial', category: 'EDITORIAL', name: 'Editorial', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` },
  { type: 'spacer', category: 'LAYOUT', name: 'Khoang Trong / Phan Cach', iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>` },
];

export const ABOUT_SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  {
    type: 'editorial',
    category: 'CONTENT',
    name: 'Editorial',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,

  },
  {
    type: 'image-text',
    category: 'CONTENT',
    name: 'Hình ảnh và nội dung',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="18" rx="1"/><line x1="14" y1="6" x2="21" y2="6"/><line x1="14" y1="10" x2="19" y2="10"/><line x1="14" y1="14" x2="21" y2="14"/></svg>`,

  },
  {
    type: 'quote',
    category: 'CONTENT',
    name: 'Trích Dẫn',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/></svg>`
  },
  {
    type: 'cta',
    category: 'CONTENT',
    name: 'Kêu Gọi Hành Động (CTA)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`
  },
  {
    type: 'spacer',
    category: 'LAYOUT',
    name: 'Khoảng Cách Bố Cục',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
  },
];

// ─────────────────── Initial Sections ───────────────────
export const INITIAL_HOME_SECTIONS: HomeSection[] = [
  {
    id: 'sec-hero-1', name: 'Hero Banner', type: 'hero', category: 'CONTENT', enabled: true, order: 1,
    content: { eyebrow: 'Atelier Cheri', title: 'Cheri Grand Campaign', description: 'Bo suu tap mang ve dep thanh lich vuot thoi gian.', buttonText: 'Kham pha ngay', buttonLink: '/vi/product/all' },
    media: {
      desktop: { url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg', alt: 'Cheri Grand Campaign' }, mobile: { url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg', alt: 'Cheri Grand Campaign Mobile' }, overlayOpacity: 25, carouselSlides: [
        { id: 'slide-1', url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg', mobileUrl: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg', alt: 'Cheri Grand Campaign', title: 'Cheri Grand Campaign', description: 'Bo suu tap mang ve dep thanh lich.', linkUrl: '/vi/product/all', enabled: true },
        { id: 'slide-2', url: 'https://static.wixstatic.com/media/911b80_7aa6c2e5dddb4114af8decd9a14090d8~mv2.webp', mobileUrl: 'https://static.wixstatic.com/media/911b80_7aa6c2e5dddb4114af8decd9a14090d8~mv2.webp', alt: 'Haute Couture Paris', title: 'Haute Couture Collection', description: 'Dinh cao may do thu cong tinh xao.', linkUrl: '/vi/product/all', enabled: true },
        { id: 'slide-3', url: 'https://static.wixstatic.com/media/911b80_ea026219bac741dd83918fc6e2c718a9~mv2.webp', mobileUrl: 'https://static.wixstatic.com/media/911b80_ea026219bac741dd83918fc6e2c718a9~mv2.webp', alt: 'Dac Quyen Thanh Vien', title: 'Dac Quyen Thanh Vien Cheri', description: 'Qua tang doc quyen cho don hang dau tien.', linkUrl: '/vi/product/all', enabled: true },
      ]
    },
    layout: { variant: 'centered', alignment: 'center', contentPosition: 'middle', fullWidth: true, minHeight: '520px', carouselConfig: getDefaultCarouselConfig() },
    motionPreset: 'editorial', animation: { preset: 'fade-up', trigger: 'viewport', direction: 'up', duration: 800, delay: 100, intensity: 'normal', once: true },
    typography: getDefaultTypographyForType('hero'), colors: getDefaultColorsForType('hero'),
    settings: { overlay: true, bgColor: '#1a1a1a', textColor: '#ffffff' },
  },
  {
    id: 'sec-product-slider-2', name: 'San pham tieu bieu', type: 'product-slider', category: 'PRODUCT', enabled: true, order: 2,
    content: { title: 'San pham tieu bieu', viewAllText: 'Xem Toan Bo Cua Hang', viewAllLink: '/vi/product/all' },
    media: {}, layout: { variant: 'slider', fullWidth: false }, motionPreset: 'normal',
    animation: { preset: 'fade', trigger: 'viewport', duration: 600, delay: 0, intensity: 'normal' },
    typography: getDefaultTypographyForType('product-slider'), colors: getDefaultColorsForType('product-slider'),
    settings: { source: 'featured', limit: 10, itemsPerView: 4 },
  },
  {
    id: 'sec-editorial-3', name: 'Nang tho cua rieng ban', type: 'editorial', category: 'EDITORIAL', enabled: true, order: 3,
    content: { title: 'Nang tho cua rieng ban', quote: 'Khong chay theo xu huong nhat thoi. Chung toi tao nen nhung thiet ke mang ve dep vuot thoi gian.', tagline1: 'Atelier Cheri', tagline2: 'Timeless', buttonText: 'Kham pha cau chuyen', buttonLink: '/vi/product/all' },
    media: { desktop: { url: 'https://static.wixstatic.com/media/911b80_c2c4f8245cbc4a1e80c6e871af920c1d~mv2.png', alt: 'Nang tho Cheri' }, mobile: { url: 'https://static.wixstatic.com/media/911b80_c2c4f8245cbc4a1e80c6e871af920c1d~mv2.png', alt: 'Nang tho Cheri Mobile' } },
    layout: { variant: 'image-left', imageWidth: 50, contentWidth: 50, alignment: 'center' }, motionPreset: 'editorial',
    animation: { preset: 'split-reveal', trigger: 'viewport', duration: 850, delay: 150, intensity: 'normal' },
    typography: getDefaultTypographyForType('editorial'), colors: getDefaultColorsForType('editorial'),
    settings: { enableGlow: true },
  },
];

export const INITIAL_ABOUT_SECTIONS: AboutSection[] = [
  {
    id: 'about-intro', name: 'Giới thiệu Thương hiệu Chéri', type: 'editorial', category: 'CONTENT', enabled: true, order: 1,
    content: { title: '', quote: '', tagline1: '', tagline2: '', description: '', buttonText: '', buttonLink: '' },
    media: { desktop: null, mobile: null, overlayOpacity: 0 },
    layout: { variant: 'image-left', imageWidth: 50, contentWidth: 50, alignment: 'center' }, motionPreset: 'editorial',
    animation: { preset: 'split-reveal', duration: 850, delay: 100, intensity: 'normal', once: true },
    typography: getDefaultTypographyForType('editorial'), colors: getDefaultColorsForType('editorial'),
    settings: { enableGlow: false },
  },
  {
    id: 'about-philosophy', name: 'Triết lý Thiết kế', type: 'image-text', category: 'CONTENT', enabled: true, order: 2,
    content: { eyebrow: '', title: '', description: '', buttonText: '', buttonLink: '' },
    media: { desktop: null, mobile: null },
    layout: { variant: 'image-right', imageWidth: 50, contentWidth: 50 }, motionPreset: 'subtle',
    animation: { preset: 'slide-right', duration: 750 },
    typography: getDefaultTypographyForType('image-text'), colors: getDefaultColorsForType('image-text'),
    settings: {},
  },
  {
    id: 'about-quote', name: 'Thông Điệp Tác Giả', type: 'quote', category: 'CONTENT', enabled: true, order: 3,
    content: { quote: '', author: '' },
    media: {}, layout: { variant: 'centered' }, motionPreset: 'minimal',
    animation: { preset: 'fade', duration: 700 },
    typography: getDefaultTypographyForType('quote'), colors: getDefaultColorsForType('quote'),
    settings: {},
  },
];

// ─────────────────── Section Factory ───────────────────
export function createDefaultSection(type: HomeSectionType, order: number): HomeSection {
  const id = `sec-${type}-${Date.now().toString(36)}`;
  const defaultTypography = getDefaultTypographyForType(type);
  const defaultColors = getDefaultColorsForType(type);
  let base: any;
  switch (type) {
    case 'hero': base = { id, name: 'Hero Banner Moi', type, category: 'CONTENT', enabled: true, order, content: { eyebrow: '', title: '', description: '', buttonText: '', buttonLink: '' }, media: { desktop: null, mobile: null, carouselSlides: [] }, layout: { variant: 'centered', alignment: 'center', contentPosition: 'middle', fullWidth: true, minHeight: '480px', carouselConfig: getDefaultCarouselConfig() }, motionPreset: 'editorial', animation: { preset: 'fade-up', duration: 800, delay: 0 }, typography: defaultTypography, settings: { overlay: true } }; break;
    case 'product-slider': base = { id, name: 'Slider San Pham Moi', type, category: 'PRODUCT', enabled: true, order, content: { title: '', viewAllText: '', viewAllLink: '' }, media: {}, layout: { variant: 'slider', fullWidth: false }, motionPreset: 'normal', animation: { preset: 'fade', duration: 600 }, typography: defaultTypography, settings: { source: 'featured', limit: 10, itemsPerView: 4 } }; break;
    case 'editorial': base = { id, name: 'Editorial Moi', type, category: 'EDITORIAL', enabled: true, order, content: { title: '', quote: '', tagline1: '', tagline2: '', buttonText: '', buttonLink: '' }, media: { desktop: null, mobile: null }, layout: { variant: 'image-left', imageWidth: 50, contentWidth: 50, alignment: 'center' }, motionPreset: 'editorial', animation: { preset: 'split-reveal', duration: 800 }, typography: defaultTypography, settings: { enableGlow: true } }; break;
    case 'banner': base = { id, name: 'Banner Moi', type, category: 'CONTENT', enabled: true, order, content: { eyebrow: '', title: '', description: '', buttonText: '', buttonLink: '' }, media: { desktop: null, mobile: null, carouselSlides: [] }, layout: { variant: 'centered', fullWidth: false, minHeight: '360px', carouselConfig: getDefaultCarouselConfig() }, motionPreset: 'luxury', animation: { preset: 'zoom-in', duration: 900 }, typography: defaultTypography, settings: { overlay: true } }; break;
    case 'image-text': base = { id, name: 'Hinh Anh & Cau Chuyen Moi', type, category: 'CONTENT', enabled: true, order, content: { eyebrow: '', title: '', description: '', buttonText: '', buttonLink: '' }, media: { desktop: null, mobile: null }, layout: { variant: 'image-right', imageWidth: 50, contentWidth: 50 }, motionPreset: 'subtle', animation: { preset: 'slide-right', duration: 750 }, typography: defaultTypography, settings: {} }; break;
    case 'quote': base = { id, name: 'Khoi Trich Dan Moi', type, category: 'CONTENT', enabled: true, order, content: { quote: '', author: '' }, media: {}, layout: { variant: 'centered' }, motionPreset: 'minimal', animation: { preset: 'fade', duration: 700 }, typography: defaultTypography, settings: {} }; break;
    case 'cta': base = { id, name: 'Khoi Keu Goi Hanh Dong Moi', type, category: 'CONTENT', enabled: true, order, content: { title: '', description: '', buttonText: '', buttonLink: '' }, media: {}, layout: { variant: 'centered' }, motionPreset: 'luxury', animation: { preset: 'fade-up', duration: 800 }, typography: defaultTypography, settings: {} }; break;
    case 'product-grid': base = { id, name: 'Luoi San Pham Moi', type, category: 'PRODUCT', enabled: true, order, content: { title: '', viewAllText: '', viewAllLink: '' }, media: {}, layout: { variant: 'grid-4', columns: 4 }, motionPreset: 'normal', animation: { preset: 'stagger', duration: 650 }, typography: defaultTypography, settings: { source: 'latest', limit: 8 } }; break;
    default: base = { id, name: 'Khoang Cach / Dem Phan Cach', type: 'spacer', category: 'LAYOUT', enabled: true, order, content: {}, media: {}, layout: { variant: 'default' }, animation: { preset: 'none' }, typography: defaultTypography, settings: { spacerHeight: 48 } };
  }
  base.colors = defaultColors;
  return base as HomeSection;
}

export function createDefaultAboutSection(type: AboutSectionType = 'editorial', order = 1): AboutSection {
  const randSuffix = Math.random().toString(36).substring(2, 7);
  const id = `sec-about-${type}-${Date.now().toString(36)}-${randSuffix}`;
  const defaultTypography = getDefaultTypographyForType(type);
  const defaultColors = getDefaultColorsForType(type);
  let base: any;

  switch (type) {
    case 'editorial':
      base = {
        id,
        name: `Câu Chuyện Thương Hiệu ${order}`,
        type,
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          eyebrow: '',
          title: '',
          quote: '',
          tagline1: '',
          tagline2: '',
          description: '',
          buttonText: '',
          buttonLink: '',
        },
        media: {
          desktop: null,
          mobile: null,
          overlayOpacity: 0,
          carouselSlides: [],
        },
        layout: { variant: 'image-left', imageWidth: 50, contentWidth: 50, alignment: 'center' },
        motionPreset: 'editorial',
        animation: { preset: 'split-reveal', duration: 850, delay: 100, intensity: 'normal', once: true },
        settings: { enableGlow: false },
      };
      break;

    case 'image-text':
      base = {
        id,
        name: `Hình Ảnh & Nội Dung ${order}`,
        type,
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          eyebrow: '',
          title: '',
          description: '',
          buttonText: '',
          buttonLink: '',
        },
        media: {
          desktop: null,
          mobile: null,
          overlayOpacity: 0,
          carouselSlides: [],
        },
        layout: { variant: 'image-right', imageWidth: 50, contentWidth: 50, alignment: 'center' },
        motionPreset: 'subtle',
        animation: { preset: 'slide-right', duration: 750, delay: 50, intensity: 'subtle', once: true },
        settings: {},
      };
      break;

    case 'quote':
      base = {
        id,
        name: `Trích Dẫn Nghệ Thuật ${order}`,
        type,
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          quote: '',
          author: '',
        },
        media: { desktop: null, mobile: null, carouselSlides: [] },
        layout: { variant: 'centered', alignment: 'center' },
        motionPreset: 'minimal',
        animation: { preset: 'fade', duration: 700, delay: 0, intensity: 'normal', once: true },
        settings: {},
      };
      break;

    case 'cta':
      base = {
        id,
        name: `Kêu Gọi Hành Động ${order}`,
        type,
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          title: '',
          description: '',
          buttonText: '',
          buttonLink: '',
        },
        media: { desktop: null, mobile: null, carouselSlides: [] },
        layout: { variant: 'centered', alignment: 'center' },
        motionPreset: 'luxury',
        animation: { preset: 'fade-up', duration: 800, delay: 100, intensity: 'normal', once: true },
        settings: {},
      };
      break;

    case 'spacer':
    default:
      base = {
        id,
        name: `Khoảng Cách Bố Cục ${order}`,
        type: 'spacer',
        category: 'LAYOUT',
        enabled: true,
        order,
        content: {},
        media: { desktop: null, mobile: null, carouselSlides: [] },
        layout: { variant: 'default' },
        motionPreset: 'minimal',
        animation: { preset: 'none', duration: 0, delay: 0 },
        settings: { spacerHeight: 48 },
      };
      break;
  }

  base.typography = defaultTypography;
  base.colors = defaultColors;
  return base as AboutSection;
}
