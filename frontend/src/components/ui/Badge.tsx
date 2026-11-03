import type { ReactNode } from 'react';

export type BadgeTone = 'good' | 'warn' | 'crit' | 'run';

const toneClass: Record<BadgeTone, string> = {
  good: 'text-up bg-bg-good-wash',
  warn: 'text-text-warn bg-bg-warn-wash',
  crit: 'text-crit bg-bg-crit-wash',
  run: 'text-accent bg-bg-accent-wash',
};

export const Badge = ({ tone, children }: { tone: BadgeTone; children: ReactNode }) => (
  <div
    className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${toneClass[tone]}`}
  >
    <div className="size-1.5 rounded-full bg-current" />
    {children}
  </div>
);

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={status === '영점 완료' ? 'good' : 'crit'}>{status}</Badge>
);
