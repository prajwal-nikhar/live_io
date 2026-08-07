import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class LoginDto {
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: "New password must be at least 6 characters long" })
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: "Invalid email address" })
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  newPassword: string;
}
