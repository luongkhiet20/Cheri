/**
 * cms-section.registry.ts
 * Data-driven: thay 3 khối `switch(section.type)` (getAvailableTypographyElements,
 * getAvailableContentFields, getAvailableColorProperties) + hàng chục *ngIf lặp lại
 * bằng 1 bảng cấu hình duy nhất. Thêm loại section mới = thêm 1 dòng ở đây.
 */
import { ColorKey, SectionCategory, SectionContent, TypographyElementKey } from './cms.models';

export type ContentFieldKey = keyof Pick<SectionContent,
  'eyebrow' | 'title' | 'description' | 'quote' | 'author' | 'tagline1' | 'tagline2' |
  'buttonText' | 'secondaryButtonText' | 'viewAllText'>;

export interface ContentFieldDef {
  key: ContentFieldKey;
  label: string;
  icon: string;
  description: string;
  typoKey: TypographyElementKey;
  colorKey: ColorKey;
  multiline?: boolean;
  linkKey?: keyof SectionContent;       // field link đi kèm (nút)
}

/** Danh mục field duy nhất — dùng cho cả typography, color, form nội dung. */
export const CONTENT_FIELDS: Record<ContentFieldKey, ContentFieldDef> = {
  eyebrow:  { key: 'eyebrow', label: 'Dòng mở đầu (Eyebrow)', icon: 'e', description: 'Nhãn nhỏ phía trên tiêu đề', typoKey: 'eyebrow', colorKey: 'subtitleColor' },
  title:    { key: 'title', label: 'Tiêu đề chính', icon: 'H', description: 'Tiêu đề khối', typoKey: 'heading', colorKey: 'titleColor' },
  description: { key: 'description', label: 'Đoạn mô tả', icon: '¶', description: 'Nội dung mô tả chi tiết', typoKey: 'body', colorKey: 'bodyColor', multiline: true },
  quote:    { key: 'quote', label: 'Trích dẫn', icon: '“', description: 'Khối trích dẫn nghệ thuật', typoKey: 'quote', colorKey: 'quoteColor', multiline: true },
  author:   { key: 'author', label: 'Tác giả / Nguồn', icon: '—', description: 'Người phát ngôn / nguồn trích dẫn', typoKey: 'author', colorKey: 'authorColor' },
  tagline1: { key: 'tagline1', label: 'Tagline 1', icon: '1', description: 'Dòng nhấn mạnh thứ nhất', typoKey: 'tagline1', colorKey: 'tagline1Color' },
  tagline2: { key: 'tagline2', label: 'Tagline 2', icon: '2', description: 'Dòng nhấn mạnh thứ hai', typoKey: 'tagline2', colorKey: 'tagline2Color' },
  buttonText: { key: 'buttonText', label: 'Nút chính', icon: '▣', description: 'Nút kêu gọi hành động', typoKey: 'button', colorKey: 'buttonTextColor', linkKey: 'buttonLink' },
  secondaryButtonText: { key: 'secondaryButtonText', label: 'Nút phụ', icon: '▢', description: 'Nút hành động thứ hai', typoKey: 'button', colorKey: 'buttonTextColor', linkKey: 'secondaryButtonLink' },
  viewAllText: { key: 'viewAllText', label: 'Liên kết "Xem tất cả"', icon: '→', description: 'Link xem toàn bộ danh sách', typoKey: 'viewAllText', colorKey: 'viewAllColor', linkKey: 'viewAllLink' },
};

export const BUTTON_COLOR_KEYS: ColorKey[] = [
  'buttonTextColor', 'buttonBackgroundColor', 'buttonHoverTextColor', 'buttonHoverBackgroundColor',
];

export const COLOR_LABELS: Record<ColorKey, string> = {
  backgroundColor: 'Màu nền phân đoạn', titleColor: 'Màu tiêu đề', subtitleColor: 'Màu eyebrow',
  bodyColor: 'Màu mô tả', quoteColor: 'Màu trích dẫn', authorColor: 'Màu tác giả',
  tagline1Color: 'Màu tagline 1', tagline2Color: 'Màu tagline 2', viewAllColor: 'Màu "Xem tất cả"',
  buttonTextColor: 'Màu chữ nút', buttonBackgroundColor: 'Màu nền nút',
  buttonHoverTextColor: 'Màu chữ nút (hover)', buttonHoverBackgroundColor: 'Màu nền nút (hover)',
  descriptionColor: 'Màu mô tả slide',
};

export interface SectionTypeDef {
  category: SectionCategory;
  name: string;
  fields: ContentFieldKey[];
  /** Tính năng bật/tắt các tab / khối UI — thay cho *ngIf theo type */
  features: { media?: boolean; carousel?: boolean; products?: boolean; spacer?: boolean; glow?: boolean };
}

export const SECTION_REGISTRY: Record<string, SectionTypeDef> = {
  hero:       { category: 'CONTENT',   name: 'Hero',        fields: ['eyebrow', 'title', 'description', 'buttonText', 'secondaryButtonText'], features: { media: true, carousel: true } },
  banner:     { category: 'CONTENT',   name: 'Banner',      fields: ['eyebrow', 'title', 'description', 'buttonText'], features: { media: true, carousel: true } },
  'image-text': { category: 'CONTENT', name: 'Ảnh + Chữ',   fields: ['eyebrow', 'title', 'description', 'buttonText'], features: { media: true } },
  editorial:  { category: 'EDITORIAL', name: 'Editorial',   fields: ['eyebrow', 'title', 'description', 'quote', 'tagline1', 'tagline2', 'buttonText'], features: { media: true, glow: true } },
  quote:      { category: 'EDITORIAL', name: 'Trích dẫn',   fields: ['quote', 'author'], features: {} },
  cta:        { category: 'CONTENT',   name: 'Kêu gọi (CTA)', fields: ['title', 'description', 'buttonText'], features: {} },
  spacer:     { category: 'LAYOUT',    name: 'Khoảng trống', fields: [], features: { spacer: true } },
  'product-slider': { category: 'PRODUCT', name: 'Slider sản phẩm', fields: ['eyebrow', 'title', 'description', 'viewAllText'], features: { products: true } },
  'product-grid':   { category: 'PRODUCT', name: 'Lưới sản phẩm',   fields: ['eyebrow', 'title', 'description', 'viewAllText'], features: { products: true } },
  // Đề xuất cho About:
  gallery:    { category: 'CONTENT',   name: 'Thư viện ảnh', fields: ['eyebrow', 'title', 'description'], features: { media: true, carousel: true } },
  timeline:   { category: 'EDITORIAL', name: 'Dòng thời gian', fields: ['eyebrow', 'title', 'description'], features: {} },
  stats:      { category: 'CONTENT',   name: 'Số liệu',      fields: ['eyebrow', 'title'], features: {} },
};

// ───────────── Helper có memo (tính 1 lần / type, không tính lại mỗi chu kỳ CD) ─────────────
const fieldCache = new Map<string, ContentFieldDef[]>();
const colorCache = new Map<string, { key: ColorKey; label: string }[]>();

export function getFieldsForType(type: string): ContentFieldDef[] {
  let v = fieldCache.get(type);
  if (!v) {
    v = (SECTION_REGISTRY[type]?.fields ?? []).map((k) => CONTENT_FIELDS[k]);
    fieldCache.set(type, v);
  }
  return v;
}

export function getTypographyElementsForType(type: string): { key: TypographyElementKey; label: string }[] {
  const seen = new Set<TypographyElementKey>();
  return getFieldsForType(type)
    .filter((f) => !seen.has(f.typoKey) && !!seen.add(f.typoKey))
    .map((f) => ({ key: f.typoKey, label: f.label }));
}

export function getColorPropsForType(type: string): { key: ColorKey; label: string }[] {
  let v = colorCache.get(type);
  if (!v) {
    const def = SECTION_REGISTRY[type];
    if (!def || def.features.spacer) {
      v = [{ key: 'backgroundColor', label: COLOR_LABELS.backgroundColor }];
    } else {
      const keys = new Set<ColorKey>(['backgroundColor']);
      let hasButton = false;
      for (const f of getFieldsForType(type)) {
        if (f.typoKey === 'button') hasButton = true; else keys.add(f.colorKey);
      }
      if (hasButton) BUTTON_COLOR_KEYS.forEach((k) => keys.add(k));
      v = [...keys].map((key) => ({ key, label: COLOR_LABELS[key] }));
    }
    colorCache.set(type, v);
  }
  return v;
}
