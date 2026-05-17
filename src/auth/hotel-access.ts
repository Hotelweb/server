import { ForbiddenException } from '@nestjs/common';
import type { TokenPayload } from './token.service.js';

/** System admins may access any hotel; hotel users only their own. */
export function assertHotelAccess(user: TokenPayload, hotelId: number): void {
  if (user.scope === 'system') return;
  if (user.hotel_id !== hotelId) {
    throw new ForbiddenException(
      'Cannot access resources from a different hotel',
    );
  }
}
