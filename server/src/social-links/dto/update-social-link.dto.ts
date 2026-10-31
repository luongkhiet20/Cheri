import { IsString, IsNotEmpty, Matches, IsBoolean, IsOptional } from 'class-validator';

export class UpdateSocialLinkDto {
  @IsString({ message: 'Đường dẫn URL phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Đường dẫn URL không được để trống' })
  @Matches(/^https?:\/\/.+/i, {
    message: 'Đường dẫn URL phải bắt đầu bằng http:// hoặc https://',
  })
  url: string;
}

export class ToggleSocialLinkDto {
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái isActive phải là giá trị boolean (true hoặc false)' })
  isActive?: boolean;
}

