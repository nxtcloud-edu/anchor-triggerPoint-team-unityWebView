import { MIN_HITS } from '../../../frontend/src/constants/shooting';
import type { UnitySession, UnityTrace } from './unity';

export { MIN_HITS };

/**
 * 지표별 [좋음, 나쁨] 기준값 — METRICS 순서. 실제 기록을 보며 조정하는 초기값이다.
 * 바꾼 뒤에는 `pnpm recompute`로 저장된 세션 지표를 다시 계산한다.
 */
export const METRIC_THRESHOLDS: readonly (readonly [number, number])[] = [
  [0.3, 3.0], // 조준 안정성: 격발 전 0.5초 조준점 흔들림 (mrad)
  [0.2, 2.0], // 호흡 통제: 같은 구간 상하 흔들림 (mrad)
  [0.2, 2.0], // 격발 제어: 격발 직전 0.2초 총구 이동 (mrad)
  [1, 10], // 사격 자세: 세션 안 캔트 변화폭 (도)
  [0.5, 5.0], // 탄착 일관성: 평균 반경 (cm)
];

const NO_DATA_SCORE = 50;
const PRE_SHOT_WINDOW_MS = 200;

/** 화면 가짜 데이터의 점수 범위(15–99)에 맞춘 선형 점수 */
export const scoreOf = (value: number, good: number, bad: number) =>
  Math.min(99, Math.max(15, Math.round(99 - (84 * (value - good)) / (bad - good))));

const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
};

interface TraceValues {
  aim: number;
  breath: number;
  trigger: number;
}

/** 격발 순간까지의 궤적으로 탄 하나의 흔들림 값을 잰다. 궤적이 모자라면 null */
const traceValues = (trace: UnityTrace | undefined): TraceValues | null => {
  if (!trace || trace.StepMs <= 0) return null;

  const fire = Math.round(-trace.StartMs / trace.StepMs);
  const before = fire - Math.round(PRE_SHOT_WINDOW_MS / trace.StepMs);
  const count = Math.min(trace.RightMrad?.length ?? 0, trace.UpMrad?.length ?? 0);
  if (before < 0 || fire >= count) return null;

  const right = trace.RightMrad.slice(0, fire + 1);
  const up = trace.UpMrad.slice(0, fire + 1);

  return {
    aim: Math.hypot(std(right), std(up)),
    breath: std(up),
    trigger: Math.hypot(
      trace.RightMrad[fire] - trace.RightMrad[before],
      trace.UpMrad[fire] - trace.UpMrad[before],
    ),
  };
};

const scoreAt = (index: number, value: number | null) =>
  value === null ? NO_DATA_SCORE : scoreOf(value, ...METRIC_THRESHOLDS[index]);

/** METRICS 순서 5개 지표 (0–100). 계산할 탄이 없으면 그 지표는 50 */
export const computeMetrics = (raw: UnitySession): number[] => {
  const shots = raw.Shots ?? [];
  const traces = shots.map(s => traceValues(s.Trace)).filter((v): v is TraceValues => v !== null);
  const avgOf = (pick: (t: TraceValues) => number) => (traces.length ? mean(traces.map(pick)) : null);

  const cants = shots.map(s => s.CantDegrees).filter(Number.isFinite);
  const cantRange = cants.length ? Math.max(...cants) - Math.min(...cants) : null;

  const consistency = raw.HitCount >= MIN_HITS ? scoreAt(4, raw.MeanRadius * 100) : 15;

  return [
    scoreAt(0, avgOf(t => t.aim)),
    scoreAt(1, avgOf(t => t.breath)),
    scoreAt(2, avgOf(t => t.trigger)),
    scoreAt(3, cantRange),
    consistency,
  ];
};

/** 지표 인덱스 → 교정 포인트 인덱스 (조준 안정성→조준선 정렬, 호흡 통제→호흡 불안정, 사격 자세→사격 자세) */
const METRIC_TO_CORRECTION: Record<number, number> = { 0: 0, 1: 1, 3: 2 };

/** 세 교정 포인트 후보 중 가장 약한 지표를 1순위로 (가짜 데이터 seed.ts와 같은 규칙) */
export const correctionOf = (metrics: number[]) => {
  const weakest = [0, 1, 3].sort((a, b) => metrics[a] - metrics[b])[0];
  return METRIC_TO_CORRECTION[weakest];
};
