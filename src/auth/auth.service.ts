import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

const BCRYPT_COST_FACTOR = 10;

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    /**
     * Hash a password using bcrypt with cost factor of 10.
     * Used when creating or updating admin accounts.
     */
    async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, BCRYPT_COST_FACTOR);
    }

    /**
     * Validate admin credentials by finding the admin by email
     * and verifying the password against the stored bcrypt hash.
     * Returns the admin if valid, null otherwise.
     */
    async validateAdmin(email: string, password: string) {
        const admin = await this.prisma.admin.findUnique({ where: { email } });
        if (!admin) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
        if (!isPasswordValid) {
            return null;
        }

        return admin;
    }

    /**
     * Authenticate an admin and return a JWT access token with admin details.
     * Throws UnauthorizedException if credentials are invalid.
     * Never returns the passwordHash in the response.
     */
    async login(loginDto: LoginDto) {
        const admin = await this.validateAdmin(loginDto.email, loginDto.password);
        if (!admin) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload = { sub: admin.id, email: admin.email };
        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            admin: {
                id: admin.id,
                email: admin.email,
                createdAt: admin.createdAt,
            },
        };
    }
}
