"use client";

import { useMemo, useState } from "react";
import { formatShortDatePt, formatWeightKg } from "@/lib/db";

export interface EvolutionPoint {
  id: string | number;
  date: string;
  weightKg: number;
  note?: string;
}

interface EvolutionChartProps {
  points: EvolutionPoint[];
  goalKg?: number;
  compact?: boolean;
  interactive?: boolean;
}

function buildSmoothPath(coords: { x: number; y: number }[]): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  if (coords.length === 2) {
    return `M ${coords[0].x} ${coords[0].y} L ${coords[1].x} ${coords[1].y}`;
  }

  let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function EvolutionChart({
  points,
  goalKg,
  compact = false,
  interactive = true,
}: EvolutionChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const width = 360;
  const height = compact ? 136 : 196;
  const padLeft = compact ? 34 : 40;
  const padRight = 14;
  const padTop = compact ? 16 : 22;
  const padBottom = compact ? 24 : 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const { coords, minVal, maxVal, goalY, ticks, linePath, areaPath } =
    useMemo(() => {
      if (points.length === 0) {
        return {
          coords: [],
          minVal: 0,
          maxVal: 100,
          goalY: null as number | null,
          ticks: [] as number[],
          linePath: "",
          areaPath: "",
        };
      }

      const values = points.map((p) => p.weightKg);
      if (goalKg && goalKg > 0) values.push(goalKg);

      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const span = Math.max(2, rawMax - rawMin);
      const pad = span * 0.18;
      const minV = Math.max(0, rawMin - pad);
      const maxV = rawMax + pad;
      const range = Math.max(0.5, maxV - minV);

      const toY = (v: number) => padTop + (1 - (v - minV) / range) * plotH;
      const toX = (idx: number) => {
        if (points.length === 1) return padLeft + plotW / 2;
        return padLeft + (idx / (points.length - 1)) * plotW;
      };

      const pts = points.map((p, i) => ({
        x: toX(i),
        y: toY(p.weightKg),
      }));

      const gY = goalKg && goalKg > 0 ? toY(goalKg) : null;

      const midV = (minV + maxV) / 2;
      const tickVals = compact ? [maxV, minV] : [maxV, midV, minV];

      const lPath = buildSmoothPath(pts);
      const baseY = padTop + plotH;
      const aPath =
        pts.length >= 2
          ? `${lPath} L ${pts[pts.length - 1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`
          : "";

      return {
        coords: pts,
        minVal: minV,
        maxVal: maxV,
        goalY: gY,
        ticks: tickVals,
        linePath: lPath,
        areaPath: aPath,
      };
    }, [points, goalKg, compact, padLeft, padTop, plotH, plotW]);

  const activeIdx =
    selectedIndex !== null && selectedIndex < points.length
      ? selectedIndex
      : points.length > 0
        ? points.length - 1
        : null;

  const activePoint = activeIdx !== null ? points[activeIdx] : null;
  const prevPoint =
    activeIdx !== null && activeIdx > 0 ? points[activeIdx - 1] : null;
  const activeDelta =
    activePoint && prevPoint
      ? Number((activePoint.weightKg - prevPoint.weightKg).toFixed(1))
      : null;

  if (points.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-[20px] border border-dashed border-white/15 bg-white/[0.02] text-center ${
          compact ? "h-[120px] px-4" : "h-[180px] px-6"
        }`}
      >
        <span className="text-xs text-zinc-400">
          Nenhum peso semanal registrado ainda
        </span>
        {goalKg ? (
          <span className="mt-1 text-[11px] text-zinc-500 tabular-nums">
            Meta atual: {formatWeightKg(goalKg)} kg
          </span>
        ) : null}
      </div>
    );
  }

  const xLabelIndices = (() => {
    if (points.length <= 4) return points.map((_, i) => i);
    const mid = Math.floor((points.length - 1) / 2);
    return [0, mid, points.length - 1];
  })();

  const gradientId = compact ? "evoAreaCompact" : "evoAreaFull";

  return (
    <div className="space-y-2.5">
      {/* Selected point readout when interactive */}
      {interactive && !compact && activePoint && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-zinc-400">
            {formatShortDatePt(activePoint.date)}
            {activePoint.note ? ` · ${activePoint.note}` : ""}
          </span>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="font-medium text-white">
              {formatWeightKg(activePoint.weightKg)} kg
            </span>
            {activeDelta !== null && (
              <span className="glass-pill rounded-full px-2 py-0.5 text-[10px] text-zinc-200">
                {activeDelta > 0 ? "+" : ""}
                {formatWeightKg(activeDelta)} kg
              </span>
            )}
          </div>
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
        role="img"
        aria-label="Gráfico de evolução de peso"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle horizontal gridlines */}
        {ticks.map((val, idx) => {
          const y =
            padTop +
            (1 - (val - minVal) / Math.max(0.5, maxVal - minVal)) * plotH;
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3.5}
                textAnchor="end"
                fill="rgba(255,255,255,0.42)"
                fontSize="9.5"
                className="tabular-nums"
              >
                {val.toFixed(1).replace(".", ",")}
              </text>
            </g>
          );
        })}

        {/* Dashed goal reference line */}
        {goalY !== null && goalKg && (
          <g>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={goalY}
              y2={goalY}
              stroke="rgba(255,255,255,0.42)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <rect
              x={width - padRight - 66}
              y={Math.max(2, goalY - 15)}
              width="66"
              height="14"
              rx="7"
              fill="rgba(255,255,255,0.12)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="0.6"
            />
            <text
              x={width - padRight - 33}
              y={Math.max(2, goalY - 15) + 10}
              textAnchor="middle"
              fill="rgba(255,255,255,0.9)"
              fontSize="8.5"
              className="tabular-nums"
            >
              Meta {formatWeightKg(goalKg)}
            </text>
          </g>
        )}

        {/* Luminous area gradient */}
        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

        {/* Smooth white evolution curve */}
        {linePath && points.length >= 2 && (
          <path
            d={linePath}
            fill="none"
            stroke="#ffffff"
            strokeWidth={compact ? "2" : "2.25"}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter: "drop-shadow(0 0 8px rgba(255, 255, 255, 0.45))",
            }}
          />
        )}

        {/* Interactive nodes */}
        {coords.map((pt, idx) => {
          const isSelected = activeIdx === idx;
          return (
            <g
              key={points[idx].id}
              onClick={
                interactive
                  ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedIndex(idx);
                    }
                  : undefined
              }
              className={interactive ? "cursor-pointer" : undefined}
            >
              {isSelected && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={compact ? 6.5 : 8}
                  fill="rgba(255,255,255,0.18)"
                />
              )}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? (compact ? 3.5 : 4.2) : compact ? 2.4 : 3}
                fill={isSelected ? "#ffffff" : "#0a0a0c"}
                stroke="#ffffff"
                strokeWidth="1.8"
              />
              {/* Invisible generous tap target */}
              {interactive && (
                <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
              )}
            </g>
          );
        })}

        {/* X-axis dates */}
        {xLabelIndices.map((idx) => {
          const pt = coords[idx];
          if (!pt) return null;
          return (
            <text
              key={idx}
              x={pt.x}
              y={height - 6}
              textAnchor={
                idx === 0 && points.length > 1
                  ? "start"
                  : idx === points.length - 1 && points.length > 1
                    ? "end"
                    : "middle"
              }
              fill="rgba(255,255,255,0.42)"
              fontSize="9.5"
            >
              {formatShortDatePt(points[idx].date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
