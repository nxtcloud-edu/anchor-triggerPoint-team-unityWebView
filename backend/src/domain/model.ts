import type { ShotRound } from '../../../frontend/src/api/types';

export interface RosterMember {
  /** 군번 */
  id: string;
  name: string;
  platoonNo: number;
}

export interface SimulatorAssignment {
  memberId: string | null;
  assignedAt: string | null;
}

/** 세션 하나를 화면 형식으로 계산해 둔 결과. index·date·report·key는 응답할 때 만든다 */
export interface StoredSession {
  id: string;
  memberId: string | null;
  simulatorId: string;
  receivedAt: string;
  rawKey: string;
  /** 실내 영점 표적에서 탄창을 다 쏜 세션만 집계한다 */
  counted: boolean;
  stageName: string;
  distanceMeters: number;
  shotsFired: number;
  hitCount: number;
  diameter: number;
  offset: number;
  pass: boolean;
  metrics: number[];
  /** CORRECTIONS 인덱스 — 가장 약한 교정 포인트 */
  correction: number;
  rounds: ShotRound[];
  clicksH: number;
  clicksV: number;
  durationMin: number;
}

export interface CompanyInfo {
  id: string;
  name: string;
  course: string;
  simulatorCount: number;
}

export interface State {
  version: 1;
  company: CompanyInfo;
  members: RosterMember[];
  simulators: Record<string, SimulatorAssignment>;
  sessions: StoredSession[];
}

export const emptyState = (): State => ({
  version: 1,
  company: { id: 'c1', name: '1중대', course: '2026년 2기 영점사격 과정', simulatorCount: 1 },
  members: [],
  simulators: {},
  sessions: [],
});
