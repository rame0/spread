import { z, ZodType } from 'zod';
import { HttpError } from './errorMiddleware';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid request body');
  }
  return parsed.data;
}

export function parseQuery<T>(schema: ZodType<T>, query: unknown): T {
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid request query');
  }
  return parsed.data;
}

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
