/**
 * Password hashing with bcrypt.
 *
 * bcryptjs is pure JavaScript, so it works in Vercel's serverless runtime
 * without native binaries. Cost factor 12 is a sane default for an operations
 * dashboard; raise it only if login latency allows.
 */

import bcrypt from 'bcryptjs';

const COST = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** Consume roughly the same time as a real compare to avoid user enumeration. */
export async function fakeVerify(password: string): Promise<void> {
  try {
    await bcrypt.compare(password, '$2a$12$C6UzMDM.H6dfI/f/IKcEe.5Gg5J5G7Q0h9YQ2rFq5D8m0z1s2u3v4');
  } catch {
    // Ignore: this salt is intentionally invalid, we only care about elapsed time.
  }
}
