import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 4096;

/** Printable ASCII only, so SASLprep leaves the password unchanged (RFC 4013). */
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

/**
 * Computes a PostgreSQL SCRAM-SHA-256 password verifier on the client
 * (`SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>`, RFC 5802/7677,
 * the format `pg_authid.rolpassword` stores). Passing the verifier instead of the
 * password to CREATE/ALTER ROLE keeps the plaintext out of the statement text,
 * and so out of any server log that records statements.
 */
export function scramSha256Verifier(password: string, salt: Buffer = randomBytes(16)): string {
  if (!PRINTABLE_ASCII.test(password)) {
    throw new Error('Role passwords must be printable ASCII without spaces.');
  }
  const salted = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
  const clientKey = createHmac('sha256', salted).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', salted).update('Server Key').digest();
  return `SCRAM-SHA-256$${ITERATIONS}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}
