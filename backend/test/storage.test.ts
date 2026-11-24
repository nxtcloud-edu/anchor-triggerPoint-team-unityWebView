import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyState } from '../src/domain/model';
import { createFsStorage } from '../src/storage/fs';

describe('fs storage', () => {
  let dir = '';

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tp-storage-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns null before first write', async () => {
    expect(await createFsStorage(dir).readState()).toBeNull();
  });

  it('round-trips state and raw', async () => {
    const storage = createFsStorage(dir);
    const state = emptyState();

    await storage.writeState(state);
    await storage.putRaw('raw/2026/11/11/a.json', { Id: 'a' });

    expect(await storage.readState()).toEqual(state);
    expect(await storage.getRaw('raw/2026/11/11/a.json')).toEqual({ Id: 'a' });
    expect(await storage.listRaw()).toEqual(['raw/2026/11/11/a.json']);
  });

  it('stores binary objects, deletes by prefix and has no presigned urls', async () => {
    const storage = createFsStorage(dir);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

    await storage.putObject('photos/a.jpg', jpeg, 'image/jpeg');
    await storage.putObject('photos/dummy/b.jpg', jpeg, 'image/jpeg');
    await storage.putObject('photos/dummy/c.jpg', jpeg, 'image/jpeg');

    expect(await storage.getObject('photos/a.jpg')).toEqual(jpeg);
    expect(await storage.getObject('photos/none.jpg')).toBeNull();
    expect(await storage.deletePrefix('photos/dummy/')).toBe(2);
    expect(await storage.getObject('photos/dummy/b.jpg')).toBeNull();
    expect(await storage.getObject('photos/a.jpg')).toEqual(jpeg);
    expect(await storage.deletePrefix('photos/dummy/')).toBe(0);
    expect(await storage.presign('photos/a.jpg', 60)).toBeNull();
    await expect(storage.putObject('../x.jpg', jpeg, 'image/jpeg')).rejects.toThrow();
  });

  it('refuses keys that escape the data folder', async () => {
    const storage = createFsStorage(dir);
    await expect(storage.putRaw('raw/../../escaped.json', {})).rejects.toThrow();
    await expect(storage.getRaw('../escaped.json')).rejects.toThrow();
  });
});
