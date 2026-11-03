import type { PlatoonSummary } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { axisX, axisY, tooltipOptions, useChartColors } from '@/utils/chartTheme';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useNavigate } from 'react-router-dom';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface Props {
  platoons: PlatoonSummary[];
  highlightId?: string;
  className?: string;
}

/** 소대별 합격률 — 막대를 누르면 해당 소대 대시보드로 이동 */
export const PlatoonPassRate = ({ platoons, highlightId, className }: Props) => {
  const c = useChartColors();
  const navigate = useNavigate();

  const valueLabel: Plugin<'bar'> = {
    id: 'valueLabel',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.font = '600 11.5px Pretendard, system-ui';
      ctx.fillStyle = c.ink2;
      ctx.textBaseline = 'middle';
      chart
        .getDatasetMeta(0)
        .data.forEach((bar, i) => ctx.fillText(`${platoons[i].passRate}%`, bar.x + 6, bar.y));
      ctx.restore();
    },
  };

  return (
    <Card
      className={className}
      title="소대별 합격률"
      hint="세션 합격률 · 막대를 누르면 소대 대시보드로 이동"
    >
      <div className="relative h-[300px]">
        <Bar
          data={{
            labels: platoons.map(p => p.name),
            datasets: [
              {
                label: '합격률',
                data: platoons.map(p => p.passRate),
                backgroundColor: platoons.map(p =>
                  !highlightId || p.id === highlightId ? c.s[0] : c.grid,
                ),
                borderRadius: { topRight: 4, bottomRight: 4 },
                borderSkipped: false,
                maxBarThickness: 20,
              },
            ],
          }}
          options={{
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: true },
            onClick: (_, els) => {
              if (els[0]) navigate(`/platoons/${platoons[els[0].index].id}`);
            },
            onHover: (e, els) => {
              const t = e.native?.target as HTMLElement | undefined;
              if (t) t.style.cursor = els.length ? 'pointer' : 'default';
            },
            scales: {
              x: {
                ...axisY(c),
                min: 0,
                max: 100,
                ticks: { ...axisY(c).ticks, callback: v => `${v}%` },
              },
              y: { ...axisX(c), grid: { display: false } },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...tooltipOptions(c),
                callbacks: {
                  label: ctx => {
                    const p = platoons[ctx.dataIndex];
                    return ` 합격률 ${p.passRate}% · 세션 ${p.sessions}회 · 인원 ${p.memberCount}명`;
                  },
                },
              },
            },
          }}
          plugins={[valueLabel]}
        />
      </div>
    </Card>
  );
};
