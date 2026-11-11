import * as mock from '@/mocks/data/aggregate';
import { COMPANY, PLATOONS, TODAY, members as seedMembers, sessions as seedSessions } from '@/mocks/data/seed';
import type { SeedSession } from '@/mocks/data/seed';
import { describe, expect, it } from 'vitest';
import {
  buildDashboard,
  buildMemberDetail,
  buildView,
  listMembers,
  platoonSummaries,
  toMember,
  type AggSession,
  type View,
} from '../src/domain/aggregate';
import { summarize } from '../src/domain/convert';
import { emptyState, type State } from '../src/domain/model';
import { loadFixture } from './helpers';

const toAgg = (s: SeedSession): AggSession => ({
  id: s.id,
  memberId: s.memberId,
  platoonId: s.platoonId,
  date: s.date,
  diameter: s.diameter,
  pass: s.pass,
  metrics: s.metrics,
  correction: s.correction,
  api: {
    id: s.id,
    index: s.index,
    date: s.date.toISOString(),
    diameter: s.diameter,
    offset: s.offset,
    pass: s.pass,
    metrics: s.metrics,
    rounds: s.rounds,
    clicksH: s.clicksH,
    clicksV: s.clicksV,
    durationMin: s.durationMin,
    report: s.report,
    key: s.key,
  },
});

const seedView = (): View => ({
  company: COMPANY,
  platoons: PLATOONS,
  members: seedMembers.map(m => ({
    id: m.id,
    name: m.name,
    platoonId: m.platoonId,
    platoonName: m.platoonName,
    sessions: m.sessions.map(toAgg),
  })),
  sessions: seedSessions.map(toAgg),
  now: TODAY,
});

describe('aggregate parity with the mock', () => {
  const v = seedView();

  it('builds the same company and platoon dashboards', () => {
    expect(buildDashboard(v, 30)).toEqual(mock.buildDashboard(30));
    expect(buildDashboard(v, 7, 'p3')).toEqual(mock.buildDashboard(7, 'p3'));
    expect(buildDashboard(v, 14, 'p99')).toBeNull();
  });

  it('builds the same platoon summaries', () => {
    expect(platoonSummaries(v, 14)).toEqual(mock.platoonSummaries(14));
  });

  it('computes the same member rows', () => {
    expect(v.members.map(toMember)).toEqual(seedMembers.map(mock.toMember));
  });

  it('computes the same company average metrics and sessions for a member', () => {
    const id = seedMembers[5].id;
    const mine = buildMemberDetail(v, id)!;
    const theirs = mock.buildMemberDetail(id)!;
    expect(mine.companyAvgMetrics).toEqual(theirs.companyAvgMetrics);
    expect(mine.sessions).toEqual(theirs.sessions);
    expect(mine.metricLabels).toEqual(theirs.metricLabels);
  });

  it('lists members like the mock handler (score desc, filters, paging)', () => {
    const page = listMembers(v, {});
    expect(page.size).toBe(12);
    expect(page.total).toBe(300);
    expect(page.items[0].score).toBeGreaterThanOrEqual(page.items[1].score);

    const filtered = listMembers(v, { platoonId: 'p2', status: '영점 완료', sort: 'name', dir: 'asc' });
    expect(filtered.items.every(m => m.platoonId === 'p2' && m.status === '영점 완료')).toBe(true);

    const q = seedMembers[0].name;
    expect(listMembers(v, { q }).items.some(m => m.name === q)).toBe(true);
  });
});

const NOW = new Date('2026-11-11T14:00:00+09:00');
const OPTS = { clickCmAt100mH: 3, clickCmAt100mV: 3, countedProfiles: ['IndoorTargetScore'] };

const stateWith = (sessions: { fixture: 'hit10' | 'hit0'; memberId: string | null; at: string; counted?: boolean }[]): State => {
  const state = emptyState();
  state.members = [
    { id: '26-1', name: '홍길동', platoonNo: 3 },
    { id: '26-2', name: '김철수', platoonNo: 1 },
  ];
  state.sessions = sessions.map((s, i) => {
    const raw = loadFixture(s.fixture);
    return {
      ...summarize({ ...raw, Id: `s${i}` }, OPTS),
      ...(s.counted === false ? { counted: false } : {}),
      memberId: s.memberId,
      simulatorId: '1',
      receivedAt: new Date(s.at).toISOString(),
      rawKey: `raw/x/s${i}.json`,
    };
  });
  return state;
};

describe('aggregate on real state', () => {
  it('returns zeros and empty lists on an empty state', () => {
    const v = buildView(emptyState(), NOW);
    const d = buildDashboard(v, 30)!;

    expect(d.kpis.sessions).toBe(0);
    expect(d.kpis.passRate).toBe(0);
    expect(d.kpis.avgDiameter).toBe(0);
    expect(d.kpis.prevSessions).toBeNull();
    expect(d.daily).toHaveLength(30);
    expect(d.platoons).toEqual([]);
    expect(JSON.stringify(d)).not.toMatch(/NaN|Infinity/);
  });

  it('orders platoons by number and only counts assigned counted sessions', () => {
    const v = buildView(
      stateWith([
        { fixture: 'hit10', memberId: '26-1', at: '2026-11-10T10:00:00+09:00' },
        { fixture: 'hit10', memberId: null, at: '2026-11-10T11:00:00+09:00' },
        { fixture: 'hit10', memberId: '26-1', at: '2026-11-10T12:00:00+09:00', counted: false },
      ]),
      NOW,
    );
    expect(v.platoons).toEqual([
      { id: 'p1', name: '1소대' },
      { id: 'p3', name: '3소대' },
    ]);
    expect(v.sessions).toHaveLength(1);
    expect(buildMemberDetail(v, '26-1')!.sessions).toHaveLength(1);
  });

  it('describes a member without sessions safely', () => {
    const v = buildView(stateWith([]), NOW);
    const d = buildMemberDetail(v, '26-2')!;

    expect(d.sessions).toEqual([]);
    expect(d.status).toBe('재훈련 필요');
    expect(d.best).toBe(0);
    expect(d.last).toBe(0);
    expect(d.score).toBe(0);
    expect(d.lastDate).toBe('');
    expect(d.weapon).toBe('사격 기록 없음');
    expect(buildMemberDetail(v, 'nobody')).toBeNull();
  });

  it('keeps fewer-than-3-hit sessions out of group averages but counts them as failed', () => {
    const v = buildView(
      stateWith([
        { fixture: 'hit10', memberId: '26-1', at: '2026-11-10T10:00:00+09:00' },
        { fixture: 'hit0', memberId: '26-1', at: '2026-11-11T10:00:00+09:00' },
      ]),
      NOW,
    );
    const d = buildDashboard(v, 30)!;
    const m = toMember(v.members.find(x => x.id === '26-1')!);

    expect(d.kpis.sessions).toBe(2);
    expect(d.kpis.passRate).toBe(0);
    expect(d.kpis.avgDiameter).toBe(7.6);
    expect(m.best).toBe(7.6);
    expect(m.last).toBe(7.6);
    expect(m.status).toBe('재훈련 필요');
    expect(m.lastDate).toBe(new Date('2026-11-11T10:00:00+09:00').toISOString());

    // 비교할 수 있는 탄착군이 한쪽 기간에 없으면 증감을 보여 주지 않는다
    const week = buildDashboard(
      buildView(
        stateWith([
          { fixture: 'hit10', memberId: '26-1', at: '2026-11-01T10:00:00+09:00' },
          { fixture: 'hit0', memberId: '26-1', at: '2026-11-10T10:00:00+09:00' },
        ]),
        NOW,
      ),
      7,
    )!;
    expect(week.kpis.prevAvgDiameter).toBeNull();
    expect(week.kpis.prevSessions).toBe(1);

    const detail = buildMemberDetail(v, '26-1')!;
    expect(detail.sessions.map(s => s.index)).toEqual([1, 2]);
    expect(detail.sessions[1].hitCount).toBe(0);
    expect(detail.weapon).toBe('Stage01 · 10m');
  });
});
