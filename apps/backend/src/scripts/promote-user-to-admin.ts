// EPIC-21 Phase 3: operational script to grant UserRole.ADMIN to an
// existing user, so at least one account can pass the new requireAdmin
// route guard (apps/backend/src/middleware/require-role.ts). There is no
// self-service "assign role" API — role changes are a deliberate,
// out-of-band operation, not something reachable over HTTP.
//
// Updates only the `role` column directly via Prisma rather than going
// through UserRepository.save(user), which currently overwrites
// passwordHash with '' on every write (UserMapper.toPersistence hardcodes
// it) — an unrelated pre-existing bug, out of scope here, but one this
// script must not trip.
//
// Usage: pnpm --filter @careeros/backend exec tsx src/scripts/promote-user-to-admin.ts <email>
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

import { prisma } from '@careeros/database';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: tsx src/scripts/promote-user-to-admin.ts <email>');
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exitCode = 1;
    return;
  }

  if (user.role === 'ADMIN') {
    console.log(`${email} is already ADMIN.`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
  console.log(`${email} promoted from ${user.role} to ADMIN. They must log in again (or refresh their token) for the new role to appear in their JWT.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
