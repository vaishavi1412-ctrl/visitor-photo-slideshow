import { Router } from 'express';
import db from '../db.js';
import { generateToken, hashToken, generateVisitorCode } from '../utils/tokens.js';
import { cleanName } from '../utils/validate.js';
import { identifyVisitor } from '../middleware/identifyVisitor.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
router.use(identifyVisitor);

const COOKIE_OPTIONS = {
  httpOnly: true,                                   // JavaScript cannot read it
  sameSite: 'lax',                                  // basic protection against other sites
  secure: process.env.NODE_ENV === 'production',    // HTTPS only when deployed
  maxAge: 365 * 24 * 60 * 60 * 1000,                // one year
};

const insertVisitor = db.prepare(
  'INSERT INTO visitors (full_name, visitor_code, token_hash) VALUES (?, ?, ?)'
);
const getVisitorById = db.prepare('SELECT * FROM visitors WHERE visitor_id = ?');
const getVisitorByCode = db.prepare('SELECT * FROM visitors WHERE visitor_code = ?');
const updateTokenHash = db.prepare('UPDATE visitors SET token_hash = ? WHERE visitor_id = ?');

// Only send safe fields to the browser (never the token hash)
function publicVisitor(v) {
  return { id: v.visitor_id, fullName: v.full_name, visitorCode: v.visitor_code };
}

// Creates a visitor. If the random code collides with an existing one,
// the database rejects it (UNIQUE) and we simply try a new code.
function createVisitor(fullName) {
  const token = generateToken();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const info = insertVisitor.run(fullName, generateVisitorCode(), hashToken(token));
      return { visitor: getVisitorById.get(info.lastInsertRowid), token };
    } catch (err) {
      if (err.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
    }
  }
  throw new Error('Could not create a unique visitor code');
}

// POST /api/visitors/register  { fullName }
router.post('/register', (req, res) => {
  const name = cleanName(req.body?.fullName);
  if (name.error) {
    return res.status(400).json({ error: name.error });
  }

  // Same browser, same name: reuse the record instead of creating a duplicate
  if (req.visitor && req.visitor.full_name.toLowerCase() === name.value.toLowerCase()) {
    return res.json({ visitor: publicVisitor(req.visitor), alreadyRegistered: true });
  }

  const { visitor, token } = createVisitor(name.value);
  res.cookie('visitor_token', token, COOKIE_OPTIONS);
  res.status(201).json({ visitor: publicVisitor(visitor), alreadyRegistered: false });
});

// GET /api/visitors/me  -> who is this browser?
router.get('/me', (req, res) => {
  res.json({ visitor: req.visitor ? publicVisitor(req.visitor) : null });
});

// POST /api/visitors/login  { visitorCode, fullName }  (returning visitor, new device)
router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  const code = String(req.body?.visitorCode || '').trim().toUpperCase();
  const name = cleanName(req.body?.fullName);

  const visitor = code && !name.error ? getVisitorByCode.get(code) : null;

  // One message for every failure, so nobody can learn which codes exist
  if (!visitor || visitor.full_name.toLowerCase() !== name.value.toLowerCase()) {
    return res.status(401).json({ error: 'We could not find a visitor with that code and name.' });
  }

  // Give this device a fresh token (the old device's cookie stops working)
  const token = generateToken();
  updateTokenHash.run(hashToken(token), visitor.visitor_id);
  res.cookie('visitor_token', token, COOKIE_OPTIONS);
  res.json({ visitor: publicVisitor(visitor) });
});

// POST /api/visitors/logout  -> "forget this device"
router.post('/logout', (req, res) => {
  res.clearCookie('visitor_token', { ...COOKIE_OPTIONS, maxAge: undefined });
  res.json({ ok: true });
});

export default router;