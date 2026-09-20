import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'priceFormat',
  pure: true,
  standalone: true,
})
export class PriceFormatPipe implements PipeTransform {

  transform(value: number | string): string {
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    const num = Number(value);
    if (isNaN(num)) {
      return '0';
    }
    const price = Math.round(num);
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

}
