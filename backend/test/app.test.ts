import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Dashboard, MemberDetail, RecentSession, SimulatorSlot } from '../../frontend/src/api/types';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { generateDummy } from '../src/domain/dummy';
import { Repo } from '../src/repo';
import { createFsStorage } from '../src/storage/fs';
import { loadFixture } from './helpers';

const NOW = new Date('2026-11-11T14:00:00+09:00');
const ENV = { STORAGE: 'fs', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'pw', AUTH_SECRET: 'secret' };

describe('HTTP API', () => {
  let dir = '';

  const setup = async (env: Record<string, string> = {}) => {
    const config = loadConfig({ ...ENV, ...env });
    const repo = await Repo.open(createFsStorage(dir), config);
    return createApp(repo, config, () => NOW);
  };

  const login = async (app: Hono) => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'pw' }),
    });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const postSession = (app: Hono, body: unknown, headers: Record<string, string> = {}) =>
    app.request('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tp-app-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts a unity session on first run and lists it as unassigned', async () => {
    const app = await setup();
    const res = await postSession(app, loadFixture('hit10'));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ ok: true });

    const auth = await login(app);
    const recent = (await (await app.request('/api/sessions/recent', { headers: auth })).json()) as RecentSession[];
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ memberId: null, memberName: null, counted: true, hitCount: 10, diameter: 7.6 });
  });

  it('rejects a wrong password and unauthenticated admin routes', async () => {
    const app = await setup();
    const bad = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'nope' }),
    });
    expect(bad.status).toBe(401);
    expect((await app.request('/api/company')).status).toBe(401);
    expect((await app.request('/api/company', { headers: { Authorization: 'Bearer junk' } })).status).toBe(401);
  });

  it('locks login for 5 minutes after 5 failures', async () => {
    const config = loadConfig(ENV);
    let now = NOW;
    const app = createApp(await Repo.open(createFsStorage(dir), config), config, () => now);
    const attempt = (password: string) =>
      app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password }),
      });

    for (let i = 0; i < 5; i++) expect((await attempt('nope')).status).toBe(401);
    expect((await attempt('pw')).status).toBe(429);

    now = new Date(NOW.getTime() + 5 * 60e3 + 1);
    expect((await attempt('pw')).status).toBe(200);
  });

  it('refuses login when the server has no admin password configured', async () => {
    const app = await setup({ ADMIN_PASSWORD: '' });
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: '' }),
    });
    expect(res.status).toBe(503);
  });

  it('runs roster → simulator assignment → ingest → member dashboard', async () => {
    const app = await setup();
    const auth = await login(app);

    const roster = await app.request('/api/roster', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ text: '군번,이름,소대\n26-1,홍길동,3\n26-2,김철수,1' }),
    });
    expect(await roster.json()).toEqual({ added: 2, updated: 0, errors: [] });

    const assign = await app.request('/api/simulators/1', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ memberId: '26-1' }),
    });
    expect(assign.status).toBe(200);

    const slots = (await (await app.request('/api/simulators', { headers: auth })).json()) as SimulatorSlot[];
    expect(slots).toEqual([
      { id: '1', member: { id: '26-1', name: '홍길동', platoonName: '3소대' }, assignedAt: NOW.toISOString() },
    ]);

    expect((await postSession(app, loadFixture('hit10'))).status).toBe(202);

    const detail = (await (await app.request('/api/members/26-1', { headers: auth })).json()) as MemberDetail;
    expect(detail.sessions).toHaveLength(1);
    expect(detail.sessions[0].rounds[0].shots).toHaveLength(10);
    expect(detail.weapon).toBe('Stage01 · 10m');

    const me = await app.request('/api/me/26-1');
    expect(me.status).toBe(200);
    expect((await app.request('/api/me/nobody')).status).toBe(404);

    const dashboard = (await (await app.request('/api/dashboard?range=30', { headers: auth })).json()) as Dashboard;
    expect(Object.keys(dashboard).sort()).toEqual(
      ['corrections', 'daily', 'kpis', 'platoons', 'range', 'scope', 'status'].sort(),
    );
    expect(dashboard.kpis.sessions).toBe(1);
    expect(dashboard.platoons.map(p => p.id)).toEqual(['p1', 'p3']);

    const members = await (await app.request('/api/members?sort=name&dir=asc', { headers: auth })).json();
    expect(members).toMatchObject({ total: 2, page: 0, size: 12 });

    expect((await app.request('/api/dashboard?platoonId=p9', { headers: auth })).status).toBe(404);
  });

  it('moves a session to another member and validates input', async () => {
    const app = await setup();
    const auth = await login(app);
    await app.request('/api/roster', { method: 'POST', headers: auth, body: JSON.stringify({ text: '26-1,홍길동,3' }) });
    await postSession(app, loadFixture('hit10'));

    const id = loadFixture('hit10').Id;
    const moved = await app.request(`/api/sessions/${id}/assign`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ memberId: '26-1' }),
    });
    expect(moved.status).toBe(200);

    const unknown = await app.request(`/api/sessions/${id}/assign`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ memberId: 'nobody' }),
    });
    expect(unknown.status).toBe(400);
    expect(await unknown.json()).toHaveProperty('message');

    const badSlot = await app.request('/api/simulators/5', {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ memberId: '26-1' }),
    });
    expect(badSlot.status).toBe(400);
  });

  it('rejects a session without Id or with broken JSON', async () => {
    const app = await setup();
    expect((await postSession(app, { ...loadFixture('hit10'), Id: '' })).status).toBe(400);
    const broken = await app.request('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect(broken.status).toBe(400);
  });

  it('does not reveal which people or sessions are dummy data', async () => {
    const config = loadConfig(ENV);
    const repo = await Repo.open(createFsStorage(dir), config);
    const data = generateDummy(NOW, { count: 3, platoons: 1 });
    await repo.seedDummy(data);
    const app = createApp(repo, config, () => NOW);
    const auth = await login(app);

    for (const path of [
      `/api/members/${data.members[0].id}`,
      '/api/members',
      '/api/dashboard?range=30',
      '/api/sessions/recent',
    ]) {
      const res = await app.request(path, { headers: auth });
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain('dummy');
    }
  });

  it('enforces the ingest key when configured', async () => {
    const app = await setup({ INGEST_KEY: 'k1' });
    expect((await postSession(app, loadFixture('hit10'))).status).toBe(401);
    expect((await postSession(app, loadFixture('hit10'), { 'X-Ingest-Key': 'k1' })).status).toBe(202);
  });

  it('answers CORS preflight only for configured origins', async () => {
    const app = await setup({ CORS_ORIGINS: 'http://site.example' });
    const res = await app.request('/api/company', {
      method: 'OPTIONS',
      headers: { Origin: 'http://site.example', 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://site.example');
  });
});
