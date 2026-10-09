import {
  AboutSection,
  SectionTypeOption,
  AboutSectionType,
  FontOption,
  TypographyPresetType,
  SectionTypography,
  SectionColors,
  CarouselConfig,
} from './about-cms.models';

export function getDefaultCarouselConfig(): CarouselConfig {
  return {
    autoplay: true,
    autoplayInterval: 4,
    showDots: true,
    showArrows: true,
    loop: true,
  };
}

export const AVAILABLE_FONTS: FontOption[] = [
  {
    id: 'system',
    name: 'System Default',
    fontFamily: 'inherit',
    category: 'System',
  },
  {
    id: 'playfair',
    name: 'Playfair Display',
    fontFamily: "'Playfair Display', Georgia, serif",
    category: 'Serif',
  },
  {
    id: 'cormorant',
    name: 'Cormorant Garamond',
    fontFamily: "'Cormorant Garamond', Garamond, serif",
    category: 'Serif',
  },
  {
    id: 'lora',
    name: 'Lora',
    fontFamily: "'Lora', Georgia, serif",
    category: 'Serif',
  },
  {
    id: 'inter',
    name: 'Inter',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    fontFamily: "'Montserrat', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'corinthia',
    name: 'Corinthia',
    fontFamily: "'Corinthia', cursive, 'Cormorant Garamond', serif",
    category: 'Serif',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    fontFamily: "'Roboto', sans-serif",
    category: 'Sans-Serif',
  },
];

export const TYPOGRAPHY_PRESETS: {
  id: TypographyPresetType;
  value: TypographyPresetType;
  name: string;
  label: string;
  badge: string;
  description: string;
  previewFont: string;
  typography: SectionTypography;
}[] = [
  {
    id: 'minimal',
    value: 'minimal',
    name: 'Tối Giản Hiện Đại (Minimal)',
    label: 'Minimal',
    badge: 'Tối giản, hiện đại',
    description: 'Nét chữ Inter thanh mảnh, hiện đại, tối giản và dễ đọc',
    previewFont: "'Inter', sans-serif",
    typography: {
      preset: 'minimal',
      eyebrow: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 2,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 36,
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: -0.5,
      },
      subheading: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.6,
      },
      button: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: 1,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 22,
        fontWeight: 300,
        lineHeight: 1.6,
      },
    },
  },
  {
    id: 'editorial',
    value: 'editorial',
    name: 'Tạp Chí Thời Trang (Editorial)',
    label: 'Editorial',
    badge: 'Phong cách tạp chí thời trang',
    description: 'Tiêu đề Cormorant Garamond quý phái kết hợp chữ nội dung trang nhã',
    previewFont: "'Cormorant Garamond', Georgia, serif",
    typography: {
      preset: 'editorial',
      eyebrow: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 3,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 44,
        fontWeight: 500,
        lineHeight: 1.15,
        letterSpacing: 0.5,
      },
      subheading: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.4,
      },
      body: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 15,
        fontWeight: 300,
        lineHeight: 1.7,
      },
      button: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: 2,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 28,
        fontWeight: 400,
        lineHeight: 1.5,
      },
    },
  },
  {
    id: 'classic',
    value: 'classic',
    name: 'Cổ Điển Thanh Lịch (Classic)',
    label: 'Classic',
    badge: 'Cổ điển, thanh lịch',
    description: 'Chữ Playfair Display kiêu hãnh phối cùng Lora quý phái',
    previewFont: "'Playfair Display', Georgia, serif",
    typography: {
      preset: 'classic',
      eyebrow: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 3.5,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 48,
        fontWeight: 400,
        lineHeight: 1.15,
        letterSpacing: 1,
      },
      subheading: {
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1.45,
      },
      body: {
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.75,
      },
      button: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 30,
        fontWeight: 400,
        lineHeight: 1.4,
      },
    },
  },
  {
    id: 'romantic',
    value: 'romantic',
    name: 'Lãng Mạn Mềm Mại (Romantic)',
    label: 'Romantic',
    badge: 'Lãng mạn, mềm mại',
    description: 'Phong cách thơ mộng, nghệ thuật và nữ tính với Cormorant & Corinthia',
    previewFont: "'Corinthia', cursive, 'Cormorant Garamond', serif",
    typography: {
      preset: 'romantic',
      eyebrow: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: 3,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 46,
        fontWeight: 500,
        lineHeight: 1.2,
        letterSpacing: 0.5,
      },
      subheading: {
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body: {
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 15.5,
        fontWeight: 400,
        lineHeight: 1.75,
      },
      button: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: 2,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Corinthia', cursive, 'Cormorant Garamond', serif",
        fontSize: 36,
        fontWeight: 400,
        lineHeight: 1.35,
      },
    },
  },
  {
    id: 'modern',
    value: 'modern',
    name: 'Đương Đại Sắc Nét (Modern)',
    label: 'Modern',
    badge: 'Hiện đại, rõ nét',
    description: 'Font Montserrat khỏe khoắn, sắc sảo và hiện đại',
    previewFont: "'Montserrat', sans-serif",
    typography: {
      preset: 'modern',
      eyebrow: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 38,
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: -0.5,
      },
      subheading: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.65,
      },
      button: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 24,
        fontWeight: 500,
        lineHeight: 1.5,
      },
    },
  },
];

/**
 * Bảng màu preset chuẩn thương hiệu Chéri (8 màu nhận diện)
 */
export const CHERI_COLOR_PRESETS = [
  { name: 'Chéri Burgundy', hex: '#74070E', label: 'Đỏ Đô Chéri' },
  { name: 'Pure Red', hex: '#990000', label: 'Đỏ Tươi' },
  { name: 'Wine Red', hex: '#5B1018', label: 'Đỏ Rượu' },
  { name: 'Pure White', hex: '#FFFFFF', label: 'Trắng Tinh' },
  { name: 'Deep Black', hex: '#111111', label: 'Đen Huyền' },
  { name: 'Charcoal', hex: '#374151', label: 'Xám Than' },
  { name: 'Neutral Gray', hex: '#6B7280', label: 'Xám Tro' },
  { name: 'Soft Border', hex: '#E5E7EB', label: 'Xám Viền' },
];

/**
 * Cung cấp bảng màu mặc định thẩm mỹ theo từng loại section trong About
 */
export function getDefaultColorsForType(type: AboutSectionType): SectionColors {
  switch (type) {
    case 'quote':
      return {
        backgroundColor: '#FDF2F3',
        quoteColor: '#74070E',
        subtitleColor: '#6B7280',
      };
    case 'cta':
      return {
        backgroundColor: '#74070E',
        titleColor: '#FFFFFF',
        bodyColor: '#FDF2F3',
        buttonTextColor: '#74070E',
        buttonBackgroundColor: '#FFFFFF',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#1A1A1A',
      };
    case 'editorial':
    case 'image-text':
    case 'hero':
    case 'banner':
    default:
      return {
        backgroundColor: '#FFFFFF',
        titleColor: '#1A1A1A',
        subtitleColor: '#74070E',
        bodyColor: '#4A4A4A',
        quoteColor: '#74070E',
        buttonTextColor: '#FFFFFF',
        buttonBackgroundColor: '#74070E',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#5A050A',
      };
  }
}

export function getDefaultTypographyForType(type: AboutSectionType): SectionTypography {
  return JSON.parse(JSON.stringify(TYPOGRAPHY_PRESETS[1].typography));
}

/**
 * Danh sách lựa chọn khi thêm phân đoạn mới trong About CMS.
 * QUY TẮC BẮT BUỘC:
 * - CHỈ CÓ DUY NHẤT LỰA CHỌN "Phân Đoạn Mới".
 * - KHÔNG CÓ "Lưới sản phẩm" (Product Grid/Slider).
 * - KHÔNG CÓ "Thêm Phân Đoạn Mới" như một lựa chọn thứ hai.
 */
export const ABOUT_SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  {
    type: 'editorial',
    category: 'CONTENT',
    name: 'Phân Đoạn Mới',
    description: 'Tạo phân đoạn nội dung câu chuyện, hình ảnh và thông điệp thương hiệu',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    badge: 'Khuyên dùng',
  },
];

/**
 * Hàm khởi tạo phân đoạn mới sạch, không hardcode mẫu rác
 */
export function createDefaultAboutSection(type: AboutSectionType = 'editorial', order = 1): AboutSection {
  const id = `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const defaultTypography = getDefaultTypographyForType(type);
  const defaultColors = getDefaultColorsForType(type);

  return {
    id,
    name: `Phân Đoạn ${order}`,
    type: 'editorial',
    category: 'CONTENT',
    enabled: true,
    order,
    content: {
      eyebrow: '',
      title: '',
      description: '',
      quote: '',
      tagline1: '',
      tagline2: '',
      buttonText: '',
      buttonLink: '',
      author: '',
    },
    media: {
      desktop: null,
      mobile: null,
      overlayOpacity: 25,
      carouselSlides: [],
    },
    layout: {
      variant: 'image-left',
      imageWidth: 50,
      contentWidth: 50,
      alignment: 'center',
    },
    motionPreset: 'editorial',
    animation: {
      preset: 'split-reveal',
      duration: 800,
      delay: 100,
      intensity: 'subtle',
      once: true,
    },
    typography: defaultTypography,
    colors: defaultColors,
    settings: {
      enableGlow: true,
    },
  };
}

export const INITIAL_ABOUT_SECTIONS: AboutSection[] = [
  {
    id: 'about-intro',
    name: 'Giới thiệu Thương hiệu Chéri',
    type: 'editorial',
    category: 'CONTENT',
    enabled: true,
    order: 1,
    content: {
      title: 'Câu Chuyện Chéri',
      quote: 'Từng đường kim mũi chỉ là sự tôn vinh nét đẹp thanh lịch vượt thời gian.',
      tagline1: 'Atelier de Chéri',
      tagline2: 'Depuis 2024',
      buttonText: 'Khám phá bộ sưu tập',
      buttonLink: '/vi/product/all',
    },
    media: {
      desktop: {
        url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1600&auto=format&fit=crop',
        alt: 'Câu chuyện Chéri',
      },
      mobile: null,
      overlayOpacity: 20,
    },
    layout: {
      variant: 'image-left',
      imageWidth: 50,
      contentWidth: 50,
      alignment: 'center',
    },
    motionPreset: 'editorial',
    animation: {
      preset: 'split-reveal',
      duration: 850,
      delay: 100,
      intensity: 'normal',
      once: true,
    },
    typography: TYPOGRAPHY_PRESETS[1].typography,
    colors: getDefaultColorsForType('editorial'),
    settings: {
      enableGlow: true,
    },
  },
  {
    id: 'about-philosophy',
    name: 'Triết lý Thiết kế',
    type: 'image-text',
    category: 'CONTENT',
    enabled: true,
    order: 2,
    content: {
      eyebrow: 'Triết lý & Nghệ thuật',
      title: 'Sự Tinh Tế Trong Từng Chi Tiết',
      description: 'Chúng tôi tin rằng sự sang trọng thực sự nằm ở sự giản dị tinh tế, chất liệu cao cấp và sự thoải mái tuyệt đối cho người mặc.',
      buttonText: 'Tìm hiểu thêm',
      buttonLink: '/vi/product/all',
    },
    media: {
      desktop: {
        url: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=1600&auto=format&fit=crop',
        alt: 'Triết lý thiết kế',
      },
      mobile: null,
    },
    layout: {
      variant: 'image-right',
      imageWidth: 50,
      contentWidth: 50,
    },
    motionPreset: 'subtle',
    animation: {
      preset: 'slide-right',
      duration: 750,
    },
    typography: TYPOGRAPHY_PRESETS[1].typography,
    colors: getDefaultColorsForType('image-text'),
    settings: {},
  },
  {
    id: 'about-quote',
    name: 'Thông Điệp Tác Giả',
    type: 'quote',
    category: 'CONTENT',
    enabled: true,
    order: 3,
    content: {
      quote: 'Vẻ đẹp không nằm ở trang phục bạn mặc, mà ở phong thái và năng lượng bạn toát ra.',
      author: 'Chéri Creative Director',
    },
    media: {},
    layout: {
      variant: 'centered',
    },
    motionPreset: 'minimal',
    animation: {
      preset: 'fade',
      duration: 700,
    },
    typography: TYPOGRAPHY_PRESETS[1].typography,
    colors: getDefaultColorsForType('quote'),
    settings: {},
  },
];
