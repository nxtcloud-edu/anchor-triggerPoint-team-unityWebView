import type { DailySessions } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { Legend } from '@/components/ui/Legend';
import { axisX, axisY, tooltipOptions, useChartColors } from '@/utils/chartTheme';
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export const DailyChart = ({
  daily,
  className,
}: {
  daily: DailySessions[];
  className?: string;
}) => {
  const c = useChartColors();
  return (
    <Card
      className={className}
      title="일별 사격 세션"
      hint="Unity 클라이언트 업로드 기준 · 합격/미달 판정"
      right={
        <Legend
          items={[
            { label: '합격 세션', color: 'var(--color-chart-1)' },
            { label: '미달 세션', color: 'var(--color-chart-2)' },
          ]}
        />
      }
    >
      <div className="relative h-60">
        <Bar
          data={{
            labels: daily.map(d => d.date),
            datasets: [
              {
                label: '합격',
                data: daily.map(d => d.pass),
                backgroundColor: c.s[0],
                borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                borderSkipped: false,
                borderColor: c.surface,
                borderWidth: { top: 1 },
              },
              {
                label: '미달',
                data: daily.map(d => d.fail),
                backgroundColor: c.s[1],
                borderRadius: { topLeft: 4, topRight: 4 },
                borderSkipped: false,
                borderColor: c.surface,
                borderWidth: { bottom: 1 },
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            datasets: { bar: { maxBarThickness: 22, categoryPercentage: 0.75 } },
            scales: {
              x: { ...axisX(c), stacked: true },
              y: { ...axisY(c), stacked: true, beginAtZero: true },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                ...tooltipOptions(c),
                callbacks: {
                  footer: items => `합계 ${items.reduce((a, b) => a + Number(b.raw), 0)}회`,
                },
              },
            },
          }}
        />
      </div>
    </Card>
  );
};
