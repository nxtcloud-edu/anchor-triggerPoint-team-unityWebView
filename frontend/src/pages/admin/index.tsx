import { fetchCompany, fetchDashboard } from '@/api/command';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { FilterBar, FilterLabel, LiveClock, PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { ErrorBox, Loading } from '@/components/ui/State';
import { RANGES } from '@/constants/ranges';
import { useAsync, useNow } from '@/hooks/useAsync';
import { useToastStore } from '@/stores/toastStore';
import { useState } from 'react';

/** 중대 대시보드 — 중대 전체(소대 10개) 기준 */
const AdminPage = () => {
  const [range, setRange] = useState(30);
  const now = useNow();
  const toast = useToastStore(s => s.show);
  const company = useAsync(fetchCompany, []);
  const dash = useAsync(() => fetchDashboard({ range }), [range]);

  const c = company.data;
  return (
    <div>
      <PageHeader
        title={c ? `${c.name} 대시보드` : '중대 대시보드'}
        sub={
          c &&
          `${c.course} · 소대 ${c.platoonCount}개 · 인원 ${c.memberCount}명 · Unity 시뮬레이터 ${c.simulatorCount}대`
        }
        right={
          <>
            <LiveClock time={now.toLocaleTimeString('ko-KR')} />
            <Button
              variant="primary"
              onClick={() => toast('CSV 내보내기가 시작되었습니다 (trigger_point_sessions.csv)')}
            >
              ⤓ 내보내기
            </Button>
          </>
        }
      />
      <FilterBar>
        <FilterLabel>기간</FilterLabel>
        <Segmented options={RANGES} value={range} onChange={setRange} />
      </FilterBar>
      {dash.error && <ErrorBox message={dash.error} />}
      {dash.loading && !dash.data && <Loading />}
      {dash.data && <DashboardView data={dash.data} />}
    </div>
  );
};

export default AdminPage;
