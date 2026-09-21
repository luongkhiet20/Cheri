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
  @MinLength(5)
  @MaxLength(50)
  @Matches(/^(?=.*\d).{5,20}$/, {
    message: 'password too weak',
  })
  password: string;
}
