import { IsIn, IsOptional } from 'class-validator';
import { SortOptions } from '../models/sort.enum';

export class GetProductsDto {
  @IsOptional()
  lang?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  pageSize?: string | number;

  @IsOptional()
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
  sort?: SortOptions;

  @IsOptional()
  category?: string;

  @IsOptional()
  search?: string;

  @IsOptional()
  maxPrice?: number;

  @IsOptional()
  minPrice?: number;

  @IsOptional()
  stock?: string;

  @IsOptional()
  rating?: any;
}
