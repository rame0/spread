import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export type UserRow = typeof users.$inferSelect;

export async function createUser(
  email: string,
  passwordHash: string
): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();
  if (!row) throw new Error('Failed to create user');
  return row;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}
