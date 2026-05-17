import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { CurrentUser, JwtAuthGuard } from './jwt-auth.guard.js';
import type { TokenPayload } from './token.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Log in a user',
    description:
      'Authenticate a system admin or hotel user. Pass `scope` to pin the ' +
      'lookup, or omit it to try `system` first then fall back to `hotel`.',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the current authenticated user profile',
    description:
      'Returns the latest profile snapshot for the bearer token holder. ' +
      'Useful for refreshing the cached user object on app boot.',
  })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  me(@CurrentUser() payload: TokenPayload) {
    return this.authService.getProfile(payload);
  }
}
