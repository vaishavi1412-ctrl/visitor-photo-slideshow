import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import db from '../db.js';
import { UPLOAD_DIR } from '../config.js';
import { identifyVisitor, requireVisitor } from '../middleware/identifyVisitor.js';

const router = Router();

const MAX_MB = Number(process.env.MAX_FILE_SIZE_MB) || 5;
const MAX_FILES = 10;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Files are kept in memory while we check them, then written to disk by us
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FILES },
});

const insertPhoto = db.prepare(
  `INSERT INTO photos (photo_id, visitor_id, image_path, file_hash, consent_status, display_status)
   VALUES (?, ?, ?, ?, 1, 'visible')`
);
const getPhoto = db.prepare('SELECT * FROM photos WHERE photo_id = ?');
const findDuplicate = db.prepare('SELECT photo_id FROM photos WHERE visitor_id = ? AND file_hash = ?');
const listVisitorPhotos = db.prepare(
  'SELECT * FROM photos WHERE visitor_id = ? ORDER BY upload_date DESC, rowid DESC'
);
const deletePhotoRow = db.prepare('DELETE FROM photos WHERE photo_id = ? AND visitor_id = ?');

function publicPhoto(p) {
  return {
    id: p.photo_id,
    url: p.image_path,
    uploadDate: p.upload_date,
    consent: p.consent_status === 1,
    displayStatus: p.display_status,
  };
}

// Runs multer and turns its errors into clear messages
function receiveFiles(req, res, next) {
  upload.array('photos', MAX_FILES)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const messages = {
        LIMIT_FILE_SIZE: `Each photo must be ${MAX_MB} MB or smaller.`,
        LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES} photos at a time.`,
        LIMIT_UNEXPECTED_FILE: 'Unexpected file field. Use the "photos" field.',
      };
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: messages[err.code] || 'Upload failed.' });
    }
    next(err);
  });
}

// Checks, converts and saves ONE photo. Always returns a result object.
async function processOne(file, visitorId) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { status: 'rejected', reason: 'Only JPG, JPEG, PNG and WEBP images are allowed.' };
  }

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
  if (findDuplicate.get(visitorId, fileHash)) {
    return { status: 'duplicate', reason: 'You have already uploaded this photo.' };
  }

  // Re-encoding proves the file is a real image and removes hidden metadata
  let output;
  try {
    output = await sharp(file.buffer, { limitInputPixels: 50_000_000 })
      .rotate() // apply the camera's orientation, then forget it
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { status: 'rejected', reason: 'This file is not a valid image.' };
  }

  // Safe file name: a random UUID, never the visitor's own file name
  const photoId = crypto.randomUUID();
  const fileName = `${photoId}.webp`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  await fs.writeFile(filePath, output, { flag: 'wx' }); // "wx" = fail instead of overwrite

  try {
    insertPhoto.run(photoId, visitorId, `/uploads/${fileName}`, fileHash);
  } catch (err) {
    await fs.unlink(filePath).catch(() => {}); // do not leave an orphan file
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { status: 'duplicate', reason: 'You have already uploaded this photo.' };
    }
    throw err;
  }

  return { status: 'saved', photo: publicPhoto(getPhoto.get(photoId)) };
}

// POST /api/photos   (multipart form: photos[] files + consent=true)
router.post('/', identifyVisitor, requireVisitor, receiveFiles, async (req, res, next) => {
  try {
    if (req.body?.consent !== 'true') {
      return res.status(400).json({
        error: 'You must give consent before your photos can be shown on the slideshow.',
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Please choose at least one photo.' });
    }

    const results = [];
    for (const file of req.files) {
      const result = await processOne(file, req.visitor.visitor_id);
      results.push({ fileName: file.originalname, ...result });
    }

    const savedCount = results.filter((r) => r.status === 'saved').length;

    if (savedCount > 0) {
      // Tell every open slideshow screen that new photos exist (used in the next group)
      req.app.get('io')?.emit('photos:updated');
    }

    res.status(savedCount > 0 ? 201 : 400).json({ savedCount, results });
  } catch (err) {
    next(err);
  }
});

// GET /api/photos/mine  -> all photos of the recognized visitor (previous and new)
router.get('/mine', identifyVisitor, requireVisitor, (req, res) => {
  const photos = listVisitorPhotos.all(req.visitor.visitor_id).map(publicPhoto);
  res.json({ photos });
});

// DELETE /api/photos/:id  -> a visitor removes one of their own photos
router.delete('/:id', identifyVisitor, requireVisitor, async (req, res, next) => {
  try {
    const photo = getPhoto.get(req.params.id);

    // Same answer for "does not exist" and "belongs to someone else"
    if (!photo || photo.visitor_id !== req.visitor.visitor_id) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    deletePhotoRow.run(photo.photo_id, req.visitor.visitor_id);
    // basename() makes sure we only ever delete a file inside the uploads folder
    await fs.unlink(path.join(UPLOAD_DIR, path.basename(photo.image_path))).catch(() => {});

    req.app.get('io')?.emit('photos:updated');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;