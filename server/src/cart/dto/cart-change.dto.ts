import { IsNotEmpty, IsOptional } from 'class-validator';

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
  qty?: number;
}

