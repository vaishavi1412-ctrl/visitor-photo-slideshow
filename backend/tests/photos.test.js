import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import db from '../src/db.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR;

afterAll(() => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

// Makes a small real image. Different colours give different file contents.
function makeImage(red, format = 'png') {
  return sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: red, g: 80, b: 120 } },
  })
    [format]()
    .toBuffer();
}

async function newVisitor(name) {
  const agent = request.agent(app);
  const res = await agent.post('/api/visitors/register').send({ fullName: name });
  return { agent, visitorId: res.body.visitor.id };
}

function photoCount(visitorId) {
  return db.prepare('SELECT COUNT(*) AS n FROM photos WHERE visitor_id = ?').get(visitorId).n;
}

describe('Photo upload', () => {
  it('rejects uploads from someone who is not registered', async () => {
    const res = await request(app)
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(10), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('rejects an upload without consent and saves nothing', async () => {
    const { agent, visitorId } = await newVisitor('No Consent');
    const res = await agent
      .post('/api/photos')
      .attach('photos', await makeImage(20), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/consent/i);
    expect(photoCount(visitorId)).toBe(0);
  });

  it('saves one photo with a safe generated file name', async () => {
    const { agent, visitorId } = await newVisitor('Single Upload');
    const res = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(30), { filename: '../../evil name.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.savedCount).toBe(1);

    const photo = res.body.results[0].photo;
    expect(photo.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webp$/);
    expect(photo.url).not.toContain('evil');
    expect(fs.existsSync(path.join(UPLOAD_DIR, path.basename(photo.url)))).toBe(true);

    const row = db.prepare('SELECT consent_status FROM photos WHERE photo_id = ?').get(photo.id);
    expect(row.consent_status).toBe(1);
    expect(photoCount(visitorId)).toBe(1);
  });

  it('saves several photos in one upload (JPG, PNG and WEBP)', async () => {
    const { agent, visitorId } = await newVisitor('Multi Upload');
    const res = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(40, 'png'), { filename: 'one.png', contentType: 'image/png' })
      .attach('photos', await makeImage(50, 'jpeg'), { filename: 'two.jpg', contentType: 'image/jpeg' })
      .attach('photos', await makeImage(60, 'webp'), { filename: 'three.webp', contentType: 'image/webp' });

    expect(res.status).toBe(201);
    expect(res.body.savedCount).toBe(3);
    expect(photoCount(visitorId)).toBe(3);
  });

  it('rejects an unsupported file type', async () => {
    const { agent, visitorId } = await newVisitor('Wrong Type');
    const res = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', Buffer.from('just some text'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.results[0].status).toBe('rejected');
    expect(photoCount(visitorId)).toBe(0);
  });

  it('rejects a fake image (text file renamed to .jpg)', async () => {
    const { agent, visitorId } = await newVisitor('Fake Image');
    const res = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', Buffer.from('I am not really a picture'), { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.results[0].reason).toMatch(/not a valid image/i);
    expect(photoCount(visitorId)).toBe(0);
  });

  it('rejects a file larger than 5 MB', async () => {
    const { agent, visitorId } = await newVisitor('Big File');
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1);
    const res = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', tooBig, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/5 MB/);
    expect(photoCount(visitorId)).toBe(0);
  });

  it('does not save the same photo twice for one visitor', async () => {
    const { agent, visitorId } = await newVisitor('Duplicate Test');
    const image = await makeImage(70);

    const first = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', image, { filename: 'a.png', contentType: 'image/png' });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', image, { filename: 'again.png', contentType: 'image/png' });
    expect(second.status).toBe(400);
    expect(second.body.results[0].status).toBe('duplicate');
    expect(photoCount(visitorId)).toBe(1);
  });

  it('handles several visitors uploading at the same time', async () => {
    const visitors = await Promise.all(
      ['Sim A', 'Sim B', 'Sim C', 'Sim D', 'Sim E'].map((n) => newVisitor(n))
    );

    const responses = await Promise.all(
      visitors.map(async ({ agent }, index) =>
        agent
          .post('/api/photos')
          .field('consent', 'true')
          .attach('photos', await makeImage(100 + index * 10), { filename: 'same-name.png', contentType: 'image/png' })
      )
    );

    responses.forEach((res) => expect(res.status).toBe(201));

    const ids = responses.map((res) => res.body.results[0].photo.id);
    expect(new Set(ids).size).toBe(5); // every photo got its own unique id

    const urls = responses.map((res) => res.body.results[0].photo.url);
    expect(new Set(urls).size).toBe(5); // and its own file, nothing overwritten
    urls.forEach((url) => {
      expect(fs.existsSync(path.join(UPLOAD_DIR, path.basename(url)))).toBe(true);
    });
  });
});

describe('Previous photos and deleting', () => {
  it('shows a returning visitor their previous and new photos', async () => {
    const { agent } = await newVisitor('Returning Person');
    await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(150), { filename: 'old.png', contentType: 'image/png' });

    // Later visit: same cookie, new upload
    await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(160), { filename: 'new.png', contentType: 'image/png' });

    const mine = await agent.get('/api/photos/mine');
    expect(mine.status).toBe(200);
    expect(mine.body.photos).toHaveLength(2);
  });

  it('only lists the visitor\'s own photos', async () => {
    const a = await newVisitor('Owner One');
    const b = await newVisitor('Owner Two');
    await a.agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(170), { filename: 'a.png', contentType: 'image/png' });

    const mineB = await b.agent.get('/api/photos/mine');
    expect(mineB.body.photos).toHaveLength(0);
  });

  it('lets a visitor delete their own photo (row and file)', async () => {
    const { agent, visitorId } = await newVisitor('Deleter');
    const up = await agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(180), { filename: 'a.png', contentType: 'image/png' });
    const photo = up.body.results[0].photo;
    const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));
    expect(fs.existsSync(filePath)).toBe(true);

    const del = await agent.delete(`/api/photos/${photo.id}`);
    expect(del.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(photoCount(visitorId)).toBe(0);
  });

  it('does not let a visitor delete someone else\'s photo', async () => {
    const owner = await newVisitor('Photo Owner');
    const other = await newVisitor('Other Person');
    const up = await owner.agent
      .post('/api/photos')
      .field('consent', 'true')
      .attach('photos', await makeImage(190), { filename: 'a.png', contentType: 'image/png' });
    const photo = up.body.results[0].photo;

    const del = await other.agent.delete(`/api/photos/${photo.id}`);
    expect(del.status).toBe(404);
    expect(photoCount(owner.visitorId)).toBe(1);
  });
});