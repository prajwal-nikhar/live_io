import { Controller, Post, Body, Get, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    const { email, password, name, role } = body;
    if (!email || !password || !name) {
      throw new BadRequestException('Email, password, and name are required');
    }
    return this.authService.register(email, password, name, role || 'HOST');
  }

  @Post('login')
  async login(@Body() body: any) {
    const { email, password } = body;
    if (!email || !password) {
      throw new BadRequestException('Email and password are required');
    }
    return this.authService.login(email, password);
  }

  @Post('google')
  async googleLogin(@Body() body: any) {
    const { token, name, email } = body;
    if (!token || !email || !name) {
      throw new BadRequestException('Token, email, and name are required');
    }
    return this.authService.googleLogin(token, name, email);
  }

  @Post('refresh')
  async refresh(@Body() body: any) {
    const { refreshToken } = body;
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }
    try {
      const decoded: any = this.authService['jwtService'].verify(refreshToken);
      return this.authService.refreshToken(decoded.sub);
    } catch (e) {
      throw new BadRequestException('Invalid or expired refresh token');
    }
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Request() req: any) {
    return req.user;
  }
}
