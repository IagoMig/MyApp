"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Droplets,
  Undo2,
  BookOpen,
  BookMarked,
  Utensils,
  Footprints,
  Dumbbell,
  Scale,
  Camera,
  Flame,
  Sparkles,
  Settings,
  ChevronRight,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { SettingsModal } from "./SettingsModal";
import { EvolutionChart, type EvolutionPoint } from "./EvolutionChart";
import { CaloriePieChart } from "./CaloriePieChart";
import { DailyStoryModal } from "./DailyStoryModal";
import { DailyRecapBookModal } from "./DailyRecapBookModal";
import { PeriodFilterBar } from "./PeriodFilterBar";
import {
  db,
  ensureSettings,
  addWater,
  undoLastWater,
  getDateKey,
  shiftDateKey,
  getIsoWeekKey,
  formatLongDatePt,
  formatShortDatePt,
  formatFullDatePt,
  formatWeightKg,
  daysBetweenDateKeys,
  DEFAULT_SETTINGS,
  type MealLog,
} from "@/lib/db";
import { formatKm } from "@/lib/running";
import { mergeWorkoutsAndRuns, summarizeUnifiedWorkouts } from "@/lib/workouts";
import { buildDailyRecap, formatLitersPt } from "@/lib/recap";
import {
  isDateInPeriod,
  resolvePeriodRange,
  type PeriodMode,
} from "@/lib/period";

export function TodayView() {
  const [todayKey] = useState(() => getDateKey());
  const yesterdayKey = useMemo(() => shiftDateKey(todayKey, -1), [todayKey]);

  // Unified temporal filter (Diário | Dia anterior | Semanal | Mensal)
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [anchorDate, setAnchorDate] = useState(() => getDateKey());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyDate, setStoryDate] = useState(() =>
    shiftDateKey(getDateKey(), -1)
  );
  const [recapBookOpen, setRecapBookOpen] = useState(false);
  const [recapBookDate, setRecapBookDate] = useState(() => getDateKey());

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  const range = useMemo(
    () => resolvePeriodRange(periodMode, anchorDate, todayKey),
    [periodMode, anchorDate, todayKey]
  );

  const settings = useLiveQuery(() => db.settings.get("user"), []);

  // Period-ranged queries
  const periodWaterLogs = useLiveQuery(
    () =>
      db.waterLogs
        .where("date")
        .between(range.startDate, range.endDate, true, true)
        .toArray(),
    [range.startDate, range.endDate]
  );
  const periodDiaryEntries = useLiveQuery(
    () =>
      db.diaryEntries
        .where("date")
        .between(range.startDate, range.endDate, true, true)
        .toArray(),
    [range.startDate, range.endDate]
  );
  const periodMeals = useLiveQuery(
    () =>
      db.mealLogs
        .where("date")
        .between(range.startDate, range.endDate, true, true)
        .toArray(),
    [range.startDate, range.endDate]
  );
  const periodRuns = useLiveQuery(
    () =>
      db.runs
        .where("date")
        .between(range.startDate, range.endDate, true, true)
        .toArray(),
    [range.startDate, range.endDate]
  );
  const periodWorkouts = useLiveQuery(
    () =>
      db.workouts
        .where("date")
        .between(range.startDate, range.endDate, true, true)
        .toArray(),
    [range.startDate, range.endDate]
  );

  // Yesterday queries (for next-day Instagram Story banner)
  const yWaterLogs = useLiveQuery(
    () => db.waterLogs.where("date").equals(yesterdayKey).toArray(),
    [yesterdayKey]
  );
  const yMeals = useLiveQuery(
    () => db.mealLogs.where("date").equals(yesterdayKey).toArray(),
    [yesterdayKey]
  );
  const yWorkouts = useLiveQuery(
    () => db.workouts.where("date").equals(yesterdayKey).toArray(),
    [yesterdayKey]
  );
  const yRuns = useLiveQuery(
    () => db.runs.where("date").equals(yesterdayKey).toArray(),
    [yesterdayKey]
  );
  const yDiary = useLiveQuery(
    () => db.diaryEntries.get(yesterdayKey),
    [yesterdayKey]
  );
  const yWeight = useLiveQuery(
    () => db.weightLogs.where("date").equals(yesterdayKey).first(),
    [yesterdayKey]
  );
  const yPhotos = useLiveQuery(
    () => db.progressPhotos.where("date").equals(yesterdayKey).toArray(),
    [yesterdayKey]
  );

  // Evolution queries
  const weightLogsAsc = useLiveQuery(
    () => db.weightLogs.orderBy("date").toArray(),
    []
  );
  const frontPhotos = useLiveQuery(
    () => db.progressPhotos.where("angle").equals("frente").toArray(),
    []
  );

  const activeSettings = settings ?? DEFAULT_SETTINGS;

  // Water metrics for active period
  const totalWaterMl = (periodWaterLogs ?? []).reduce(
    (sum, item) => sum + item.amountMl,
    0
  );
  const waterPeriodGoalMl = activeSettings.waterGoalMl * range.daysCount;
  const waterPct = Math.min(
    100,
    Math.round((totalWaterMl / Math.max(1, waterPeriodGoalMl)) * 100)
  );
  const waterTargetDate = range.isSingleDay ? range.startDate : todayKey;
  const waterAvgPerDayMl = Math.round(totalWaterMl / Math.max(1, range.daysCount));

  // Meals metrics for active period
  const mealBySlot = useMemo(() => {
    const map = new Map<number, MealLog>();
    if (!range.isSingleDay) return map;
    for (const m of periodMeals ?? []) map.set(m.slotIndex, m);
    return map;
  }, [periodMeals, range.isSingleDay]);

  const totalKcalPeriod = (periodMeals ?? []).reduce(
    (s, m) => s + (m.isFasting ? 0 : m.totalKcal),
    0
  );
  const mealsCountPeriod = (periodMeals ?? []).filter(
    (m) => !m.isFasting && (m.totalKcal > 0 || m.items.length > 0)
  ).length;
  const fastingCountPeriod = (periodMeals ?? []).filter(
    (m) => m.isFasting
  ).length;
  const mealActiveDays = useMemo(() => {
    const set = new Set<string>();
    for (const m of periodMeals ?? []) {
      if (!m.isFasting && m.totalKcal > 0) set.add(m.date);
    }
    return set.size;
  }, [periodMeals]);

  // Workouts & Runs for active period
  const totalRunKmPeriod = (periodRuns ?? []).reduce(
    (s, r) => s + r.distanceKm,
    0
  );
  const totalRunKcalPeriod = (periodRuns ?? []).reduce(
    (s, r) => s + r.caloriesBurned,
    0
  );

  const periodUnifiedSummary = useMemo(() => {
    const merged = mergeWorkoutsAndRuns(
      periodWorkouts ?? [],
      periodRuns ?? []
    );
    return summarizeUnifiedWorkouts(merged);
  }, [periodWorkouts, periodRuns]);

  // Diary for active period
  const filledPeriodDiaries = useMemo(
    () =>
      (periodDiaryEntries ?? [])
        .filter((e) => e.title.trim() || e.plainText.trim())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [periodDiaryEntries]
  );
  const primaryDiary = filledPeriodDiaries[0];

  // Yesterday Story recap
  const yesterdayRecap = useMemo(
    () =>
      buildDailyRecap({
        date: yesterdayKey,
        settings,
        waterLogs: yWaterLogs ?? [],
        mealLogs: yMeals ?? [],
        workouts: yWorkouts ?? [],
        runs: yRuns ?? [],
        diary: yDiary,
        weightLog: yWeight,
        photos: yPhotos ?? [],
      }),
    [
      yesterdayKey,
      settings,
      yWaterLogs,
      yMeals,
      yWorkouts,
      yRuns,
      yDiary,
      yWeight,
      yPhotos,
    ]
  );

  // Weight evolution chart data filtered by active period
  const allWeightLogs = useMemo(() => weightLogsAsc ?? [], [weightLogsAsc]);
  const currentWeekKey = useMemo(() => getIsoWeekKey(todayKey), [todayKey]);
  const hasWeightThisWeek = useMemo(
    () => allWeightLogs.some((l) => l.weekKey === currentWeekKey),
    [allWeightLogs, currentWeekKey]
  );

  const periodWeightLogs = useMemo(() => {
    if (periodMode === "daily" && anchorDate === todayKey) {
      return allWeightLogs.slice(-10);
    }
    if (range.isSingleDay) {
      return allWeightLogs.filter((l) => l.date <= range.endDate).slice(-8);
    }
    return allWeightLogs.filter((l) => isDateInPeriod(l.date, range));
  }, [allWeightLogs, periodMode, anchorDate, todayKey, range]);

  const latestWeight =
    periodWeightLogs.length > 0
      ? periodWeightLogs[periodWeightLogs.length - 1].weightKg
      : allWeightLogs.length > 0
        ? allWeightLogs[allWeightLogs.length - 1].weightKg
        : activeSettings.weightKg;
  const startWeight =
    periodWeightLogs.length >= 2
      ? periodWeightLogs[0].weightKg
      : (activeSettings.startWeightKg ??
        (allWeightLogs.length > 0 ? allWeightLogs[0].weightKg : latestWeight));
  const goalWeight =
    activeSettings.weightGoalKg ??
    Math.max(40, Number((latestWeight - 5).toFixed(1)));
  const totalWeightDelta = Number((latestWeight - startWeight).toFixed(1));

  const homeChartPoints: EvolutionPoint[] = useMemo(
    () =>
      periodWeightLogs.map((l) => ({
        id: l.id ?? l.date,
        date: l.date,
        weightKg: l.weightKg,
      })),
    [periodWeightLogs]
  );

  // First & Last frontal photos (respects period filter when non-default)
  const isDefaultToday = periodMode === "daily" && anchorDate === todayKey;
  const { firstFront, lastFront, frontSpanDays } = useMemo(() => {
    const base = [...(frontPhotos ?? [])].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt - b.createdAt;
    });
    const scoped = isDefaultToday
      ? base
      : base.filter((p) => isDateInPeriod(p.date, range));

    if (scoped.length === 0) {
      return { firstFront: null, lastFront: null, frontSpanDays: 0 };
    }
    if (scoped.length === 1) {
      return { firstFront: scoped[0], lastFront: null, frontSpanDays: 0 };
    }
    const first = scoped[0];
    const last = scoped[scoped.length - 1];
    return {
      firstFront: first,
      lastFront: last,
      frontSpanDays: Math.max(0, daysBetweenDateKeys(first.date, last.date)),
    };
  }, [frontPhotos, isDefaultToday, range]);

  const formattedLiters = (totalWaterMl / 1000).toFixed(2).replace(".", ",");
  const formattedGoal = (waterPeriodGoalMl / 1000)
    .toFixed(1)
    .replace(".", ",");

  const openStoryFor = (dateKey: string) => {
    setStoryDate(dateKey);
    setStoryOpen(true);
  };

  const openRecapBookFor = (dateKey: string) => {
    setRecapBookDate(dateKey);
    setRecapBookOpen(true);
  };

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

        <div className="flex items-center gap-2">
          <GlassButton
            type="button"
            onClick={() =>
              openRecapBookFor(
                range.isSingleDay ? range.startDate : todayKey
              )
            }
            aria-label="Livro de retrospectiva diária"
            className="h-11 px-3.5 text-xs font-medium"
          >
            <BookMarked className="h-4 w-4 text-zinc-200" strokeWidth={1.8} />
            <span>Livro</span>
          </GlassButton>

          <GlassButton
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ajustes"
            className="h-11 w-11 !rounded-full p-0"
          >
            <Settings
              className="h-[18px] w-[18px] text-zinc-200"
              strokeWidth={1.8}
            />
          </GlassButton>
        </div>
      </header>

      {/* Unified Temporal Filter: Diário | Dia anterior | Semanal | Mensal */}
      <PeriodFilterBar
        mode={periodMode}
        anchorDate={anchorDate}
        onChangeMode={setPeriodMode}
        onChangeAnchor={setAnchorDate}
        todayKey={todayKey}
        allowDatePicker
      />

      {/* Next-Day Instagram Story Retrospective Card */}
      {yesterdayRecap.hasAnyData ? (
        <GlassCard variant="frosted" className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => openStoryFor(yesterdayKey)}
              className="flex flex-1 items-center gap-3.5 text-left min-w-0 cursor-pointer"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-[2px] bg-gradient-to-tr from-zinc-500 via-white to-zinc-300 shadow-[0_0_20px_rgba(255,255,255,0.28)]">
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-black text-center leading-none">
                  <Sparkles className="h-4 w-4 text-white" strokeWidth={1.9} />
                </div>
              </div>

              <div className="min-w-0">
                <span className="block text-[10px] uppercase tracking-[0.16em] text-zinc-400">
                  Story de ontem · {formatShortDatePt(yesterdayKey)}
                </span>
                <span className="block text-base font-medium text-white truncate">
                  Retrospectiva pronta
                </span>
                <span className="block text-xs text-zinc-400 tabular-nums truncate mt-0.5">
                  {formatLitersPt(yesterdayRecap.waterMl)} L água ·{" "}
                  {yesterdayRecap.caloriesBurned} kcal ·{" "}
                  {yesterdayRecap.workoutSummary.totalSessions}{" "}
                  {yesterdayRecap.workoutSummary.totalSessions === 1
                    ? "treino"
                    : "treinos"}
                </span>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <GlassButton
              type="button"
              active
              onClick={() => openStoryFor(yesterdayKey)}
              className="py-2.5 text-xs font-medium"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Abrir Story</span>
            </GlassButton>
            <GlassButton
              type="button"
              onClick={() => openRecapBookFor(yesterdayKey)}
              className="py-2.5 text-xs font-medium"
            >
              <BookMarked className="h-3.5 w-3.5" />
              <span>Livro do dia</span>
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-4 !rounded-[24px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-white/35 bg-white/[0.04]">
                <Sparkles className="h-4 w-4 text-zinc-300" strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-medium text-white truncate">
                  Story de retrospectiva
                </span>
                <span className="block text-[11px] text-zinc-400 truncate">
                  Liberado amanhã com o resumo de hoje
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <GlassButton
                type="button"
                onClick={() =>
                  openStoryFor(range.isSingleDay ? range.startDate : todayKey)
                }
                className="h-8 px-2.5 text-[11px] font-medium !rounded-xl"
              >
                Prévia
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() =>
                  openRecapBookFor(
                    range.isSingleDay ? range.startDate : todayKey
                  )
                }
                aria-label="Abrir livro de retrospectiva"
                className="h-8 w-8 !rounded-xl p-0"
              >
                <BookMarked className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Water Card — Glassmorphism */}
      <GlassCard variant="frosted" className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="glass-pill flex h-9 w-9 items-center justify-center rounded-full">
              <Droplets className="h-4 w-4 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <span className="block text-base font-medium text-white">
                Água
              </span>
              {!range.isSingleDay && (
                <span className="block text-[11px] text-zinc-400 tabular-nums">
                  Média {formatLitersPt(waterAvgPerDayMl)} L/dia
                </span>
              )}
            </div>
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
            onClick={() => addWater(waterTargetDate, 250)}
            className="flex-1 py-3 text-sm font-medium"
          >
            + 250 ml
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => addWater(waterTargetDate, 500)}
            className="flex-1 py-3 text-sm font-medium"
          >
            + 500 ml
          </GlassButton>
          <GlassButton
            type="button"
            onClick={() => undoLastWater(waterTargetDate)}
            disabled={totalWaterMl === 0}
            aria-label="Desfazer última água"
            className="h-[46px] w-[46px] p-0"
          >
            <Undo2 className="h-4 w-4 text-zinc-300" />
          </GlassButton>
        </div>
      </GlassCard>

      {/* Pie Chart Card — Calorias Consumidas × Gastadas */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="glass-pill flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
              <Flame className="h-4 w-4 text-white" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <span className="block text-base font-medium text-white">
                Calorias · {range.shortLabel}
              </span>
              <span className="block text-xs text-zinc-400">
                Consumidas × Gastadas
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              openRecapBookFor(range.isSingleDay ? range.startDate : todayKey)
            }
            className="glass-pill rounded-full px-3 py-1 text-[11px] font-medium text-zinc-200 hover:text-white cursor-pointer shrink-0"
          >
            Detalhes
          </button>
        </div>

        <CaloriePieChart
          consumed={totalKcalPeriod}
          burned={periodUnifiedSummary.totalCalories}
          mealsCount={mealsCountPeriod}
          activitiesCount={periodUnifiedSummary.totalSessions}
        />
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
              {!hasWeightThisWeek && isDefaultToday ? (
                <span className="glass-pill-active rounded-full px-2.5 py-1 text-[10px] font-medium">
                  Pesar semana
                </span>
              ) : (
                periodWeightLogs.length >= 2 && (
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
                  {range.isSingleDay
                    ? primaryDiary?.title?.trim() || "Diário"
                    : `Diário · ${filledPeriodDiaries.length} ${filledPeriodDiaries.length === 1 ? "página" : "páginas"}`}
                </span>
                <span className="block text-sm text-zinc-400 truncate">
                  {primaryDiary?.plainText?.trim()
                    ? primaryDiary.plainText.trim().slice(0, 48)
                    : range.isSingleDay
                      ? "Escrever neste dia"
                      : "Nenhuma página neste período"}
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
              {totalKcalPeriod > 0 && (
                <span className="text-sm text-zinc-300 tabular-nums">
                  {totalKcalPeriod.toLocaleString("pt-BR")} kcal
                </span>
              )}
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            </div>
          </div>

          {range.isSingleDay ? (
            <div className="grid grid-cols-4 gap-2">
              {activeSettings.mealSlots.slice(0, 4).map((slot, idx) => {
                const log = mealBySlot.get(idx);
                const isDone = log && (log.isFasting || log.totalKcal > 0);
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl px-2 py-2.5 text-center text-xs truncate ${
                      isDone
                        ? "glass-pill-active font-medium"
                        : "glass-pill text-zinc-300"
                    }`}
                  >
                    {log?.isFasting ? "Jejum" : slot}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <div className="glass-obsidian rounded-2xl py-2.5 px-2">
                <span className="block text-[10px] uppercase text-zinc-500">
                  Média/dia
                </span>
                <span className="text-xs font-medium text-white">
                  {mealActiveDays > 0
                    ? `${Math.round(totalKcalPeriod / mealActiveDays)} kcal`
                    : "—"}
                </span>
              </div>
              <div className="glass-obsidian rounded-2xl py-2.5 px-2">
                <span className="block text-[10px] uppercase text-zinc-500">
                  Registradas
                </span>
                <span className="text-xs font-medium text-white">
                  {mealsCountPeriod}
                </span>
              </div>
              <div className="glass-obsidian rounded-2xl py-2.5 px-2">
                <span className="block text-[10px] uppercase text-zinc-500">
                  Jejuns
                </span>
                <span className="text-xs font-medium text-white">
                  {fastingCountPeriod}
                </span>
              </div>
            </div>
          )}
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
                {periodUnifiedSummary.totalSessions > 0
                  ? `${periodUnifiedSummary.totalSessions} ${periodUnifiedSummary.totalSessions === 1 ? "sessão" : "sessões"} · ${periodUnifiedSummary.totalCalories} kcal`
                  : "Sem registros"}
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
                {totalRunKmPeriod > 0
                  ? `${formatKm(totalRunKmPeriod)} km · ${totalRunKcalPeriod} kcal`
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
                  Frontal {!isDefaultToday ? `· ${range.shortLabel}` : ""}
                  {frontSpanDays > 0
                    ? ` · ${frontSpanDays} dias de evolução`
                    : ""}
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
                    <Camera
                      className="h-5 w-5 text-zinc-500"
                      strokeWidth={1.6}
                    />
                    <span className="text-[11px] font-medium text-zinc-300">
                      Primeira frontal
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {isDefaultToday
                        ? "Toque para adicionar"
                        : "Sem foto neste período"}
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
                    <Camera
                      className="h-5 w-5 text-zinc-500"
                      strokeWidth={1.6}
                    />
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

      {/* Modals */}
      <DailyStoryModal
        open={storyOpen}
        initialDateKey={storyDate}
        onClose={() => setStoryOpen(false)}
      />

      <DailyRecapBookModal
        open={recapBookOpen}
        initialDateKey={recapBookDate}
        onClose={() => setRecapBookOpen(false)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
      />
    </div>
  );
}
