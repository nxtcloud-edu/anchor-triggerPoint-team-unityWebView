import type { SelectHTMLAttributes } from 'react';

export const Select = ({ className = '', ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={`rounded-lg border border-border-default bg-bg-surface px-2.5 py-[7px] ${className}`}
    {...rest}
  />
);
