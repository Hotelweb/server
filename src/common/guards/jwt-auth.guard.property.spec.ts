import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import * as fc from 'fast-check';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Property 8: Authorization Enforcement
 *
 * For any request to protected endpoints without a valid JWT token, the system
 * always returns 401 Unauthorized. The JwtAuthGuard SHALL reject:
 * - Any random string that is not a valid JWT
 * - Any expired JWT
 * - Any request with no user resolved from the token
 *
 * Protected endpoints: POST /api/locations, PATCH /api/locations/:id,
 * DELETE /api/locations/:id, GET /api/locations/admin/dashboard
 *
 * **Validates: Requirement 4.1**
 */

describe('Property 8: Authorization Enforcement', () => {
    let guard: JwtAuthGuard;
    let mockContext: ExecutionContext;

    beforeEach(() => {
        guard = new JwtAuthGuard();
        mockContext = {} as ExecutionContext;
    });

    describe('Random invalid tokens always result in 401', () => {
        it('for any random string that is not a valid JWT, the guard always throws UnauthorizedException', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 0, maxLength: 500 }),
                    (randomToken) => {
                        // Simulate Passport behavior: when token is invalid,
                        // passport calls handleRequest with err=null, user=null,
                        // and info describing the error
                        const info = { name: 'JsonWebTokenError', message: `invalid token: ${randomToken}` };

                        try {
                            guard.handleRequest(null, null, info, mockContext);
                            // If it doesn't throw, property is violated
                            return false;
                        } catch (error) {
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Expired tokens always result in 401', () => {
        it('for any expired JWT, the guard always throws UnauthorizedException', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        name: fc.constant('TokenExpiredError'),
                        message: fc.string({ minLength: 1, maxLength: 100 }),
                        expiredAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
                    }),
                    (tokenExpiredInfo) => {
                        try {
                            guard.handleRequest(null, null, tokenExpiredInfo, mockContext);
                            return false;
                        } catch (error) {
                            if (!(error instanceof UnauthorizedException)) return false;
                            // Must specifically mention token expiration
                            return error.message === 'Token has expired';
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Malformed tokens always result in 401', () => {
        it('for any JsonWebTokenError info, the guard always throws UnauthorizedException with "Invalid token"', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        name: fc.constant('JsonWebTokenError'),
                        message: fc.oneof(
                            fc.constant('jwt malformed'),
                            fc.constant('invalid signature'),
                            fc.constant('jwt not active'),
                            fc.constant('invalid token'),
                            fc.string({ minLength: 1, maxLength: 100 }),
                        ),
                    }),
                    (jwtErrorInfo) => {
                        try {
                            guard.handleRequest(null, null, jwtErrorInfo, mockContext);
                            return false;
                        } catch (error) {
                            if (!(error instanceof UnauthorizedException)) return false;
                            return error.message === 'Invalid token';
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('No user resolved always results in 401', () => {
        it('when no user is resolved (null/undefined/false), the guard always throws UnauthorizedException regardless of info', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.constant(false),
                    ),
                    fc.oneof(
                        fc.constant(null),
                        fc.constant(undefined),
                        fc.record({
                            name: fc.string({ minLength: 1, maxLength: 50 }),
                            message: fc.string({ minLength: 0, maxLength: 100 }),
                        }),
                    ),
                    (user, info) => {
                        try {
                            guard.handleRequest(null, user as any, info, mockContext);
                            return false;
                        } catch (error) {
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Error passed from Passport always results in 401', () => {
        it('when an error is passed (regardless of user), the guard always throws UnauthorizedException', () => {
            fc.assert(
                fc.property(
                    fc.oneof(
                        fc.constant(new Error('some error')),
                        fc.string({ minLength: 1, maxLength: 100 }).map((msg) => new Error(msg)),
                    ),
                    fc.oneof(
                        fc.constant(null),
                        fc.constant({ id: 'some-id', email: 'admin@test.com' }),
                    ),
                    fc.oneof(
                        fc.constant(null),
                        fc.constant(undefined),
                    ),
                    (err, user, info) => {
                        try {
                            guard.handleRequest(err, user as any, info, mockContext);
                            return false;
                        } catch (error) {
                            return error instanceof UnauthorizedException;
                        }
                    },
                ),
                { numRuns: 100 },
            );
        });
    });

    describe('Valid user always passes through', () => {
        it('when a valid user is resolved with no error, the guard always returns the user', () => {
            fc.assert(
                fc.property(
                    fc.record({
                        id: fc.uuid(),
                        email: fc.emailAddress(),
                    }),
                    (user) => {
                        const result = guard.handleRequest(null, user, null, mockContext);
                        return result === user;
                    },
                ),
                { numRuns: 100 },
            );
        });
    });
});
