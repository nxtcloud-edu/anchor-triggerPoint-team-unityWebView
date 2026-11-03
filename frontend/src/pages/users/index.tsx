import { fetchPlatoons } from '@/api/command';
import { PageHeader } from '@/components/layout/PageHeader';
import { MemberTable } from '@/components/members/MemberTable';
import { useAsync } from '@/hooks/useAsync';

/** 사용자 목록 — 행을 누르면 사용자 대시보드 */
const UsersPage = () => {
  const platoons = useAsync(() => fetchPlatoons(), []);
  return (
    <div>
      <PageHeader title="사용자 대시보드" sub="사용자를 선택하면 개인 대시보드가 열립니다" />
      <MemberTable
        title="사용자 목록"
        hint="이름·군번으로 찾거나 소대·상태로 걸러 보세요"
        platoons={platoons.data ?? undefined}
      />
    </div>
  );
};

export default UsersPage;
