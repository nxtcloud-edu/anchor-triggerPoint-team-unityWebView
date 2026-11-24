import { TARGET_STAGE01 } from '../photo/render';
import type { RosterMember } from './model';
import type { UnityShot, UnitySession, UnityTrace } from './unity';

/*
 * 발표용 더미 — 실제 유니티 세션과 같은 모양으로 만들어 서버의 summarize 를 그대로 거치게 한다.
 * 그래야 지표·클릭·합격 판정이 실제 기록과 같은 규칙으로 계산된다.
 */

export interface DummyOptions {
  count: number;
  platoons: number;
  minSessions: number;
  maxSessions: number;
  /** 실행 시각 기준 며칠 전까지 흩을지 */
  days: number;
  seed: number;
  /** 이미 쓰고 있는 군번 — 더미가 피한다 */
  existingIds: Set<string>;
}

export const DEFAULT_DUMMY: DummyOptions = {
  count: 200,
  platoons: 10,
  minSessions: 2,
  maxSessions: 8,
  days: 30,
  seed: 20261117,
  existingIds: new Set(),
};

export interface DummySession {
  raw: UnitySession;
  memberId: string;
  receivedAt: string;
}

const DAY = 864e5;
const SHOTS = 10;
const DISTANCE_M = 10;
/* MuzzleMotionBuffer 와 같은 궤적 형식: 격발 -500ms ~ +200ms, 20ms 간격 */
const START_MS = -500;
const STEP_MS = 20;
const SAMPLES = 36;
const FIRE = 25;
const BEFORE = 15;
const HOURS = [9, 9, 10, 10, 10, 11, 13, 14, 14, 15, 15, 16, 17, 19, 20];

/** 표적 종이(A4) 안에 맞은 탄만 명중 — 표적 사진과 같은 링 측정값으로 채점 중심 기준 cm 경계를 구한다 */
const PX_PER_CM = TARGET_STAGE01.pxPerM / 100;
const onPaper = (x: number, y: number) =>
  x >= -TARGET_STAGE01.ringCx / PX_PER_CM &&
  x <= (TARGET_STAGE01.width - TARGET_STAGE01.ringCx) / PX_PER_CM &&
  y <= TARGET_STAGE01.ringCy / PX_PER_CM &&
  y >= -(TARGET_STAGE01.height - TARGET_STAGE01.ringCy) / PX_PER_CM;

const SUR =
  '김이박최정강조윤장임한오서신권황안송류홍전고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부'.split(
    '',
  );
const GIV =
  '민서준도윤예하지시우주원현건태은수영재훈성진동혁석규찬호승연유상경범율빈결한강산'.split('');

type Weakness = 'aim' | 'breath' | 'trigger' | 'posture';
const WEAKNESSES: Weakness[] = ['aim', 'breath', 'trigger', 'posture'];

/** mulberry32 — 시드가 같으면 같은 데이터 */
const createRng = (seed: number) => {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = (mean = 0, sd = 1) => {
    let u = 0;
    let v = 0;
    while (!u) u = next();
    while (!v) v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  return { next, normal, int, pick };
};
type Rng = ReturnType<typeof createRng>;

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits || 0;
const pad = (n: number) => String(n).padStart(2, '0');

/** 유니티 DateTime.Now 형식 (시간대 없음, 서버 TZ=Asia/Seoul 기준) */
const localStamp = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** ShootingRecordMath.Evaluate 와 같은 계산 (미터) */
const groupStats = (points: { x: number; y: number }[]) => {
  if (!points.length) return { mpiX: 0, mpiY: 0, groupSize: 0, meanRadius: 0 };
  const mpiX = points.reduce((s, p) => s + p.x, 0) / points.length;
  const mpiY = points.reduce((s, p) => s + p.y, 0) / points.length;
  let groupSize = 0;
  let meanRadius = 0;
  points.forEach((p, i) => {
    meanRadius += Math.hypot(p.x - mpiX, p.y - mpiY);
    for (let j = i + 1; j < points.length; j++) {
      groupSize = Math.max(groupSize, Math.hypot(p.x - points[j].x, p.y - points[j].y));
    }
  });
  return { mpiX, mpiY, groupSize, meanRadius: meanRadius / points.length };
};

/**
 * 격발 전후 총구 방향(mrad). 무작위 걸음으로 흔들림을 만들고(창 안 표준편차 ≈ 걸음 × 2),
 * 격발 직전 0.2초는 숨을 멈추고 안정되는 구간이라 흔들림을 줄인 뒤 움찔(flinch)을 더한다.
 * 마지막에 격발 순간을 0으로 맞춘다.
 */
const makeTrace = (rng: Rng, aim: number, breath: number, flinch: number): UnityTrace => {
  const right: number[] = [];
  const up: number[] = [];
  let r = 0;
  let u = 0;
  const angle = rng.normal((5 * Math.PI) / 4, 0.5); // 대개 왼쪽 아래로 당김
  for (let k = 0; k < SAMPLES; k++) {
    const steady = k > BEFORE && k <= FIRE ? 0.3 : 1;
    r += rng.normal(0, (aim / 2.1) * steady);
    u += rng.normal(0, (breath / 2.1) * steady);
    const pull = k <= BEFORE ? 0 : Math.min(1, (k - BEFORE) / (FIRE - BEFORE));
    right.push(r + flinch * pull * Math.cos(angle));
    up.push(u + flinch * pull * Math.sin(angle));
  }
  const fr = right[FIRE];
  const fu = up[FIRE];
  return {
    StartMs: START_MS,
    StepMs: STEP_MS,
    RightMrad: right.map(v => round(v - fr, 2)),
    UpMrad: up.map(v => round(v - fu, 2)),
  };
};

const hex32 = (rng: Rng) =>
  Array.from({ length: 32 }, () => Math.floor(rng.next() * 16).toString(16)).join('');

/** 같은 날 안에서 지난 days 일 중 n 개 날짜 (오래된 것부터) */
const sessionDates = (rng: Rng, now: Date, n: number, days: number) => {
  const offsets = new Set<number>();
  while (offsets.size < Math.min(n, days)) offsets.add(rng.int(0, days - 1));
  return [...offsets]
    .sort((a, b) => b - a)
    .map(offset => {
      const d = new Date(now.getTime() - offset * DAY);
      d.setHours(rng.pick(HOURS), rng.int(0, 59), rng.int(0, 59), 0);
      if (d.getTime() > now.getTime()) d.setTime(now.getTime() - rng.int(5, 300) * 60e3);
      return d;
    });
};

interface Shooter {
  skill: number;
  learn: number;
  weakness: Weakness;
  zeroX: number;
  zeroY: number;
}

const makeSession = (rng: Rng, shooter: Shooter, k: number, receivedAt: Date): UnitySession => {
  const sk = clamp(shooter.skill + shooter.learn * k + rng.normal(0, 0.06), 0.02, 0.99);
  const weak = (w: Weakness) => (shooter.weakness === w ? 1.6 : 1);

  // 흔들림(mrad)·캔트(도)·탄착 퍼짐(cm) — 실력이 낮을수록 크다
  const aim = (0.3 + (1 - sk) * 2.2) * weak('aim');
  const breath = (0.2 + (1 - sk) * 1.5) * weak('breath');
  const flinch = (0.15 + (1 - sk) * 1.6) * weak('trigger');
  const cantSpread = (0.4 + (1 - sk) * 2.5) * weak('posture');
  const spread = 0.45 + (1 - sk) * 1.9;

  // 영점 오차는 세션이 쌓일수록 줄어든다 (조정이 반영되는 효과)
  const settle = Math.max(0.2, 1 - 0.25 * k) * (1 - sk * 0.4);
  const mpiX = shooter.zeroX * settle + rng.normal(0, 0.35);
  const mpiY = shooter.zeroY * settle + rng.normal(0, 0.35);
  const cantBase = rng.normal(0, 1.5);

  let time = rng.next() * 3 + 2;
  const shots: UnityShot[] = Array.from({ length: SHOTS }, (_, i) => {
    time += rng.next() * 2.5 + 1.2;
    const x = mpiX + rng.normal(0, spread);
    const y = mpiY + rng.normal(0, spread);
    const r = Math.hypot(x, y);
    const hit = onPaper(x, y) && rng.next() > (1 - sk) * 0.04;
    return {
      Index: i + 1,
      Time: round(time, 3),
      Hit: hit,
      X: hit ? round(x / 100, 4) : 0,
      Y: hit ? round(y / 100, 4) : 0,
      CenterDistance: hit ? round(r / 100, 4) : 0,
      RangeMeters: DISTANCE_M,
      Score: hit ? Math.max(0, 10 - Math.floor(r / 1.5)) : 0,
      Zone: hit ? 'Body' : '',
      Input: 'Physical',
      LeftHand: false,
      CantDegrees: round(cantBase + rng.normal(0, cantSpread), 1),
      Tracking: 'Tracking',
      TrackingStability: round(clamp(0.6 + sk * 0.4 + rng.normal(0, 0.05), 0, 1), 2),
      Trace: makeTrace(rng, aim, breath, flinch),
    };
  });

  const hits = shots.filter(s => s.Hit);
  const stats = groupStats(hits.map(s => ({ x: s.X, y: s.Y })));
  const duration = round(time + rng.next() * 2 + 1, 2);

  return {
    Version: 1,
    Id: hex32(rng),
    StageIndex: 0,
    StageName: 'Stage01',
    DistanceMeters: DISTANCE_M,
    StartedAt: localStamp(new Date(receivedAt.getTime() - duration * 1000)),
    DurationSeconds: duration,
    EndReason: 'MagazineEmpty',
    MagazineSize: SHOTS,
    ShotsFired: SHOTS,
    HitCount: hits.length,
    TotalScore: shots.reduce((s, shot) => s + shot.Score, 0),
    MaxShotScore: 10,
    MpiX: round(stats.mpiX, 4),
    MpiY: round(stats.mpiY, 4),
    GroupSize: round(stats.groupSize, 4),
    MeanRadius: round(stats.meanRadius, 4),
    AppVersion: 'dummy',
    Target: { ProfileName: 'IndoorTargetScore' },
    Shots: shots,
    SimulatorId: '1',
  };
};

export const generateDummy = (
  now: Date,
  options: Partial<DummyOptions> = {},
): { members: RosterMember[]; sessions: DummySession[] } => {
  const opts = { ...DEFAULT_DUMMY, ...options };
  const rng = createRng(opts.seed);
  const used = new Set(opts.existingIds);
  const members: RosterMember[] = [];
  const sessions: DummySession[] = [];

  for (let i = 0; i < opts.count; i++) {
    let id = '';
    do id = `26-7${String(rng.int(0, 9_999_999)).padStart(7, '0')}`;
    while (used.has(id));
    used.add(id);

    members.push({
      id,
      name: rng.pick(SUR) + rng.pick(GIV) + rng.pick(GIV),
      platoonNo: (i % opts.platoons) + 1,
    });

    const shooter: Shooter = {
      skill: clamp(rng.normal(0.42, 0.2), 0.05, 0.95),
      learn: clamp(rng.normal(0.06, 0.025), 0.01, 0.12),
      weakness: rng.pick(WEAKNESSES),
      zeroX: clamp(rng.normal(0, 2), -5, 5),
      zeroY: clamp(rng.normal(0, 2), -5, 5),
    };

    const n = rng.int(opts.minSessions, opts.maxSessions);
    sessionDates(rng, now, n, opts.days).forEach((date, k) => {
      sessions.push({
        raw: makeSession(rng, shooter, k, date),
        memberId: id,
        receivedAt: date.toISOString(),
      });
    });
  }

  return { members, sessions };
};
