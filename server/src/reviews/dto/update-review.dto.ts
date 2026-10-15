import {
  IsNumber,
  Min,
  Max,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'rating phải là số' })
  @Min(1, { message: 'rating tối thiểu là 1 sao' })
  @Max(5, { message: 'rating tối đa là 5 sao' })
  rating?: number;

  @IsOptional()
  @IsString({ message: 'Nội dung nhận xét phải là chuỗi ký tự' })
  @MinLength(3, { message: 'Nội dung nhận xét phải có ít nhất 3 ký tự' })
  @MaxLength(2000, { message: 'Nội dung nhận xét không được vượt quá 2000 ký tự' })
  comment?: string;
}
