import { describe, expect, it } from 'vitest';
import { isCounted, summarize } from '../src/domain/convert';
import { loadFixture } from './helpers';

const OPTS = { clickCmAt100mH: 3, clickCmAt100mV: 3, countedProfiles: ['IndoorTargetScore'] };

describe('summarize', () => {
  it('converts a 10-hit unity session into one round in cm', () => {
    const s = summarize(loadFixture('hit10'), OPTS);

    expect(s.id).toBe('fe7c8c5c4d3d4df89064a36289684bf6');
    expect(s.diameter).toBe(7.6);
    expect(s.offset).toBe(2.8);
    expect(s.pass).toBe(false);
    expect(s.rounds).toHaveLength(1);
    expect(s.rounds[0].round).toBe(1);
    expect(s.rounds[0].diameter).toBe(7.6);
    expect(s.rounds[0].shots).toHaveLength(10);
    expect(s.rounds[0].shots[0]).toEqual({ x: 1.23, y: -1.91 });
    expect(s.clicksH).toBe(0);
    expect(s.clicksV).toBe(9);
    expect(s.durationMin).toBe(0.3);
    expect(s.counted).toBe(true);
    expect(s.distanceMeters).toBe(10);
    expect(s.hitCount).toBe(10);
    expect(s.shotsFired).toBe(10);
    expect(s.stageName).toBe('Stage01');
  });

  it('treats a session with fewer than 3 hits as unmeasurable and failed', () => {
    const s = summarize(loadFixture('hit0'), OPTS);

    expect(s.diameter).toBe(0);
    expect(s.offset).toBe(0);
    expect(s.pass).toBe(false);
    expect(s.rounds[0].shots).toHaveLength(0);
    expect(s.clicksH).toBe(0);
    expect(s.clicksV).toBe(0);
    expect(s.hitCount).toBe(0);
  });

  it('passes a tight centred group', () => {
    const raw = loadFixture('hit10');
    const s = summarize({ ...raw, GroupSize: 0.04, MpiX: 0.01, MpiY: -0.01 }, OPTS);
    expect(s.pass).toBe(true);
  });
});

describe('isCounted', () => {
  it('counts only indoor zeroing target sessions that emptied the magazine', () => {
    const raw = loadFixture('hit10');
    expect(isCounted(raw, OPTS.countedProfiles)).toBe(true);
    expect(isCounted({ ...raw, Target: { ProfileName: 'OutdoorTargetScore' } }, OPTS.countedProfiles)).toBe(false);
    expect(isCounted({ ...raw, EndReason: 'Stopped' }, OPTS.countedProfiles)).toBe(false);
  });
});
