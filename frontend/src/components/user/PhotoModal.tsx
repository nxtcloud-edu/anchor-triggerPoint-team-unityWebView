import type { Session } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useEffect } from 'react';

interface Props {
  session: Session;
  caption: string;
  onClose: () => void;
}

/** 표적 사진 크게 보기 — 바깥을 누르거나 Esc 로 닫는다 */
export const PhotoModal = ({ session, caption, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg-tooltip/60 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-[560px]" onClick={e => e.stopPropagation()}>
        <Card
          title={`표적 사진 · 세션 #${session.index}`}
          hint={caption}
          right={<Button onClick={onClose}>닫기</Button>}
        >
          <img
            src={session.photoUrl}
            alt={`세션 #${session.index} 표적 사진`}
            className="mx-auto block max-h-[75vh] w-auto rounded-lg"
          />
        </Card>
      </div>
    </div>
  );
};
