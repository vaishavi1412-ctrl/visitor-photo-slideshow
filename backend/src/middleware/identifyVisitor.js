import db from '../db.js';
import { hashToken } from '../utils/tokens.js';

const findByTokenHash = db.prepare(
  'SELECT visitor_id, full_name, visitor_code, created_at FROM visitors WHERE token_hash = ?'
);

// Reads the cookie and sets req.visitor (or null if nobody is recognized)
export function identifyVisitor(req, res, next) {
  req.visitor = null;
  const token = req.cookies?.visitor_token;

  if (typeof token === 'string' && token.length > 0) {
    req.visitor = findByTokenHash.get(hashToken(token)) || null;
  }
  next();
}

// Use this on routes that only recognized visitors may call (like upload)
export function requireVisitor(req, res, next) {
  if (!req.visitor) {
    return res.status(401).json({ error: 'Please register or sign in as a returning visitor first.' });
  }
  next();
}