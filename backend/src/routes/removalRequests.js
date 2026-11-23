import { Router } from 'express';
import db from '../db.js';
import { identifyVisitor, requireVisitor } from '../middleware/identifyVisitor.js';

const router = Router();

// POST /api/removal-requests  { photoId, reason }
router.post('/', identifyVisitor, requireVisitor, (req, res) => {
  const photoId = String(req.body?.photoId || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 500);

  const photo = db.prepare('SELECT photo_id, visitor_id FROM photos WHERE photo_id = ?').get(photoId);

  // Same answer whether the photo does not exist or belongs to someone else
  if (!photo || photo.visitor_id !== req.visitor.visitor_id) {
    return res.status(404).json({ error: 'Photo not found.' });
  }

  const waiting = db
    .prepare("SELECT request_id FROM removal_requests WHERE photo_id = ? AND status = 'pending'")
    .get(photoId);
  if (waiting) {
    return res.status(409).json({ error: 'A removal request for this photo is already waiting for the admin.' });
  }

  db.prepare('INSERT INTO removal_requests (photo_id, visitor_id, reason) VALUES (?, ?, ?)').run(
    photoId,
    req.visitor.visitor_id,
    reason || null
  );
  res.status(201).json({ ok: true });
});

export default router;