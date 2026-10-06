import { IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetCartChangeDto {
  @IsNotEmpty()
  id: string;

  @IsOptional()
  lang?: string;

  @IsOptional()
  variantId?: string;

  @IsOptional()
  classification?: string;

  @IsOptional()
  color?: string;

  @IsOptional()
  size?: string;

  @IsOptional()
  @Type(() => Number)
  qty?: number;
}

