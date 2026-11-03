import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

export const Card = ({ title, hint, right, className = '', children }: CardProps) => (
  <div
    className={`min-w-0 rounded-[14px] border border-border-default bg-bg-surface px-[18px] py-4 ${className}`}
  >
    {(title || right) && (
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-col">
          <div className="text-sm font-semibold">{title}</div>
          {hint && <div className="mt-0.5 text-xs text-text-muted">{hint}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);
