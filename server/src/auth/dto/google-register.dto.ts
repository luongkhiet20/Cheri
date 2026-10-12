import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class GoogleRegisterDto {
  @IsNotEmpty({ message: 'registrationToken không được để trống' })
  @IsString()
  registrationToken: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;
}
