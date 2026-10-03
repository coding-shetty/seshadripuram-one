import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, closeDatabase } from '../db';
import { institutions, users, auditLogs } from '../db/schema';

const schema = z.object({
  COLLEGE_ID: z.string().trim().min(1),
  COLLEGE_CODE: z.string().trim().min(1),
  COLLEGE_NAME: z.string().trim().min(1),
  ADMIN_LOGIN_ID: z.string().trim().min(1),
  ADMIN_EMAIL: z.email(),
});

async function bootstrap() {
  const input = schema.parse(process.env);
  await db.transaction(async (tx) => {
    const college = await tx.select().from(institutions).where(eq(institutions.id, input.COLLEGE_ID)).get();
    if (!college) await tx.insert(institutions).values({ id: input.COLLEGE_ID, code: input.COLLEGE_CODE, name: input.COLLEGE_NAME });
    else if (!college.isActive || college.code !== input.COLLEGE_CODE) throw new Error('College configuration mismatch');
    const existing = await tx.select().from(users).where(eq(users.institutionId, input.ADMIN_LOGIN_ID)).get();
    if (existing) {
      // Safe one-time migration of an existing administrator. Never elevate a
      // student or silently move an administrator between colleges.
      if (existing.role !== 'ADMIN' || (existing.collegeId && existing.collegeId !== input.COLLEGE_ID) || existing.contactEmail !== input.ADMIN_EMAIL) {
        throw new Error('Existing account does not match the requested administrator');
      }
      await tx.update(users).set({ collegeId: input.COLLEGE_ID }).where(eq(users.id, existing.id));
    } else {
      await tx.insert(users).values({ id: randomUUID(), institutionId: input.ADMIN_LOGIN_ID,
        collegeId: input.COLLEGE_ID, role: 'ADMIN', contactEmail: input.ADMIN_EMAIL });
    }
    await tx.insert(auditLogs).values({ id: randomUUID(), action: 'ADMIN_PROVISIONED_BY_OPERATOR', collegeId: input.COLLEGE_ID });
  });
  console.info('Administrator provisioned. Use the normal email activation flow; no default password was created.');
}
bootstrap().catch(() => {
  console.error('Administrator provisioning failed. Check required environment values and existing account ownership.');
  process.exitCode = 1;
}).finally(closeDatabase);
