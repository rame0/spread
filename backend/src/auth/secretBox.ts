/**
 * Encryption of third-party tokens at rest: AES-256-GCM with a key derived from JWT_SECRET
 * by HKDF, so no extra secret has to be configured. Changing JWT_SECRET makes stored
 * tokens unreadable and they have to be entered again.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'crypto';
import { config } from '../config/env';

const VERSION = 'v1';

function key(secret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', secret, 'credit-grace-planner', 'integration-token', 32));
}

export function encryptSecret(plain: string, secret = config.jwtSecret): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

/** Throws when the value was encrypted with another key or tampered with. */
export function decryptSecret(value: string, secret = config.jwtSecret): string {
  const [version, iv, tag, encrypted] = value.split(':');
  if (version !== VERSION || !iv || !tag || encrypted === undefined) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}
