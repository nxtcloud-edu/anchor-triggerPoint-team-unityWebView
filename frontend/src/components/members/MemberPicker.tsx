import { fetchMembers } from '@/api/command';
import type { Member } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';

interface Props {
  onPick: (member: Member) => void;
  onCancel: () => void;
}

/** 이름·군번으로 찾아서 한 명을 고른다 (사격 배치 · 세션 옮기기) */
export const MemberPicker = ({ onPick, onCancel }: Props) => {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Member[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetchMembers({ q: q.trim() || undefined, sort: 'name', dir: 'asc', size: 8 })
      .then(r => {
        if (!alive) return;
        setItems(r.items);
        setError('');
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border-default bg-bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          className="w-full rounded-lg border border-border-default bg-bg-surface px-2.5 py-[7px] sm:w-[240px]"
          placeholder="이름 · 군번 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Button onClick={onCancel}>취소</Button>
      </div>
      {error && <div className="text-xs text-crit">{error}</div>}
      <div className="flex flex-wrap gap-1.5">
        {items.map(m => (
          <Button key={m.id} onClick={() => onPick(m)}>
            <div className="font-semibold">{m.name}</div>
            <div className="text-xs text-text-muted">
              {m.platoonName} · {m.id}
            </div>
          </Button>
        ))}
        {!error && !items.length && (
          <div className="text-xs text-text-muted">
            찾는 사람이 없습니다. 사용자 대시보드에서 명단을 먼저 붙여넣으세요.
          </div>
        )}
      </div>
    </div>
  );
};
