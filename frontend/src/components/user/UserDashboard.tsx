import type { MemberDetail, Session } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { ROUND_COLORS, TargetSheet } from '@/components/target/TargetSheet';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Legend } from '@/components/ui/Legend';
import { PASS_DIAMETER_CM, PASS_OFFSET_CM } from '@/constants/shooting';
import { useToastStore } from '@/stores/toastStore';
import { tooltipOptions, useChartColors } from '@/utils/chartTheme';
import { fmtDT } from '@/utils/format';
import {
  Chart as ChartJS,
  Filler,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const TIPS = [
  '조준 시 가늠쇠가 미세하게 흔들립니다. 팔꿈치를 지면에 단단히 고정하고 견착 위치를 일정하게 유지하세요.',
  '격발 직전 호흡 정지 구간이 짧습니다. 자연 호흡 후 날숨 끝에서 2–3초 정지한 뒤 격발하는 리듬을 연습하세요.',
  '격발 순간 총구가 우하단으로 당겨지는 패턴이 반복됩니다. 방아쇠는 손가락 첫마디로 곧게 뒤로 압착하세요.',
  '사격 자세 각도가 세션마다 달라 탄착이 분산됩니다. 몸과 총의 각도를 15–20°로 맞추는 기준 자세를 정해 두세요.',
  '탄착군의 중심이 회차별로 이동합니다. 매 발 동일한 볼 견착(cheek weld) 위치를 확인하세요.',
];

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0 rounded-[10px] bg-bg-surface-2 px-3 py-2.5">
    <div className="text-[11.5px] text-text-muted">{k}</div>
    <div className="mt-0.5 text-base font-bold">{v}</div>
  </div>
);

const KeyValue = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between border-b border-border-grid pb-[7px]">
    <div className="text-text-secondary">{k}</div>
    <div className="tabular font-semibold">{v}</div>
  </div>
);

const LastSessionCard = ({ m, L, P }: { m: MemberDetail; L: Session; P?: Session }) => {
  const dd = P ? L.diameter - P.diameter : 0;
  return (
    <Card
      className="xl:col-span-4"
      title="최근 탄착군"
      hint={`${fmtDT(L.date)} · 세션 #${L.index} · ${L.durationMin}분`}
      right={L.pass ? <Badge tone="good">합격</Badge> : <Badge tone="crit">미달</Badge>}
    >
      <div className="flex items-baseline gap-1">
        <div className="text-[52px] leading-none font-bold tracking-tighter">
          {L.diameter.toFixed(1)}
        </div>
        <div className="text-lg font-medium text-text-secondary">cm</div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-xs text-text-muted">
        {P ? (
          <>
            <div>직전 세션 대비</div>
            <div className={dd <= 0 ? 'text-up' : 'text-crit'}>
              {dd <= 0 ? '▼' : '▲'} {Math.abs(dd).toFixed(1)}cm
            </div>
            <div>· 최고 기록 {m.best.toFixed(1)}cm</div>
          </>
        ) : (
          <div>첫 세션 기록</div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        <Stat k="중심 편차" v={`${L.offset.toFixed(1)}cm`} />
        <Stat k="좌우 조정" v={`${L.clicksH > 0 ? 'R' : 'L'} ${Math.abs(L.clicksH)}클릭`} />
        <Stat k="상하 조정" v={`${L.clicksV > 0 ? 'U' : 'D'} ${Math.abs(L.clicksV)}클릭`} />
      </div>
    </Card>
  );
};

const TargetCard = ({ L }: { L: Session }) => {
  const last = L.rounds.length;
  return (
    <Card
      className="xl:col-span-8"
      title="표적지 · 최근 세션"
      hint="25m 영점 표적 · 1칸 = 1cm · 회차별 3발"
      right={
        <Legend
          items={L.rounds.map((r, i) => ({
            label: `${r.round}회차${i === 0 ? ' (조정 전)' : i === last - 1 ? ' (최종)' : ''}`,
            color: ROUND_COLORS[i],
            round: true,
          }))}
        />
      }
    >
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
        <TargetSheet session={L} />
        <div className="flex flex-col gap-2.5 text-[13px]">
          {L.rounds.map(r => (
            <KeyValue key={r.round} k={`${r.round}회차 탄착군`} v={`${r.diameter.toFixed(1)}cm`} />
          ))}
          <KeyValue k="최종 중심 편차" v={`${L.offset.toFixed(1)}cm`} />
          <KeyValue k="판정" v={L.pass ? '합격' : '미달'} />
        </div>
      </div>
    </Card>
  );
};

const RadarCard = ({ m, L }: { m: MemberDetail; L: Session }) => {
  const c = useChartColors();
  return (
    <Card
      className="xl:col-span-5"
      title="사격 역량 진단"
      hint="센서 기반 5개 지표 (0–100)"
      right={
        <Legend
          items={[
            { label: '본인', color: 'var(--color-chart-1)' },
            { label: '중대 평균', color: 'var(--color-chart-2)' },
          ]}
        />
      }
    >
      <div className="relative h-[280px]">
        <Radar
          data={{
            labels: m.metricLabels,
            datasets: [
              {
                label: '본인',
                data: L.metrics,
                borderColor: c.s[0],
                backgroundColor: c.wash,
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: c.s[0],
              },
              {
                label: '중대 평균',
                data: m.companyAvgMetrics,
                borderColor: c.s[1],
                backgroundColor: 'transparent',
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: c.s[1],
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: tooltipOptions(c) },
            scales: {
              r: {
                min: 0,
                max: 100,
                ticks: { stepSize: 25, display: false },
                grid: { color: c.grid },
                angleLines: { color: c.grid },
                pointLabels: { color: c.ink2, font: { size: 12, family: 'Pretendard' } },
              },
            },
          }}
        />
      </div>
    </Card>
  );
};

const CoachCard = ({ m, L }: { m: MemberDetail; L: Session }) => {
  const weak = L.metrics.indexOf(Math.min(...L.metrics));
  const strong = L.metrics.indexOf(Math.max(...L.metrics));
  const first = L.rounds[0];
  const lastRound = L.rounds[L.rounds.length - 1];
  return (
    <Card
      className="xl:col-span-7"
      title="AI 코치 분석"
      hint="Amazon Bedrock이 세션 요약본을 분석해 생성한 리포트 발췌"
    >
      <div className="flex flex-col gap-2 rounded-[10px] bg-bg-surface-2 px-4 py-3.5 text-[13.5px] leading-[1.7]">
        <div className="text-[13px] font-semibold">세션 #{L.index} 요약</div>
        <div>
          최종 {lastRound.round}회차 탄착군{' '}
          <div className="inline font-bold">{L.diameter.toFixed(1)}cm</div>, 중심 편차{' '}
          <div className="inline font-bold">{L.offset.toFixed(1)}cm</div>로{' '}
          {L.pass ? (
            <div className="inline font-bold">합격 기준을 충족했습니다.</div>
          ) : (
            <>
              합격 기준(⌀{PASS_DIAMETER_CM}cm, 편차 {PASS_OFFSET_CM}cm)에{' '}
              <div className="inline font-bold">미달</div>했습니다.
            </>
          )}{' '}
          가장 높은 지표는{' '}
          <div className="inline font-bold">
            {m.metricLabels[strong]}({L.metrics[strong]})
          </div>
          , 보완이 필요한 지표는{' '}
          <div className="inline font-bold">
            {m.metricLabels[weak]}({L.metrics[weak]})
          </div>
          입니다.
        </div>
        <div className="flex flex-col gap-1 pl-1">
          <div>• {TIPS[weak]}</div>
          <div>
            • 1회차 대비 {lastRound.round}회차 중심이 {Math.hypot(first.cx, first.cy).toFixed(1)}cm
            → {L.offset.toFixed(1)}cm로 수렴했습니다. 클릭 조정은 정확했습니다.
          </div>
          <div>
            • 다음 세션 목표: 탄착군{' '}
            <div className="inline font-bold">{Math.max(2, L.diameter - 0.8).toFixed(1)}cm</div>{' '}
            이하, {m.metricLabels[weak]} {Math.min(95, L.metrics[weak] + 8)}점 이상.
          </div>
        </div>
        <div className="mt-1 text-[11px] text-text-muted">
          생성: Bedrock · 리포트 {fmtDT(new Date(new Date(L.date).getTime() + 41000))} · 원본{' '}
          {L.key}
        </div>
      </div>
    </Card>
  );
};

const ReportsCard = ({ sessions }: { sessions: Session[] }) => {
  const toast = useToastStore(s => s.show);
  return (
    <Card
      className="xl:col-span-12"
      title="내 리포트"
      hint="세션 종료 후 자동 생성 · 링크는 7일간 유효 (presigned URL)"
    >
      <div className="flex flex-col">
        {[...sessions].reverse().map(s => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border-grid py-2.5 last:border-b-0"
          >
            <div className="flex flex-col">
              <div className="text-[13px] font-semibold">
                세션 #{s.index} 영점사격 리포트{s.pass ? ' · 합격' : ''}
              </div>
              <div className="text-xs text-text-muted">
                {fmtDT(s.date)} · 탄착군 {s.diameter.toFixed(1)}cm · 편차 {s.offset.toFixed(1)}cm
              </div>
            </div>
            <div className="flex items-center gap-2">
              {s.report === 'run' && <Badge tone="run">생성 중</Badge>}
              {s.report === 'fail' && <Badge tone="crit">재생성 대기</Badge>}
              {s.report === 'ok' &&
                ['PDF', 'MD', 'JSON'].map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toast(`${f} 다운로드 링크 생성됨 (presigned URL · 7일 유효)`)}
                    className="cursor-pointer rounded-md border border-border-default bg-bg-surface px-2 py-[3px] text-[11.5px] hover:bg-bg-surface-2"
                  >
                    {f}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

interface UserDashboardProps {
  member: MemberDetail;
  /** 관리자 화면에서는 소대 이름을 소대 대시보드 링크로 보여 준다 */
  linkPlatoon?: boolean;
}

/** 개인 대시보드 본문 — 관리자 화면(/users/:id)과 사용자 본인 화면(/me/:id)이 함께 쓴다 */
export const UserDashboard = ({ member: m, linkPlatoon = false }: UserDashboardProps) => {
  const toast = useToastStore(s => s.show);
  const S = m.sessions;
  const L = S[S.length - 1];
  const P = S.length > 1 ? S[S.length - 2] : undefined;

  return (
    <div>
      <PageHeader
        title={
          <div className="flex items-center gap-4">
            <div className="flex size-14 flex-none items-center justify-center rounded-full bg-chart-1 text-xl font-bold text-text-on-accent">
              {m.name[0]}
            </div>
            <div className="flex flex-col">
              <div className="text-xl font-bold">{m.name}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[13px] font-normal text-text-secondary">
                <div className="font-mono text-xs">{m.id}</div>
                {linkPlatoon ? (
                  <Link to={`/platoons/${m.platoonId}`} className="hover:text-text-primary">
                    {m.platoonName}
                  </Link>
                ) : (
                  <div>{m.platoonName}</div>
                )}
                <div>{m.weapon}</div>
                <div>세션 {m.sessionCount}회</div>
                <StatusBadge status={m.status} />
              </div>
            </div>
          </div>
        }
        right={
          <Button
            variant="primary"
            onClick={() => toast(`${m.name} · 세션 #${L.index} 리포트 PDF 다운로드를 시작합니다`)}
          >
            ⤓ 최신 리포트 PDF
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
        <LastSessionCard m={m} L={L} P={P} />
        <TargetCard L={L} />
        <RadarCard m={m} L={L} />
        <CoachCard m={m} L={L} />
        <ReportsCard sessions={S} />
      </div>
    </div>
  );
};
