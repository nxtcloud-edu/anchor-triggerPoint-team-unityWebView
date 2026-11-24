import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { generateDummy } from '../src/domain/dummy';
import { Photos } from '../src/photos';
import { Repo } from '../src/repo';
import { createFsStorage } from '../src/storage/fs';
import type { Storage } from '../src/storage/storage';
import { loadFixture, putAssets } from './helpers';

const NOW = new Date('2026-11-24T15:00:00+09:00');
const config = loadConfig({ STORAGE: 'fs', AUTH_SECRET: 'secret' });

describe('Photos', () => {
  let dir = '';
  let storage: Storage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tp-photos-'));
    storage = createFsStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('turns itself off when the art is not uploaded', async () => {
    const repo = await Repo.open(storage, config);
    const photos = await Photos.create(storage, repo, config);
    const s = await repo.ingest(loadFixture('hit10'), NOW);

    expect(photos.enabled).toBe(false);
    photos.enqueue(s.id);
    await photos.idle();
    expect(repo.state.sessions[0].photoKey).toBeUndefined();
    expect(await photos.urlFor(repo.state.sessions[0], NOW)).toBeUndefined();
  });

  it('renders a session once and records where it went', async () => {
    await putAssets(storage);
    const repo = await Repo.open(storage, config);
    const photos = await Photos.create(storage, repo, config);
    const s = await repo.ingest(loadFixture('hit10'), NOW);

    let writes = 0;
    const put = storage.putObject.bind(storage);
    storage.putObject = async (...args) => {
      writes++;
      return put(...args);
    };

    photos.enqueue(s.id);
    photos.enqueue(s.id);
    await photos.idle();

    expect(writes).toBe(1);
    expect(repo.state.sessions[0].photoKey).toBe(`photos/${s.id}.jpg`);
    const jpeg = (await storage.getObject(`photos/${s.id}.jpg`))!;
    expect((await sharp(jpeg).metadata()).format).toBe('jpeg');

    photos.enqueue(s.id);
    await photos.idle();
    expect(writes).toBe(1);
  });

  it('keeps dummy photos in their own folder', async () => {
    await putAssets(storage);
    const repo = await Repo.open(storage, config);
    const photos = await Photos.create(storage, repo, config);
    await repo.seedDummy(generateDummy(NOW, { count: 2, platoons: 1 }));

    const keys = await photos.renderMany(repo.state.sessions);
    await repo.setPhotoKeys(keys);

    expect(Object.keys(keys)).toHaveLength(repo.state.sessions.length);
    expect(repo.state.sessions.every(s => s.photoKey === `photos/dummy/${s.id}.jpg`)).toBe(true);
  });

  it('signs local photo urls and rejects tampered or expired ones', async () => {
    await putAssets(storage);
    const repo = await Repo.open(storage, config);
    const photos = await Photos.create(storage, repo, config);
    const s = await repo.ingest(loadFixture('hit10'), NOW);
    photos.enqueue(s.id);
    await photos.idle();

    const url = (await photos.urlFor(repo.state.sessions[0], NOW))!;
    const parsed = new URL(url, 'http://local');
    expect(parsed.pathname).toBe(`/api/photos/${s.id}`);
    const exp = parsed.searchParams.get('exp')!;
    const sig = parsed.searchParams.get('sig')!;

    expect(photos.verifyLocal(s.id, exp, sig, NOW)).toBe(true);
    expect(photos.verifyLocal(s.id, exp, `${sig}x`, NOW)).toBe(false);
    expect(photos.verifyLocal('other', exp, sig, NOW)).toBe(false);
    expect(photos.verifyLocal(s.id, exp, sig, new Date(NOW.getTime() + 2 * 3600e3))).toBe(false);
  });
});
