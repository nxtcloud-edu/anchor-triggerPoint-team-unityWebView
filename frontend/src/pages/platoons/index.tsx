import { fetchPlatoons } from '@/api/command';
import { FilterBar, FilterLabel, PageHeader } from '@/components/layout/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorBox, Loading } from '@/components/ui/State';
import { RANGES } from '@/constants/ranges';
import { useAsync } from '@/hooks/useAsync';
import { useState } from 'react';
import { Link } from 'react-router-dom';

/** 소대 목록 — 카드를 누르면 소대 대시보드 */
const PlatoonsPage = () => {
  const [range, setRange] = useState(30);
  const { data, error, loading } = useAsync(() => fetchPlatoons(range), [range]);

  return (
    <div>
      <PageHeader title="소대 대시보드" sub="소대를 선택하면 해당 소대의 대시보드가 열립니다" />
      <FilterBar>
        <FilterLabel>기간</FilterLabel>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </FilterBar>
      {error && <ErrorBox message={error} />}
      {loading && !data && <Loading />}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {data?.map(p => (
          <Link
            key={p.id}
            to={`/platoons/${p.id}`}
            className="flex flex-col gap-3 rounded-[14px] border border-border-default bg-bg-surface px-[18px] py-4 hover:bg-bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="text-xs text-text-muted">{p.memberCount}명</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-text-secondary">합격률</div>
              <div className="flex items-baseline gap-0.5">
                <div className="text-[26px] font-bold tracking-tight">{p.passRate.toFixed(1)}</div>
                <div className="text-[13px] text-text-secondary">%</div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-bg-surface-2">
                <div
                  className="h-full rounded-full bg-chart-1"
                  style={{ width: `${p.passRate}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="flex flex-col">
                <div className="text-text-muted">영점 완료</div>
                <div className="tabular font-semibold text-up">{p.zeroed}</div>
              </div>
              <div className="flex flex-col">
                <div className="text-text-muted">재훈련</div>
                <div className="tabular font-semibold text-crit">{p.retrain}</div>
              </div>
              <div className="flex flex-col">
                <div className="text-text-muted">세션</div>
                <div className="tabular font-semibold">{p.sessions}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default PlatoonsPage;
