import crypto from 'crypto';
import { hashToken } from '../utils/tokens.js';

const SESSION_MS = 2 * 60 * 60 * 1000; // 2 hours

// Active admin sessions, kept in memory: hashed token -> session details
const sessions = new Map();

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict', // the cookie is never sent from other websites
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MS,
};

export function createSession(admin) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(hashToken(token), {
    adminId: admin.admin_id,
    username: admin.username,
    expiresAt: Date.now() + SESSION_MS,
  });
  return token;
}

export function destroySession(token) {
  if (typeof token === 'string') sessions.delete(hashToken(token));
}

// Sets req.admin when the cookie holds a valid, unexpired session
export function identifyAdmin(req, res, next) {
  req.admin = null;
  const token = req.cookies?.admin_token;

  if (typeof token === 'string') {
    const key = hashToken(token);
    const session = sessions.get(key);
    if (session && session.expiresAt > Date.now()) {
      req.admin = session;
    } else if (session) {
      sessions.delete(key);
    }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Admin login required.' });
  }
  next();
}