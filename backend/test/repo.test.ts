import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { Repo } from '../src/repo';
import { createFsStorage } from '../src/storage/fs';
import type { Storage } from '../src/storage/storage';
import { loadFixture } from './helpers';

const NOW = new Date('2026-11-11T14:02:00+09:00');

describe('Repo', () => {
  let dir = '';
  let storage: Storage;
  const config = loadConfig({ STORAGE: 'fs' });

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'tp-repo-'));
    storage = createFsStorage(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('stores a session without assignment as unassigned and persists it', async () => {
    const repo = await Repo.open(storage, config);
    const s = await repo.ingest(loadFixture('hit10'), NOW);

    expect(s.memberId).toBeNull();
    expect(s.simulatorId).toBe('1');
    expect(s.rawKey).toBe('raw/2026/11/11/fe7c8c5c4d3d4df89064a36289684bf6.json');
    expect(await storage.listRaw()).toEqual([s.rawKey]);
    expect(await storage.getRaw(s.rawKey)).toMatchObject({
      Id: 'fe7c8c5c4d3d4df89064a36289684bf6',
      receivedAt: NOW.toISOString(),
      simulatorId: '1',
    });

    const reopened = await Repo.open(storage, config);
    expect(reopened.state.sessions).toHaveLength(1);
  });

  it('attaches the member assigned to the simulator at receive time', async () => {
    const repo = await Repo.open(storage, config);
    await repo.upsertRoster('26-1,홍길동,3');
    await repo.assignSimulator('1', '26-1', NOW);

    const s = await repo.ingest(loadFixture('hit10'), NOW);
    expect(s.memberId).toBe('26-1');
  });

  it('keeps the member and does not duplicate when the same Id arrives again', async () => {
    const repo = await Repo.open(storage, config);
    await repo.upsertRoster('26-1,홍길동,3\n26-2,김철수,4');
    await repo.assignSimulator('1', '26-1', NOW);
    await repo.ingest(loadFixture('hit10'), NOW);
    await repo.assignSimulator('1', '26-2', NOW);

    await repo.ingest(loadFixture('hit10'), new Date(NOW.getTime() + 60_000));

    expect(repo.state.sessions).toHaveLength(1);
    expect(repo.state.sessions[0].memberId).toBe('26-1');
    expect(repo.state.sessions[0].receivedAt).toBe(NOW.toISOString());
  });

  it('moves a session to another member', async () => {
    const repo = await Repo.open(storage, config);
    await repo.upsertRoster('26-1,홍길동,3');
    const s = await repo.ingest(loadFixture('hit10'), NOW);

    await repo.assignSession(s.id, '26-1');
    expect(repo.state.sessions[0].memberId).toBe('26-1');
    await expect(repo.assignSession(s.id, 'nobody')).rejects.toThrow();
    await expect(repo.assignSession('nope', '26-1')).rejects.toThrow();
  });

  it('rejects unknown members and out-of-range simulators', async () => {
    const repo = await Repo.open(storage, config);
    await repo.upsertRoster('26-1,홍길동,3');

    await expect(repo.assignSimulator('1', 'nobody', NOW)).rejects.toThrow();
    await expect(repo.assignSimulator('2', '26-1', NOW)).rejects.toThrow();
    await repo.assignSimulator('1', '26-1', NOW);
    await repo.assignSimulator('1', null, NOW);
    expect(repo.state.simulators['1']).toEqual({ memberId: null, assignedAt: null });
  });

  it('counts added and updated roster rows', async () => {
    const repo = await Repo.open(storage, config);
    expect(await repo.upsertRoster('26-1,홍길동,3\n26-2,김철수,4')).toEqual({
      added: 2,
      updated: 0,
      errors: [],
    });
    expect(await repo.upsertRoster('26-1,홍길순,5\n26-3,이영희,1\nbad')).toEqual({
      added: 1,
      updated: 1,
      errors: [{ line: 3, reason: '칸이 3개가 아닙니다' }],
    });
    expect(repo.state.members.find(m => m.id === '26-1')).toEqual({
      id: '26-1',
      name: '홍길순',
      platoonNo: 5,
    });
  });

  it('rejects a session without Id or with an Id that is not a plain identifier', async () => {
    const repo = await Repo.open(storage, config);
    await expect(repo.ingest({ ...loadFixture('hit10'), Id: '' }, NOW)).rejects.toThrow('Id');
    await expect(repo.ingest({ ...loadFixture('hit10'), Id: '../../../x' }, NOW)).rejects.toThrow('Id');
    await expect(repo.ingest({ ...loadFixture('hit10'), Id: 'a\\b' }, NOW)).rejects.toThrow('Id');
    expect(await storage.listRaw()).toEqual([]);
  });

  it('ignores a stored assignment for a simulator beyond the current count', async () => {
    const three = await Repo.open(storage, loadConfig({ STORAGE: 'fs', SIMULATOR_COUNT: '3' }));
    await three.upsertRoster('26-1,홍길동,3');
    await three.assignSimulator('3', '26-1', NOW);

    const two = await Repo.open(storage, loadConfig({ STORAGE: 'fs', SIMULATOR_COUNT: '2' }));
    const s = await two.ingest({ ...loadFixture('hit10'), SimulatorId: '3' }, NOW);
    expect(s.memberId).toBeNull();
  });

  it('restores raw sessions missing from state when recomputing', async () => {
    const repo = await Repo.open(storage, config);
    await repo.ingest(loadFixture('hit10'), NOW);
    await storage.writeState((await import('../src/domain/model')).emptyState());

    const reopened = await Repo.open(storage, config);
    expect(await reopened.recompute()).toEqual({ recomputed: 0, restored: 1 });
    expect(reopened.state.sessions[0]).toMatchObject({
      id: 'fe7c8c5c4d3d4df89064a36289684bf6',
      memberId: null,
      receivedAt: NOW.toISOString(),
      simulatorId: '1',
    });
  });

  it('applies SIMULATOR_COUNT from config', async () => {
    const repo = await Repo.open(storage, loadConfig({ STORAGE: 'fs', SIMULATOR_COUNT: '3' }));
    await repo.upsertRoster('26-1,홍길동,3');
    await repo.assignSimulator('3', '26-1', NOW);
    expect(repo.state.company.simulatorCount).toBe(3);
  });
});
