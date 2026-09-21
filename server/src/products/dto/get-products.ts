import { IsIn, IsNotEmpty } from 'class-validator';
import { SortOptions } from '../models/sort.enum';

export class GetProductsDto {
  @IsNotEmpty()
  lang: string;

  @IsNotEmpty()
  page: string;

  @IsIn([
    SortOptions.newest,
    SortOptions.oldest,
    SortOptions.priceasc,
    SortOptions.pricedesc,
    SortOptions.nameasc,
    SortOptions.namedesc,
    SortOptions.ratingdesc,
    SortOptions.ratingasc,
  ])
  sort: SortOptions;

  category?: string;

  search?: string;

  maxPrice?: number;

  minPrice?: number;

  stock?: string;

  rating?: any;
}
