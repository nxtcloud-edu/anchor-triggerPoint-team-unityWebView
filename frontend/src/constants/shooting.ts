/** 합격 기준: 최종 회차 탄착군 직경 ⌀5cm 이하 + 중심 편차 2.5cm 이하 */
export const PASS_DIAMETER_CM = 5;
export const PASS_OFFSET_CM = 2.5;

/** 주요 교정 포인트 — 이 세 가지만 집계한다 */
export const CORRECTIONS = ['조준선 정렬', '호흡 불안정', '사격 자세'] as const;

export const METRICS = [
  '조준 안정성',
  '호흡 통제',
  '격발 제어',
  '사격 자세',
  '탄착 일관성',
] as const;

export const ROUNDS_PER_SESSION = 3;
