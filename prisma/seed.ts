import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const BCRYPT_COST_FACTOR = 10;
const ADMIN_EMAIL = 'admin@a25hotel.com';
const ADMIN_PASSWORD = 'admin123'; // Development only

const TEST_LOCATIONS = [
    { name: 'Lobby', slug: 'lobby' },
    { name: 'Pool Area', slug: 'pool-area' },
    { name: 'Restaurant', slug: 'restaurant' },
    { name: 'Room 101', slug: 'room-101' },
    { name: 'Spa', slug: 'spa' },
];

async function main() {
    console.log('Seeding database...');

    // Create admin user with bcrypt hashed password (cost factor 10)
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST_FACTOR);

    const admin = await prisma.admin.upsert({
        where: { email: ADMIN_EMAIL },
        update: { passwordHash },
        create: {
            email: ADMIN_EMAIL,
            passwordHash,
        },
    });

    console.log(`Admin user created/updated: ${admin.email}`);

    // Create test locations with unique slugs
    for (const location of TEST_LOCATIONS) {
        const created = await prisma.location.upsert({
            where: { slug: location.slug },
            update: { name: location.name },
            create: {
                name: location.name,
                slug: location.slug,
            },
        });

        console.log(`Location created/updated: ${created.name} (/${created.slug})`);
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error('Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
