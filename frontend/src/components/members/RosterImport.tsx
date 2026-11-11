import { uploadRoster } from '@/api/command';
import type { RosterResult } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToastStore } from '@/stores/toastStore';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  /** 한 명이라도 추가·수정되면 불린다 — 목록을 다시 불러온다 */
  onDone: () => void;
}

/** 명단 붙여넣기 — 엑셀에서 군번·이름·소대 세 칸을 복사해 붙여넣는다 */
export const RosterImport = ({ onClose, onDone }: Props) => {
  const toast = useToastStore(s => s.show);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RosterResult | null>(null);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await uploadRoster(text);
      setResult(r);
      toast(`명단 반영 · 추가 ${r.added}명 · 수정 ${r.updated}명`);
      if (r.added || r.updated) onDone();
      if (!r.errors.length) onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg-tooltip/50 p-4">
      <Card
        className="w-full max-w-[560px]"
        title="명단 붙여넣기"
        hint="한 줄에 한 명 · 군번, 이름, 소대 (엑셀에서 세 칸을 복사해 붙여넣어도 됩니다)"
      >
        <div className="flex flex-col gap-3">
          <textarea
            autoFocus
            rows={10}
            className="w-full rounded-lg border border-border-default bg-bg-surface px-2.5 py-2 font-mono text-[13px]"
            placeholder={'26-71288786, 홍길동, 3\n26-71288787, 김철수, 3소대'}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <div className="text-xs text-text-muted">
            같은 군번이 이미 있으면 이름·소대를 새 값으로 바꿉니다. 첫 줄의 머리글(군번, 이름,
            소대)은 건너뜁니다.
          </div>
          {error && <div className="text-[13px] text-crit">{error}</div>}
          {result && result.errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg bg-bg-crit-wash px-3 py-2 text-[13px] text-crit">
              <div className="font-semibold">반영하지 못한 줄 {result.errors.length}개</div>
              {result.errors.map(e => (
                <div key={e.line}>
                  {e.line}번째 줄 · {e.reason}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>닫기</Button>
            <Button variant="primary" disabled={busy || !text.trim()} onClick={submit}>
              {busy ? '반영 중…' : '명단 반영'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
