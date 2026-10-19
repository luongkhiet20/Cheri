import { Pipe, PipeTransform } from '@angular/core';

/**
 * Format a number/string into Vietnamese thousand-separator format (using dots).
 * Example: 3639736 -> "3.639.736", 0 -> "0", 450000 -> "450.000"
 */
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0';
  }
  const num = Number(value);
  if (isNaN(num)) {
    return String(value);
  }
  const isNegative = num < 0;
  const absPrice = Math.round(Math.abs(num));
  const formatted = absPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format a number/string into Vietnamese currency with suffix ' đ'.
 * Example: 3639736 -> "3.639.736 đ", 0 -> "0 đ"
 */
export function formatVND(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '0 đ';
  }
  const num = Number(value);
  if (isNaN(num)) {
    return `${value} đ`;
  }
  return `${formatPrice(value)} đ`;
}

@Pipe({
  name: 'priceFormat',
  pure: true,
  standalone: true,
})
export class PriceFormatPipe implements PipeTransform {
  transform(value: number | string | null | undefined, suffix?: boolean | string): string {
    const formatted = formatPrice(value);
    if (suffix === true) {
      return `${formatted} đ`;
    }
    if (typeof suffix === 'string' && suffix.trim().length > 0) {
      return `${formatted} ${suffix.trim()}`;
    }
    return formatted;
  }
}
