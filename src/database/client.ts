import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  // 1. Create a raw Postgres connection pool
  const connectionString = process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });

  // 2. Create the Prisma Adapter
  const adapter = new PrismaPg(pool);

  // 3. Initialize Prisma with the adapter
  return new PrismaClient({ adapter });
};

const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;