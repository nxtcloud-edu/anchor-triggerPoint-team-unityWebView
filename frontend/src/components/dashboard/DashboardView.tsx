import type { Dashboard } from '@/api/types';
import { DailyChart } from '@/components/dashboard/DailyChart';
import { PlatoonPassRate } from '@/components/dashboard/PlatoonPassRate';
import { MemberTable } from '@/components/members/MemberTable';
import { DonutCard } from '@/components/ui/DonutCard';
import { Delta, Kpi } from '@/components/ui/Kpi';
import { useChartColors } from '@/utils/chartTheme';

/** 중대 · 소대 대시보드 공용 본문 */
export const DashboardView = ({ data }: { data: Dashboard }) => {
  const c = useChartColors();
  const { kpis: k, range } = data;
  const isPlatoon = data.scope.type === 'platoon';
  const statusTotal = data.status.zeroed + data.status.retrain;
  const correctionTotal = data.corrections.reduce((a, b) => a + b.count, 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label="등록 인원"
          value={k.memberCount}
          unit="명"
          detail={`활성 ${k.activeMembers7d}명 (최근 7일)`}
        />
        <Kpi
          label="사격 세션"
          value={k.sessions.toLocaleString()}
          unit="회"
          detail={
            <Delta cur={k.sessions} prev={k.prevSessions} unit="회" range={range} digits={0} />
          }
        />
        <Kpi
          label="세션 합격률"
          value={k.passRate.toFixed(1)}
          unit="%"
          detail={<Delta cur={k.passRate} prev={k.prevPassRate} unit="%p" range={range} />}
        />
        <Kpi
          label="평균 탄착군"
          value={k.avgDiameter.toFixed(2)}
          unit="cm"
          detail={
            <Delta
              cur={k.avgDiameter}
              prev={k.prevAvgDiameter}
              unit="cm"
              range={range}
              invert
              digits={2}
            />
          }
        />
        <Kpi
          label="영점 완료"
          value={k.zeroed}
          unit={`/ ${k.memberCount}명`}
          detail={`완료율 ${k.memberCount ? ((k.zeroed / k.memberCount) * 100).toFixed(1) : '0.0'}%`}
        />
      </div>

      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
        <DailyChart daily={data.daily} className="xl:col-span-8" />
        <DonutCard
          className="xl:col-span-4"
          title="영점 상태"
          hint="최근 세션 기준"
          labels={['영점 완료', '재훈련 필요']}
          values={[data.status.zeroed, data.status.retrain]}
          colors={[c.good, c.crit]}
          center={`${statusTotal ? Math.round((data.status.zeroed / statusTotal) * 100) : 0}%`}
          centerLabel="영점 완료"
        />

        <PlatoonPassRate
          className="xl:col-span-8"
          platoons={data.platoons}
          highlightId={isPlatoon ? data.scope.id : undefined}
        />
        <DonutCard
          className="xl:col-span-4"
          title="주요 교정 포인트"
          hint="Bedrock 분석이 지목한 1순위 오류"
          labels={data.corrections.map(x => x.label)}
          values={data.corrections.map(x => x.count)}
          colors={[c.s[0], c.s[1], c.s[2]]}
          center={correctionTotal.toLocaleString()}
          centerLabel="분석 세션"
        />

        <div className="xl:col-span-12">
          <MemberTable
            title="소대 인원 현황"
            hint="행을 누르면 해당 인원의 사용자 대시보드로 이동합니다"
            platoonId={isPlatoon ? data.scope.id : undefined}
            platoons={data.platoons}
          />
        </div>
      </div>
    </div>
  );
};
