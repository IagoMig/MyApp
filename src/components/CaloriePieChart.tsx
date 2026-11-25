"use client";

import { useId } from "react";

interface CaloriePieChartProps {
  consumed: number;
  burned: number;
  mealsCount?: number;
  activitiesCount?: number;
  compact?: boolean;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describePieSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function CaloriePieChart({
  consumed,
  burned,
  mealsCount = 0,
  activitiesCount = 0,
  compact = false,
}: CaloriePieChartProps) {
  const uid = useId().replace(/:/g, "");
  const safeConsumed = Math.max(0, Math.round(consumed));
  const safeBurned = Math.max(0, Math.round(burned));
  const total = safeConsumed + safeBurned;
  const net = safeConsumed - safeBurned;

  const consumedPct =
    total > 0 ? Math.round((safeConsumed / total) * 100) : 0;
  const burnedPct = total > 0 ? 100 - consumedPct : 0;

  const size = compact ? 116 : 144;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 8;

  const consumedAngle = total > 0 ? (safeConsumed / total) * 360 : 0;
  const whiteGradId = `pieWhite_${uid}`;
  const burnedPatternId = `pieBurned_${uid}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {/* Monochrome Glass Pie SVG */}
        <div className="relative shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Gráfico de pizza: ${safeConsumed} kcal consumidas e ${safeBurned} kcal gastadas`}
            className="overflow-visible select-none"
          >
            <defs>
              <linearGradient
                id={whiteGradId}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#d4d4d8" stopOpacity="0.88" />
              </linearGradient>

              {/* Subtle frosted monochrome diagonal texture for Burned slice */}
              <pattern
                id={burnedPatternId}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="7" height="7" fill="rgba(255,255,255,0.22)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="7"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="2"
                />
              </pattern>
            </defs>

            {/* Outer ambient glass rim */}
            <circle
              cx={cx}
              cy={cy}
              r={radius + 4}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />

            {total === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ) : safeConsumed > 0 && safeBurned === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={`url(#${whiteGradId})`}
                style={{
                  filter: "drop-shadow(0 0 10px rgba(255,255,255,0.22))",
                }}
              />
            ) : safeBurned > 0 && safeConsumed === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={`url(#${burnedPatternId})`}
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.2"
              />
            ) : (
              <>
                {/* Consumed Slice (Pure Luminous White) */}
                <path
                  d={describePieSlice(cx, cy, radius, 0, consumedAngle)}
                  fill={`url(#${whiteGradId})`}
                  stroke="#050507"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  style={{
                    filter: "drop-shadow(0 0 10px rgba(255,255,255,0.20))",
                  }}
                />
                {/* Burned Slice (Frosted Silver Texture) */}
                <path
                  d={describePieSlice(cx, cy, radius, consumedAngle, 360)}
                  fill={`url(#${burnedPatternId})`}
                  stroke="#050507"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Inner specular glass center badge */}
            <circle
              cx={cx}
              cy={cy}
              r={radius * 0.4}
              fill="rgba(8,8,10,0.88)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
            />
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={compact ? "11" : "13"}
              fontWeight="600"
              className="tabular-nums"
            >
              {total > 0 ? `${burnedPct}%` : "0%"}
            </text>
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.52)"
              fontSize="7.5"
              letterSpacing="0.08em"
            >
              GASTO
            </text>
          </svg>
        </div>

        {/* Legend & Breakdown */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Consumidas */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.65)]" />
                <span className="text-xs text-zinc-300 truncate">
                  Consumidas
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                {consumedPct}%
              </span>
            </div>
            <div className="pl-4.5 flex items-baseline justify-between gap-2">
              <span className="text-lg font-light text-white tabular-nums">
                {safeConsumed.toLocaleString("pt-BR")}{" "}
                <span className="text-xs text-zinc-400">kcal</span>
              </span>
              {mealsCount > 0 && (
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {mealsCount} {mealsCount === 1 ? "refeição" : "refeições"}
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Gastadas */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/55 bg-white/25" />
                <span className="text-xs text-zinc-300 truncate">Gastadas</span>
              </div>
              <span className="text-[11px] text-zinc-400 tabular-nums shrink-0">
                {burnedPct}%
              </span>
            </div>
            <div className="pl-4.5 flex items-baseline justify-between gap-2">
              <span className="text-lg font-light text-white tabular-nums">
                {safeBurned.toLocaleString("pt-BR")}{" "}
                <span className="text-xs text-zinc-400">kcal</span>
              </span>
              {activitiesCount > 0 && (
                <span className="text-[10px] text-zinc-500 tabular-nums">
                  {activitiesCount}{" "}
                  {activitiesCount === 1 ? "exercício" : "exercícios"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Net Balance Strip */}
      <div className="glass-obsidian flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs tabular-nums">
        <span className="text-zinc-400">Balanço do dia</span>
        <span className="font-medium text-white">
          {net > 0 ? "+" : ""}
          {net.toLocaleString("pt-BR")} kcal
        </span>
      </div>
    </div>
  );
}
