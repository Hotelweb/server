import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as fc from 'fast-check';

/**
 * Property 6: Authentication Failure Security
 *
 * For any invalid credentials or expired/invalid JWT token, the system SHALL
 * return 401 Unauthorized and SHALL NOT return any JWT token or success status.
 *
 * **Validates: Requirements 3.2, 3.5**
 */

// Mock PrismaService before importing AuthService
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            admin = { findUnique: jest.fn() };
        },
    };
});

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Property 6: Authentication Failure Security', () => {
    let authService: AuthService;
    let prismaService: any;
    let jwtService: { sign: jest.Mock; verify: jest.Mock };

    const STORED_EMAIL = 'admin@a25hotel.com';
    const STORED_PASSWORD = 'securePassword123';
    let storedPasswordHash: string;

    beforeAll(async () => {
        storedPasswordHash = await bcrypt.hash(STORED_PASSWORD, 10);
    });

    beforeEach(async () => {
        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
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

        prismaService.admin.findUnique.mockReset();
    });

    describe('Invalid email always throws UnauthorizedException', () => {
        it('for any email not matching stored admin, login always throws UnauthorizedException', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(
                        (email) => email !== STORED_EMAIL,
                    ),
                    fc.string({ minLength: 1, maxLength: 100 }),
                    async (email, password) => {
                        prismaService.admin.findUnique.mockResolvedValue(null);

                        try {
                            await authService.login({ email, password });
                            // If login succeeds, the property is violated
                            return false;
                        } catch (error) {
                            // Must throw UnauthorizedException
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Wrong password always throws UnauthorizedException', () => {
        it('for any password not matching stored hash, login always throws UnauthorizedException', async () => {
            const mockAdmin = {
                id: 'admin-uuid-123',
                email: STORED_EMAIL,
                passwordHash: storedPasswordHash,
                createdAt: new Date('2025-01-01T00:00:00Z'),
            };

            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(
                        (password) => password !== STORED_PASSWORD,
                    ),
                    async (password) => {
                        prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

                        try {
                            await authService.login({ email: STORED_EMAIL, password });
                            // If login succeeds, the property is violated
                            return false;
                        } catch (error) {
                            // Must throw UnauthorizedException
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 50 },
            );
        });
    });

    describe('Error response never leaks email existence or password correctness', () => {
        it('the error message is the same whether email exists or password is wrong', async () => {
            const mockAdmin = {
                id: 'admin-uuid-123',
                email: STORED_EMAIL,
                passwordHash: storedPasswordHash,
                createdAt: new Date('2025-01-01T00:00:00Z'),
            };

            await fc.assert(
                fc.asyncProperty(
                    fc.string({ minLength: 1, maxLength: 100 }).filter(
                        (email) => email !== STORED_EMAIL,
                    ),
                    fc.string({ minLength: 1, maxLength: 100 }).filter(
                        (password) => password !== STORED_PASSWORD,
                    ),
                    async (invalidEmail, wrongPassword) => {
                        // Case 1: Non-existent email
                        prismaService.admin.findUnique.mockResolvedValue(null);
                        let emailNotFoundMessage: string;
                        try {
                            await authService.login({ email: invalidEmail, password: 'anyPassword' });
                            return false;
                        } catch (error) {
                            emailNotFoundMessage = (error as UnauthorizedException).message;
                        }

                        // Case 2: Existing email but wrong password
                        prismaService.admin.findUnique.mockResolvedValue(mockAdmin);
                        let wrongPasswordMessage: string;
                        try {
                            await authService.login({ email: STORED_EMAIL, password: wrongPassword });
                            return false;
                        } catch (error) {
                            wrongPasswordMessage = (error as UnauthorizedException).message;
                        }

                        // Both error messages must be identical (no information leakage)
                        return emailNotFoundMessage === wrongPasswordMessage;
                    },
                ),
                { numRuns: 50 },
            );
        });
    });

    describe('JwtAuthGuard returns 401 for expired/invalid tokens', () => {
        it('for any expired or invalid token info, guard always throws UnauthorizedException', async () => {
            const guard = new JwtAuthGuard();
            const mockContext = {} as any;

            await fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant({ name: 'TokenExpiredError', message: 'jwt expired' }),
                        fc.constant({ name: 'JsonWebTokenError', message: 'invalid token' }),
                        fc.constant({ name: 'JsonWebTokenError', message: 'jwt malformed' }),
                        fc.constant(null),
                        fc.record({
                            name: fc.string({ minLength: 1, maxLength: 50 }),
                            message: fc.string({ minLength: 1, maxLength: 100 }),
                        }),
                    ),
                    (tokenInfo) => {
                        try {
                            // When user is falsy (null/undefined), guard should throw
                            guard.handleRequest(null, null, tokenInfo, mockContext);
                            // If it doesn't throw, property is violated
                            return false;
                        } catch (error) {
                            // Must always be UnauthorizedException
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });

        it('guard never returns a success response for invalid/expired tokens', async () => {
            const guard = new JwtAuthGuard();
            const mockContext = {} as any;

            await fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant({ name: 'TokenExpiredError', message: 'jwt expired' }),
                        fc.constant({ name: 'JsonWebTokenError', message: 'invalid signature' }),
                        fc.constant({ name: 'JsonWebTokenError', message: 'jwt malformed' }),
                    ),
                    (tokenInfo) => {
                        try {
                            const result = guard.handleRequest(null, null, tokenInfo, mockContext);
                            // Should never reach here - if it does, no JWT token should be in result
                            return result === undefined || result === null;
                        } catch (error) {
                            // Throwing UnauthorizedException is the expected behavior
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
