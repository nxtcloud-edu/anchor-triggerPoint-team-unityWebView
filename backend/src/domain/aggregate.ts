import type {
  Dashboard,
  Member,
  MemberDetail,
  MemberQuery,
  Page,
  PlatoonSummary,
  Session,
} from '../../../frontend/src/api/types';
import { CORRECTIONS, METRICS } from '../../../frontend/src/constants/shooting';
import { fmtD } from '../../../frontend/src/utils/format';
import { MIN_HITS } from './metrics';
import type { CompanyInfo, State } from './model';

/*
 * 화면 가짜 데이터의 집계(frontend/src/mocks/data/aggregate.ts)와 같은 의미로 계산한다.
 * 차이는 데이터 출처뿐 — 시드 데이터로 결과가 같은지 test/aggregate.test.ts가 확인한다.
 */

const DAY = 864e5;

export interface AggSession {
  id: string;
  memberId: string;
  platoonId: string;
  date: Date;
  diameter: number;
  pass: boolean;
  metrics: number[];
  correction: number;
  /** 없으면(더미 데이터) 잴 수 있는 세션으로 본다 */
  hitCount?: number;
  api: Session;
}

export interface AggMember {
  id: string;
  name: string;
  platoonId: string;
  platoonName: string;
  /** 오래된 것부터 */
  sessions: AggSession[];
}

export interface View {
  company: CompanyInfo;
  platoons: { id: string; name: string }[];
  members: AggMember[];
  sessions: AggSession[];
  now: Date;
}

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const passRate = (a: AggSession[]) => (a.length ? (a.filter(s => s.pass).length / a.length) * 100 : 0);
const r1 = (v: number) => +v.toFixed(1);
const r2 = (v: number) => +v.toFixed(2);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** 명중 3발 미만 세션은 탄착군을 잴 수 없다 — 탄착군 평균·최고 기록에서 뺀다 */
const measurable = (s: AggSession) => s.hitCount === undefined || s.hitCount >= MIN_HITS;
const avgDiameter = (a: AggSession[]) => avg(a.filter(measurable).map(s => s.diameter));

const platoonOf = (no: number) => ({ id: `p${no}`, name: `${no}소대` });

export const buildView = (state: State, now: Date): View => {
  const platoonNos = [...new Set(state.members.map(m => m.platoonNo))].sort((a, b) => a - b);
  const members: AggMember[] = state.members.map(m => ({
    id: m.id,
    name: m.name,
    platoonId: platoonOf(m.platoonNo).id,
    platoonName: platoonOf(m.platoonNo).name,
    sessions: [],
  }));
  const byId = new Map(members.map(m => [m.id, m]));

  const counted = state.sessions
    .filter(s => s.counted && s.memberId && byId.has(s.memberId))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  const sessions = counted.map(s => {
    const member = byId.get(s.memberId!)!;
    const agg: AggSession = {
      id: s.id,
      memberId: member.id,
      platoonId: member.platoonId,
      date: new Date(s.receivedAt),
      diameter: s.diameter,
      pass: s.pass,
      metrics: s.metrics,
      correction: s.correction,
      hitCount: s.hitCount,
      api: {
        id: s.id,
        index: member.sessions.length + 1,
        date: s.receivedAt,
        diameter: s.diameter,
        offset: s.offset,
        pass: s.pass,
        metrics: s.metrics,
        rounds: s.rounds,
        clicksH: s.clicksH,
        clicksV: s.clicksV,
        durationMin: s.durationMin,
        report: 'ok',
        key: s.rawKey,
        distanceMeters: s.distanceMeters,
        shotsFired: s.shotsFired,
        hitCount: s.hitCount,
        stageName: s.stageName,
        simulatorId: s.simulatorId,
      },
    };
    member.sessions.push(agg);
    return agg;
  });

  return { company: state.company, platoons: platoonNos.map(platoonOf), members, sessions, now };
};

export const toMember = (m: AggMember): Member => {
  const L = m.sessions[m.sessions.length - 1];
  const valid = m.sessions.filter(measurable);
  const last = valid.length ? valid[valid.length - 1].diameter : 0;
  const groupScore = last > 0 ? clamp(100 - (last - 1.5) * 9, 0, 100) : 0;

  return {
    id: m.id,
    name: m.name,
    platoonId: m.platoonId,
    platoonName: m.platoonName,
    sessionCount: m.sessions.length,
    best: valid.length ? Math.min(...valid.map(s => s.diameter)) : 0,
    last,
    score: L ? Math.round(avg(L.metrics) * 0.6 + groupScore * 0.4) : 0,
    status: L?.pass ? '영점 완료' : '재훈련 필요',
    lastDate: L ? L.date.toISOString() : '',
  };
};

const inRange = (v: View, range: number, platoonId?: string) => {
  const from = v.now.getTime() - range * DAY;
  const prevFrom = from - range * DAY;
  const mine = (s: AggSession) => !platoonId || s.platoonId === platoonId;
  return {
    cur: v.sessions.filter(s => mine(s) && s.date.getTime() > from),
    prev: v.sessions.filter(s => mine(s) && s.date.getTime() > prevFrom && s.date.getTime() <= from),
  };
};

const zeroedCount = (members: AggMember[]) =>
  members.filter(m => toMember(m).status === '영점 완료').length;

export const platoonSummaries = (v: View, range: number): PlatoonSummary[] =>
  v.platoons.map(p => {
    const { cur } = inRange(v, range, p.id);
    const M = v.members.filter(m => m.platoonId === p.id);
    const zeroed = zeroedCount(M);
    return {
      id: p.id,
      name: p.name,
      memberCount: M.length,
      sessions: cur.length,
      passRate: r1(passRate(cur)),
      avgDiameter: r2(avgDiameter(cur)),
      zeroed,
      retrain: M.length - zeroed,
    };
  });

export const buildDashboard = (v: View, range: number, platoonId?: string): Dashboard | null => {
  const platoon = platoonId ? v.platoons.find(p => p.id === platoonId) : undefined;
  if (platoonId && !platoon) return null;
  const { cur, prev } = inRange(v, range, platoonId);
  const M = v.members.filter(m => !platoonId || m.platoonId === platoonId);
  const zeroed = zeroedCount(M);
  const today = v.now.getTime();
  // 한쪽 기간에 잴 수 있는 세션이 없으면 0과 비교한 가짜 증감이 되므로 비교하지 않는다
  const comparableDiameter = cur.some(measurable) && prev.some(measurable);

  const daily = Array.from({ length: range }, (_, i) => {
    const day = new Date(today - (range - 1 - i) * DAY);
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
      : { type: 'company', id: v.company.id, name: v.company.name },
    kpis: {
      memberCount: M.length,
      activeMembers7d: M.filter(m => {
        const L = m.sessions[m.sessions.length - 1];
        return L !== undefined && L.date.getTime() > today - 7 * DAY;
      }).length,
      sessions: cur.length,
      prevSessions: prev.length || null,
      passRate: r1(passRate(cur)),
      prevPassRate: prev.length ? r1(passRate(prev)) : null,
      avgDiameter: r2(avgDiameter(cur)),
      prevAvgDiameter: comparableDiameter ? r2(avgDiameter(prev)) : null,
      zeroed,
    },
    daily,
    status: { zeroed, retrain: M.length - zeroed },
    corrections: CORRECTIONS.map((label, i) => ({
      label,
      count: cur.filter(s => s.correction === i).length,
    })),
    platoons: platoonSummaries(v, range),
  };
};

export const buildMemberDetail = (v: View, id: string): MemberDetail | null => {
  const m = v.members.find(x => x.id === id);
  if (!m) return null;

  const withSessions = v.members.filter(x => x.sessions.length);
  const companyAvgMetrics = METRICS.map((_, j) =>
    Math.round(avg(withSessions.map(x => x.sessions[x.sessions.length - 1].metrics[j]))),
  );
  const L = m.sessions[m.sessions.length - 1]?.api;

  return {
    ...toMember(m),
    weapon: !L ? '사격 기록 없음' : L.stageName ? `${L.stageName} · ${L.distanceMeters}m` : '영점사격',
    sessions: m.sessions.map(s => s.api),
    metricLabels: [...METRICS],
    companyAvgMetrics,
  };
};

/** /api/members — 화면 목 핸들러(handlers.ts)와 같은 검색·정렬·페이지 규칙 */
export const listMembers = (v: View, q: MemberQuery): Page<Member> => {
  const sort = q.sort ?? 'score';
  const dir = q.dir === 'asc' ? 1 : -1;
  const page = q.page ?? 0;
  const size = q.size ?? 12;
  const text = q.q?.trim();

  const rows = v.members
    .map(toMember)
    .filter(m => (!q.platoonId || m.platoonId === q.platoonId) && (!q.status || m.status === q.status))
    .filter(m => !text || m.name.includes(text) || m.id.includes(text))
    .sort((a, b) => {
      const x = sort === 'platoonName' ? Number(a.platoonId.slice(1)) : a[sort];
      const y = sort === 'platoonName' ? Number(b.platoonId.slice(1)) : b[sort];
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });

  return { items: rows.slice(page * size, page * size + size), total: rows.length, page, size };
};
