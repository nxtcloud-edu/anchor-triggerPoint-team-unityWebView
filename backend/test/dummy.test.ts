import { describe, expect, it } from 'vitest';
import { buildDashboard, buildView } from '../src/domain/aggregate';
import { isCounted, summarize } from '../src/domain/convert';
import { generateDummy } from '../src/domain/dummy';
import { emptyState, type State } from '../src/domain/model';

const NOW = new Date('2026-11-17T15:00:00+09:00');
const DAY = 864e5;
const OPTS = { clickCmAt100mH: 3, clickCmAt100mV: 3, countedProfiles: ['IndoorTargetScore'] };

const toState = (data: ReturnType<typeof generateDummy>): State => {
  const state = emptyState();
  state.members = data.members.map(m => ({ ...m, dummy: true }));
  state.sessions = data.sessions.map(s => ({
    ...summarize(s.raw, OPTS),
    memberId: s.memberId,
    simulatorId: '1',
    receivedAt: s.receivedAt,
    rawKey: `raw/x/${s.raw.Id}.json`,
    dummy: true,
  }));
  return state;
};

describe('generateDummy', () => {
  const data = generateDummy(NOW);

  it('is the same for the same seed', () => {
    expect(generateDummy(NOW)).toEqual(data);
  });

  it('makes 200 people in 10 platoons of 20 with unique 군번', () => {
    expect(data.members).toHaveLength(200);
    expect(new Set(data.members.map(m => m.id)).size).toBe(200);
    for (let p = 1; p <= 10; p++) {
      expect(data.members.filter(m => m.platoonNo === p)).toHaveLength(20);
    }
    expect(data.members.every(m => /^26-7\d{7}$/.test(m.id) && m.name.length === 3)).toBe(true);
  });

  it('never reuses an existing 군번', () => {
    const taken = new Set(data.members.slice(0, 5).map(m => m.id));
    const other = generateDummy(NOW, { existingIds: taken });
    expect(other.members).toHaveLength(200);
    expect(other.members.some(m => taken.has(m.id))).toBe(false);
  });

  it('gives each person 2 to 8 sessions within the last 30 days', () => {
    for (const m of data.members) {
      const own = data.sessions.filter(s => s.memberId === m.id);
      expect(own.length).toBeGreaterThanOrEqual(2);
      expect(own.length).toBeLessThanOrEqual(8);
    }
    for (const s of data.sessions) {
      const t = new Date(s.receivedAt).getTime();
      expect(t).toBeLessThanOrEqual(NOW.getTime());
      expect(t).toBeGreaterThan(NOW.getTime() - 30 * DAY);
    }
  });

  it('builds unity-shaped sessions that count for the dashboard', () => {
    expect(new Set(data.sessions.map(s => s.raw.Id)).size).toBe(data.sessions.length);
    for (const { raw } of data.sessions) {
      expect(raw.Id).toMatch(/^[0-9a-f]{32}$/);
      expect(raw.Shots).toHaveLength(10);
      expect(raw.HitCount).toBe(raw.Shots.filter(s => s.Hit).length);
      expect(raw.Shots[0].Trace?.RightMrad).toHaveLength(36);
      expect(isCounted(raw, OPTS.countedProfiles)).toBe(true);
    }
  });

  it('looks like a real company on the dashboard', () => {
    const d = buildDashboard(buildView(toState(data), NOW), 30)!;

    const zeroedRatio = d.kpis.zeroed / d.kpis.memberCount;
    expect(zeroedRatio).toBeGreaterThan(0.4);
    expect(zeroedRatio).toBeLessThan(0.8);
    expect(d.kpis.passRate).toBeGreaterThan(30);
    expect(d.kpis.passRate).toBeLessThan(75);
    expect(d.kpis.avgDiameter).toBeGreaterThan(2.5);
    expect(d.kpis.avgDiameter).toBeLessThan(7);
    expect(d.corrections.every(c => c.count > 0)).toBe(true);
    expect(d.daily.filter(day => day.pass + day.fail > 0).length).toBeGreaterThanOrEqual(25);
    expect(d.platoons).toHaveLength(10);

    const aim = toState(data).sessions.map(s => s.metrics[0]);
    const avgAim = aim.reduce((a, b) => a + b, 0) / aim.length;
    expect(avgAim).toBeGreaterThan(40);
    expect(avgAim).toBeLessThan(92);
  });
});
