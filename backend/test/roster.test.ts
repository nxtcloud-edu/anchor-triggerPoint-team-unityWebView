import { describe, expect, it } from 'vitest';
import { parseRoster } from '../src/domain/roster';

describe('parseRoster', () => {
  it('parses comma and tab lines with 소대 suffix', () => {
    const { rows, errors } = parseRoster('26-1,홍길동,3\n26-2\t김철수\t4소대\r\n26-3, 이영희 , 5 소대');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { id: '26-1', name: '홍길동', platoonNo: 3 },
      { id: '26-2', name: '김철수', platoonNo: 4 },
      { id: '26-3', name: '이영희', platoonNo: 5 },
    ]);
  });

  it('skips a header line and blank lines', () => {
    const { rows, errors } = parseRoster('군번\t이름\t소대\n\n  \n26-1\t홍길동\t1');
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ id: '26-1', name: '홍길동', platoonNo: 1 }]);
  });

  it('reports bad lines with their line numbers', () => {
    expect(parseRoster('26-1,홍길동').errors).toEqual([{ line: 1, reason: '칸이 3개가 아닙니다' }]);
    expect(parseRoster('26-1,홍길동,1\n26-2,김철수,일').errors).toEqual([
      { line: 2, reason: '소대는 숫자여야 합니다' },
    ]);
    expect(parseRoster('26-1,,1').errors).toEqual([{ line: 1, reason: '군번과 이름이 필요합니다' }]);
  });

  it('does not mistake a bad first data line for a header', () => {
    expect(parseRoster('26-1,홍길동,일').errors).toEqual([{ line: 1, reason: '소대는 숫자여야 합니다' }]);
  });

  it('lets the last duplicate win', () => {
    const { rows } = parseRoster('26-1,홍길동,1\n26-1,홍길순,2');
    expect(rows).toEqual([{ id: '26-1', name: '홍길순', platoonNo: 2 }]);
  });
});
