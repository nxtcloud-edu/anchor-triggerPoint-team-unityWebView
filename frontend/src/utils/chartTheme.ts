import { useThemeStore } from '@/stores/themeStore';
import { useMemo } from 'react';

const read = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Chart.js 는 CSS 변수를 직접 못 읽으므로 현재 테마의 토큰 값을 꺼내 쓴다 */
export const useChartColors = () => {
  const theme = useThemeStore(s => s.theme);
  return useMemo(
    () => ({
      theme,
      surface: read('--color-bg-surface'),
      ink: read('--color-text-primary'),
      ink2: read('--color-text-secondary'),
      muted: read('--color-text-muted'),
      grid: read('--color-border-grid'),
      axis: read('--color-border-axis'),
      tipBg: read('--color-bg-tooltip'),
      tipText: read('--color-text-tooltip'),
      good: read('--color-good'),
      warn: read('--color-warn'),
      crit: read('--color-crit'),
      wash: read('--color-chart-1-wash'),
      s: [1, 2, 3, 4, 5, 6, 7, 8].map(i => read(`--color-chart-${i}`)),
    }),
    [theme],
  );
};

export type ChartColors = ReturnType<typeof useChartColors>;

export const tooltipOptions = (c: ChartColors) => ({
  backgroundColor: c.tipBg,
  titleColor: c.tipText,
  bodyColor: c.tipText,
  footerColor: c.tipText,
  padding: 10,
  cornerRadius: 8,
  boxWidth: 10,
  boxHeight: 2,
  titleFont: { weight: 600 as const },
  bodyFont: { weight: 500 as const },
});

export const axisX = (c: ChartColors) => ({
  grid: { display: false },
  border: { color: c.axis },
  ticks: { color: c.muted, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 10 },
});

export const axisY = (c: ChartColors) => ({
  grid: { color: c.grid },
  border: { display: false },
  ticks: { color: c.muted, font: { size: 11 }, padding: 6 },
});
