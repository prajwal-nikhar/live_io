import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwt: any;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@quiz.com',
    passwordHash: '$2a$10$e8w...hashedPassword',
    name: 'Test Host',
    role: 'HOST',
    isActive: true,
    deletedAt: null,
    refreshTokenHash: null,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwt = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create a new user if email is not taken', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.register('test@quiz.com', 'password123', 'Test Host');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is taken', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register('test@quiz.com', 'password123', 'Test Host')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should authenticate user with correct credentials', async () => {
      const rawPassword = 'password123';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const user = { ...mockUser, passwordHash: hashedPassword };

      prisma.user.findFirst.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      const result = await service.login('test@quiz.com', rawPassword);
      expect(result.user.email).toBe('test@quiz.com');
      expect(result.accessToken).toBe('mock-jwt-token');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.login('test@quiz.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
