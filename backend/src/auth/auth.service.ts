import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto';

export interface FortyTwoUserData {
  fortyTwoId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  fortyTwoLogin: string;
  oauthData: any;
}

export interface GoogleUserData {
  googleId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  oauthData: any;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmailOrUsername(identifier);
    
    if (!user) {
      return null;
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated');
    }

    const isPasswordValid = await this.usersService.validatePassword(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    return this.usersService.toSafeUser(user);
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUser(loginDto.identifier, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    const payload = { 
      email: user.email, 
      sub: user.id, 
      username: user.username 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    try {
      const user = await this.usersService.create(registerDto);
      const safeUser = this.usersService.toSafeUser(user);

      const payload = { 
        email: safeUser.email, 
        sub: safeUser.id, 
        username: safeUser.username 
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: safeUser,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Registration failed');
    }
  }

  async findOrCreateFortyTwoUser(userData: FortyTwoUserData): Promise<any> {
    // First try to find user by 42 ID
    let user = await this.usersService.findByFortyTwoId(userData.fortyTwoId);
    
    if (!user) {
      // Try to find by email
      user = await this.usersService.findByEmail(userData.email);
      
      if (user) {
        // Link existing account with 42
        user = await this.usersService.linkFortyTwoAccount(user.id, userData);
      } else {
        // Create new user
        user = await this.usersService.createFromFortyTwo(userData);
      }
    } else {
      // Update existing 42 user data
      user = await this.usersService.updateFortyTwoData(user.id, userData);
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return this.usersService.toSafeUser(user);
  }

  async loginWithFortyTwo(user: any): Promise<AuthResponseDto> {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      username: user.username 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async findOrCreateGoogleUser(userData: GoogleUserData): Promise<any> {
    // First try to find user by Google ID
    let user = await this.usersService.findByGoogleId(userData.googleId);
    
    if (!user) {
      // Try to find by email
      user = await this.usersService.findByEmail(userData.email);
      
      if (user) {
        // Link existing account with Google
        user = await this.usersService.linkGoogleAccount(user.id, userData);
      } else {
        // Create new user
        user = await this.usersService.createFromGoogle(userData);
      }
    } else {
      // Update existing Google user data
      user = await this.usersService.updateGoogleData(user.id, userData);
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    return this.usersService.toSafeUser(user);
  }

  async loginWithGoogle(user: any): Promise<AuthResponseDto> {
    const payload = { 
      email: user.email, 
      sub: user.id, 
      username: user.username 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.usersService.toSafeUser(user);
  }
}
