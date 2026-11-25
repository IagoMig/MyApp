"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Dumbbell,
  Footprints,
  Plus,
  X,
  Trash2,
  BookMarked,
  Flame,
  Clock,
  Sparkles,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  WorkoutBookModal,
  type WorkoutBookPeriod,
} from "./WorkoutBookModal";
import { PeriodFilterBar } from "./PeriodFilterBar";
import {
  db,
  DEFAULT_SETTINGS,
  ensureSettings,
  getDateKey,
  getMonthKey,
  getIsoWeekKey,
  formatShortDatePt,
  formatShortDayPt,
  type WorkoutCategoryId,
  type WorkoutIntensity,
} from "@/lib/db";
import {
  WORKOUT_CATEGORIES,
  INTENSITY_CONFIG,
  getCategoryDef,
  estimateWorkoutCalories,
  mergeWorkoutsAndRuns,
  summarizeUnifiedWorkouts,
  formatMinutesHuman,
} from "@/lib/workouts";
import {
  isDateInPeriod,
  resolvePeriodRange,
  type PeriodMode,
} from "@/lib/period";
import { formatKm } from "@/lib/running";

const DURATION_PRESETS = [20, 30, 45, 60, 90];

export function WorkoutsView() {
  const [todayKey] = useState(() => getDateKey());
  const [periodMode, setPeriodMode] = useState<PeriodMode>("daily");
  const [anchorDate, setAnchorDate] = useState(() => getDateKey());

  // Book modal
  const [bookOpen, setBookOpen] = useState(false);

  // Add workout modal state
  const [addOpen, setAddOpen] = useState(false);
  const [category, setCategory] = useState<WorkoutCategoryId>("muay_thai");
  const [customTitle, setCustomTitle] = useState("");
  const [durationMin, setDurationMin] = useState("45");
  const [intensity, setIntensity] = useState<WorkoutIntensity>("moderado");
  const [customKcal, setCustomKcal] = useState("");
  const [notes, setNotes] = useState("");
  const [workoutDate, setWorkoutDate] = useState(() => getDateKey());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  const range = useMemo(
    () => resolvePeriodRange(periodMode, anchorDate, todayKey),
    [periodMode, anchorDate, todayKey]
  );

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const allWorkouts = useLiveQuery(() => db.workouts.toArray(), []);
  const allRuns = useLiveQuery(() => db.runs.toArray(), []);

  const weightKg = (settings ?? DEFAULT_SETTINGS).weightKg;

  const unifiedAll = useMemo(
    () => mergeWorkoutsAndRuns(allWorkouts ?? [], allRuns ?? []),
    [allWorkouts, allRuns]
  );

  // Entries strictly filtered to active PeriodFilterBar range
  const periodEntries = useMemo(
    () => unifiedAll.filter((e) => isDateInPeriod(e.date, range)),
    [unifiedAll, range]
  );
  const periodSummary = useMemo(
    () => summarizeUnifiedWorkouts(periodEntries),
    [periodEntries]
  );

  // Bar chart data for Weekly & Monthly modes
  const chartBars = useMemo(() => {
    if (periodMode === "weekly") {
      const byDay = new Map<string, number>();
      for (const item of periodEntries) {
        byDay.set(item.date, (byDay.get(item.date) ?? 0) + item.caloriesBurned);
      }
      const raw = range.days.map((d) => ({
        key: d,
        label: formatShortDayPt(d),
        kcal: byDay.get(d) ?? 0,
        isToday: d === todayKey,
      }));
      const maxKcal = Math.max(1, ...raw.map((r) => r.kcal));
      return raw.map((r) => ({
        ...r,
        pct: r.kcal > 0 ? Math.max(12, Math.round((r.kcal / maxKcal) * 100)) : 4,
      }));
    }

    if (periodMode === "monthly") {
      const buckets = [0, 0, 0, 0, 0];
      for (const item of periodEntries) {
        const dayNum = parseInt(item.date.slice(8, 10), 10) || 1;
        const idx = Math.min(4, Math.floor((dayNum - 1) / 7));
        buckets[idx] += item.caloriesBurned;
      }
      const maxKcal = Math.max(1, ...buckets);
      return buckets.map((kcal, i) => ({
        key: `S${i + 1}`,
        label: `Sem ${i + 1}`,
        kcal,
        isToday: false,
        pct: kcal > 0 ? Math.max(12, Math.round((kcal / maxKcal) * 100)) : 4,
      }));
    }

    return [];
  }, [periodMode, periodEntries, range.days, todayKey]);

  const parsedDuration = Math.max(0, parseInt(durationMin, 10) || 0);
  const autoEstimatedKcal = estimateWorkoutCalories(
    category,
    parsedDuration,
    weightKg,
    intensity
  );
  const finalKcal =
    customKcal.trim() !== "" && Number(customKcal) > 0
      ? Math.round(Number(customKcal))
      : autoEstimatedKcal;

  const openAddModal = (
    presetCategory: WorkoutCategoryId = "muay_thai",
    presetDuration?: number
  ) => {
    const def = getCategoryDef(presetCategory);
    setCategory(presetCategory);
    setCustomTitle("");
    setDurationMin(String(presetDuration ?? def.defaultMin));
    setIntensity("moderado");
    setCustomKcal("");
    setNotes("");
    setWorkoutDate(range.isSingleDay ? range.startDate : todayKey);
    setAddOpen(true);
  };

  const handleSaveWorkout = async () => {
    const mins = Math.max(1, parseInt(durationMin, 10) || 0);
    if (mins <= 0) return;
    setSaving(true);
    try {
      const def = getCategoryDef(category);
      const dateStr = workoutDate || todayKey;
      await db.workouts.add({
        date: dateStr,
        weekKey: getIsoWeekKey(dateStr),
        monthKey: getMonthKey(dateStr),
        category,
        name: customTitle.trim() || def.label,
        durationMin: mins,
        intensity,
        caloriesBurned: Math.max(1, finalKcal),
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      });
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWorkout = async (id?: number) => {
    if (id === undefined) return;
    await db.workouts.delete(id);
  };

  const activeCategoryDef = getCategoryDef(category);
  const bookInitialPeriod: WorkoutBookPeriod =
    periodMode === "monthly" ? "month" : "week";

  return (
    <div className="space-y-5 pt-2">
      {/* Sub-navigation switcher: Treinos | Corrida */}
      <div className="glass-obsidian grid grid-cols-2 gap-1.5 rounded-2xl p-1">
        <Link
          href="/treino"
          className="glass-pill-active flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium transition-all"
        >
          <Dumbbell className="h-3.5 w-3.5" />
          <span>Treinos</span>
        </Link>
        <Link
          href="/corrida"
          className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-zinc-400 hover:text-white transition-all"
        >
          <Footprints className="h-3.5 w-3.5" />
          <span>Corrida</span>
        </Link>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">
          Treino
        </h1>

        <div className="flex items-center gap-2">
          <GlassButton
            type="button"
            onClick={() => setBookOpen(true)}
            aria-label="Abrir livro de treinos"
            className="h-10 px-3 text-xs font-medium"
          >
            <BookMarked className="h-4 w-4" />
            <span>Livro</span>
          </GlassButton>

          <GlassButton
            type="button"
            active
            onClick={() => openAddModal()}
            className="h-10 px-3.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Treino</span>
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

      {/* Period Hero Summary Card */}
      <GlassCard variant="frosted" className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="block text-xs text-zinc-400">
              Gasto em {range.shortLabel} (treinos + corrida)
            </span>
            <div className="mt-1 text-4xl font-light tracking-tight text-white tabular-nums">
              {periodSummary.totalCalories.toLocaleString("pt-BR")}{" "}
              <span className="text-lg text-zinc-400">kcal</span>
            </div>
          </div>

          <div className="glass-pill flex h-10 w-10 items-center justify-center rounded-full">
            <Flame className="h-4 w-4 text-white" strokeWidth={1.8} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300 tabular-nums">
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <Dumbbell className="h-3 w-3" />
            {periodSummary.totalSessions}{" "}
            {periodSummary.totalSessions === 1 ? "sessão" : "sessões"}
          </span>
          <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
            <Clock className="h-3 w-3" />
            {formatMinutesHuman(periodSummary.totalMinutes)}
          </span>
          {periodSummary.runCount > 0 && (
            <span className="glass-pill inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white">
              <Footprints className="h-3 w-3" />
              {formatKm(periodSummary.totalRunKm)} km (auto)
            </span>
          )}
        </div>
      </GlassCard>

      {/* Weekly / Monthly Visual Results & Modality Breakdown */}
      {!range.isSingleDay && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
              Resultados · {range.shortLabel}
            </span>
            <GlassButton
              type="button"
              onClick={() => setBookOpen(true)}
              className="h-8 px-3 text-[11px] font-medium !rounded-xl"
            >
              <BookMarked className="h-3.5 w-3.5" />
              <span>Abrir Livro</span>
            </GlassButton>
          </div>

          {/* Monochrome Activity Bar Chart */}
          <div className="glass-obsidian rounded-2xl px-3.5 pt-4 pb-3">
            <div className="flex items-end justify-between gap-2 h-24">
              {chartBars.map((bar) => (
                <div
                  key={bar.key}
                  className="flex flex-1 flex-col items-center justify-end gap-1.5 h-full"
                >
                  <div className="flex flex-1 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-[22px] rounded-t-lg transition-all duration-500 ${
                        bar.kcal > 0
                          ? "bg-gradient-to-t from-zinc-400 via-zinc-200 to-white shadow-[0_0_12px_rgba(255,255,255,0.28)]"
                          : "bg-white/[0.08]"
                      }`}
                      style={{ height: `${bar.pct}%` }}
                      title={`${bar.label}: ${bar.kcal} kcal`}
                    />
                  </div>
                  <span
                    className={`text-[10px] capitalize ${
                      bar.isToday ? "text-white font-semibold" : "text-zinc-500"
                    }`}
                  >
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Modality Breakdown */}
          {periodSummary.breakdown.length > 0 && (
            <div className="space-y-2.5">
              <span className="block text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                Por modalidade
              </span>
              {periodSummary.breakdown.map((mod) => (
                <div key={mod.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-zinc-200">
                      <strong className="font-medium text-white">
                        {mod.label}
                      </strong>{" "}
                      <span className="text-zinc-400">
                        · {mod.count}x · {formatMinutesHuman(mod.minutes)}
                      </span>
                    </span>
                    <span className="text-white">
                      {mod.calories.toLocaleString("pt-BR")} kcal
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-white/85"
                      style={{ width: `${Math.max(5, mod.pctCalories)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Sessions List for Selected Period */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            {range.isSingleDay ? `Treinos · ${range.shortLabel}` : "Histórico do período"}
          </span>
          <span className="text-[11px] text-zinc-500">
            Corridas entram automaticamente
          </span>
        </div>

        {periodEntries.length === 0 ? (
          <GlassCard className="p-5 space-y-4">
            <p className="text-sm text-zinc-400 text-center">
              Nenhum treino registrado em {range.label}. Atalhos rápidos:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <GlassButton
                type="button"
                onClick={() => openAddModal("muay_thai", 60)}
                className="py-2.5 text-xs font-medium"
              >
                + Muay Thai
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => openAddModal("musculacao", 60)}
                className="py-2.5 text-xs font-medium"
              >
                + Musculação
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => openAddModal("hiit", 30)}
                className="py-2.5 text-xs font-medium"
              >
                + HIIT 30m
              </GlassButton>
              <Link
                href="/corrida"
                className="glass-pill inline-flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-xs font-medium text-white transition-all active:scale-[0.96]"
              >
                <Footprints className="h-3.5 w-3.5" />
                <span>Correr</span>
              </Link>
            </div>
          </GlassCard>
        ) : (
          periodEntries.map((item) => {
            if (item.source === "run") {
              return (
                <Link key={item.uid} href="/corrida" className="block">
                  <GlassCard className="px-5 py-4 !rounded-[24px] transition-transform active:scale-[0.985]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="glass-pill-active flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                          <Footprints className="h-4 w-4" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              Corrida
                            </span>
                            <span className="glass-pill rounded-full px-2 py-0.5 text-[10px] text-zinc-200">
                              Automático
                            </span>
                          </div>
                          <span className="block text-xs text-zinc-400 tabular-nums truncate mt-0.5">
                            {!range.isSingleDay
                              ? `${formatShortDatePt(item.date)} · `
                              : ""}
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-white tabular-nums shrink-0">
                        {item.caloriesBurned} kcal
                      </span>
                    </div>
                  </GlassCard>
                </Link>
              );
            }

            return (
              <GlassCard key={item.uid} className="px-5 py-4 !rounded-[24px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="glass-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      <Dumbbell
                        className="h-4 w-4 text-white"
                        strokeWidth={1.8}
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-white truncate">
                        {item.title}
                      </span>
                      <span className="block text-xs text-zinc-400 tabular-nums truncate">
                        {!range.isSingleDay
                          ? `${formatShortDatePt(item.date)} · `
                          : ""}
                        {item.subtitle}
                        {item.notes ? ` · ${item.notes}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-white tabular-nums">
                      {item.caloriesBurned} kcal
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteWorkout(item.originalId)}
                      aria-label="Apagar treino"
                      className="p-1.5 text-zinc-500 hover:text-white cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Register Workout Sheet Modal */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-3 sm:items-center"
          onClick={() => setAddOpen(false)}
        >
          <GlassCard
            variant="frosted"
            className="flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <h2 className="text-lg font-medium text-white">
                Registrar treino
              </h2>
              <GlassButton
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>

            <div className="overflow-y-auto p-5 space-y-4 no-scrollbar">
              {/* Modalities Grid */}
              <div className="space-y-2">
                <span className="block px-1 text-xs text-zinc-400">
                  Modalidade
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {WORKOUT_CATEGORIES.map((cat) => (
                    <GlassButton
                      key={cat.id}
                      type="button"
                      active={category === cat.id}
                      onClick={() => {
                        setCategory(cat.id);
                        setCustomKcal("");
                      }}
                      className="h-8 px-3 text-xs font-medium !rounded-xl"
                    >
                      {cat.label}
                    </GlassButton>
                  ))}
                </div>
              </div>

              {/* Duration Presets + Custom Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-zinc-400">Duração (min)</span>
                  <span className="text-xs text-white tabular-nums">
                    {parsedDuration} min
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {DURATION_PRESETS.map((m) => (
                    <GlassButton
                      key={m}
                      type="button"
                      active={parsedDuration === m}
                      onClick={() => {
                        setDurationMin(String(m));
                        setCustomKcal("");
                      }}
                      className="h-9 flex-1 text-xs font-medium !rounded-xl tabular-nums"
                    >
                      {m}m
                    </GlassButton>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={600}
                  inputMode="numeric"
                  value={durationMin}
                  onChange={(e) => {
                    setDurationMin(e.target.value);
                    setCustomKcal("");
                  }}
                  placeholder="Minutos"
                  className="glass-pill w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none tabular-nums"
                />
              </div>

              {/* Intensity */}
              <div className="space-y-2">
                <span className="block px-1 text-xs text-zinc-400">
                  Intensidade
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(["leve", "moderado", "intenso"] as const).map((lvl) => (
                    <GlassButton
                      key={lvl}
                      type="button"
                      active={intensity === lvl}
                      onClick={() => {
                        setIntensity(lvl);
                        setCustomKcal("");
                      }}
                      className="py-2.5 text-xs font-medium"
                    >
                      {INTENSITY_CONFIG[lvl].label}
                    </GlassButton>
                  ))}
                </div>
              </div>

              {/* Live Calorie Estimate Banner */}
              <div className="glass-obsidian rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                    <span>Estimativa automática</span>
                  </div>
                  <span className="text-lg font-medium text-white tabular-nums">
                    ~{finalKcal} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums">
                  <span>
                    {activeCategoryDef.label} · {parsedDuration} min ·{" "}
                    {weightKg} kg
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    placeholder="Ajustar kcal"
                    className="w-24 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-right text-[11px] text-white placeholder-zinc-500 outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Optional Title + Notes + Date */}
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`Nome (padrão: ${activeCategoryDef.label})`}
                  className="glass-pill w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none"
                />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={activeCategoryDef.placeholder}
                  className="glass-pill w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none"
                />
                <input
                  type="date"
                  value={workoutDate}
                  onChange={(e) => setWorkoutDate(e.target.value)}
                  className="glass-pill w-full rounded-xl px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
            </div>

            <div className="border-t border-white/10 p-5">
              <GlassButton
                type="button"
                active
                disabled={saving || parsedDuration <= 0}
                onClick={handleSaveWorkout}
                className="w-full py-3.5 text-sm font-medium"
              >
                {saving
                  ? "Salvando..."
                  : `Salvar treino · ${finalKcal} kcal`}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Weekly & Monthly Workout Book Modal */}
      <WorkoutBookModal
        open={bookOpen}
        initialPeriod={bookInitialPeriod}
        initialDateKey={range.anchorDate}
        initialMonthKey={range.monthKey}
        onClose={() => setBookOpen(false)}
      />
    </div>
  );
}
