import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class AuthCredentialDto {
  name?: string;

  fullName?: string;

  phoneNumber?: string;

  address?: string;

  gender?: string;

  dateOfBirth?: string;

  avatar?: string;

  googleId?: string;

  @IsString()
  @MinLength(4)
  @MaxLength(50)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  password: string;
}
