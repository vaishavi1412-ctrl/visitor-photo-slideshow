import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import db from '../src/db.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR;

afterAll(() => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

// Start every test with an empty photos table
beforeEach(() => {
  db.exec('DELETE FROM photos');
});

function makeImage(red) {
  return sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: red, g: 90, b: 140 } },
  })
    .png()
    .toBuffer();
}

async function newVisitor(name) {
  const agent = request.agent(app);
  const res = await agent.post('/api/visitors/register').send({ fullName: name });
  return { agent, visitorId: res.body.visitor.id };
}

async function uploadPhoto(agent, red) {
  const res = await agent
    .post('/api/photos')
    .field('consent', 'true')
    .attach('photos', await makeImage(red), { filename: 'p.png', contentType: 'image/png' });
  return res.body.results[0].photo;
}

// Inserts a photo record directly, so we can create cases the upload route never allows
function addRow({ visitorId, consent, display = 'visible', withFile = true }) {
  const photoId = crypto.randomUUID();
  const fileName = `${photoId}.webp`;
  if (withFile) fs.writeFileSync(path.join(UPLOAD_DIR, fileName), 'x');

  db.prepare(
    `INSERT INTO photos (photo_id, visitor_id, image_path, file_hash, consent_status, display_status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(photoId, visitorId, `/uploads/${fileName}`, crypto.randomUUID(), consent, display);

  return photoId;
}

describe('Slideshow API', () => {
  it('returns an empty list and default settings when there are no photos', async () => {
    const res = await request(app).get('/api/slideshow');
    expect(res.status).toBe(200);
    expect(res.body.photos).toEqual([]);
    expect(res.body.settings).toEqual({ photoDuration: 5, transitionType: 'fade' });
  });

  it('shows photos from different visitors', async () => {
    const a = await newVisitor('Slide A');
    const b = await newVisitor('Slide B');
    const photoA = await uploadPhoto(a.agent, 10);
    const photoB = await uploadPhoto(b.agent, 20);

    const res = await request(app).get('/api/slideshow');
    const ids = res.body.photos.map((p) => p.id);
    expect(ids).toContain(photoA.id);
    expect(ids).toContain(photoB.id);
  });

  it('does not reveal visitor names or other private details', async () => {
    const { agent } = await newVisitor('Secret Name');
    await uploadPhoto(agent, 30);

    const res = await request(app).get('/api/slideshow');
    expect(JSON.stringify(res.body)).not.toContain('Secret Name');
    expect(Object.keys(res.body.photos[0]).sort()).toEqual(['id', 'url']);
  });

  it('never shows a photo without consent', async () => {
    const { visitorId } = await newVisitor('No Consent Slide');
    const hiddenForConsent = addRow({ visitorId, consent: 0 });
    const allowed = addRow({ visitorId, consent: 1 });

    const res = await request(app).get('/api/slideshow');
    const ids = res.body.photos.map((p) => p.id);
    expect(ids).toContain(allowed);          // control: a consented photo is shown
    expect(ids).not.toContain(hiddenForConsent);
  });

  it('never shows a photo that the admin has hidden', async () => {
    const { visitorId } = await newVisitor('Hidden Slide');
    const hidden = addRow({ visitorId, consent: 1, display: 'hidden' });

    const res = await request(app).get('/api/slideshow');
    expect(res.body.photos.map((p) => p.id)).not.toContain(hidden);
  });

  it('skips records whose image file is missing (no broken images)', async () => {
    const { visitorId } = await newVisitor('Missing File');
    const missing = addRow({ visitorId, consent: 1, withFile: false });
    const present = addRow({ visitorId, consent: 1, withFile: true });

    const res = await request(app).get('/api/slideshow');
    const ids = res.body.photos.map((p) => p.id);
    expect(ids).toContain(present);
    expect(ids).not.toContain(missing);
  });

  it('removes a photo from the slideshow after the visitor deletes it', async () => {
    const { agent } = await newVisitor('Delete Slide');
    const photo = await uploadPhoto(agent, 40);

    let res = await request(app).get('/api/slideshow');
    expect(res.body.photos.map((p) => p.id)).toContain(photo.id);

    await agent.delete(`/api/photos/${photo.id}`);

    res = await request(app).get('/api/slideshow');
    expect(res.body.photos.map((p) => p.id)).not.toContain(photo.id);
  });
});

describe('Live update events', () => {
  it('announces photos:updated after an upload and after a delete', async () => {
    const fakeIo = { emit: vi.fn() };
    app.set('io', fakeIo);

    const { agent } = await newVisitor('Live Update');
    const photo = await uploadPhoto(agent, 50);
    expect(fakeIo.emit).toHaveBeenCalledWith('photos:updated');

    fakeIo.emit.mockClear();
    await agent.delete(`/api/photos/${photo.id}`);
    expect(fakeIo.emit).toHaveBeenCalledWith('photos:updated');

    app.set('io', undefined);
  });

  it('does not announce anything when an upload fails', async () => {
    const fakeIo = { emit: vi.fn() };
    app.set('io', fakeIo);

    const { agent } = await newVisitor('Failed Upload');
    await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', Buffer.from('not an image'), { filename: 'x.jpg', contentType: 'image/jpeg' });

    expect(fakeIo.emit).not.toHaveBeenCalled();
    app.set('io', undefined);
  });
});