import {
  assignSession,
  assignSimulator,
  fetchRecentSessions,
  fetchSimulators,
} from '@/api/command';
import { PageHeader } from '@/components/layout/PageHeader';
import { MemberPicker } from '@/components/members/MemberPicker';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBox, Loading } from '@/components/ui/State';
import { MIN_HITS } from '@/constants/shooting';
import { useAsync } from '@/hooks/useAsync';
import { useToastStore } from '@/stores/toastStore';
import { fmtDT } from '@/utils/format';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const REFRESH_MS = 10_000;

type Picking = { kind: 'simulator' | 'session'; id: string } | null;

/** 사격 배치 — 시뮬레이터에 사수를 배치하고, 들어온 세션을 확인·정정한다 */
const AssignmentsPage = () => {
  const toast = useToastStore(s => s.show);
  const [tick, setTick] = useState(0);
  const [picking, setPicking] = useState<Picking>(null);
  const simulators = useAsync(() => fetchSimulators(), [tick]);
  const recent = useAsync(() => fetchRecentSessions(20), [tick]);

  // 유니티에서 세션이 들어오는 것을 보면서 배치를 바꿀 수 있게 주기적으로 다시 불러온다
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, []);

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      toast(done);
      setPicking(null);
      setTick(n => n + 1);
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const isPicking = (kind: 'simulator' | 'session', id: string) =>
    picking?.kind === kind && picking.id === id;

  return (
    <div>
      <PageHeader
        title="사격 배치"
        sub="시뮬레이터에 사수를 배치하면, 그 시뮬레이터에서 들어오는 세션이 그 사람의 기록이 됩니다"
        right={<Button onClick={() => setTick(n => n + 1)}>새로고침</Button>}
      />
      <div className="flex flex-col gap-3.5">
        <Card title="시뮬레이터" hint="배치는 바꾸거나 해제할 때까지 유지됩니다">
          {simulators.error && <ErrorBox message={simulators.error} />}
          {simulators.loading && !simulators.data && <Loading />}
          <div className="flex flex-col">
            {simulators.data?.map(s => (
              <div
                key={s.id}
                className="flex flex-col gap-2 border-b border-border-grid py-2.5 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-[96px] font-semibold">시뮬레이터 {s.id}</div>
                  <div className="min-w-[200px] flex-1">
                    {s.member ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold">{s.member.name}</div>
                        <div className="text-xs text-text-secondary">
                          {s.member.platoonName} ·{' '}
                          <div className="inline font-mono">{s.member.id}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-text-muted">비어 있음</div>
                    )}
                  </div>
                  <div className="text-xs text-text-muted">
                    {s.assignedAt ? `${fmtDT(s.assignedAt)} 배치` : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setPicking({ kind: 'simulator', id: s.id })}>
                      {s.member ? '변경' : '지정'}
                    </Button>
                    {s.member && (
                      <Button
                        onClick={() =>
                          run(() => assignSimulator(s.id, null), `시뮬레이터 ${s.id} 배치 해제`)
                        }
                      >
                        해제
                      </Button>
                    )}
                  </div>
                </div>
                {isPicking('simulator', s.id) && (
                  <MemberPicker
                    onCancel={() => setPicking(null)}
                    onPick={m =>
                      run(() => assignSimulator(s.id, m.id), `시뮬레이터 ${s.id} → ${m.name}`)
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="최근 세션"
          hint="최근 20개 · 10초마다 갱신 · 잘못 붙은 세션은 다른 사람으로 옮길 수 있습니다"
        >
          {recent.error && <ErrorBox message={recent.error} />}
          {recent.loading && !recent.data && <Loading />}
          {recent.data && !recent.data.length && (
            <div className="py-8 text-center text-text-muted">아직 들어온 세션이 없습니다</div>
          )}
          <div className="flex flex-col text-[13px]">
            {recent.data?.map(r => (
              <div
                key={r.id}
                className="flex flex-col gap-2 border-b border-border-grid py-2.5 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="tabular w-[96px] text-text-secondary">{fmtDT(r.date)}</div>
                  <div className="w-[88px]">시뮬레이터 {r.simulatorId}</div>
                  <div className="min-w-[140px] flex-1">
                    {r.memberId ? (
                      <Link to={`/users/${r.memberId}`} className="font-semibold hover:underline">
                        {r.memberName ?? r.memberId}
                      </Link>
                    ) : (
                      <Badge tone="warn">미배정</Badge>
                    )}
                  </div>
                  <div className="tabular w-[96px]">
                    명중 {r.hitCount}/{r.shotsFired}
                  </div>
                  <div className="tabular w-[88px]">
                    {r.hitCount >= MIN_HITS ? `${r.diameter.toFixed(1)}cm` : '-'}
                  </div>
                  <div className="w-[96px]">
                    {!r.counted && <Badge tone="crit">집계 제외</Badge>}
                  </div>
                  <Button onClick={() => setPicking({ kind: 'session', id: r.id })}>
                    {r.memberId ? '다른 사람으로' : '사람 지정'}
                  </Button>
                </div>
                {!r.counted && (
                  <div className="text-xs text-text-muted">
                    {r.stageName} · 실내 영점 표적에서 탄창을 다 쏜 세션만 대시보드에 집계합니다
                  </div>
                )}
                {isPicking('session', r.id) && (
                  <MemberPicker
                    onCancel={() => setPicking(null)}
                    onPick={m =>
                      run(() => assignSession(r.id, m.id), `세션을 ${m.name}에게 옮겼습니다`)
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AssignmentsPage;
