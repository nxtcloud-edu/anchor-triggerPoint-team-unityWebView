import { fetchMembers } from '@/api/command';
import type { Member, MemberSortKey, MemberStatus, Page, PlatoonSummary } from '@/api/types';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { fmtDT } from '@/utils/format';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const COLUMNS: { key: MemberSortKey | null; label: string }[] = [
  { key: 'id', label: '군번' },
  { key: 'name', label: '이름' },
  { key: 'platoonName', label: '소대' },
  { key: 'sessionCount', label: '세션' },
  { key: 'best', label: '최고 탄착군' },
  { key: 'last', label: '최근 탄착군' },
  { key: 'score', label: '종합 점수' },
  { key: null, label: '상태' },
  { key: 'lastDate', label: '최근 사격' },
];
const GRID = 'grid grid-cols-[110px_80px_64px_52px_88px_88px_120px_96px_96px] gap-0 min-w-[794px]';
const PER = 12;

interface Props {
  title: string;
  hint: string;
  /** 고정 소대 (소대 대시보드). 없으면 소대 선택 필터를 보여 준다 */
  platoonId?: string;
  platoons?: PlatoonSummary[];
}

/** 인원 목록 — 행을 누르면 사용자 대시보드로 이동 */
export const MemberTable = ({ title, hint, platoonId, platoons }: Props) => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<MemberStatus | ''>('');
  const [platoonF, setPlatoonF] = useState('');
  const [sort, setSort] = useState<MemberSortKey>('score');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Page<Member> | null>(null);
  const [error, setError] = useState('');

  const pid = platoonId ?? (platoonF || undefined);

  useEffect(() => {
    let alive = true;
    fetchMembers({
      platoonId: pid,
      q: q || undefined,
      status: status || undefined,
      sort,
      dir,
      page,
      size: PER,
    })
      .then(r => {
        if (alive) {
          setData(r);
          setError('');
        }
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [pid, q, status, sort, dir, page]);

  const onSort = (k: MemberSortKey) => {
    if (k === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSort(k);
      setDir(k === 'name' || k === 'id' || k === 'platoonName' ? 'asc' : 'desc');
    }
  };

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER));

  return (
    <Card
      title={title}
      hint={hint}
      right={
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="w-full rounded-lg border border-border-default bg-bg-surface px-2.5 py-[7px] sm:w-[220px]"
            placeholder="이름 · 군번 검색"
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
          {!platoonId && platoons && (
            <Select
              value={platoonF}
              onChange={e => {
                setPlatoonF(e.target.value);
                setPage(0);
              }}
            >
              <option value="">전체 소대</option>
              {platoons.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Select
            value={status}
            onChange={e => {
              setStatus(e.target.value as MemberStatus | '');
              setPage(0);
            }}
          >
            <option value="">전체 상태</option>
            <option>영점 완료</option>
            <option>재훈련 필요</option>
          </Select>
        </div>
      }
    >
      {error && <div className="py-3 text-crit">{error}</div>}
      <div className="overflow-x-auto text-[13px]">
        <div className={`${GRID} border-b border-border-grid`}>
          {COLUMNS.map(col => (
            <div
              key={col.label}
              className="px-2.5 py-2 text-xs font-medium whitespace-nowrap text-text-muted"
            >
              {col.key ? (
                <button
                  type="button"
                  className="cursor-pointer hover:text-text-primary"
                  onClick={() => onSort(col.key!)}
                >
                  {col.label}
                  {sort === col.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </button>
              ) : (
                col.label
              )}
            </div>
          ))}
        </div>
        {data?.items.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => navigate(`/users/${m.id}`)}
            className={`${GRID} w-full cursor-pointer items-center border-b border-border-grid text-left hover:bg-bg-surface-2`}
          >
            <div className="px-2.5 py-[9px] font-mono text-xs text-text-secondary">{m.id}</div>
            <div className="px-2.5 py-[9px] font-semibold">{m.name}</div>
            <div className="px-2.5 py-[9px]">{m.platoonName}</div>
            <div className="tabular px-2.5 py-[9px]">{m.sessionCount}</div>
            <div className="tabular px-2.5 py-[9px]">{m.best.toFixed(1)}cm</div>
            <div className="tabular px-2.5 py-[9px]">{m.last.toFixed(1)}cm</div>
            <div className="tabular flex items-center gap-1.5 px-2.5 py-[9px]">
              <div className="h-1.5 rounded-[3px] bg-chart-1" style={{ width: m.score * 0.6 }} />
              {m.score}
            </div>
            <div className="px-2.5 py-[9px]">
              <StatusBadge status={m.status} />
            </div>
            <div className="tabular px-2.5 py-[9px]">{fmtDT(m.lastDate)}</div>
          </button>
        ))}
        {data && !data.items.length && (
          <div className="py-10 text-center text-text-muted">조건에 맞는 인원이 없습니다</div>
        )}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-xs text-text-muted">
        <div>
          {total}명 중 {total ? page * PER + 1 : 0}–{Math.min(total, page * PER + PER)} · {page + 1}
          /{pages} 페이지
        </div>
        <div className="flex gap-2">
          <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
            이전
          </Button>
          <Button disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            다음
          </Button>
        </div>
      </div>
    </Card>
  );
};
