import { createHash, randomBytes, randomInt } from 'node:crypto';

const URL_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function fromAlphabet(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Short id for sections, questions, options and regions. */
export const newId = (length = 10) => fromAlphabet(URL_ALPHABET, length);
/** Human-typeable code without ambiguous characters (no 0/O, 1/I/L). */
export const humanCode = (length = 6) => fromAlphabet(CODE_ALPHABET, length);
export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
