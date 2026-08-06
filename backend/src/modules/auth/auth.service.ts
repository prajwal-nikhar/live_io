import { Injectable, ConflictException, UnauthorizedException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, pass: string, name: string, role = 'HOST') {
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Email address is already registered');
    }

    const passwordHash = await bcrypt.hash(pass, 10);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name,
        role,
        isActive: true,
        isVerified: true,
      },
    });

    return this.generateAndStoreTokens(user);
  }

  async login(email: string, pass: string) {
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated. Contact an administrator.');
    }

    const valid = await bcrypt.compare(pass, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update lastLogin timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.generateAndStoreTokens(user);
  }

  async refreshToken(refreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'cognition-super-secret-jwt-key-2026',
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, isActive: true },
    });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Access denied. Invalid session context.');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedException('Refresh token is invalid or revoked');
    }

    return this.generateAndStoreTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPass, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshTokenHash: null },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      // Return success to prevent user enumeration attacks
      return { success: true, message: 'If an account exists, a reset link has been dispatched' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = await bcrypt.hash(resetToken, 10);
    const resetTokenExpires = new Date(Date.now() + 3600 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash,
        resetTokenExpires,
      },
    });

    this.logger.log(`Password reset token generated for ${normalizedEmail}: ${resetToken}`);

    return {
      success: true,
      message: 'If an account exists, a reset link has been dispatched',
      resetToken, // Returned for dev/testing convenience
    };
  }

  async resetPassword(resetToken: string, newPass: string) {
    const users = await this.prisma.user.findMany({
      where: {
        resetTokenExpires: { gte: new Date() },
        deletedAt: null,
      },
    });

    let targetUser: any = null;
    for (const user of users) {
      if (user.resetTokenHash && (await bcrypt.compare(resetToken, user.resetTokenHash))) {
        targetUser = user;
        break;
      }
    }

    if (!targetUser) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpires: null,
        refreshTokenHash: null,
      },
    });

    return { success: true, message: 'Password reset successfully. You may now log in.' };
  }

  private async generateAndStoreTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const accessTokenExpiresIn = process.env.JWT_EXPIRATION || '15m';
    const refreshTokenExpiresIn = process.env.JWT_REFRESH_EXPIRATION || '7d';

    const jwtSecret = process.env.JWT_SECRET || 'cognition-super-secret-jwt-key-2026';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || jwtSecret;

    const accessToken = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: refreshSecret,
        expiresIn: refreshTokenExpiresIn,
      },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
      accessToken,
      refreshToken,
    };
  }
}
