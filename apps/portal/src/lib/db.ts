let _db: any = null;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not configured');
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');
    const globalForPrisma = globalThis as unknown as { prisma: any };
    _db = globalForPrisma.prisma ?? new PrismaClient();
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _db;
    }
  }
  return _db;
}

// Convenience alias — use getDb() in route handlers
export const db = new Proxy({} as any, {
  get(_, prop) {
    return getDb()[prop];
  },
});
