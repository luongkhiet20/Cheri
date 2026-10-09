import {
  HomeSection,
  SectionTypeOption,
  SectionType,
  FontOption,
  TypographyPresetType,
  SectionTypography,
  SectionColors,
  CarouselConfig,
  CarouselSlideItem,
} from './home-cms.models';

export interface ColorPreset {
  name: string;
  hex: string;
  label: string;
}

export const CHERI_COLOR_PRESETS: ColorPreset[] = [
  { name: 'Burgundy', hex: '#74070E', label: 'Đỏ Burgundy' },
  { name: 'Cherry Red', hex: '#990000', label: 'Đỏ Cherry' },
  { name: 'Deep Burgundy', hex: '#5B1018', label: 'Đỏ trầm' },
  { name: 'White', hex: '#FFFFFF', label: 'Trắng' },
  { name: 'Black', hex: '#111111', label: 'Đen' },
  { name: 'Dark Gray', hex: '#374151', label: 'Xám đậm' },
  { name: 'Neutral Gray', hex: '#6B7280', label: 'Xám trung tính' },
  { name: 'Light Gray', hex: '#E5E7EB', label: 'Xám nhạt' },
];

export function getDefaultColorsForType(type: SectionType): SectionColors {
  switch (type) {
    case 'hero':
    case 'banner':
      return {
        backgroundColor: '#1A1A1A',
        titleColor: '#FFFFFF',
        subtitleColor: '#FAF8F5',
        bodyColor: '#E5E7EB',
        buttonTextColor: '#FFFFFF',
        buttonBackgroundColor: '#74070E',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#59050B',
      };
    case 'editorial':
      return {
        backgroundColor: '#FAF8F5',
        titleColor: '#1A1A1A',
        subtitleColor: '#74070E',
        bodyColor: '#333333',
        quoteColor: '#74070E',
        buttonTextColor: '#FFFFFF',
        buttonBackgroundColor: '#74070E',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#59050B',
      };
    case 'quote':
      return {
        backgroundColor: '#FFFFFF',
        quoteColor: '#1A1A1A',
        subtitleColor: '#74070E',
      };
    case 'cta':
      return {
        backgroundColor: '#FAF4EF',
        titleColor: '#1A1A1A',
        bodyColor: '#555555',
        buttonTextColor: '#FFFFFF',
        buttonBackgroundColor: '#74070E',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#59050B',
      };
    case 'product-slider':
    case 'product-grid':
      return {
        backgroundColor: '#FAF8F5',
        titleColor: '#1A1A1A',
        buttonTextColor: '#74070E',
        buttonBackgroundColor: 'transparent',
        buttonHoverTextColor: '#59050B',
        buttonHoverBackgroundColor: '#FDF2F3',
      };
    case 'spacer':
      return {
        backgroundColor: 'transparent',
      };
    default:
      return {
        backgroundColor: '#FFFFFF',
        titleColor: '#1A1A1A',
        subtitleColor: '#74070E',
        bodyColor: '#333333',
        buttonTextColor: '#FFFFFF',
        buttonBackgroundColor: '#74070E',
        buttonHoverTextColor: '#FFFFFF',
        buttonHoverBackgroundColor: '#59050B',
      };
  }
}

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
    id: 'roboto',
    name: 'Roboto',
    fontFamily: "'Roboto', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'lato',
    name: 'Lato',
    fontFamily: "'Lato', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'opensans',
    name: 'Open Sans',
    fontFamily: "'Open Sans', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'corinthia',
    name: 'Corinthia',
    fontFamily: "'Corinthia', cursive, 'Cormorant Garamond', serif",
    category: 'Serif',
  },
  {
    id: 'arial',
    name: 'Arial',
    fontFamily: 'Arial, Helvetica, sans-serif',
    category: 'Sans-Serif',
  },
];

export const TYPOGRAPHY_PRESETS: {
  id: TypographyPresetType;
  value: TypographyPresetType;
  name: string;
  label: string;
  badge: string;
  description?: string;
  previewFont: string;
  typography: SectionTypography;
}[] = [
  {
    id: 'minimal',
    value: 'minimal',
    name: 'Tối Giản Hiện Đại (Minimal)',
    label: 'Minimal',
    badge: 'Tối giản, hiện đại',
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
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      },
      quote: {
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 26,
        fontWeight: 400,
        lineHeight: 1.6,
      },
    },
  },
  {
    id: 'romantic',
    value: 'romantic',
    name: 'Lãng Mạn Mềm Mại (Romantic)',
    label: 'Romantic',
    badge: 'Lãng mạn, mềm mại',
    previewFont: "'Playfair Display', Georgia, serif",
    typography: {
      preset: 'romantic',
      eyebrow: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: 3,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 42,
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: 0.5,
      },
      subheading: {
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 18,
        fontWeight: 400,
        lineHeight: 1.5,
      },
      body: {
        fontFamily: "'Inter', sans-serif",
        fontSize: 15,
        fontWeight: 300,
        lineHeight: 1.7,
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
        fontSize: 34,
        fontWeight: 400,
        lineHeight: 1.4,
      },
    },
  },
  {
    id: 'modern',
    value: 'modern',
    name: 'Hiện Đại Rõ Nét (Modern)',
    label: 'Modern',
    badge: 'Hiện đại, rõ nét',
    previewFont: "'Montserrat', sans-serif",
    typography: {
      preset: 'modern',
      eyebrow: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      },
      heading: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 38,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: -0.5,
      },
      subheading: {
        fontFamily: "'Roboto', sans-serif",
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1.4,
      },
      body: {
        fontFamily: "'Roboto', sans-serif",
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.6,
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
        fontSize: 22,
        fontWeight: 500,
        lineHeight: 1.6,
      },
    },
  },
];

export function getDefaultTypographyForType(type: SectionType): SectionTypography {
  switch (type) {
    case 'hero':
      return {
        preset: 'luxury',
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 40,
          fontWeight: 600,
          lineHeight: 1.25,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'center',
        },
        eyebrow: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
        body: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: 0,
          textTransform: 'none',
          textAlign: 'center',
        },
        button: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
      };

    case 'editorial':
      return {
        preset: 'editorial',
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 34,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'left',
        },
        quote: {
          fontFamily: "'Cormorant Garamond', Garamond, serif",
          fontSize: 20,
          fontWeight: 400,
          lineHeight: 1.7,
          letterSpacing: 0,
          textTransform: 'none',
          textAlign: 'left',
        },
        eyebrow: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textAlign: 'left',
        },
        button: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'left',
        },
      };

    case 'product-slider':
    case 'product-grid':
      return {
        preset: 'luxury',
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 26,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'left',
        },
        button: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 14,
          fontWeight: 500,
          lineHeight: 1.4,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'right',
        },
      };

    case 'banner':
      return {
        preset: 'luxury',
        eyebrow: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'center',
        },
        body: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: 0,
          textTransform: 'none',
          textAlign: 'center',
        },
        button: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
      };

    case 'image-text':
      return {
        preset: 'editorial',
        eyebrow: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textAlign: 'left',
        },
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 30,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'left',
        },
        body: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: 0,
          textTransform: 'none',
          textAlign: 'left',
        },
        button: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'left',
        },
      };

    case 'quote':
      return {
        preset: 'editorial',
        quote: {
          fontFamily: "'Cormorant Garamond', Garamond, serif",
          fontSize: 26,
          fontWeight: 400,
          lineHeight: 1.8,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'center',
        },
        subheading: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          letterSpacing: 2,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
      };

    case 'cta':
      return {
        preset: 'luxury',
        heading: {
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 28,
          fontWeight: 600,
          lineHeight: 1.3,
          letterSpacing: 0.5,
          textTransform: 'none',
          textAlign: 'center',
        },
        body: {
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.6,
          letterSpacing: 0,
          textTransform: 'none',
          textAlign: 'center',
        },
        button: {
          fontFamily: "'Montserrat', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          textAlign: 'center',
        },
      };

    case 'spacer':
    default:
      return {};
  }
}

export const INITIAL_HOME_SECTIONS: HomeSection[] = [
  {
    id: 'sec-hero-1',
    name: 'Hero Banner',
    type: 'hero',
    category: 'CONTENT',
    enabled: true,
    order: 1,
    content: {
      eyebrow: 'Atelier Chéri',
      title: 'Chéri Grand Campaign',
      description: 'Bộ sưu tập mang vẻ đẹp thanh lịch vượt thời gian.',
      buttonText: 'Khám phá ngay',
      buttonLink: '/vi/product/all',
    },
    media: {
      desktop: {
        url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg',
        alt: 'Chéri Grand Campaign',
      },
      mobile: {
        url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg',
        alt: 'Chéri Grand Campaign Mobile',
      },
      overlayOpacity: 25,
      carouselSlides: [
        {
          id: 'slide-1',
          url: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg',
          mobileUrl: 'https://static.wixstatic.com/media/911b80_56c8defb7ec14d90b9ebb021fa9c4a65~mv2.jpg',
          alt: 'Chéri Grand Campaign - BST Mới',
          title: 'Chéri Grand Campaign',
          description: 'Bộ sưu tập mang vẻ đẹp thanh lịch vượt thời gian.',
          linkUrl: '/vi/product/all',
          enabled: true,
        },
        {
          id: 'slide-2',
          url: 'https://static.wixstatic.com/media/911b80_7aa6c2e5dddb4114af8decd9a14090d8~mv2.webp',
          mobileUrl: 'https://static.wixstatic.com/media/911b80_7aa6c2e5dddb4114af8decd9a14090d8~mv2.webp',
          alt: 'Atelier Haute Couture Paris',
          title: 'Haute Couture Collection',
          description: 'Đỉnh cao may đo thủ công tinh xảo chuẩn phong cách Pháp.',
          linkUrl: '/vi/product/all',
          enabled: true,
        },
        {
          id: 'slide-3',
          url: 'https://static.wixstatic.com/media/911b80_ea026219bac741dd83918fc6e2c718a9~mv2.webp',
          mobileUrl: 'https://static.wixstatic.com/media/911b80_ea026219bac741dd83918fc6e2c718a9~mv2.webp',
          alt: 'Ưu Đãi Đặc Quyền Khách Hàng VIP',
          title: 'Đặc Quyền Thành Viên Chéri',
          description: 'Quà tặng độc quyền cho đơn hàng đầu tiên trong tháng.',
          linkUrl: '/vi/product/all',
          enabled: true,
        },
      ],
    },
    layout: {
      variant: 'centered',
      alignment: 'center',
      contentPosition: 'middle',
      fullWidth: true,
      minHeight: '520px',
      carouselConfig: getDefaultCarouselConfig(),
    },
    motionPreset: 'editorial',
    animation: {
      preset: 'fade-up',
      trigger: 'viewport',
      direction: 'up',
      duration: 800,
      delay: 100,
      intensity: 'normal',
      once: true,
    },
    typography: getDefaultTypographyForType('hero'),
    settings: {
      overlay: true,
      bgColor: '#1a1a1a',
      textColor: '#ffffff',
    },
  },
  {
    id: 'sec-product-slider-2',
    name: 'Sản phẩm tiêu biểu',
    type: 'product-slider',
    category: 'PRODUCT',
    enabled: true,
    order: 2,
    content: {
      title: 'Sản phẩm tiêu biểu',
      viewAllText: 'Xem Toàn Bộ Cửa Hàng',
      viewAllLink: '/vi/product/all',
    },
    media: {},
    layout: {
      variant: 'slider',
      fullWidth: false,
    },
    motionPreset: 'normal',
    animation: {
      preset: 'fade',
      trigger: 'viewport',
      duration: 600,
      delay: 0,
      intensity: 'normal',
    },
    typography: getDefaultTypographyForType('product-slider'),
    settings: {
      source: 'featured',
      limit: 10,
      itemsPerView: 4,
    },
  },
  {
    id: 'sec-editorial-3',
    name: 'Nàng thơ của riêng bạn',
    type: 'editorial',
    category: 'EDITORIAL',
    enabled: true,
    order: 3,
    content: {
      title: 'Nàng thơ của riêng bạn',
      quote: 'Không chạy theo xu hướng nhất thời. Chúng tôi tạo nên những thiết kế mang vẻ đẹp vượt thời gian.',
      tagline1: 'Atelier Chéri',
      tagline2: 'Timeless',
      buttonText: 'Khám phá câu chuyện',
      buttonLink: '/vi/product/all',
    },
    media: {
      desktop: {
        url: 'https://static.wixstatic.com/media/911b80_c2c4f8245cbc4a1e80c6e871af920c1d~mv2.png',
        alt: 'Nàng thơ Chéri',
      },
      mobile: {
        url: 'https://static.wixstatic.com/media/911b80_c2c4f8245cbc4a1e80c6e871af920c1d~mv2.png',
        alt: 'Nàng thơ Chéri Mobile',
      },
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
      trigger: 'viewport',
      duration: 850,
      delay: 150,
      intensity: 'normal',
    },
    typography: getDefaultTypographyForType('editorial'),
    settings: {
      enableGlow: true,
    },
  },
];

export const SECTION_TYPE_OPTIONS: SectionTypeOption[] = [
  // CONTENT
  {
    type: 'hero',
    category: 'CONTENT',
    name: 'Hero Banner',

    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>`,
  },
  {
    type: 'banner',
    category: 'CONTENT',
    name: 'Banner Quảng Bá',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>`,
  },
  {
    type: 'image-text',
    category: 'CONTENT',
    name: 'Hình ảnh + Chữ',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="8" height="18" rx="1"/><line x1="14" y1="6" x2="21" y2="6"/><line x1="14" y1="10" x2="19" y2="10"/><line x1="14" y1="14" x2="21" y2="14"/></svg>`,
  },
  {
    type: 'quote',
    category: 'CONTENT',
    name: 'Trích Dẫn / Thông Điệp',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2H4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.75-2-2-2h-4c-1.25 0-2 .75-2 2v6c0 7 1 8 1 8z"/></svg>`,
  },
  {
    type: 'cta',
    category: 'CONTENT',
    name: 'Kêu Gọi Hành Động (CTA)',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
  },

  // PRODUCT
  {
    type: 'product-slider',
    category: 'PRODUCT',
    name: 'Slider Sản Phẩm',

    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="4" width="6" height="16" rx="1"/><rect x="16" y="4" width="6" height="16" rx="1"/></svg>`,
  },
  {
    type: 'product-grid',
    category: 'PRODUCT',
    name: 'Lưới Sản Phẩm',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  },

  // EDITORIAL
  {
    type: 'editorial',
    category: 'EDITORIAL',
    name: 'Editorial Nàng Thơ',

    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  },

  // LAYOUT
  {
    type: 'spacer',
    category: 'LAYOUT',
    name: 'Khoảng Trống / Phân Cách',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  },
];

export function createDefaultSection(type: SectionType, order: number): HomeSection {
  const id = `sec-${type}-${Date.now().toString(36)}`;
  const defaultTypography = getDefaultTypographyForType(type);
  const defaultColors = getDefaultColorsForType(type);
  const baseSection: HomeSection = (() => {
    switch (type) {
    case 'hero':
      return {
        id,
        name: 'Hero Banner Mới',
        type: 'hero',
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
          carouselSlides: [],
        },
        layout: {
          variant: 'centered',
          alignment: 'center',
          contentPosition: 'middle',
          fullWidth: true,
          minHeight: '480px',
          carouselConfig: getDefaultCarouselConfig(),
        },
        motionPreset: 'editorial',
        animation: {
          preset: 'fade-up',
          duration: 800,
          delay: 0,
        },
        typography: defaultTypography,
        settings: {
          overlay: true,
        },
      };

    case 'product-slider':
      return {
        id,
        name: 'Slider Sản Phẩm Mới',
        type: 'product-slider',
        category: 'PRODUCT',
        enabled: true,
        order,
        content: {
          title: '',
          viewAllText: '',
          viewAllLink: '',
        },
        media: {},
        layout: {
          variant: 'slider',
          fullWidth: false,
        },
        motionPreset: 'normal',
        animation: {
          preset: 'fade',
          duration: 600,
        },
        typography: defaultTypography,
        settings: {
          source: 'featured',
          limit: 10,
          itemsPerView: 4,
        },
      };

    case 'editorial':
      return {
        id,
        name: 'Editorial Nàng Thơ Mới',
        type: 'editorial',
        category: 'EDITORIAL',
        enabled: true,
        order,
        content: {
          title: '',
          quote: '',
          tagline1: '',
          tagline2: '',
          buttonText: '',
          buttonLink: '',
        },
        media: {
          desktop: null,
          mobile: null,
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
        },
        typography: defaultTypography,
        settings: {
          enableGlow: true,
        },
      };

    case 'banner':
      return {
        id,
        name: 'Banner Quảng Bá Mới',
        type: 'banner',
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
          carouselSlides: [],
        },
        layout: {
          variant: 'centered',
          fullWidth: false,
          minHeight: '360px',
          carouselConfig: getDefaultCarouselConfig(),
        },
        motionPreset: 'luxury',
        animation: {
          preset: 'zoom-in',
          duration: 900,
        },
        typography: defaultTypography,
        settings: {
          overlay: true,
        },
      };

    case 'image-text':
      return {
        id,
        name: 'Hình Ảnh & Câu Chuyện Mới',
        type: 'image-text',
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
        typography: defaultTypography,
        settings: {},
      };

    case 'quote':
      return {
        id,
        name: 'Khối Trích Dẫn Mới',
        type: 'quote',
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          quote: '',
          author: '',
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
        typography: defaultTypography,
        settings: {},
      };

    case 'cta':
      return {
        id,
        name: 'Khối Kêu Gọi Hành Động Mới',
        type: 'cta',
        category: 'CONTENT',
        enabled: true,
        order,
        content: {
          title: '',
          description: '',
          buttonText: '',
          buttonLink: '',
        },
        media: {},
        layout: {
          variant: 'centered',
        },
        motionPreset: 'luxury',
        animation: {
          preset: 'fade-up',
          duration: 800,
        },
        typography: defaultTypography,
        settings: {},
      };

    case 'product-grid':
      return {
        id,
        name: 'Lưới Sản Phẩm Mới',
        type: 'product-grid',
        category: 'PRODUCT',
        enabled: true,
        order,
        content: {
          title: '',
          viewAllText: '',
          viewAllLink: '',
        },
        media: {},
        layout: {
          variant: 'grid-4',
          columns: 4,
        },
        motionPreset: 'normal',
        animation: {
          preset: 'stagger',
          duration: 650,
        },
        typography: defaultTypography,
        settings: {
          source: 'latest',
          limit: 8,
        },
      };

    case 'spacer':
    default:
      return {
        id,
        name: 'Khoảng Cách / Đệm Phân Cách',
        type: 'spacer',
        category: 'LAYOUT',
        enabled: true,
        order,
        content: {},
        media: {},
        layout: {
          variant: 'default',
        },
        animation: {
          preset: 'none',
        },
        typography: defaultTypography,
        settings: {
          spacerHeight: 48,
        },
      };
    }
  })();
  baseSection.colors = defaultColors;
  return baseSection;
}
