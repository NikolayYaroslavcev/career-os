import { randomInt, createHash } from 'node:crypto';

const CODE_LENGTH = 8;
// Unambiguous alphabet (no 0/O/1/I) so a user can type it back accurately — ~40 bits of entropy at length 8.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** crypto.randomInt is a CSPRNG (unlike Math.random), satisfying the "secure random generation" requirement. */
export function generateLinkingCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Only this hash is ever persisted. SHA-256 (not argon2) is intentional here:
 * it's deterministic, so the token can be looked up by hash in O(1) instead
 * of argon2-verifying against every outstanding code — safe because the
 * input space is a high-entropy random code, not a user-chosen password.
 */
export function hashLinkingCode(code: string): string {
  return createHash('sha256').update(normalizeCode(code)).digest('hex');
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}
