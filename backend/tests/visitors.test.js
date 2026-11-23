import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

describe('Visitor registration and recognition', () => {
  it('registers a new visitor and sets a secure cookie', async () => {
    const res = await request(app)
      .post('/api/visitors/register')
      .send({ fullName: 'Asha Patel' });

    expect(res.status).toBe(201);
    expect(res.body.visitor.fullName).toBe('Asha Patel');
    expect(res.body.visitor.visitorCode).toHaveLength(6);
    expect(res.headers['set-cookie'][0]).toContain('visitor_token');
    expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('rejects an empty or invalid name', async () => {
    const empty = await request(app).post('/api/visitors/register').send({ fullName: '   ' });
    expect(empty.status).toBe(400);

    const bad = await request(app).post('/api/visitors/register').send({ fullName: '<script>' });
    expect(bad.status).toBe(400);
  });

  it('recognizes a returning visitor by cookie without creating a duplicate', async () => {
    const agent = request.agent(app); // an agent remembers cookies like a browser
    const first = await agent.post('/api/visitors/register').send({ fullName: 'Ravi Shah' });

    const me = await agent.get('/api/visitors/me');
    expect(me.body.visitor.id).toBe(first.body.visitor.id);

    const again = await agent.post('/api/visitors/register').send({ fullName: 'ravi shah' });
    expect(again.body.alreadyRegistered).toBe(true);
    expect(again.body.visitor.id).toBe(first.body.visitor.id);

    const count = db
      .prepare('SELECT COUNT(*) AS n FROM visitors WHERE lower(full_name) = ?')
      .get('ravi shah').n;
    expect(count).toBe(1);
  });

  it('returns no visitor when there is no cookie', async () => {
    const res = await request(app).get('/api/visitors/me');
    expect(res.body.visitor).toBeNull();
  });

  it('lets a returning visitor sign in on a new device with code and name', async () => {
    const first = await request(app).post('/api/visitors/register').send({ fullName: 'Meera Joshi' });
    const code = first.body.visitor.visitorCode;

    const newDevice = request.agent(app);
    const login = await newDevice
      .post('/api/visitors/login')
      .send({ visitorCode: code, fullName: 'Meera Joshi' });
    expect(login.status).toBe(200);
    expect(login.body.visitor.id).toBe(first.body.visitor.id);

    const me = await newDevice.get('/api/visitors/me');
    expect(me.body.visitor.id).toBe(first.body.visitor.id);
  });

  it('rejects a wrong code or wrong name', async () => {
    const first = await request(app).post('/api/visitors/register').send({ fullName: 'Kiran Desai' });

    const wrongCode = await request(app)
      .post('/api/visitors/login')
      .send({ visitorCode: 'AAAAAA', fullName: 'Kiran Desai' });
    expect(wrongCode.status).toBe(401);

    const wrongName = await request(app)
      .post('/api/visitors/login')
      .send({ visitorCode: first.body.visitor.visitorCode, fullName: 'Someone Else' });
    expect(wrongName.status).toBe(401);
  });

  it('forgets the device on logout', async () => {
    const agent = request.agent(app);
    await agent.post('/api/visitors/register').send({ fullName: 'Nisha Rao' });
    await agent.post('/api/visitors/logout');

    const me = await agent.get('/api/visitors/me');
    expect(me.body.visitor).toBeNull();
  });
});