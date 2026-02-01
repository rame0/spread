import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const DEFAULT_USER_EMAIL = 'dev@local';

export async function ensureDefaultUser(): Promise<string> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEFAULT_USER_EMAIL))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(users)
    .values({ email: DEFAULT_USER_EMAIL })
    .returning({ id: users.id });
  if (!inserted) throw new Error('Failed to create default user');
  return inserted.id;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}
