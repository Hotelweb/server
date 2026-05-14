import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// We need to mock the prisma module before importing AuthService
// because it transitively imports the generated Prisma client which uses import.meta
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            admin = { findUnique: jest.fn() };
        },
    };
});

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
    let authService: AuthService;
    let prismaService: any;
    let jwtService: { sign: jest.Mock };

    const mockAdmin = {
        id: 'admin-uuid-123',
        email: 'admin@a25hotel.com',
        passwordHash: '', // Will be set in beforeAll
        createdAt: new Date('2025-01-01T00:00:00Z'),
    };

    beforeAll(async () => {
        // Hash a known password with cost factor 10
        mockAdmin.passwordHash = await bcrypt.hash('securePassword123', 10);
    });

    beforeEach(async () => {
        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                PrismaService,
                { provide: JwtService, useValue: jwtService },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        prismaService = module.get<PrismaService>(PrismaService);

        // Reset mocks
        prismaService.admin.findUnique.mockReset();
    });

    describe('hashPassword', () => {
        it('should hash a password using bcrypt with cost factor 10', async () => {
            const password = 'testPassword123';
            const hash = await authService.hashPassword(password);

            // Verify it's a valid bcrypt hash with cost factor 10
            expect(hash).toMatch(/^\$2[aby]\$10\$/);

            // Verify the hash can be compared back
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
        });

        it('should produce different hashes for the same password (salt)', async () => {
            const password = 'testPassword123';
            const hash1 = await authService.hashPassword(password);
            const hash2 = await authService.hashPassword(password);

            expect(hash1).not.toBe(hash2);
        });
    });

    describe('validateAdmin', () => {
        it('should return admin when email and password are valid', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            const result = await authService.validateAdmin('admin@a25hotel.com', 'securePassword123');

            expect(result).toEqual(mockAdmin);
            expect(prismaService.admin.findUnique).toHaveBeenCalledWith({
                where: { email: 'admin@a25hotel.com' },
            });
        });

        it('should return null when email does not exist', async () => {
            prismaService.admin.findUnique.mockResolvedValue(null);

            const result = await authService.validateAdmin('nonexistent@test.com', 'anyPassword');

            expect(result).toBeNull();
        });

        it('should return null when password is incorrect', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            const result = await authService.validateAdmin('admin@a25hotel.com', 'wrongPassword');

            expect(result).toBeNull();
        });
    });

    describe('login', () => {
        it('should return accessToken and admin details on valid credentials', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            const result = await authService.login({
                email: 'admin@a25hotel.com',
                password: 'securePassword123',
            });

            expect(result).toEqual({
                accessToken: 'mock-jwt-token',
                admin: {
                    id: mockAdmin.id,
                    email: mockAdmin.email,
                    createdAt: mockAdmin.createdAt,
                },
            });

            // Verify JWT payload contains sub and email
            expect(jwtService.sign).toHaveBeenCalledWith({
                sub: mockAdmin.id,
                email: mockAdmin.email,
            });
        });

        it('should throw UnauthorizedException for invalid credentials', async () => {
            prismaService.admin.findUnique.mockResolvedValue(null);

            await expect(
                authService.login({ email: 'wrong@test.com', password: 'wrong' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for wrong password', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            await expect(
                authService.login({ email: 'admin@a25hotel.com', password: 'wrongPassword' }),
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should never include passwordHash in the response', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            const result = await authService.login({
                email: 'admin@a25hotel.com',
                password: 'securePassword123',
            });

            // Verify passwordHash is NOT in the response
            expect(result.admin).not.toHaveProperty('passwordHash');
            expect(JSON.stringify(result)).not.toContain('passwordHash');
            expect(JSON.stringify(result)).not.toContain(mockAdmin.passwordHash);
        });

        it('should return admin with only id, email, and createdAt fields', async () => {
            prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

            const result = await authService.login({
                email: 'admin@a25hotel.com',
                password: 'securePassword123',
            });

            const adminKeys = Object.keys(result.admin);
            expect(adminKeys).toEqual(['id', 'email', 'createdAt']);
        });
    });
});
