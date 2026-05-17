import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * The payload encoded inside an access token.
 *
 *  - `sub`   – user id (system_admins.id or hotel_users.id)
 *  - `scope` – which auth realm the user belongs to
 *  - `email` – cached for convenience (so /auth/me doesn't always have to hit DB)
 *  - `hotel_id` – only present for hotel-scoped tokens
 *  - `iat` / `exp` – seconds since epoch
 */
export interface TokenPayload {
  sub: number;
  scope: 'system' | 'hotel';
  email: string;
  hotel_id?: number;
  iat: number;
  exp: number;
}

/**
 * Minimal HS256 JWT issuer / verifier.
 *
 * Built on Node's built-in `crypto` so we don't need to pull in @nestjs/jwt
 * just for a single signed-token use case. The format is the standard JWT
 * three-part `header.payload.signature` separated by dots, base64url encoded.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly secret: string;
  // 7 days – long enough that a busy admin doesn't get logged out mid-shift,
  // short enough that a leaked token isn't useful forever.
  private readonly ttlSeconds = 60 * 60 * 24 * 7;

  constructor(config: ConfigService) {
    const raw = config.get<string>('JWT_SECRET');
    if (!raw || raw.length < 16) {
      this.logger.warn(
        'JWT_SECRET is missing or too short (<16 chars). Tokens will still work ' +
          'but switch to a strong secret before deploying.',
      );
    }
    this.secret = raw || 'dev-only-secret-change-me-in-production';
  }

  sign(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: TokenPayload = {
      ...payload,
      iat: now,
      exp: now + this.ttlSeconds,
    };

    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify(fullPayload));
    const signature = this.signSegment(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  verify(token: string): TokenPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed token');
    }
    const [header, body, signature] = parts;

    const expected = this.signSegment(`${header}.${body}`);
    // Constant-time comparison so we don't leak signature info via timing.
    const expectedBuf = Buffer.from(expected);
    const givenBuf = Buffer.from(signature);
    if (
      expectedBuf.length !== givenBuf.length ||
      !timingSafeEqual(expectedBuf, givenBuf)
    ) {
      throw new UnauthorizedException('Invalid token signature');
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, 'base64url').toString('utf8'),
      ) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expired');
    }
    return payload;
  }

  private signSegment(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}
