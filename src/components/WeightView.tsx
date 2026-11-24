"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Scale,
  Target,
  Plus,
  Minus,
  X,
  Check,
  CalendarClock,
  Trash2,
  Pencil,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { EvolutionChart, type EvolutionPoint } from "./EvolutionChart";
import {
  db,
  DEFAULT_SETTINGS,
  ensureSettings,
  updateSettings,
  saveWeeklyWeight,
  deleteWeightLog,
  getDateKey,
  getIsoWeekKey,
  getWeekBounds,
  shiftDateKey,
  formatShortDatePt,
  formatFullDatePt,
  formatWeekRangePt,
  formatWeightKg,
  daysBetweenDateKeys,
  type WeightLog,
} from "@/lib/db";

type ChartRange = "4w" | "12w" | "all";

export function WeightView() {
  const [todayKey] = useState(() => getDateKey());
  const [range, setRange] = useState<ChartRange>("12w");

  // Weight modal
  const [logOpen, setLogOpen] = useState(false);
  const [inputWeight, setInputWeight] = useState("75.0");
  const [inputDate, setInputDate] = useState(() => getDateKey());
  const [inputNote, setInputNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Goal modal
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalWeightInput, setGoalWeightInput] = useState("70.0");
  const [startWeightInput, setStartWeightInput] = useState("75.0");

  useEffect(() => {
    ensureSettings().catch(() => {});
  }, []);

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const logsAsc = useLiveQuery(
    () => db.weightLogs.orderBy("date").toArray(),
    []
  );

  const activeSettings = settings ?? DEFAULT_SETTINGS;
  const allLogs = useMemo(() => logsAsc ?? [], [logsAsc]);

  const currentWeek = useMemo(() => getWeekBounds(todayKey), [todayKey]);
  const nextWeekStart = useMemo(
    () => shiftDateKey(currentWeek.endDate, 1),
    [currentWeek.endDate]
  );

  const thisWeekLog = useMemo(
    () => allLogs.find((l) => l.weekKey === currentWeek.weekKey) ?? null,
    [allLogs, currentWeek.weekKey]
  );

  const latestLog = allLogs.length > 0 ? allLogs[allLogs.length - 1] : null;
  const firstLog = allLogs.length > 0 ? allLogs[0] : null;

  const currentWeight = latestLog?.weightKg ?? activeSettings.weightKg;
  const startWeight =
    activeSettings.startWeightKg ?? firstLog?.weightKg ?? currentWeight;
  const goalWeight =
    activeSettings.weightGoalKg ?? Math.max(40, Number((currentWeight - 5).toFixed(1)));

  const totalChange = Number((currentWeight - startWeight).toFixed(1));
  const diffToGoal = Number((currentWeight - goalWeight).toFixed(1));
  const isLosingGoal = goalWeight <= startWeight;

  const progressPct = useMemo(() => {
    const totalNeeded = Math.abs(startWeight - goalWeight);
    if (totalNeeded < 0.05) return 100;
    const achieved = isLosingGoal
      ? startWeight - currentWeight
      : currentWeight - startWeight;
    return Math.max(0, Math.min(100, Math.round((achieved / totalNeeded) * 100)));
  }, [startWeight, goalWeight, currentWeight, isLosingGoal]);

  const goalReached = isLosingGoal
    ? currentWeight <= goalWeight
    : currentWeight >= goalWeight;

  // Weekly average pace & forecast
  const { avgWeeklyDelta, estimatedWeeksLeft } = useMemo(() => {
    if (allLogs.length < 2) {
      return { avgWeeklyDelta: null as number | null, estimatedWeeksLeft: null as number | null };
    }
    const first = allLogs[0];
    const last = allLogs[allLogs.length - 1];
    const days = Math.max(7, daysBetweenDateKeys(first.date, last.date));
    const weeks = days / 7;
    const avg = Number(((last.weightKg - first.weightKg) / weeks).toFixed(2));

    let forecast: number | null = null;
    if (!goalReached) {
      const movingRightWay = isLosingGoal ? avg < -0.05 : avg > 0.05;
      if (movingRightWay) {
        forecast = Math.max(1, Math.ceil(Math.abs(currentWeight - goalWeight) / Math.abs(avg)));
      }
    }
    return { avgWeeklyDelta: avg, estimatedWeeksLeft: forecast };
  }, [allLogs, goalReached, isLosingGoal, currentWeight, goalWeight]);

  // Filtered chart points
  const chartPoints: EvolutionPoint[] = useMemo(() => {
    const slice =
      range === "4w"
        ? allLogs.slice(-4)
        : range === "12w"
          ? allLogs.slice(-12)
          : allLogs;
    return slice.map((l) => ({
      id: l.id ?? l.date,
      date: l.date,
      weightKg: l.weightKg,
      note: l.note,
    }));
  }, [allLogs, range]);

  // Reverse list with deltas for history display
  const historyRows = useMemo(() => {
    return allLogs
      .map((log, idx) => {
        const prev = idx > 0 ? allLogs[idx - 1] : null;
        const delta = prev
          ? Number((log.weightKg - prev.weightKg).toFixed(1))
          : null;
        return { log, delta };
      })
      .reverse();
  }, [allLogs]);

  const openLogModal = (existing?: WeightLog | null) => {
    if (existing) {
      setInputWeight(existing.weightKg.toFixed(1));
      setInputDate(existing.date);
      setInputNote(existing.note ?? "");
    } else {
      setInputWeight(currentWeight.toFixed(1));
      setInputDate(todayKey);
      setInputNote("");
    }
    setLogOpen(true);
  };

  const openGoalModal = () => {
    setGoalWeightInput(goalWeight.toFixed(1));
    setStartWeightInput(startWeight.toFixed(1));
    setGoalOpen(true);
  };

  const selectedDateWeekKey = getIsoWeekKey(inputDate || todayKey);
  const willOverwriteWeek = useMemo(
    () => allLogs.some((l) => l.weekKey === selectedDateWeekKey),
    [allLogs, selectedDateWeekKey]
  );

  const adjustInputWeight = (delta: number) => {
    const num = parseFloat(inputWeight.replace(",", ".")) || currentWeight;
    const next = Math.max(30, Math.min(250, Number((num + delta).toFixed(1))));
    setInputWeight(next.toFixed(1));
  };

  const handleSaveWeight = async () => {
    const parsed = parseFloat(inputWeight.replace(",", "."));
    if (!parsed || parsed < 30 || parsed > 250) return;
    setSaving(true);
    try {
      await saveWeeklyWeight({
        date: inputDate || todayKey,
        weightKg: parsed,
        note: inputNote,
      });
      setLogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveGoal = async () => {
    const g = parseFloat(goalWeightInput.replace(",", "."));
    const s = parseFloat(startWeightInput.replace(",", "."));
    if (!g || g < 30 || g > 250) return;
    await updateSettings({
      weightGoalKg: Number(g.toFixed(1)),
      startWeightKg: s && s >= 30 && s <= 250 ? Number(s.toFixed(1)) : startWeight,
    });
    setGoalOpen(false);
  };

  const handleDelete = async (id?: number) => {
    if (id === undefined) return;
    await deleteWeightLog(id);
  };

  const daysUntilNextWeek = Math.max(
    1,
    daysBetweenDateKeys(todayKey, nextWeekStart)
  );

  return (
    <div className="space-y-5 pt-2">
      {/* Header */}
      <header className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Emagrecimento
          </h1>
          <p className="text-xs text-zinc-400">
            Atualização semanal · {formatWeekRangePt(currentWeek.startDate, currentWeek.endDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <GlassButton
            type="button"
            onClick={openGoalModal}
            aria-label="Definir meta de peso"
            className="h-10 px-3 text-xs font-medium"
          >
            <Target className="h-4 w-4" />
            <span>Meta</span>
          </GlassButton>

          <GlassButton
            type="button"
            active
            onClick={() => openLogModal(thisWeekLog)}
            className="h-10 px-3.5 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Peso</span>
          </GlassButton>
        </div>
      </header>

      {/* Weekly Check-in + Goal Hero Card */}
      <GlassCard variant="frosted" className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="block text-xs text-zinc-400">Peso atual</span>
            <div className="mt-1 text-4xl font-light tracking-tight text-white tabular-nums">
              {formatWeightKg(currentWeight)}{" "}
              <span className="text-lg text-zinc-400">kg</span>
            </div>
          </div>

          <button
            type="button"
            onClick={openGoalModal}
            className="glass-pill rounded-2xl px-3.5 py-2 text-right cursor-pointer"
          >
            <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
              Meta
            </span>
            <span className="text-sm font-medium text-white tabular-nums">
              {formatWeightKg(goalWeight)} kg
            </span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs tabular-nums">
            <span className="text-zinc-400">
              Início: {formatWeightKg(startWeight)} kg
            </span>
            <span className="font-medium text-white">
              {goalReached
                ? "Meta atingida"
                : `Faltam ${formatWeightKg(Math.abs(diffToGoal))} kg · ${progressPct}%`}
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-zinc-300 via-white to-white transition-all duration-500 ease-out shadow-[0_0_16px_rgba(255,255,255,0.45)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Weekly Status Banner */}
        <div className="glass-obsidian flex items-center justify-between gap-3 rounded-[20px] px-4 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                thisWeekLog ? "glass-pill-active" : "glass-pill"
              }`}
            >
              {thisWeekLog ? (
                <Check className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <CalendarClock className="h-4 w-4 text-white" strokeWidth={1.8} />
              )}
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-medium text-white truncate">
                {thisWeekLog
                  ? "Peso da semana atualizado"
                  : "Pesagem semanal pendente"}
              </span>
              <span className="block text-[11px] text-zinc-400 truncate">
                {thisWeekLog
                  ? `Próxima em ${daysUntilNextWeek} ${daysUntilNextWeek === 1 ? "dia" : "dias"} (${formatShortDatePt(nextWeekStart)})`
                  : "Registre seu peso 1x por semana"}
              </span>
            </div>
          </div>

          <GlassButton
            type="button"
            active={!thisWeekLog}
            onClick={() => openLogModal(thisWeekLog)}
            className="h-8 px-3 text-[11px] font-medium shrink-0"
          >
            {thisWeekLog ? "Editar" : "Registrar"}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Evolution Chart Card */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="glass-pill flex h-8 w-8 items-center justify-center rounded-full">
              <Scale className="h-3.5 w-3.5 text-white" strokeWidth={1.8} />
            </div>
            <span className="text-sm font-medium text-white">
              Gráfico de evolução
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                { id: "4w", label: "4 sem" },
                { id: "12w", label: "3 m" },
                { id: "all", label: "Tudo" },
              ] as const
            ).map((opt) => (
              <GlassButton
                key={opt.id}
                type="button"
                active={range === opt.id}
                onClick={() => setRange(opt.id)}
                className="h-7 px-2.5 text-[11px] font-medium !rounded-xl"
              >
                {opt.label}
              </GlassButton>
            ))}
          </div>
        </div>

        <EvolutionChart
          points={chartPoints}
          goalKg={goalWeight}
          interactive
        />
      </GlassCard>

      {/* 3 Monochrome Summary Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <GlassCard className="p-4 !rounded-[22px] space-y-1">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
            Variação
          </span>
          <span className="block text-lg font-light text-white tabular-nums">
            {totalChange > 0 ? "+" : ""}
            {formatWeightKg(totalChange)}{" "}
            <span className="text-xs text-zinc-400">kg</span>
          </span>
        </GlassCard>

        <GlassCard className="p-4 !rounded-[22px] space-y-1">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
            Média/sem
          </span>
          <span className="block text-lg font-light text-white tabular-nums">
            {avgWeeklyDelta !== null ? (
              <>
                {avgWeeklyDelta > 0 ? "+" : ""}
                {formatWeightKg(avgWeeklyDelta)}
                <span className="text-xs text-zinc-400"> kg</span>
              </>
            ) : (
              "—"
            )}
          </span>
        </GlassCard>

        <GlassCard className="p-4 !rounded-[22px] space-y-1">
          <span className="block text-[10px] uppercase tracking-wider text-zinc-400">
            Previsão
          </span>
          <span className="block text-lg font-light text-white tabular-nums">
            {goalReached
              ? "Concluída"
              : estimatedWeeksLeft !== null
                ? `${estimatedWeeksLeft} sem`
                : "—"}
          </span>
        </GlassCard>
      </div>

      {/* Weekly History List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-400">
            Histórico semanal
          </span>
          <span className="text-xs text-zinc-500 tabular-nums">
            {allLogs.length} {allLogs.length === 1 ? "registro" : "registros"}
          </span>
        </div>

        {historyRows.length === 0 ? (
          <GlassCard className="p-7 text-center space-y-3">
            <p className="text-sm text-zinc-300">
              Registre sua primeira pesagem semanal para acompanhar sua evolução.
            </p>
            <GlassButton
              type="button"
              active
              onClick={() => openLogModal(null)}
              className="px-5 py-2.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Registrar peso inicial</span>
            </GlassButton>
          </GlassCard>
        ) : (
          historyRows.map(({ log, delta }) => {
            const bounds = getWeekBounds(log.date);
            const isThisWeek = log.weekKey === currentWeek.weekKey;
            return (
              <GlassCard
                key={log.id ?? log.date}
                variant={isThisWeek ? "frosted" : "default"}
                className="px-5 py-4 !rounded-[24px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-white tabular-nums">
                        {formatWeightKg(log.weightKg)} kg
                      </span>
                      {delta !== null ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
                            delta < 0
                              ? "glass-pill-active"
                              : "glass-pill text-zinc-300"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {formatWeightKg(delta)} kg
                        </span>
                      ) : (
                        <span className="glass-pill rounded-full px-2 py-0.5 text-[10px] text-zinc-300">
                          Início
                        </span>
                      )}
                    </div>
                    <span className="block text-xs text-zinc-400 mt-0.5">
                      {formatFullDatePt(log.date)} · Sem{" "}
                      {bounds.weekKey.split("-W")[1]}
                      {log.note ? ` · ${log.note}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openLogModal(log)}
                      aria-label="Editar pesagem"
                      className="p-2 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(log.id)}
                      aria-label="Apagar pesagem"
                      className="p-2 text-zinc-500 hover:text-white cursor-pointer"
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

      {/* Register / Update Weekly Weight Modal */}
      {logOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-4 sm:items-center"
          onClick={() => setLogOpen(false)}
        >
          <GlassCard
            variant="frosted"
            className="w-full max-w-[420px] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">
                  Pesagem semanal
                </h2>
                <p className="text-xs text-zinc-400">
                  {willOverwriteWeek
                    ? "Atualizará o peso registrado nesta semana"
                    : `Semana ${selectedDateWeekKey.split("-W")[1]} · 1 registro por semana`}
                </p>
              </div>
              <GlassButton
                type="button"
                onClick={() => setLogOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>

            {/* Big Monochrome Weight Stepper */}
            <div className="glass-obsidian flex items-center justify-between rounded-[22px] p-4">
              <GlassButton
                type="button"
                onClick={() => adjustInputWeight(-0.1)}
                aria-label="Diminuir 0,1 kg"
                className="h-11 w-11 !rounded-full p-0"
              >
                <Minus className="h-4 w-4" />
              </GlassButton>

              <div className="flex items-baseline gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  className="w-28 bg-transparent text-center text-4xl font-light text-white outline-none tabular-nums"
                />
                <span className="text-base text-zinc-400">kg</span>
              </div>

              <GlassButton
                type="button"
                onClick={() => adjustInputWeight(0.1)}
                aria-label="Aumentar 0,1 kg"
                className="h-11 w-11 !rounded-full p-0"
              >
                <Plus className="h-4 w-4" />
              </GlassButton>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="block px-1 text-xs text-zinc-400">Data</span>
                <input
                  type="date"
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="block px-1 text-xs text-zinc-400">
                  Observação (opcional)
                </span>
                <input
                  type="text"
                  value={inputNote}
                  onChange={(e) => setInputNote(e.target.value)}
                  placeholder="Ex: Em jejum, manhã"
                  className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none"
                />
              </label>
            </div>

            <GlassButton
              type="button"
              active
              disabled={saving}
              onClick={handleSaveWeight}
              className="w-full py-3.5 text-sm font-medium"
            >
              {saving
                ? "Salvando..."
                : willOverwriteWeek
                  ? "Atualizar peso da semana"
                  : "Salvar pesagem semanal"}
            </GlassButton>
          </GlassCard>
        </div>
      )}

      {/* Goal Configuration Modal */}
      {goalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-4 sm:items-center"
          onClick={() => setGoalOpen(false)}
        >
          <GlassCard
            variant="frosted"
            className="w-full max-w-[420px] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">
                Meta de emagrecimento
              </h2>
              <GlassButton
                type="button"
                onClick={() => setGoalOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>

            <div className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="block px-1 text-xs text-zinc-400">
                  Peso meta (kg)
                </span>
                <div className="flex items-center gap-2">
                  <GlassButton
                    type="button"
                    onClick={() => {
                      const v = parseFloat(goalWeightInput.replace(",", ".")) || goalWeight;
                      setGoalWeightInput(Math.max(35, v - 0.5).toFixed(1));
                    }}
                    className="h-11 w-11 !rounded-full p-0 shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </GlassButton>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={goalWeightInput}
                    onChange={(e) => setGoalWeightInput(e.target.value)}
                    className="glass-pill w-full rounded-xl px-4 py-3 text-center text-base font-medium text-white outline-none tabular-nums"
                  />
                  <GlassButton
                    type="button"
                    onClick={() => {
                      const v = parseFloat(goalWeightInput.replace(",", ".")) || goalWeight;
                      setGoalWeightInput(Math.min(200, v + 0.5).toFixed(1));
                    }}
                    className="h-11 w-11 !rounded-full p-0 shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </GlassButton>
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="block px-1 text-xs text-zinc-400">
                  Peso inicial de referência (kg)
                </span>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={startWeightInput}
                  onChange={(e) => setStartWeightInput(e.target.value)}
                  className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white outline-none tabular-nums"
                />
              </label>
            </div>

            <GlassButton
              type="button"
              active
              onClick={handleSaveGoal}
              className="w-full py-3.5 text-sm font-medium"
            >
              Salvar meta
            </GlassButton>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
