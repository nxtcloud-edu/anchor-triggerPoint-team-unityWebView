import type { ReactNode } from 'react';

export const PageHeader = ({
  title,
  sub,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
}) => (
  <div className="mb-[18px] flex flex-wrap items-center justify-between gap-4">
    <div className="flex flex-col">
      <div className="text-[22px] font-bold tracking-tight">{title}</div>
      {sub && <div className="mt-0.5 text-[13px] text-text-secondary">{sub}</div>}
    </div>
    {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
  </div>
);

export const LiveClock = ({ time }: { time: string }) => (
  <div className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
    <div className="animate-tp-pulse size-2 rounded-full bg-good" />
    실시간 · {time}
  </div>
);

export const FilterBar = ({ children }: { children: ReactNode }) => (
  <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>
);

export const FilterLabel = ({ children }: { children: ReactNode }) => (
  <div className="mr-0.5 text-xs text-text-muted">{children}</div>
);
