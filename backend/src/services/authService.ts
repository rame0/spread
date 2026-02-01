import bcrypt from 'bcrypt';
import { createUser, findUserByEmail } from '../repositories/userRepository';
import { signToken } from '../auth/jwt';

const SALT_ROUNDS = 10;

export async function register(email: string, password: string) {
  const existing = await findUserByEmail(email);
  if (existing) throw new Error('Email already registered');
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser(email, passwordHash);
  const token = signToken({ userId: user.id, email: user.email });
  return {
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    token,
  };
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) throw new Error('Invalid email or password');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error('Invalid email or password');
  const token = signToken({ userId: user.id, email: user.email });
  return {
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
    token,
  };
}
