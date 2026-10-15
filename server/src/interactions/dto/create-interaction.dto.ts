import { IsNotEmpty, IsString, IsOptional, IsIn, Matches } from 'class-validator';

export class CreateInteractionDto {
  @IsNotEmpty({ message: 'productId không được để trống' })
  @IsString({ message: 'productId phải là chuỗi ký tự' })
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'productId phải là ObjectId hợp lệ gồm 24 ký tự hex' })
  productId: string;

  @IsOptional()
  variantId?: any;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsIn(['VIEW', 'view'], { message: 'eventType chỉ chấp nhận VIEW' })
  eventType?: string;
}
