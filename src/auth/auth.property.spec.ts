import { Test, TestingModule } from '@nestjs/testing';
import { JwtService, JwtModule } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as fc from 'fast-check';

/**
 * Property 5: Authentication Token Generation
 * **Validates: Requirements 3.1, 3.4**
 *
 * For any valid admin credentials, the Auth_Service SHALL return a JWT token
 * with a 24-hour expiration containing sub (admin id) and email claims.
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

const TEST_JWT_SECRET = 'test-secret-for-property-tests';

describe('Property 5: Authentication Token Generation', () => {
    let authService: AuthService;
    let prismaService: any;
    let jwtService: JwtService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            imports: [
                JwtModule.register({
                    secret: TEST_JWT_SECRET,
                    signOptions: { expiresIn: '24h' },
                }),
            ],
            providers: [AuthService, PrismaService],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        prismaService = module.get<PrismaService>(PrismaService);
        jwtService = module.get<JwtService>(JwtService);
    });

    // Arbitrary for generating valid admin data
    const adminArbitrary = fc.record({
        id: fc.uuid(),
        email: fc.emailAddress(),
        password: fc.string({ minLength: 1, maxLength: 72 }),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    });

    it('should always return a valid JWT token for valid admin credentials', async () => {
        await fc.assert(
            fc.asyncProperty(adminArbitrary, async (adminData) => {
                const passwordHash = await bcrypt.hash(adminData.password, 10);
                const mockAdmin = {
                    id: adminData.id,
                    email: adminData.email,
                    passwordHash,
                    createdAt: adminData.createdAt,
                };

                prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

                const result = await authService.login({
                    email: adminData.email,
                    password: adminData.password,
                });

                // Token must be returned
                expect(result.accessToken).toBeDefined();
                expect(typeof result.accessToken).toBe('string');
                expect(result.accessToken.length).toBeGreaterThan(0);
            }),
            { numRuns: 20 },
        );
    });

    it('should always produce a JWT with three base64url segments separated by dots', async () => {
        await fc.assert(
            fc.asyncProperty(adminArbitrary, async (adminData) => {
                const passwordHash = await bcrypt.hash(adminData.password, 10);
                const mockAdmin = {
                    id: adminData.id,
                    email: adminData.email,
                    passwordHash,
                    createdAt: adminData.createdAt,
                };

                prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

                const result = await authService.login({
                    email: adminData.email,
                    password: adminData.password,
                });

                // JWT format: three base64url segments separated by dots
                const parts = result.accessToken.split('.');
                expect(parts).toHaveLength(3);

                // Each part should be valid base64url (alphanumeric, -, _, no padding required)
                const base64urlRegex = /^[A-Za-z0-9_-]+$/;
                parts.forEach((part) => {
                    expect(part).toMatch(base64urlRegex);
                });
            }),
            { numRuns: 20 },
        );
    });

    it('should always include sub (admin id) and email claims in the JWT payload', async () => {
        await fc.assert(
            fc.asyncProperty(adminArbitrary, async (adminData) => {
                const passwordHash = await bcrypt.hash(adminData.password, 10);
                const mockAdmin = {
                    id: adminData.id,
                    email: adminData.email,
                    passwordHash,
                    createdAt: adminData.createdAt,
                };

                prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

                const result = await authService.login({
                    email: adminData.email,
                    password: adminData.password,
                });

                // Verify the token by decoding it with the same secret
                const decoded = jwtService.verify(result.accessToken) as any;

                // Must contain sub claim matching admin id
                expect(decoded.sub).toBe(adminData.id);

                // Must contain email claim matching admin email
                expect(decoded.email).toBe(adminData.email);
            }),
            { numRuns: 20 },
        );
    });

    it('should always set an expiration time of 24 hours on the JWT token', async () => {
        await fc.assert(
            fc.asyncProperty(adminArbitrary, async (adminData) => {
                const passwordHash = await bcrypt.hash(adminData.password, 10);
                const mockAdmin = {
                    id: adminData.id,
                    email: adminData.email,
                    passwordHash,
                    createdAt: adminData.createdAt,
                };

                prismaService.admin.findUnique.mockResolvedValue(mockAdmin);

                const result = await authService.login({
                    email: adminData.email,
                    password: adminData.password,
                });

                // Verify the token has an expiration
                const decoded = jwtService.verify(result.accessToken) as any;

                // Must have exp and iat claims
                expect(decoded.exp).toBeDefined();
                expect(decoded.iat).toBeDefined();

                // Expiration should be 24 hours (86400 seconds) after issued at
                const expirationDuration = decoded.exp - decoded.iat;
                expect(expirationDuration).toBe(86400); // 24h = 86400 seconds
            }),
            { numRuns: 20 },
        );
    });
});
