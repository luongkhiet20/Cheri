import { IsArray, IsOptional, IsString } from 'class-validator';

export class SaveAboutDraftDto {
  @IsArray({ message: 'Danh sách sections phải là một mảng' })
  sections: any[];

  @IsOptional()
  @IsString()
  updatedBy?: string;
}

export class PublishAboutDto {
  @IsOptional()
  @IsArray({ message: 'Danh sách sections phải là một mảng nếu được cung cấp' })
  sections?: any[];

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
