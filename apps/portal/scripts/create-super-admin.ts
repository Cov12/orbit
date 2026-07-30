/**
 * Create (or update the password of) a platform super-admin.
 *
 * Run against the target database — for prod, run it in the Render service
 * shell so it uses that service's DATABASE_URL:
 *
 *   ADMIN_SEED_EMAIL=admin@orbit.example \
 *   ADMIN_SEED_PASSWORD='<a strong password>' \
 *   npx tsx scripts/create-super-admin.ts
 *
 * The password is bcrypt-hashed (cost 12); the plaintext is never stored.
 * Idempotent: re-running with the same email resets that admin's password.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || "";

  if (!email || !password) {
    console.error(
      "Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (min 12 chars recommended)."
    );
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_SEED_PASSWORD is too short (min 8 characters).");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.superAdmin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  });

  console.log(`Super-admin ready: ${admin.email} (${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
