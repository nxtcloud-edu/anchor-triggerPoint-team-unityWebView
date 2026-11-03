import type { Dashboard, Member, MemberDetail, PlatoonSummary, Session } from '@/api/types';
import { CORRECTIONS, METRICS } from '@/constants/shooting';
import {
  COMPANY,
  DAY,
  PLATOONS,
  TODAY,
  members,
  sessions,
  type SeedMember,
  type SeedSession,
} from '@/mocks/data/seed';
import { fmtD } from '@/utils/format';

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const passRate = (a: SeedSession[]) =>
  a.length ? (a.filter(s => s.pass).length / a.length) * 100 : 0;
const r1 = (v: number) => +v.toFixed(1);
const r2 = (v: number) => +v.toFixed(2);

const inRange = (range: number, platoonId?: string) => {
  const from = TODAY.getTime() - range * DAY;
  const prevFrom = from - range * DAY;
  const mine = (s: SeedSession) => !platoonId || s.platoonId === platoonId;
  return {
    cur: sessions.filter(s => mine(s) && s.date.getTime() > from),
    prev: sessions.filter(s => mine(s) && s.date.getTime() > prevFrom && s.date.getTime() <= from),
  };
};

export const platoonSummaries = (range: number): PlatoonSummary[] =>
  PLATOONS.map(p => {
    const { cur } = inRange(range, p.id);
    const M = members.filter(m => m.platoonId === p.id);
    const zeroed = M.filter(m => m.status === '영점 완료').length;
    return {
      id: p.id,
      name: p.name,
      memberCount: M.length,
      sessions: cur.length,
      passRate: r1(passRate(cur)),
      avgDiameter: r2(avg(cur.map(s => s.diameter))),
      zeroed,
      retrain: M.length - zeroed,
    };
  });

export const buildDashboard = (range: number, platoonId?: string): Dashboard | null => {
  const platoon = platoonId ? PLATOONS.find(p => p.id === platoonId) : undefined;
  if (platoonId && !platoon) return null;
  const { cur, prev } = inRange(range, platoonId);
  const M = members.filter(m => !platoonId || m.platoonId === platoonId);
  const zeroed = M.filter(m => m.status === '영점 완료').length;

  const daily = Array.from({ length: range }, (_, i) => {
    const day = new Date(TODAY.getTime() - (range - 1 - i) * DAY);
    const ds = cur.filter(s => s.date.toDateString() === day.toDateString());
    return {
      date: fmtD(day),
      pass: ds.filter(s => s.pass).length,
      fail: ds.filter(s => !s.pass).length,
    };
  });

  return {
    range,
    scope: platoon
      ? { type: 'platoon', id: platoon.id, name: platoon.name }
      : { type: 'company', id: COMPANY.id, name: COMPANY.name },
    kpis: {
      memberCount: M.length,
      activeMembers7d: M.filter(m => m.lastDate.getTime() > TODAY.getTime() - 7 * DAY).length,
      sessions: cur.length,
      prevSessions: prev.length || null,
      passRate: r1(passRate(cur)),
      prevPassRate: prev.length ? r1(passRate(prev)) : null,
      avgDiameter: r2(avg(cur.map(s => s.diameter))),
      prevAvgDiameter: prev.length ? r2(avg(prev.map(s => s.diameter))) : null,
      zeroed,
    },
    daily,
    status: { zeroed, retrain: M.length - zeroed },
    corrections: CORRECTIONS.map((label, i) => ({
      label,
      count: cur.filter(s => s.correction === i).length,
    })),
    platoons: platoonSummaries(range),
  };
};

export const toMember = (m: SeedMember): Member => ({
  id: m.id,
  name: m.name,
  platoonId: m.platoonId,
  platoonName: m.platoonName,
  sessionCount: m.sessionCount,
  best: m.best,
  last: m.last,
  score: m.score,
  status: m.status,
  lastDate: m.lastDate.toISOString(),
});

const toSession = (s: SeedSession): Session => ({
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
});

const companyAvgMetrics = METRICS.map((_, j) =>
  Math.round(avg(members.map(m => m.sessions[m.sessions.length - 1].metrics[j]))),
);

export const buildMemberDetail = (id: string): MemberDetail | null => {
  const m = members.find(x => x.id === id);
  if (!m) return null;
  return {
    ...toMember(m),
    weapon: 'K2 소총 · 25m 영점',
    sessions: m.sessions.map(toSession),
    metricLabels: [...METRICS],
    companyAvgMetrics,
  };
};
