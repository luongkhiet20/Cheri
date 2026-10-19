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
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsIn(
    ['VIEW', 'view', 'CLICK', 'click', 'ADD_TO_CART', 'add_to_cart', 'PURCHASE', 'purchase'],
    { message: 'eventType phải là một trong các giá trị: VIEW, CLICK, ADD_TO_CART, PURCHASE' },
  )
  eventType?: string;
}
