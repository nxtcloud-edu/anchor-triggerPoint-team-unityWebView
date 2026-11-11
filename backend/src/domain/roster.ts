import type { RosterMember } from './model';

export interface RosterError {
  line: number;
  reason: string;
}

const PLATOON = /^(\d+)\s*(소대)?$/;

/** 머리글 줄: 군번·소대 칸에 숫자가 하나도 없는 첫 줄 (예: "군번, 이름, 소대") */
const isHeader = (cells: string[]) => !/\d/.test(cells[0]) && !/\d/.test(cells[cells.length - 1]);

/**
 * 한 줄에 한 명: "군번, 이름, 소대". 엑셀에서 복사하면 탭으로 구분된다.
 * 같은 군번이 여러 번 나오면 마지막 줄이 이긴다.
 */
export const parseRoster = (text: string): { rows: RosterMember[]; errors: RosterError[] } => {
  const byId = new Map<string, RosterMember>();
  const errors: RosterError[] = [];
  let seenContent = false;

  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line) return;

    const cells = line.split(line.includes('\t') ? '\t' : ',').map(c => c.trim());
    const first = !seenContent;
    seenContent = true;

    if (first && isHeader(cells)) return;
    if (cells.length !== 3) {
      errors.push({ line: i + 1, reason: '칸이 3개가 아닙니다' });
      return;
    }

    const [id, name, platoon] = cells;
    if (!id || !name) {
      errors.push({ line: i + 1, reason: '군번과 이름이 필요합니다' });
      return;
    }

    const match = PLATOON.exec(platoon);
    if (!match) {
      errors.push({ line: i + 1, reason: '소대는 숫자여야 합니다' });
      return;
    }

    byId.delete(id);
    byId.set(id, { id, name, platoonNo: Number(match[1]) });
  });

  return { rows: [...byId.values()], errors };
};
