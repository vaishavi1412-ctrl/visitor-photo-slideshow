import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import app from '../src/app.js';
import db from '../src/db.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR;
const ADMIN_USER = 'test-admin';
const ADMIN_PASS = 'a-test-only-password'; // exists only inside the in-memory test database

let adminAgent; // behaves like a browser that is logged in as admin

beforeAll(async () => {
  db.prepare('INSERT INTO admin (username, password_hash) VALUES (?, ?)').run(
    ADMIN_USER,
    bcrypt.hashSync(ADMIN_PASS, 4)
  );
  adminAgent = request.agent(app);
  const res = await adminAgent.post('/api/admin/login').send({ username: ADMIN_USER, password: ADMIN_PASS });
  expect(res.status).toBe(200);
});

afterAll(() => {
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  db.exec('DELETE FROM removal_requests');
  db.exec('DELETE FROM photos');
  db.exec('DELETE FROM visitors');
  db.exec("UPDATE slideshow_settings SET photo_duration = 5, transition_type = 'fade'");
});

function makeImage(red) {
  return sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: red, g: 70, b: 150 } },
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

async function slideshowIds() {
  const res = await request(app).get('/api/slideshow');
  return res.body.photos.map((p) => p.id);
}

describe('Admin authentication', () => {
  it('blocks every admin route when not logged in', async () => {
    const routes = [
      ['get', '/api/admin/stats'],
      ['get', '/api/admin/photos'],
      ['get', '/api/admin/visitors'],
      ['get', '/api/admin/settings'],
      ['get', '/api/admin/removal-requests'],
      ['delete', '/api/admin/photos/some-id'],
      ['delete', '/api/admin/visitors/1'],
      ['put', '/api/admin/settings'],
    ];
    for (const [method, url] of routes) {
      const res = await request(app)[method](url);
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it('rejects a wrong password and an unknown username with the same message', async () => {
    const wrongPass = await request(app)
      .post('/api/admin/login')
      .send({ username: ADMIN_USER, password: 'not-the-password' });
    const wrongUser = await request(app)
      .post('/api/admin/login')
      .send({ username: 'nobody', password: ADMIN_PASS });

    expect(wrongPass.status).toBe(401);
    expect(wrongUser.status).toBe(401);
    expect(wrongPass.body.error).toBe(wrongUser.body.error);
  });

  it('logs in with the right password and sets a strict HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: ADMIN_USER, password: ADMIN_PASS });

    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('admin_token');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('stores only a bcrypt hash, never the password', () => {
    const row = db.prepare('SELECT password_hash FROM admin WHERE username = ?').get(ADMIN_USER);
    expect(row.password_hash).not.toBe(ADMIN_PASS);
    expect(row.password_hash.startsWith('$2')).toBe(true);
  });

  it('ends the session on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/admin/login').send({ username: ADMIN_USER, password: ADMIN_PASS });

    const before = await agent.get('/api/admin/me');
    expect(before.body.admin.username).toBe(ADMIN_USER);

    await agent.post('/api/admin/logout');

    const after = await agent.get('/api/admin/me');
    expect(after.body.admin).toBeNull();
    const stats = await agent.get('/api/admin/stats');
    expect(stats.status).toBe(401);
  });
});

describe('Admin dashboard, photos and visitors', () => {
  it('shows correct totals and recent visitors', async () => {
    const a = await newVisitor('Stat One');
    const b = await newVisitor('Stat Two');
    await uploadPhoto(a.agent, 10);
    await uploadPhoto(b.agent, 20);

    const res = await adminAgent.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.totalVisitors).toBe(2);
    expect(res.body.totalPhotos).toBe(2);
    expect(res.body.onSlideshow).toBe(2);
    expect(res.body.recentVisitors).toHaveLength(2);
    expect(res.body.recentVisitors[0].fullName).toBe('Stat Two');
  });

  it('lists all photos with the visitor name', async () => {
    const a = await newVisitor('Lister');
    await uploadPhoto(a.agent, 30);

    const res = await adminAgent.get('/api/admin/photos');
    expect(res.body.photos).toHaveLength(1);
    expect(res.body.photos[0].visitorName).toBe('Lister');
    expect(res.body.photos[0].consent).toBe(true);
  });

  it('hides a photo from the slideshow and shows it again', async () => {
    const a = await newVisitor('Hider');
    const photo = await uploadPhoto(a.agent, 40);
    expect(await slideshowIds()).toContain(photo.id);

    const hide = await adminAgent.patch(`/api/admin/photos/${photo.id}`).send({ displayStatus: 'hidden' });
    expect(hide.status).toBe(200);
    expect(await slideshowIds()).not.toContain(photo.id);

    await adminAgent.patch(`/api/admin/photos/${photo.id}`).send({ displayStatus: 'visible' });
    expect(await slideshowIds()).toContain(photo.id);
  });

  it('rejects an invalid display status', async () => {
    const a = await newVisitor('Bad Status');
    const photo = await uploadPhoto(a.agent, 50);
    const res = await adminAgent.patch(`/api/admin/photos/${photo.id}`).send({ displayStatus: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('deletes a photo for good (row, file and slideshow)', async () => {
    const a = await newVisitor('Deleted Photo');
    const photo = await uploadPhoto(a.agent, 60);
    const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));
    expect(fs.existsSync(filePath)).toBe(true);

    const res = await adminAgent.delete(`/api/admin/photos/${photo.id}`);
    expect(res.status).toBe(200);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(await slideshowIds()).not.toContain(photo.id);

    const again = await adminAgent.delete(`/api/admin/photos/${photo.id}`);
    expect(again.status).toBe(404);
  });

  it('lists visitors without their codes or token hashes', async () => {
    await newVisitor('Private Person');
    const res = await adminAgent.get('/api/admin/visitors');
    expect(res.body.visitors).toHaveLength(1);
    expect(Object.keys(res.body.visitors[0]).sort()).toEqual(['createdAt', 'fullName', 'id', 'photoCount']);
  });

  it('renames a visitor and validates the new name', async () => {
    const a = await newVisitor('Old Name');
    const ok = await adminAgent.patch(`/api/admin/visitors/${a.visitorId}`).send({ fullName: 'New Name' });
    expect(ok.status).toBe(200);

    const row = db.prepare('SELECT full_name FROM visitors WHERE visitor_id = ?').get(a.visitorId);
    expect(row.full_name).toBe('New Name');

    const bad = await adminAgent.patch(`/api/admin/visitors/${a.visitorId}`).send({ fullName: '<b>' });
    expect(bad.status).toBe(400);
  });

  it('deletes a visitor together with their photos and files', async () => {
    const a = await newVisitor('Gone Visitor');
    const photo = await uploadPhoto(a.agent, 70);
    const filePath = path.join(UPLOAD_DIR, path.basename(photo.url));

    const res = await adminAgent.delete(`/api/admin/visitors/${a.visitorId}`);
    expect(res.status).toBe(200);

    expect(db.prepare('SELECT COUNT(*) AS n FROM visitors').get().n).toBe(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM photos').get().n).toBe(0);
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('Slideshow settings', () => {
  it('reads and updates the settings, and the slideshow uses them', async () => {
    const before = await adminAgent.get('/api/admin/settings');
    expect(before.body.settings).toEqual({ photoDuration: 5, transitionType: 'fade' });

    const put = await adminAgent.put('/api/admin/settings').send({ photoDuration: 8, transitionType: 'zoom' });
    expect(put.status).toBe(200);

    const show = await request(app).get('/api/slideshow');
    expect(show.body.settings).toEqual({ photoDuration: 8, transitionType: 'zoom' });
  });

  it('rejects an invalid duration or transition', async () => {
    const tooShort = await adminAgent.put('/api/admin/settings').send({ photoDuration: 1, transitionType: 'fade' });
    const tooLong = await adminAgent.put('/api/admin/settings').send({ photoDuration: 100, transitionType: 'fade' });
    const notNumber = await adminAgent.put('/api/admin/settings').send({ photoDuration: 'abc', transitionType: 'fade' });
    const badTransition = await adminAgent.put('/api/admin/settings').send({ photoDuration: 5, transitionType: 'spin' });

    [tooShort, tooLong, notNumber, badTransition].forEach((res) => expect(res.status).toBe(400));
  });
});

describe('Photo removal requests', () => {
  it('lets a visitor request removal of their own photo, once', async () => {
    const a = await newVisitor('Requester');
    const photo = await uploadPhoto(a.agent, 80);

    const first = await a.agent.post('/api/removal-requests').send({ photoId: photo.id, reason: 'Please remove' });
    expect(first.status).toBe(201);

    const second = await a.agent.post('/api/removal-requests').send({ photoId: photo.id });
    expect(second.status).toBe(409);

    const list = await adminAgent.get('/api/admin/removal-requests');
    expect(list.body.requests).toHaveLength(1);
    expect(list.body.requests[0].status).toBe('pending');
    expect(list.body.requests[0].visitorName).toBe('Requester');

    const stats = await adminAgent.get('/api/admin/stats');
    expect(stats.body.pendingRemovalRequests).toBe(1);
  });

  it('does not let a visitor request removal of someone else\'s photo', async () => {
    const owner = await newVisitor('Real Owner');
    const other = await newVisitor('Not Owner');
    const photo = await uploadPhoto(owner.agent, 90);

    const res = await other.agent.post('/api/removal-requests').send({ photoId: photo.id });
    expect(res.status).toBe(404);
  });

  it('hides the photo when the admin approves the request', async () => {
    const a = await newVisitor('Approved Case');
    const photo = await uploadPhoto(a.agent, 100);
    await a.agent.post('/api/removal-requests').send({ photoId: photo.id });

    const list = await adminAgent.get('/api/admin/removal-requests');
    const res = await adminAgent.patch(`/api/admin/removal-requests/${list.body.requests[0].id}`).send({ status: 'approved' });
    expect(res.status).toBe(200);

    expect(await slideshowIds()).not.toContain(photo.id);
    const after = await adminAgent.get('/api/admin/removal-requests');
    expect(after.body.requests[0].status).toBe('approved');
  });

  it('keeps the photo visible when the admin rejects the request', async () => {
    const a = await newVisitor('Rejected Case');
    const photo = await uploadPhoto(a.agent, 110);
    await a.agent.post('/api/removal-requests').send({ photoId: photo.id });

    const list = await adminAgent.get('/api/admin/removal-requests');
    await adminAgent.patch(`/api/admin/removal-requests/${list.body.requests[0].id}`).send({ status: 'rejected' });

    expect(await slideshowIds()).toContain(photo.id);
  });
});