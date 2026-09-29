import { IsString, IsBoolean, IsEnum, IsOptional, IsNumber, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TransactionFeeDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEnum(['FIXED', 'PERCENT'])
  @IsOptional()
  type?: 'FIXED' | 'PERCENT';

  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;
}

export class CreatePaymentMethodDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  paymentType?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  paymentInfo?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ValidateNested()
  @Type(() => TransactionFeeDto)
  @IsOptional()
  transactionFee?: TransactionFeeDto;

  @IsString()
  @IsOptional()
  logo?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePaymentMethodDto extends CreatePaymentMethodDto {}

export class BulkDeletePaymentDto {
  ids: string[];
}
