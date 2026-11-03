import { Card } from '@/components/ui/Card';
import { tooltipOptions, useChartColors } from '@/utils/chartTheme';
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface DonutCardProps {
  title: string;
  hint: string;
  labels: string[];
  values: number[];
  colors: string[];
  center: string;
  centerLabel: string;
  className?: string;
}

export const DonutCard = ({
  title,
  hint,
  labels,
  values,
  colors,
  center,
  centerLabel,
  className,
}: DonutCardProps) => {
  const c = useChartColors();
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <Card title={title} hint={hint} className={className}>
      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[150px_1fr]">
        <div className="relative mx-auto h-[150px] w-[150px]">
          <Doughnut
            data={{
              labels,
              datasets: [
                {
                  data: values,
                  backgroundColor: colors,
                  borderColor: c.surface,
                  borderWidth: 2,
                  hoverOffset: 4,
                  borderRadius: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: '70%',
              plugins: {
                legend: { display: false },
                tooltip: {
                  ...tooltipOptions(c),
                  callbacks: { label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString()}` },
                },
              },
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold tracking-tight">{center}</div>
            <div className="text-[11.5px] text-text-muted">{centerLabel}</div>
          </div>
        </div>
        <div className="flex flex-col gap-[9px] text-[13px]">
          {labels.map((l, i) => (
            <div
              key={l}
              className="grid grid-cols-[12px_1fr_auto_auto] items-center gap-2 whitespace-nowrap"
            >
              <div className="size-2.5 rounded-[3px]" style={{ background: colors[i] }} />
              <div>{l}</div>
              <div className="tabular font-semibold">{values[i].toLocaleString()}</div>
              <div className="tabular w-11 text-right text-xs text-text-muted">
                {total ? ((values[i] / total) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
