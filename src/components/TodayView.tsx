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
  Dumbbell,
  Scale,
  Camera,
  Settings,
  ChevronRight,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { SettingsModal } from "./SettingsModal";
import { EvolutionChart, type EvolutionPoint } from "./EvolutionChart";
import {
  db,
  ensureSettings,
  addWater,
  undoLastWater,
  getDateKey,
  getIsoWeekKey,
  formatLongDatePt,
  formatFullDatePt,
  formatWeightKg,
  daysBetweenDateKeys,
  DEFAULT_SETTINGS,
  type MealLog,
} from "@/lib/db";
import { formatKm } from "@/lib/running";
import { mergeWorkoutsAndRuns, summarizeUnifiedWorkouts } from "@/lib/workouts";

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
  const todayWorkouts = useLiveQuery(
    () => db.workouts.where("date").equals(todayKey).toArray(),
    [todayKey]
  );
  const weightLogsAsc = useLiveQuery(
    () => db.weightLogs.orderBy("date").toArray(),
    []
  );
  const frontPhotos = useLiveQuery(
    () => db.progressPhotos.where("angle").equals("frente").toArray(),
    []
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

  const todayUnifiedSummary = useMemo(() => {
    const merged = mergeWorkoutsAndRuns(todayWorkouts ?? [], todayRuns ?? []);
    return summarizeUnifiedWorkouts(merged);
  }, [todayWorkouts, todayRuns]);

  // Weight evolution chart data
  const allWeightLogs = useMemo(() => weightLogsAsc ?? [], [weightLogsAsc]);
  const currentWeekKey = useMemo(() => getIsoWeekKey(todayKey), [todayKey]);
  const hasWeightThisWeek = useMemo(
    () => allWeightLogs.some((l) => l.weekKey === currentWeekKey),
    [allWeightLogs, currentWeekKey]
  );

  const latestWeight =
    allWeightLogs.length > 0
      ? allWeightLogs[allWeightLogs.length - 1].weightKg
      : activeSettings.weightKg;
  const startWeight =
    activeSettings.startWeightKg ??
    (allWeightLogs.length > 0 ? allWeightLogs[0].weightKg : latestWeight);
  const goalWeight =
    activeSettings.weightGoalKg ??
    Math.max(40, Number((latestWeight - 5).toFixed(1)));
  const totalWeightDelta = Number((latestWeight - startWeight).toFixed(1));

  const homeChartPoints: EvolutionPoint[] = useMemo(
    () =>
      allWeightLogs.slice(-10).map((l) => ({
        id: l.id ?? l.date,
        date: l.date,
        weightKg: l.weightKg,
      })),
    [allWeightLogs]
  );

  // First & Last frontal photos only
  const { firstFront, lastFront, frontSpanDays } = useMemo(() => {
    const sorted = [...(frontPhotos ?? [])].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt - b.createdAt;
    });
    if (sorted.length === 0) {
      return { firstFront: null, lastFront: null, frontSpanDays: 0 };
    }
    if (sorted.length === 1) {
      return { firstFront: sorted[0], lastFront: null, frontSpanDays: 0 };
    }
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return {
      firstFront: first,
      lastFront: last,
      frontSpanDays: Math.max(0, daysBetweenDateKeys(first.date, last.date)),
    };
  }, [frontPhotos]);

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

      {/* Weight Evolution Chart Card */}
      <Link href="/peso" className="block">
        <GlassCard className="p-5 space-y-4 transition-transform duration-150 active:scale-[0.985]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="glass-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <Scale className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <span className="block text-base font-medium text-white">
                  Evolução de peso
                </span>
                <span className="block text-xs text-zinc-400 tabular-nums truncate">
                  {formatWeightKg(latestWeight)} kg · Meta{" "}
                  {formatWeightKg(goalWeight)} kg
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!hasWeightThisWeek ? (
                <span className="glass-pill-active rounded-full px-2.5 py-1 text-[10px] font-medium">
                  Pesar semana
                </span>
              ) : (
                allWeightLogs.length >= 2 && (
                  <span className="glass-pill rounded-full px-2.5 py-1 text-[11px] text-zinc-200 tabular-nums">
                    {totalWeightDelta > 0 ? "+" : ""}
                    {formatWeightKg(totalWeightDelta)} kg
                  </span>
                )
              )}
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            </div>
          </div>

          <EvolutionChart
            points={homeChartPoints}
            goalKg={goalWeight}
            compact
            interactive={false}
          />
        </GlassCard>
      </Link>

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

      {/* Treino & Corrida Quick Row */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/treino" className="block">
          <GlassCard className="h-full p-5 space-y-3 transition-transform duration-150 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
                <Dumbbell className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <span className="block text-base font-medium text-white">
                Treino
              </span>
              <span className="block text-xs text-zinc-400 tabular-nums mt-0.5 truncate">
                {todayUnifiedSummary.totalSessions > 0
                  ? `${todayUnifiedSummary.totalSessions} ${todayUnifiedSummary.totalSessions === 1 ? "sessão" : "sessões"} · ${todayUnifiedSummary.totalCalories} kcal`
                  : "Registrar hoje"}
              </span>
            </div>
          </GlassCard>
        </Link>

        <Link href="/corrida" className="block">
          <GlassCard className="h-full p-5 space-y-3 transition-transform duration-150 active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
                <Footprints className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div>
              <span className="block text-base font-medium text-white">
                Corrida
              </span>
              <span className="block text-xs text-zinc-400 tabular-nums mt-0.5 truncate">
                {totalRunKmToday > 0
                  ? `${formatKm(totalRunKmToday)} km · ${totalRunKcalToday} kcal`
                  : "Iniciar GPS"}
              </span>
            </div>
          </GlassCard>
        </Link>
      </div>

      {/* LAST CARD: First vs Last Frontal Evolution Photo */}
      <Link href="/evolucao" className="block">
        <GlassCard className="p-5 space-y-4 transition-transform duration-150 active:scale-[0.985]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
                <Camera className="h-4 w-4 text-white" strokeWidth={1.8} />
              </div>
              <div>
                <span className="block text-base font-medium text-white">
                  Antes &amp; Depois
                </span>
                <span className="block text-xs text-zinc-400">
                  Frontal
                  {frontSpanDays > 0 ? ` · ${frontSpanDays} dias de evolução` : ""}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* First Frontal Photo */}
            <div className="glass-obsidian overflow-hidden rounded-[22px] p-1.5">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[17px] bg-zinc-950">
                {firstFront ? (
                  <>
                    <img
                      src={firstFront.dataUrl}
                      alt={`Primeira foto frontal ${firstFront.date}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pt-8 pb-2.5">
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                        Primeira
                      </span>
                      <span className="block text-xs font-medium text-white">
                        {formatFullDatePt(firstFront.date)}
                      </span>
                      {firstFront.weightKg ? (
                        <span className="block text-[10px] text-zinc-400 tabular-nums">
                          {formatWeightKg(firstFront.weightKg)} kg
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <Camera className="h-5 w-5 text-zinc-500" strokeWidth={1.6} />
                    <span className="text-[11px] font-medium text-zinc-300">
                      Primeira frontal
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Toque para adicionar
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Last Frontal Photo */}
            <div className="glass-obsidian overflow-hidden rounded-[22px] p-1.5">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[17px] bg-zinc-950">
                {lastFront ? (
                  <>
                    <img
                      src={lastFront.dataUrl}
                      alt={`Última foto frontal ${lastFront.date}`}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-3 pt-8 pb-2.5">
                      <span className="block text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                        Última
                      </span>
                      <span className="block text-xs font-medium text-white">
                        {formatFullDatePt(lastFront.date)}
                      </span>
                      {lastFront.weightKg ? (
                        <span className="block text-[10px] text-zinc-400 tabular-nums">
                          {formatWeightKg(lastFront.weightKg)} kg
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                    <Camera className="h-5 w-5 text-zinc-500" strokeWidth={1.6} />
                    <span className="text-[11px] font-medium text-zinc-300">
                      Última frontal
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {firstFront
                        ? "Adicione outra foto frontal"
                        : "Comparativo automático"}
                    </span>
                  </div>
                )}
              </div>
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
