import { fetchPlatoons } from '@/api/command';
import { PageHeader } from '@/components/layout/PageHeader';
import { MemberTable } from '@/components/members/MemberTable';
import { RosterImport } from '@/components/members/RosterImport';
import { Button } from '@/components/ui/Button';
import { useAsync } from '@/hooks/useAsync';
import { useState } from 'react';

/** 사용자 목록 — 행을 누르면 사용자 대시보드 */
const UsersPage = () => {
  const [version, setVersion] = useState(0);
  const [importing, setImporting] = useState(false);
  const platoons = useAsync(() => fetchPlatoons(), [version]);

  return (
    <div>
      <PageHeader
        title="사용자 대시보드"
        sub="사용자를 선택하면 개인 대시보드가 열립니다"
        right={<Button onClick={() => setImporting(true)}>명단 붙여넣기</Button>}
      />
      <MemberTable
        key={version}
        title="사용자 목록"
        hint="이름·군번으로 찾거나 소대·상태로 걸러 보세요"
        platoons={platoons.data ?? undefined}
      />
      {importing && (
        <RosterImport onClose={() => setImporting(false)} onDone={() => setVersion(v => v + 1)} />
      )}
    </div>
  );
};

export default UsersPage;
