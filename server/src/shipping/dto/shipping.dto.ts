import { IsString, IsNumber, IsBoolean, IsEnum, IsOptional, Min } from 'class-validator';

export class CreateShippingMethodDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsNumber()
  @Min(0)
  baseCost: number;

  @IsString()
  estimatedDays: string;

  @IsEnum(['national', 'regional'])
  @IsOptional()
  coverageArea?: 'national' | 'regional';

  @IsNumber()
  @Min(0)
  @IsOptional()
  freeShippingThreshold?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateShippingMethodDto extends CreateShippingMethodDto {}

export class BulkDeleteShippingDto {
  ids: string[];
}
