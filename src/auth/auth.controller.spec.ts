import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';

// Mock PrismaService to avoid import.meta issue with generated Prisma client
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            admin = { findUnique: jest.fn() };
        },
    };
});

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
    let controller: AuthController;
    let authService: { login: jest.Mock };

    beforeEach(async () => {
        authService = {
            login: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: authService }],
        }).compile();

        controller = module.get<AuthController>(AuthController);
    });

    describe('POST /api/auth/login', () => {
        const loginDto = { email: 'admin@a25hotel.com', password: 'securePassword123' };

        it('should return JWT token and admin details on valid credentials', async () => {
            const expectedResponse = {
                accessToken: 'jwt-token-123',
                admin: {
                    id: 'admin-uuid-123',
                    email: 'admin@a25hotel.com',
                    createdAt: new Date('2025-01-01T00:00:00Z'),
                },
            };
            authService.login.mockResolvedValue(expectedResponse);

            const result = await controller.login(loginDto);

            expect(result).toEqual(expectedResponse);
            expect(authService.login).toHaveBeenCalledWith(loginDto);
        });

        it('should throw 401 Unauthorized for invalid credentials', async () => {
            authService.login.mockRejectedValue(
                new UnauthorizedException('Invalid credentials'),
            );

            await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
        });

        it('should delegate to AuthService.login with the LoginDto', async () => {
            authService.login.mockResolvedValue({ accessToken: 'token', admin: {} });

            await controller.login(loginDto);

            expect(authService.login).toHaveBeenCalledTimes(1);
            expect(authService.login).toHaveBeenCalledWith(loginDto);
        });
    });
});
