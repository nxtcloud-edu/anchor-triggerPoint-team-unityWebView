import type { MemberStatus, ReportState, Shot, ShotRound } from '@/api/types';
import {
  CORRECTIONS,
  METRICS,
  PASS_DIAMETER_CM,
  PASS_OFFSET_CM,
  ROUNDS_PER_SESSION,
} from '@/constants/shooting';

/* 시드 고정 난수 — 새로고침해도 같은 데이터 */
let seed = 20261029;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const rn = (m = 0, s = 1) => {
  let u = 0;
  let v = 0;
  while (!u) u = rnd();
  while (!v) v = rnd();
  return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const DAY = 864e5;
export const TODAY = (() => {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
})();

export const COMPANY = {
  id: 'c1',
  name: '1중대',
  course: '2026년 2기 영점사격 과정',
  simulatorCount: 12,
};

export const PLATOONS = Array.from({ length: 10 }, (_, i) => ({
  id: `p${i + 1}`,
  name: `${i + 1}소대`,
}));
const MEMBERS_PER_PLATOON = 30;

const SUR =
  '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부'.split(
    '',
  );
const GIV =
  '민서준도윤예하지시우주원현건태은수영재훈성진동혁석규찬호승연유상경범율빈결한강산'.split('');

export interface SeedSession {
  id: string;
  memberId: string;
  platoonId: string;
  index: number;
  date: Date;
  diameter: number;
  offset: number;
  pass: boolean;
  metrics: number[];
  correction: number;
  rounds: ShotRound[];
  clicksH: number;
  clicksV: number;
  durationMin: number;
  report: ReportState;
  key: string;
}

export interface SeedMember {
  id: string;
  name: string;
  platoonId: string;
  platoonName: string;
  sessions: SeedSession[];
  sessionCount: number;
  best: number;
  last: number;
  score: number;
  status: MemberStatus;
  lastDate: Date;
}

/* 지표 인덱스 → 교정 포인트 인덱스 (조준 안정성→조준선 정렬, 호흡 통제→호흡 불안정, 사격 자세→사격 자세) */
const METRIC_TO_CORRECTION: Record<number, number> = { 0: 0, 1: 1, 3: 2 };

export const members: SeedMember[] = [];
export const sessions: SeedSession[] = [];

const total = PLATOONS.length * MEMBERS_PER_PLATOON;
for (let i = 0; i < total; i++) {
  const platoon = PLATOONS[i % PLATOONS.length];
  const skill = clamp(rn(0.5 + ((i % 10) - 4.5) * 0.012, 0.2), 0.05, 0.95);
  const learn = clamp(rn(0.06, 0.025), 0.01, 0.12);
  const weakness = Math.floor(rnd() * 4);
  const id = `26-${String(71000000 + (((i + 1) * 48131) % 999999)).slice(0, 8)}`;
  const name = pick(SUR) + pick(GIV) + pick(GIV);

  const n = 2 + Math.floor(rnd() * 9);
  let day = rnd() < 0.35 ? 0 : Math.floor(rnd() * 5);
  const days: number[] = [];
  for (let k = 0; k < n; k++) {
    days.push(day);
    day += 1 + Math.floor(rnd() * 4);
    if (day > 29) break;
  }
  days.reverse();

  const own: SeedSession[] = days.map((d, k) => {
    const sk = clamp(skill + learn * k + rn(0, 0.06), 0.02, 0.99);
    const date = new Date(TODAY.getTime() - d * DAY);
    date.setHours(
      pick([9, 9, 10, 10, 10, 11, 13, 14, 14, 15, 15, 16, 17, 19, 20]),
      Math.floor(rnd() * 60),
    );
    const back = Math.floor(rnd() * 300); // 시각과 무관하게 항상 소비해야 데이터가 고정된다
    if (date > TODAY) date.setTime(TODAY.getTime() - back * 60000);
    const diameter = clamp(9.5 - 7 * sk + rn(0, 0.9), 1.6, 13);

    // 회차별 탄착군 — 회차마다 클릭 조정으로 중심이 0 에 수렴
    let ox = clamp(rn(0, 3.2), -7, 7);
    let oy = clamp(rn(0, 3.2), -7, 7);
    const rounds: ShotRound[] = [];
    for (let r = 0; r < ROUNDS_PER_SESSION; r++) {
      const gd = diameter * (r === ROUNDS_PER_SESSION - 1 ? 1 : 1 + rn(0.15, 0.1));
      const shots: Shot[] = [0, 1, 2].map(() => ({
        x: +(ox + rn(0, gd / 3.2)).toFixed(2),
        y: +(oy + rn(0, gd / 3.2)).toFixed(2),
      }));
      rounds.push({
        round: r + 1,
        cx: +ox.toFixed(2),
        cy: +oy.toFixed(2),
        diameter: +gd.toFixed(1),
        shots,
      });
      const fix = clamp(0.55 + sk * 0.4 + rn(0, 0.08), 0.3, 0.98);
      ox *= 1 - fix;
      oy *= 1 - fix;
    }
    const last = rounds[rounds.length - 1];
    const offset = Math.hypot(last.cx, last.cy);
    const pass = diameter <= PASS_DIAMETER_CM && offset <= PASS_OFFSET_CM;
    const weakMetric = [2, 1, 0, 3][weakness];
    const metrics = METRICS.map((_, j) =>
      clamp(Math.round(40 + 55 * sk + rn(0, 7) - (j === weakMetric ? 14 : 0)), 15, 99),
    );
    // 세 교정 포인트(조준·호흡·자세) 중 가장 약한 지표를 1순위로
    const candidates = [0, 1, 3].sort((a, b) => metrics[a] - metrics[b]);
    const correction = METRIC_TO_CORRECTION[candidates[0]];
    const recent = d === 0 && date.getTime() > TODAY.getTime() - 6 * 60000;
    const failRoll = rnd();
    const report: ReportState = recent ? 'run' : failRoll < 0.018 ? 'fail' : 'ok';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const sNo = String(k + 1).padStart(2, '0');
    return {
      id: `${id}-s${sNo}`,
      memberId: id,
      platoonId: platoon.id,
      index: k + 1,
      date,
      diameter: +diameter.toFixed(1),
      offset: +offset.toFixed(1),
      pass,
      metrics,
      correction,
      rounds,
      clicksH: Math.round(-rounds[0].cx / 0.7),
      clicksV: Math.round(-rounds[0].cy / 0.7),
      durationMin: Math.round(14 + rn(0, 4) + (1 - sk) * 8),
      report,
      key: `raw/${yyyy}/${mm}/${dd}/${id}/s${sNo}`,
    };
  });

  const L = own[own.length - 1];
  const member: SeedMember = {
    id,
    name,
    platoonId: platoon.id,
    platoonName: platoon.name,
    sessions: own,
    sessionCount: own.length,
    best: Math.min(...own.map(s => s.diameter)),
    last: L.diameter,
    score: Math.round(
      (L.metrics.reduce((a, b) => a + b, 0) / 5) * 0.6 +
        clamp(100 - (L.diameter - 1.5) * 9, 0, 100) * 0.4,
    ),
    status: L.pass ? '영점 완료' : '재훈련 필요',
    lastDate: L.date,
  };
  members.push(member);
  sessions.push(...own);
}

export const correctionLabels = [...CORRECTIONS];
