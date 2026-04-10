import { createHash, randomBytes } from 'crypto';

export function generateSecureToken() {
  return randomBytes(32).toString('hex');
}

export function hashToken(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}
