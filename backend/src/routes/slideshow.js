import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { UPLOAD_DIR } from '../config.js';
import { getSettings } from '../utils/settings.js';

const router = Router();

// The rule that protects privacy: no consent, or hidden by admin = never listed
const listShowable = db.prepare(
  `SELECT photo_id, image_path
   FROM photos
   WHERE consent_status = 1 AND display_status = 'visible'
   ORDER BY upload_date ASC, rowid ASC`
);

// GET /api/slideshow  (public: used by the TV page)
router.get('/', (req, res) => {
  const photos = listShowable
    .all()
    // Skip records whose image file is missing, so the TV never shows a broken image
    .filter((p) => fs.existsSync(path.join(UPLOAD_DIR, path.basename(p.image_path))))
    .map((p) => ({ id: p.photo_id, url: p.image_path }));

  res.set('Cache-Control', 'no-store'); // always fetch the latest list
  res.json({ photos, settings: getSettings() });
});

export default router;