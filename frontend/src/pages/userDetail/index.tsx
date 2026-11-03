import { fetchMember } from '@/api/command';
import { ErrorBox, Loading } from '@/components/ui/State';
import { UserDashboard } from '@/components/user/UserDashboard';
import { useAsync } from '@/hooks/useAsync';
import { Link, useParams } from 'react-router-dom';

/** 관리자 화면의 개인 대시보드 — 사용자 목록에서 들어온다 */
const UserDetailPage = () => {
  const { userId = '' } = useParams();
  const { data, error, loading } = useAsync(() => fetchMember(userId), [userId]);

  if (error) return <ErrorBox message={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div>
      <Link
        to="/users"
        className="mb-3 inline-block text-[13px] text-text-secondary hover:text-text-primary"
      >
        ← 사용자 목록
      </Link>
      <UserDashboard member={data} linkPlatoon />
    </div>
  );
};

export default UserDetailPage;
