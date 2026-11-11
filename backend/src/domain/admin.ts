import type { RecentSession, SimulatorSlot } from '../../../frontend/src/api/types';
import type { State } from './model';

const platoonName = (no: number) => `${no}소대`;

/** 1번부터 시뮬레이터 대수만큼, 지금 배치된 사람 */
export const simulatorSlots = (state: State): SimulatorSlot[] =>
  Array.from({ length: state.company.simulatorCount }, (_, i) => {
    const id = String(i + 1);
    const assignment = state.simulators[id];
    const member = assignment?.memberId
      ? state.members.find(m => m.id === assignment.memberId)
      : undefined;
    return {
      id,
      member: member ? { id: member.id, name: member.name, platoonName: platoonName(member.platoonNo) } : null,
      assignedAt: assignment?.assignedAt ?? null,
    };
  });

/** 받은 순서 최신부터 — 미배정·집계 제외 세션도 보여 줘서 도착 여부를 확인하고 옮길 수 있게 한다 */
export const recentSessions = (state: State, limit: number): RecentSession[] =>
  [...state.sessions]
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, limit)
    .map(s => ({
      id: s.id,
      date: s.receivedAt,
      simulatorId: s.simulatorId,
      memberId: s.memberId,
      memberName: state.members.find(m => m.id === s.memberId)?.name ?? null,
      shotsFired: s.shotsFired,
      hitCount: s.hitCount,
      diameter: s.diameter,
      counted: s.counted,
      stageName: s.stageName,
    }));
