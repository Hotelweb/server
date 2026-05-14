import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    handleRequest<TUser = any>(
        err: any,
        user: TUser,
        info: any,
        _context: ExecutionContext,
    ): TUser {
        if (err || !user) {
            if (info?.name === 'TokenExpiredError') {
                throw new UnauthorizedException('Token has expired');
            }
            if (info?.name === 'JsonWebTokenError') {
                throw new UnauthorizedException('Invalid token');
            }
            throw new UnauthorizedException('Unauthorized');
        }
        return user;
    }
}
