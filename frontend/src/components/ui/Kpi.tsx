import type { ReactNode } from 'react';

interface KpiProps {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
}

export const Kpi = ({ label, value, unit, detail }: KpiProps) => (
  <div className="rounded-[14px] border border-border-default bg-bg-surface px-4 py-3.5">
    <div className="text-[12.5px] text-text-secondary">{label}</div>
    <div className="mt-1 flex items-baseline gap-0.5">
      <div className="text-[26px] font-bold tracking-tight">{value}</div>
      {unit && <div className="text-[13px] font-medium text-text-secondary">{unit}</div>}
    </div>
    {detail && <div className="mt-0.5 text-xs text-text-muted">{detail}</div>}
  </div>
);

/** 이전 기간 대비 증감 — invert=true 면 감소가 좋은 지표 (탄착군 직경) */
export const Delta = ({
  cur,
  prev,
  unit,
  range,
  invert = false,
  digits = 1,
}: {
  cur: number;
  prev: number | null;
  unit: string;
  range: number;
  invert?: boolean;
  digits?: number;
}) => {
  if (prev === null) return <div>이전 기간 데이터 없음</div>;
  const d = cur - prev;
  const good = invert ? d < 0 : d > 0;
  return (
    <div className="flex gap-1">
      <div className={good ? 'text-up' : 'text-crit'}>
        {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(digits)}
        {unit}
      </div>
      <div>이전 {range}일 대비</div>
    </div>
  );
};
