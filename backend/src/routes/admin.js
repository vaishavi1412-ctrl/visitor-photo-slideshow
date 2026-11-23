import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import db from '../db.js';
import { UPLOAD_DIR } from '../config.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  identifyAdmin,
  requireAdmin,
  createSession,
  destroySession,
  ADMIN_COOKIE_OPTIONS,
} from '../middleware/adminAuth.js';
import { cleanName } from '../utils/validate.js';
import { getSettings, MIN_DURATION, MAX_DURATION, TRANSITIONS } from '../utils/settings.js';

const router = Router();
router.use(identifyAdmin);

// Used so a wrong username takes as long to reject as a wrong password
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Tell every open slideshow screen to reload its photo list and settings
function notifyScreens(req) {
  req.app.get('io')?.emit('photos:updated');
}

// Deletes the image file. basename() keeps us inside the uploads folder.
function removeFile(imagePath) {
  return fs.unlink(path.join(UPLOAD_DIR, path.basename(imagePath))).catch(() => {});
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Login, session check, logout (no admin needed) ----------

router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');

  const admin = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
  const passwordOk =
    password.length <= 200 && bcrypt.compareSync(password, admin ? admin.password_hash : DUMMY_HASH);

  if (!admin || !passwordOk) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }

  res.cookie('admin_token', createSession(admin), ADMIN_COOKIE_OPTIONS);
  res.json({ admin: { username: admin.username } });
});

router.get('/me', (req, res) => {
  res.json({ admin: req.admin ? { username: req.admin.username } : null });
});

router.post('/logout', (req, res) => {
  destroySession(req.cookies?.admin_token);
  res.clearCookie('admin_token', { ...ADMIN_COOKIE_OPTIONS, maxAge: undefined });
  res.json({ ok: true });
});

// ---------- Everything below needs a logged-in admin ----------

router.use(requireAdmin);

// Dashboard numbers
router.get('/stats', (req, res) => {
  const count = (sql) => db.prepare(sql).get().n;

  const recentVisitors = db
    .prepare(
      `SELECT v.visitor_id AS id, v.full_name AS fullName, v.created_at AS createdAt,
              COUNT(p.photo_id) AS photoCount
       FROM visitors v
       LEFT JOIN photos p ON p.visitor_id = v.visitor_id
       GROUP BY v.visitor_id
       ORDER BY v.created_at DESC, v.visitor_id DESC
       LIMIT 5`
    )
    .all();

  res.json({
    totalVisitors: count('SELECT COUNT(*) AS n FROM visitors'),
    totalPhotos: count('SELECT COUNT(*) AS n FROM photos'),
    onSlideshow: count(
      "SELECT COUNT(*) AS n FROM photos WHERE consent_status = 1 AND display_status = 'visible'"
    ),
    pendingRemovalRequests: count("SELECT COUNT(*) AS n FROM removal_requests WHERE status = 'pending'"),
    recentVisitors,
  });
});

// ---------- Photos ----------

router.get('/photos', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.photo_id AS id, p.image_path AS url, p.upload_date AS uploadDate,
              p.consent_status AS consent, p.display_status AS displayStatus,
              v.visitor_id AS visitorId, v.full_name AS visitorName
       FROM photos p
       JOIN visitors v ON v.visitor_id = p.visitor_id
       ORDER BY p.upload_date DESC, p.rowid DESC`
    )
    .all();

  res.json({ photos: rows.map((r) => ({ ...r, consent: r.consent === 1 })) });
});

// Hide a photo from the slideshow (or show it again)
router.patch('/photos/:id', (req, res) => {
  const status = req.body?.displayStatus;
  if (status !== 'visible' && status !== 'hidden') {
    return res.status(400).json({ error: 'displayStatus must be "visible" or "hidden".' });
  }

  const info = db
    .prepare('UPDATE photos SET display_status = ? WHERE photo_id = ?')
    .run(status, req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found.' });

  notifyScreens(req);
  res.json({ ok: true });
});

// Delete an inappropriate photo for good (database row and image file)
router.delete('/photos/:id', async (req, res, next) => {
  try {
    const photo = db.prepare('SELECT * FROM photos WHERE photo_id = ?').get(req.params.id);
    if (!photo) return res.status(404).json({ error: 'Photo not found.' });

    db.prepare('DELETE FROM photos WHERE photo_id = ?').run(photo.photo_id);
    await removeFile(photo.image_path);

    notifyScreens(req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Visitors ----------

// Note: the visitor code and token hash are NOT sent, so an admin cannot impersonate a visitor
router.get('/visitors', (req, res) => {
  const visitors = db
    .prepare(
      `SELECT v.visitor_id AS id, v.full_name AS fullName, v.created_at AS createdAt,
              COUNT(p.photo_id) AS photoCount
       FROM visitors v
       LEFT JOIN photos p ON p.visitor_id = v.visitor_id
       GROUP BY v.visitor_id
       ORDER BY v.visitor_id DESC`
    )
    .all();
  res.json({ visitors });
});

router.patch('/visitors/:id', (req, res) => {
  const id = parseId(req.params.id);
  const name = cleanName(req.body?.fullName);
  if (!id) return res.status(404).json({ error: 'Visitor not found.' });
  if (name.error) return res.status(400).json({ error: name.error });

  const info = db.prepare('UPDATE visitors SET full_name = ? WHERE visitor_id = ?').run(name.value, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Visitor not found.' });

  res.json({ ok: true });
});

// Deleting a visitor also deletes all of their photos (rows by CASCADE, files here)
router.delete('/visitors/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const visitor = id && db.prepare('SELECT visitor_id FROM visitors WHERE visitor_id = ?').get(id);
    if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });

    const photos = db.prepare('SELECT image_path FROM photos WHERE visitor_id = ?').all(id);
    db.prepare('DELETE FROM visitors WHERE visitor_id = ?').run(id);
    await Promise.all(photos.map((p) => removeFile(p.image_path)));

    notifyScreens(req);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------- Slideshow settings ----------

router.get('/settings', (req, res) => {
  res.json({
    settings: getSettings(),
    limits: { minDuration: MIN_DURATION, maxDuration: MAX_DURATION, transitions: TRANSITIONS },
  });
});

router.put('/settings', (req, res) => {
  const duration = Number(req.body?.photoDuration);
  const transition = req.body?.transitionType;

  if (!Number.isInteger(duration) || duration < MIN_DURATION || duration > MAX_DURATION) {
    return res
      .status(400)
      .json({ error: `Photo duration must be a whole number from ${MIN_DURATION} to ${MAX_DURATION} seconds.` });
  }
  if (!TRANSITIONS.includes(transition)) {
    return res.status(400).json({ error: `Transition must be one of: ${TRANSITIONS.join(', ')}.` });
  }

  db.prepare('UPDATE slideshow_settings SET photo_duration = ?, transition_type = ? WHERE setting_id = 1').run(
    duration,
    transition
  );

  notifyScreens(req);
  res.json({ settings: getSettings() });
});

// ---------- Photo removal requests ----------

router.get('/removal-requests', (req, res) => {
  const requests = db
    .prepare(
      `SELECT r.request_id AS id, r.photo_id AS photoId, r.reason, r.status, r.created_at AS createdAt,
              v.full_name AS visitorName, p.image_path AS url
       FROM removal_requests r
       JOIN visitors v ON v.visitor_id = r.visitor_id
       JOIN photos p ON p.photo_id = r.photo_id
       ORDER BY (r.status = 'pending') DESC, r.created_at DESC, r.request_id DESC`
    )
    .all();
  res.json({ requests });
});

// Approving hides the photo straight away. The admin can then delete it from the photo list.
const decideRequest = db.transaction((id, status) => {
  const request = db.prepare('SELECT * FROM removal_requests WHERE request_id = ?').get(id);
  if (!request) return null;

  db.prepare('UPDATE removal_requests SET status = ? WHERE request_id = ?').run(status, id);
  if (status === 'approved') {
    db.prepare("UPDATE photos SET display_status = 'hidden' WHERE photo_id = ?").run(request.photo_id);
  }
  return request;
});

router.patch('/removal-requests/:id', (req, res) => {
  const id = parseId(req.params.id);
  const status = req.body?.status;
  if (status !== 'approved' && status !== 'rejected') {
    return res.status(400).json({ error: 'status must be "approved" or "rejected".' });
  }

  const request = id && decideRequest(id, status);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  notifyScreens(req);
  res.json({ ok: true });
});

export default router;