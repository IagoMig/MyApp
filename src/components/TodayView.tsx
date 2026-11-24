"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Droplets,
  Undo2,
  BookOpen,
  Utensils,
  Footprints,
  Settings,
  ChevronRight,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { SettingsModal } from "./SettingsModal";
import {
  db,
  ensureSettings,
  addWater,
  undoLastWater,
  getDateKey,
  formatLongDatePt,
  DEFAULT_SETTINGS,
  type MealLog,
} from "@/lib/db";
import { formatKm } from "@/lib/running";

export function TodayView() {
  const [todayKey] = useState(() => getDateKey());
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const waterLogs = useLiveQuery(
    () => db.waterLogs.where("date").equals(todayKey).toArray(),
    [todayKey]
  );
  const todayDiary = useLiveQuery(
    () => db.diaryEntries.get(todayKey),
    [todayKey]
  );
  const todayMeals = useLiveQuery(
    () => db.mealLogs.where("date").equals(todayKey).toArray(),
    [todayKey]
  );
  const todayRuns = useLiveQuery(
    () => db.runs.where("date").equals(todayKey).toArray(),
    [todayKey]
  );

  const activeSettings = settings ?? DEFAULT_SETTINGS;
  const totalWaterMl = (waterLogs ?? []).reduce(
    (sum, item) => sum + item.amountMl,
    0
  );
  const waterPct = Math.min(
    100,
    Math.round((totalWaterMl / Math.max(1, activeSettings.waterGoalMl)) * 100)
  );

  const mealBySlot = useMemo(() => {
    const map = new Map<number, MealLog>();
    for (const m of todayMeals ?? []) map.set(m.slotIndex, m);
    return map;
  }, [todayMeals]);

  const totalKcalToday = (todayMeals ?? []).reduce(
    (s, m) => s + (m.isFasting ? 0 : m.totalKcal),
    0
  );
  const totalRunKmToday = (todayRuns ?? []).reduce(
    (s, r) => s + r.distanceKm,
    0
  );
  const totalRunKcalToday = (todayRuns ?? []).reduce(
    (s, r) => s + r.caloriesBurned,
    0
  );

  const formattedLiters = (totalWaterMl / 1000).toFixed(2).replace(".", ",");
  const formattedGoal = (activeSettings.waterGoalMl / 1000)
    .toFixed(1)
    .replace(".", ",");

  return (
    <div className="space-y-5 pt-2">
      {/* Minimalist Top Bar */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            My App
          </h1>
          <p className="text-sm text-zinc-400">
            {formatLongDatePt(todayKey)}
          </p>
        </div>

        <GlassButton
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Ajustes"
          className="h-11 w-11 !rounded-full p-0"
        >
          <Settings className="h-[18px] w-[18px] text-zinc-200" strokeWidth={1.8} />
        </GlassButton>
      </header>

      {/* Water Card — Glassmorphism */}
      <GlassCard variant="frosted" className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
              <Droplets className="h-4 w-4 text-white" strokeWidth={1.8} />
            </div>
            <span className="text-base font-medium text-white">Água</span>
          </div>
          <span className="text-sm text-zinc-400 tabular-nums">
            {formattedGoal} L
          </span>
        </div>

        <div className="space-y-3">
          <div className="text-4xl font-light tracking-tight text-white tabular-nums">
            {formattedLiters} <span className="text-xl text-zinc-400">L</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-zinc-300 via-white to-white transition-all duration-500 ease-out shadow-[0_0_16px_rgba(255,255,255,0.45)]"
              style={{ width: `${waterPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            type="button"
            onClick={() => addWater(todayKey, 250)}
            className="flex-1 py-3 text-sm font-medium"
          >
            + 250 ml
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => addWater(todayKey, 500)}
            className="flex-1 py-3 text-sm font-medium"
          >
            + 500 ml
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => undoLastWater(todayKey)}
            disabled={totalWaterMl === 0}
            aria-label="Desfazer última água"
            className="h-[46px] w-[46px] p-0"
          >
            <Undo2 className="h-4 w-4 text-zinc-300" />
          </GlassButton>
        </div>
      </GlassCard>

      {/* Diary Shortcut Card */}
      <Link href="/diario" className="block">
        <GlassCard className="p-6 transition-transform duration-150 active:scale-[0.985]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="glass-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                <BookOpen className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <span className="block text-base font-medium text-white truncate">
                  {todayDiary?.title?.trim() || "Diário"}
                </span>
                <span className="block text-sm text-zinc-400 truncate">
                  {todayDiary?.plainText?.trim()
                    ? todayDiary.plainText.trim().slice(0, 48)
                    : "Escrever hoje"}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-zinc-500" />
          </div>
        </GlassCard>
      </Link>

      {/* Meals Summary Card */}
      <Link href="/alimentacao" className="block">
        <GlassCard className="p-6 space-y-4 transition-transform duration-150 active:scale-[0.985]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
                <Utensils className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-base font-medium text-white">
                Refeições
              </span>
            </div>
            <div className="flex items-center gap-2">
              {totalKcalToday > 0 && (
                <span className="text-sm text-zinc-300 tabular-nums">
                  {totalKcalToday} kcal
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {activeSettings.mealSlots.slice(0, 4).map((slot, idx) => {
              const log = mealBySlot.get(idx);
              const isDone = log && (log.isFasting || log.totalKcal > 0);
              return (
                <div
                  key={idx}
                  className={`rounded-2xl px-2 py-2.5 text-center text-xs truncate ${
                    isDone ? "glass-pill-active font-medium" : "glass-pill text-zinc-300"
                  }`}
                >
                  {log?.isFasting ? "Jejum" : slot}
                </div>
              );
            })}
          </div>
        </GlassCard>
      </Link>

      {/* Run Card */}
      <Link href="/corrida" className="block">
        <GlassCard className="p-6 transition-transform duration-150 active:scale-[0.985]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="glass-pill flex h-10 w-10 items-center justify-center rounded-full">
                <Footprints className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <span className="text-base font-medium text-white">Corrida</span>
            </div>
            <div className="flex items-center gap-2">
              {totalRunKmToday > 0 && (
                <span className="text-sm text-zinc-300 tabular-nums">
                  {formatKm(totalRunKmToday)} km · {totalRunKcalToday} kcal
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            </div>
          </div>
        </GlassCard>
      </Link>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
      />
    </div>
  );
}
