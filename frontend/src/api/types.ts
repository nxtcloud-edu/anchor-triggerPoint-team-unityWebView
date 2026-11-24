export type MemberStatus = '영점 완료' | '재훈련 필요';
export type ReportState = 'ok' | 'run' | 'fail';

/* ---------- 인증 ---------- */
export interface LoginRequest {
  username: string;
  password: string;
}
export interface AdminUser {
  id: string;
  name: string;
  role: 'admin';
}
export interface LoginResponse {
  token: string;
  user: AdminUser;
}

/* ---------- 중대 · 소대 ---------- */
export interface Company {
  id: string;
  name: string;
  course: string;
  platoonCount: number;
  memberCount: number;
  simulatorCount: number;
}

export interface PlatoonSummary {
  id: string;
  name: string;
  memberCount: number;
  sessions: number;
  passRate: number;
  avgDiameter: number;
  zeroed: number;
  retrain: number;
}

/* ---------- 대시보드 (중대 / 소대 공용) ---------- */
export interface DashboardQuery {
  range: number;
  platoonId?: string;
}

export interface DashboardKpis {
  memberCount: number;
  activeMembers7d: number;
  sessions: number;
  prevSessions: number | null;
  passRate: number;
  prevPassRate: number | null;
  avgDiameter: number;
  prevAvgDiameter: number | null;
  zeroed: number;
}

export interface DailySessions {
  date: string;
  pass: number;
  fail: number;
}

export interface CorrectionCount {
  label: string;
  count: number;
}

export interface Dashboard {
  range: number;
  scope: { type: 'company' | 'platoon'; id: string; name: string };
  kpis: DashboardKpis;
  daily: DailySessions[];
  status: { zeroed: number; retrain: number };
  corrections: CorrectionCount[];
  platoons: PlatoonSummary[];
}

/* ---------- 인원 ---------- */
export type MemberSortKey =
  'id' | 'name' | 'platoonName' | 'sessionCount' | 'best' | 'last' | 'score' | 'lastDate';

export interface MemberQuery {
  platoonId?: string;
  q?: string;
  status?: MemberStatus;
  sort?: MemberSortKey;
  dir?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

export interface Member {
  id: string;
  name: string;
  platoonId: string;
  platoonName: string;
  sessionCount: number;
  best: number;
  last: number;
  score: number;
  status: MemberStatus;
  lastDate: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface Shot {
  x: number;
  y: number;
}

/** 한 세션 안의 사격 회차 (1회차 = 조정 전, 마지막 회차 = 최종) */
export interface ShotRound {
  round: number;
  cx: number;
  cy: number;
  diameter: number;
  shots: Shot[];
}

export interface Session {
  id: string;
  index: number;
  date: string;
  diameter: number;
  offset: number;
  pass: boolean;
  metrics: number[];
  rounds: ShotRound[];
  clicksH: number;
  clicksV: number;
  durationMin: number;
  report: ReportState;
  key: string;
  /* 실제 서버(유니티 세션)에서만 오는 값 — 더미 데이터에는 없다 */
  distanceMeters?: number;
  shotsFired?: number;
  hitCount?: number;
  stageName?: string;
  simulatorId?: string;
  /** 유니티 결과 창과 같은 탄흔 표적 사진 (임시 주소, 1시간 유효). 아직 없으면 생략 */
  photoUrl?: string;
}

export interface MemberDetail extends Member {
  weapon: string;
  sessions: Session[];
  metricLabels: string[];
  companyAvgMetrics: number[];
}

/* ---------- 사격 배치 · 명단 ---------- */
export interface SimulatorSlot {
  id: string;
  member: { id: string; name: string; platoonName: string } | null;
  assignedAt: string | null;
}

export interface RecentSession {
  id: string;
  date: string;
  simulatorId: string;
  memberId: string | null;
  memberName: string | null;
  shotsFired: number;
  hitCount: number;
  diameter: number;
  /** false 면 실내 영점 표적·탄창 완주가 아니라 집계에서 빠진 세션 */
  counted: boolean;
  stageName: string;
}

export interface RosterResult {
  added: number;
  updated: number;
  errors: { line: number; reason: string }[];
}
