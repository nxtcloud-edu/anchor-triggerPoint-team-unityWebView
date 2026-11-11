import {
  PASS_DIAMETER_CM,
  PASS_OFFSET_CM,
} from '../../../frontend/src/constants/shooting';
import { computeMetrics, correctionOf, MIN_HITS } from './metrics';
import type { StoredSession } from './model';
import type { UnitySession } from './unity';

export interface SummarizeOptions {
  clickCmAt100mH: number;
  clickCmAt100mV: number;
  countedProfiles: string[];
}

export type SessionSummary = Omit<StoredSession, 'memberId' | 'simulatorId' | 'receivedAt' | 'rawKey'>;

const r1 = (v: number) => +v.toFixed(1);
const r2 = (v: number) => +v.toFixed(2);
/** Math.round(-0.4)가 -0이 되는 것을 0으로 */
const round = (v: number) => Math.round(v) || 0;

/** 실내 영점 표적에서 탄창을 다 쏜 세션만 대시보드에 넣는다 */
export const isCounted = (raw: UnitySession, profiles: string[]) =>
  profiles.includes(raw.Target?.ProfileName ?? '') && raw.EndReason === 'MagazineEmpty';

/** 유니티 세션 하나 → 화면 세션 필드 (탄창 하나 = 회차 하나, 단위 cm, 거리 환산 없음) */
export const summarize = (raw: UnitySession, opts: SummarizeOptions): SessionSummary => {
  const hits = (raw.Shots ?? []).filter(s => s.Hit);
  const measurable = raw.HitCount >= MIN_HITS && hits.length >= MIN_HITS;

  const cx = measurable ? r2(raw.MpiX * 100) : 0;
  const cy = measurable ? r2(raw.MpiY * 100) : 0;
  const diameter = measurable ? r1(raw.GroupSize * 100) : 0;
  const offset = measurable ? r1(Math.hypot(raw.MpiX, raw.MpiY) * 100) : 0;

  // 한 클릭이 움직이는 거리(cm) — ShootingAdvisor.ApplyClicks와 같은 계산. 탄착을 중심으로 옮기는 방향이 +
  const distance = raw.DistanceMeters;
  const clickH = (opts.clickCmAt100mH * distance) / 100;
  const clickV = (opts.clickCmAt100mV * distance) / 100;
  const canClick = measurable && distance > 0;

  const metrics = computeMetrics(raw);

  return {
    id: raw.Id,
    counted: isCounted(raw, opts.countedProfiles),
    stageName: raw.StageName ?? '',
    distanceMeters: distance,
    shotsFired: raw.ShotsFired ?? raw.Shots?.length ?? 0,
    hitCount: raw.HitCount ?? hits.length,
    diameter,
    offset,
    pass: measurable && diameter <= PASS_DIAMETER_CM && offset <= PASS_OFFSET_CM,
    metrics,
    correction: correctionOf(metrics),
    rounds: [
      {
        round: 1,
        cx,
        cy,
        diameter,
        shots: hits.map(s => ({ x: r2(s.X * 100), y: r2(s.Y * 100) })),
      },
    ],
    clicksH: canClick && clickH > 0 ? round(-(raw.MpiX * 100) / clickH) : 0,
    clicksV: canClick && clickV > 0 ? round(-(raw.MpiY * 100) / clickV) : 0,
    durationMin: r1((raw.DurationSeconds ?? 0) / 60),
  };
};
