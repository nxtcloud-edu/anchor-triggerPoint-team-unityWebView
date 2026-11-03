import { fetchDashboard } from '@/api/command';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { FilterBar, FilterLabel, PageHeader } from '@/components/layout/PageHeader';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorBox, Loading } from '@/components/ui/State';
import { RANGES } from '@/constants/ranges';
import { useAsync } from '@/hooks/useAsync';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const PlatoonDetailPage = () => {
  const { platoonId = '' } = useParams();
  const [range, setRange] = useState(30);
  const { data, error, loading } = useAsync(
    () => fetchDashboard({ range, platoonId }),
    [range, platoonId],
  );

  return (
    <div>
      <PageHeader
        title={data ? `${data.scope.name} 대시보드` : '소대 대시보드'}
        sub={data && `인원 ${data.kpis.memberCount}명 · 최근 ${range}일 기준`}
        right={
          <Link to="/platoons" className="text-[13px] text-text-secondary hover:text-text-primary">
            ← 소대 목록
          </Link>
        }
      />
      <FilterBar>
        <FilterLabel>기간</FilterLabel>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </FilterBar>
      {error && <ErrorBox message={error} />}
      {loading && !data && <Loading />}
      {data && <DashboardView data={data} />}
    </div>
  );
};

export default PlatoonDetailPage;
