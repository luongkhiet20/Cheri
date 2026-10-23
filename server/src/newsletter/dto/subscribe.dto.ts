import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsNotEmpty({ message: 'Email không được để trống' })
  @IsEmail({}, { message: 'Định dạng email không hợp lệ' })
  email: string;

  @IsOptional()
  @IsString()
  source?: string;
}
