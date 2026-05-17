import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenPayload, TokenService } from './token.service.js';

const REQUIRED_SCOPES_KEY = 'auth:scopes';

/**
 * Restrict a controller / handler to one or more scopes.
 *
 *   @RequireScopes('system')               // root admin only
 *   @RequireScopes('system', 'hotel')      // any authenticated user
 */
export const RequireScopes = (...scopes: Array<'system' | 'hotel'>) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

/**
 * Pull the verified token payload off the request for handler arguments.
 *
 *   someRoute(@CurrentUser() user: TokenPayload) { … }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user) {
      // Should be impossible if JwtAuthGuard ran first, but bail loudly if not.
      throw new UnauthorizedException('Authentication required');
    }
    return request.user;
  },
);

interface RequestWithUser extends Request {
  user?: TokenPayload;
}

/**
 * Verifies a Bearer JWT and (optionally) enforces a scope set declared via
 * `@RequireScopes(...)`. Attaches the decoded payload to `req.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const auth = request.headers['authorization'];
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = auth.slice(7).trim();
    const payload = this.tokenService.verify(token); // throws on invalid/expired
    request.user = payload;

    const required =
      this.reflector.getAllAndOverride<Array<'system' | 'hotel'>>(
        REQUIRED_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    if (required.length > 0 && !required.includes(payload.scope)) {
      throw new ForbiddenException(`Requires scope: ${required.join(' or ')}`);
    }
    return true;
  }
}
