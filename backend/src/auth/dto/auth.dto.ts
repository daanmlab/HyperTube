import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({ description: 'Username (3-20 characters)', example: 'johndoe' })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(20, { message: 'Username must not exceed 20 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username can only contain letters, numbers, underscores, and hyphens' })
  username: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName: string;

  @ApiProperty({ description: 'Password (min 8 characters)', example: 'StrongPass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, { 
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
  })
  password: string;
}

export class LoginDto {
  @ApiProperty({ description: 'Email or username', example: 'user@example.com' })
  @IsString()
  @MinLength(1, { message: 'Email or username is required' })
  identifier: string;

  @ApiProperty({ description: 'Password', example: 'StrongPass123!' })
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  access_token: string;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    fullName: string;
    isActive: boolean;
    createdAt: Date;
  };
}
