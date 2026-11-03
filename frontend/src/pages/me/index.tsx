import { fetchMyDashboard } from '@/api/command';
import { BrandMark } from '@/components/header/icons';
import { ThemeToggle } from '@/components/header/ThemeToggle';
import { ErrorBox, Loading } from '@/components/ui/State';
import { Toast } from '@/components/ui/Toast';
import { UserDashboard } from '@/components/user/UserDashboard';
import { useAsync } from '@/hooks/useAsync';
import { useParams } from 'react-router-dom';

/** 사용자 본인용 개인 대시보드 — 관리자 메뉴 없이 단독으로 열린다 (Unity WebView 용) */
const MePage = () => {
  const { userId = '' } = useParams();
  const { data, error, loading } = useAsync(() => fetchMyDashboard(userId), [userId]);

  return (
    <div className="min-h-screen bg-bg-page">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-bg-sidebar px-4 py-2.5 text-text-sidebar md:px-7">
        <div className="flex items-center gap-2.5 text-[15px] font-bold text-text-sidebar-strong">
          <BrandMark />
          <div className="flex flex-col">
            <div>Trigger_Point</div>
            <div className="text-[11px] font-medium text-text-sidebar-muted">내 영점사격 기록</div>
          </div>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </div>
      <div className="px-4 pt-4 pb-12 md:px-7 md:pt-[22px]">
        {error && <ErrorBox message={error} />}
        {loading && !data && <Loading />}
        {data && <UserDashboard member={data} />}
      </div>
      <Toast />
    </div>
  );
};

export default MePage;
