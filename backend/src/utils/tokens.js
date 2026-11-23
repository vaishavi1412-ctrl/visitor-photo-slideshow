import crypto from 'crypto';

// A long random secret that is stored in the visitor's browser cookie
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// We store only the hash, never the token itself
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Short code a visitor can type on another device.
// Letters like O, I, 0, 1 are left out because they look alike.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateVisitorCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (const b of bytes) {
    code += CODE_CHARS[b % CODE_CHARS.length];
  }
  return code;
}