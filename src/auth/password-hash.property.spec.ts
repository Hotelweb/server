import * as fc from 'fast-check';
import * as bcrypt from 'bcrypt';

// Mock the prisma module before importing AuthService
jest.mock('../prisma/prisma.service', () => {
    return {
        PrismaService: class MockPrismaService {
            admin = { findUnique: jest.fn() };
        },
    };
});

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Property 7: Password Hash Security
 * Validates: Requirement 3.6
 *
 * For any password string, hashPassword always produces a valid bcrypt hash
 * with cost factor 10, never equals the original password, produces different
 * hashes for the same input (salt randomness), and can always be verified back.
 */
describe('Property 7: Password Hash Security', () => {
    let authService: AuthService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                PrismaService,
                { provide: JwtService, useValue: { sign: jest.fn() } },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
    });

    const passwordArbitrary = fc.string({ minLength: 1, maxLength: 72 });

    it('should always produce a valid bcrypt hash with cost factor 10', async () => {
        await fc.assert(
            fc.asyncProperty(passwordArbitrary, async (password) => {
                const hash = await authService.hashPassword(password);

                // Hash must be a valid bcrypt hash with $2b$10$ prefix (cost factor 10)
                expect(hash).toMatch(/^\$2[aby]\$10\$/);

                // Bcrypt hashes are always 60 characters long
                expect(hash).toHaveLength(60);
            }),
            { numRuns: 20 },
        );
    }, 30000);

    it('should never produce a hash equal to the original password', async () => {
        await fc.assert(
            fc.asyncProperty(passwordArbitrary, async (password) => {
                const hash = await authService.hashPassword(password);

                // The hash must never equal the original password
                expect(hash).not.toBe(password);
            }),
            { numRuns: 20 },
        );
    }, 30000);

    it('should produce different hashes for the same password (salt randomness)', async () => {
        await fc.assert(
            fc.asyncProperty(passwordArbitrary, async (password) => {
                const hash1 = await authService.hashPassword(password);
                const hash2 = await authService.hashPassword(password);

                // Different calls with the same password must produce different hashes
                expect(hash1).not.toBe(hash2);
            }),
            { numRuns: 10 },
        );
    }, 30000);

    it('should always be verifiable back with bcrypt.compare', async () => {
        await fc.assert(
            fc.asyncProperty(passwordArbitrary, async (password) => {
                const hash = await authService.hashPassword(password);

                // The hash must always verify back to the original password
                const isValid = await bcrypt.compare(password, hash);
                expect(isValid).toBe(true);
            }),
            { numRuns: 10 },
        );
    }, 30000);
});
