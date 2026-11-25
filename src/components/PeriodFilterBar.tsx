"use client";

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { GlassButton } from "./Glass";
import { getDateKey, shiftDateKey } from "@/lib/db";
import {
  resolvePeriodRange,
  stepPeriodAnchor,
  type PeriodMode,
  type PeriodRange,
} from "@/lib/period";

interface PeriodFilterBarProps {
  mode: PeriodMode;
  anchorDate: string;
  onChangeMode: (nextMode: PeriodMode) => void;
  onChangeAnchor: (nextAnchor: string) => void;
  todayKey?: string;
  allowDatePicker?: boolean;
  rightSlot?: React.ReactNode;
}

const MODE_OPTIONS: { id: PeriodMode; label: string }[] = [
  { id: "daily", label: "Diário" },
  { id: "yesterday", label: "Dia anterior" },
  { id: "weekly", label: "Semanal" },
  { id: "monthly", label: "Mensal" },
];

export function PeriodFilterBar({
  mode,
  anchorDate,
  onChangeMode,
  onChangeAnchor,
  todayKey = getDateKey(),
  allowDatePicker = false,
  rightSlot,
}: PeriodFilterBarProps) {
  const range: PeriodRange = resolvePeriodRange(mode, anchorDate, todayKey);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const handleModeClick = (next: PeriodMode) => {
    onChangeMode(next);
    if (next === "daily") {
      onChangeAnchor(todayKey);
    } else if (next === "yesterday") {
      onChangeAnchor(yesterdayKey);
    } else if (next === "weekly" || next === "monthly") {
      onChangeAnchor(todayKey);
    }
  };

  const handleStep = (delta: -1 | 1) => {
    const { nextMode, nextAnchor } = stepPeriodAnchor(
      mode,
      anchorDate,
      delta,
      todayKey
    );
    if (nextMode !== mode) {
      onChangeMode(nextMode);
    }
    onChangeAnchor(nextAnchor);
  };

  const handleResetToCurrent = () => {
    if (mode === "yesterday") {
      onChangeAnchor(yesterdayKey);
    } else {
      onChangeAnchor(todayKey);
    }
  };

  return (
    <div className="glass-obsidian rounded-[24px] p-2.5 space-y-2.5">
      {/* Row 1: 4 Filter Pills */}
      <div className="grid grid-cols-4 gap-1">
        {MODE_OPTIONS.map((opt) => {
          const isActive = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleModeClick(opt.id)}
              className={`rounded-xl py-2 px-1 text-[11px] font-medium transition-all duration-150 truncate cursor-pointer ${
                isActive
                  ? "glass-pill-active"
                  : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Row 2: Period Stepper */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <GlassButton
          type="button"
          onClick={() => handleStep(-1)}
          aria-label="Período anterior"
          className="h-8 w-8 !rounded-full p-0 shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </GlassButton>

        {allowDatePicker && range.isSingleDay ? (
          <label className="relative inline-flex items-center justify-center gap-1.5 px-2 py-1 text-xs font-medium text-white cursor-pointer truncate">
            <span className="truncate">{range.label}</span>
            <Calendar className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <input
              type="date"
              value={range.startDate}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                onChangeMode(v === yesterdayKey ? "yesterday" : "daily");
                onChangeAnchor(v);
              }}
              aria-label="Escolher data"
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={handleResetToCurrent}
            className="px-2 py-1 text-xs font-medium text-zinc-200 hover:text-white transition-colors truncate cursor-pointer"
          >
            {range.label}
          </button>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {rightSlot}
          <GlassButton
            type="button"
            onClick={() => handleStep(1)}
            aria-label="Próximo período"
            className="h-8 w-8 !rounded-full p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
