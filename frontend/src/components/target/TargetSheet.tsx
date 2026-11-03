import type { Session } from '@/api/types';
import { PASS_DIAMETER_CM } from '@/constants/shooting';
import { signed } from '@/utils/format';
import { useState, type MouseEvent } from 'react';

export const ROUND_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
];

const R = 160;
const SC = 16; // 1cm = 16px, ±9cm
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** 25m 영점 표적지 — 회차별 3발 탄착 */
export const TargetSheet = ({ session }: { session: Session }) => {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const grid = Array.from({ length: 19 }, (_, i) => i - 9);
  const onMove = (e: MouseEvent, text: string) =>
    setTip({ x: e.clientX + 12, y: e.clientY - 30, text });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${R * 2} ${R * 2}`}
        role="img"
        aria-label="표적지"
        className="mx-auto block w-full max-w-[340px]"
      >
        <rect x="0" y="0" width={R * 2} height={R * 2} rx="12" fill="var(--color-target-bg)" />
        {grid.map(i => {
          const p = R + i * SC;
          const w = i === 0 ? 1.2 : 0.6;
          return (
            <g key={i}>
              <line
                x1={p}
                y1="8"
                x2={p}
                y2={R * 2 - 8}
                stroke="var(--color-target-line)"
                strokeWidth={w}
              />
              <line
                x1="8"
                y1={p}
                x2={R * 2 - 8}
                y2={p}
                stroke="var(--color-target-line)"
                strokeWidth={w}
              />
            </g>
          );
        })}
        {[8, 6, 4, 2.5].map((r, i) => (
          <circle
            key={r}
            cx={R}
            cy={R}
            r={r * SC}
            fill="none"
            stroke="var(--color-target-ring)"
            strokeWidth={i === 3 ? 1.5 : 1}
            opacity={i === 3 ? 1 : 0.55}
          />
        ))}
        <circle
          cx={R}
          cy={R}
          r={(PASS_DIAMETER_CM / 2) * SC}
          fill="var(--color-good)"
          fillOpacity=".07"
        />
        <text
          x={R + (PASS_DIAMETER_CM / 2) * SC + 4}
          y={R - 4}
          fontSize="10"
          fill="var(--color-text-muted)"
        >
          합격원 ⌀{PASS_DIAMETER_CM}cm
        </text>
        {session.rounds.map((rd, ri) => (
          <g key={rd.round}>
            <circle
              cx={R + rd.cx * SC}
              cy={R - rd.cy * SC}
              r={Math.max((rd.diameter / 2) * SC, 10)}
              fill="none"
              stroke={ROUND_COLORS[ri]}
              strokeWidth="1.2"
              opacity=".55"
            />
            {rd.shots.map((s, si) => {
              const x = clamp(R + s.x * SC, 10, R * 2 - 10);
              const y = clamp(R - s.y * SC, 10, R * 2 - 10);
              const text = `${rd.round}회차 ${si + 1}발 · 좌우 ${signed(s.x)}cm / 상하 ${signed(s.y)}cm`;
              return (
                <g key={si} onMouseMove={e => onMove(e, text)} onMouseLeave={() => setTip(null)}>
                  <circle cx={x} cy={y} r="12" fill="transparent" />
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={ROUND_COLORS[ri]}
                    stroke="var(--color-target-bg)"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      {tip && (
        <div
          className="pointer-events-none fixed z-[60] rounded-[7px] bg-bg-tooltip px-[9px] py-1.5 text-xs whitespace-nowrap text-text-tooltip"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      )}
    </div>
  );
};
