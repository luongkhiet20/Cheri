import { IsArray, IsOptional, IsString, ArrayMaxSize } from 'class-validator';
import { Transform } from 'class-transformer';

export class RecordImpressionsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  productIds: string[];

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  currentProductId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  strategy?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  sessionId?: string;
}

