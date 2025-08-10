import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { FortyTwoAuthGuard } from './guards/forty-two-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentication')
@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered',
    type: AuthResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation error' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User already exists' 
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'User successfully logged in',
    type: AuthResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials' 
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ 
    status: 200, 
    description: 'User profile retrieved successfully' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ 
    status: 200, 
    description: 'Current user information' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async getCurrentUser(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  // 42 OAuth routes
  @Public()
  @Get('42')
  @UseGuards(FortyTwoAuthGuard)
  @ApiOperation({ summary: 'Initiate 42 OAuth login' })
  @ApiResponse({ 
    status: 302, 
    description: 'Redirects to 42 OAuth authorization page' 
  })
  async fortyTwoAuth() {
    // This route initiates the OAuth flow
  }

  @Public()
  @Get('42/callback')
  @UseGuards(FortyTwoAuthGuard)
  @ApiOperation({ summary: '42 OAuth callback' })
  @ApiResponse({ 
    status: 302, 
    description: 'OAuth callback, redirects to frontend with token' 
  })
  async fortyTwoCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user;
    const authResponse = await this.authService.loginWithFortyTwo(user);
    
    // Redirect to frontend with the token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${authResponse.access_token}`;
    
    return res.redirect(redirectUrl);
  }
}
