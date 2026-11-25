"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Droplets,
  Flame,
  Dumbbell,
  Check,
  Sparkles,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  getDateKey,
  shiftDateKey,
  formatLongDatePt,
  formatShortDatePt,
} from "@/lib/db";
import {
  buildDailyRecap,
  formatLitersPt,
  formatWeekdayYearPt,
  renderStoryPngBlob,
  type StoryStyle,
} from "@/lib/recap";
import { formatMinutesHuman } from "@/lib/workouts";
import { formatKm } from "@/lib/running";

interface DailyStoryModalProps {
  open: boolean;
  initialDateKey: string;
  onClose: () => void;
}

export function DailyStoryModal({
  open,
  initialDateKey,
  onClose,
}: DailyStoryModalProps) {
  const [todayKey] = useState(() => getDateKey());
  const yesterdayKey = useMemo(() => shiftDateKey(todayKey, -1), [todayKey]);

  const [selectedDate, setSelectedDate] = useState(initialDateKey);
  const [style, setStyle] = useState<StoryStyle>("glass");
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedDate(initialDateKey);
      setFeedback(null);
    }
  }, [open, initialDateKey]);

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const waterLogs = useLiveQuery(
    () => db.waterLogs.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const mealLogs = useLiveQuery(
    () => db.mealLogs.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const workouts = useLiveQuery(
    () => db.workouts.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const runs = useLiveQuery(
    () => db.runs.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const diary = useLiveQuery(
    () => db.diaryEntries.get(selectedDate),
    [selectedDate]
  );
  const weightLog = useLiveQuery(
    () => db.weightLogs.where("date").equals(selectedDate).first(),
    [selectedDate]
  );
  const photos = useLiveQuery(
    () => db.progressPhotos.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );

  const recap = useMemo(
    () =>
      buildDailyRecap({
        date: selectedDate,
        settings,
        waterLogs: waterLogs ?? [],
        mealLogs: mealLogs ?? [],
        workouts: workouts ?? [],
        runs: runs ?? [],
        diary,
        weightLog,
        photos: photos ?? [],
      }),
    [
      selectedDate,
      settings,
      waterLogs,
      mealLogs,
      workouts,
      runs,
      diary,
      weightLog,
      photos,
    ]
  );

  if (!open) return null;

  const isYesterday = selectedDate === yesterdayKey;
  const isToday = selectedDate === todayKey;

  const dateBadgeLabel = isYesterday
    ? `Ontem · ${formatShortDatePt(selectedDate)}`
    : isToday
      ? `Hoje (prévia) · ${formatShortDatePt(selectedDate)}`
      : formatShortDatePt(selectedDate);

  const totalKcal = recap.caloriesConsumed + recap.caloriesBurned;
  const burnedPct =
    totalKcal > 0 ? Math.round((recap.caloriesBurned / totalKcal) * 100) : 0;
  const consumedPct = totalKcal > 0 ? 100 - burnedPct : 0;

  const triggerDownload = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `story-retrospectiva-${selectedDate}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSavePng = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const blob = await renderStoryPngBlob(recap, style);
      triggerDownload(blob);
      setFeedback("Story salvo (1080×1920)");
    } catch {
      setFeedback("Erro ao gerar imagem");
    } finally {
      setExporting(false);
    }
  };

  const handleShareStory = async () => {
    setExporting(true);
    setFeedback(null);
    try {
      const blob = await renderStoryPngBlob(recap, style);
      const file = new File([blob], `story-retrospectiva-${selectedDate}.png`, {
        type: "image/png",
      });

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
      };

      if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: `Retrospectiva · ${formatLongDatePt(selectedDate)}`,
        });
        setFeedback("Pronto para postar");
      } else {
        triggerDownload(blob);
        setFeedback("PNG salvo para postar no Story");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setFeedback("Erro ao compartilhar");
      }
    } finally {
      setExporting(false);
    }
  };

  const sessionCount = recap.workoutSummary.totalSessions;
  const workoutLine =
    sessionCount === 0
      ? "Dia de descanso"
      : sessionCount === 1
        ? "Você treinou 1 vez"
        : `Você treinou ${sessionCount} vezes`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/92 backdrop-blur-xl p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94dvh] w-full max-w-[420px] flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Controls Outside Story Canvas */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <GlassButton
              type="button"
              onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
              aria-label="Dia anterior"
              className="h-8 w-8 !rounded-full p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </GlassButton>
            <button
              type="button"
              onClick={() => setSelectedDate(yesterdayKey)}
              className="glass-pill rounded-full px-3 py-1.5 text-[11px] font-medium text-white cursor-pointer"
            >
              {dateBadgeLabel}
            </button>
            <GlassButton
              type="button"
              disabled={isToday}
              onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
              aria-label="Próximo dia"
              className="h-8 w-8 !rounded-full p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </GlassButton>
          </div>

          <div className="flex items-center gap-1.5">
            <GlassButton
              type="button"
              active={style === "glass"}
              onClick={() => setStyle("glass")}
              className="h-8 px-2.5 text-[11px] font-medium !rounded-xl"
            >
              Vidro
            </GlassButton>
            <GlassButton
              type="button"
              active={style === "noir"}
              onClick={() => setStyle("noir")}
              className="h-8 px-2.5 text-[11px] font-medium !rounded-xl"
            >
              Noir
            </GlassButton>
            <GlassButton
              type="button"
              onClick={onClose}
              aria-label="Fechar story"
              className="h-8 w-8 !rounded-full p-0"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          </div>
        </div>

        {/* 9:16 Instagram Story Card Frame */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex items-center justify-center">
          <div
            className={`relative w-full max-w-[356px] aspect-[9/16] overflow-hidden rounded-[32px] border border-white/20 bg-black p-5 flex flex-col justify-between shadow-[0_24px_64px_-12px_rgba(0,0,0,0.95)]`}
          >
            {/* Ambient Obsidian Glass Backdrop (Vidro mode) */}
            {style === "glass" && (
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute -top-12 -left-14 h-52 w-52 rounded-full blur-[54px]"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 72%)",
                  }}
                />
                <div
                  className="absolute top-[42%] -right-14 h-52 w-52 rounded-full blur-[54px]"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(230,230,240,0.16) 0%, transparent 72%)",
                  }}
                />
                <div
                  className="absolute -bottom-14 left-6 h-48 w-48 rounded-full blur-[54px]"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.13) 0%, transparent 72%)",
                  }}
                />
                <div
                  className="absolute inset-0 opacity-35"
                  style={{
                    backgroundImage:
                      "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
                    backgroundSize: "18px 18px",
                  }}
                />
              </div>
            )}

            {/* Top Instagram Story progress bar */}
            <div className="relative z-10 space-y-3">
              <div className="h-[2.5px] w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-full rounded-full bg-white/90" />
              </div>

              <div className="space-y-1 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-200">
                  <Sparkles className="h-2.5 w-2.5" />
                  My App · Retrospectiva
                </span>
                <h2
                  className="text-[24px] font-semibold leading-tight text-white"
                  style={{ fontFamily: "var(--font-playfair), serif" }}
                >
                  {formatLongDatePt(recap.date)}
                </h2>
                <p className="text-[11px] text-zinc-400">
                  {formatWeekdayYearPt(recap.date)}
                </p>
              </div>
            </div>

            {/* Core Story Highlights (NO before/after photos) */}
            <div className="relative z-10 space-y-2.5 my-auto py-2">
              {/* Hydration Card */}
              <div
                className={`rounded-[20px] p-3.5 space-y-2 ${
                  style === "glass"
                    ? "glass-frosted"
                    : "border border-white/20 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    <Droplets className="h-3 w-3 text-white" />
                    Hidratação
                  </span>
                  <span className="text-[10px] text-zinc-400 tabular-nums">
                    {recap.waterPct}% da meta
                  </span>
                </div>
                <p className="text-sm text-zinc-200 leading-snug">
                  Você bebeu{" "}
                  <strong className="text-lg font-semibold text-white tabular-nums">
                    {formatLitersPt(recap.waterMl)} L
                  </strong>{" "}
                  de água
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white"
                    style={{ width: `${recap.waterPct}%` }}
                  />
                </div>
              </div>

              {/* Calories Consumed x Burned Card */}
              <div
                className={`rounded-[20px] p-3.5 ${
                  style === "glass"
                    ? "glass-frosted"
                    : "border border-white/20 bg-white/[0.03]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400 mb-2">
                  <Flame className="h-3 w-3 text-white" />
                  Calorias do dia
                </span>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-xs text-zinc-300 tabular-nums">
                      Você ingeriu{" "}
                      <strong className="block text-base font-semibold text-white">
                        {recap.caloriesConsumed.toLocaleString("pt-BR")} kcal
                      </strong>
                    </p>
                    <p className="text-xs text-zinc-300 tabular-nums">
                      Você queimou{" "}
                      <strong className="block text-base font-semibold text-white">
                        {recap.caloriesBurned.toLocaleString("pt-BR")} kcal
                      </strong>
                    </p>
                  </div>

                  {/* Mini Monochrome Ring */}
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
                    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
                      <circle
                        cx="40"
                        cy="40"
                        r="31"
                        fill="none"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth="10"
                      />
                      {totalKcal > 0 && (
                        <>
                          <circle
                            cx="40"
                            cy="40"
                            r="31"
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="10"
                            strokeDasharray={`${(consumedPct / 100) * 194.8} 194.8`}
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="31"
                            fill="none"
                            stroke="rgba(255,255,255,0.34)"
                            strokeWidth="10"
                            strokeDasharray={`${(burnedPct / 100) * 194.8} 194.8`}
                            strokeDashoffset={`-${(consumedPct / 100) * 194.8}`}
                          />
                        </>
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-white tabular-nums leading-none">
                        {totalKcal > 0 ? `${burnedPct}%` : "—"}
                      </span>
                      <span className="text-[7px] uppercase tracking-wider text-zinc-400 mt-0.5">
                        Gasto
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workouts Card */}
              <div
                className={`rounded-[20px] p-3.5 space-y-2 ${
                  style === "glass"
                    ? "glass-frosted"
                    : "border border-white/20 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    <Dumbbell className="h-3 w-3 text-white" />
                    Treinos
                  </span>
                  {sessionCount > 0 && (
                    <span className="text-[10px] text-zinc-400 tabular-nums">
                      {formatMinutesHuman(recap.workoutSummary.totalMinutes)}
                    </span>
                  )}
                </div>

                <p className="text-base font-semibold text-white leading-snug">
                  {workoutLine}
                </p>

                {recap.activities.length > 0 ? (
                  <div className="space-y-1">
                    {recap.activities.slice(0, 3).map((act) => (
                      <div
                        key={act.uid}
                        className="flex items-center justify-between text-[11px] tabular-nums"
                      >
                        <span className="text-zinc-200 truncate pr-2">
                          •{" "}
                          {act.source === "run" && act.distanceKm
                            ? `Corrida (${formatKm(act.distanceKm)} km)`
                            : `${act.title} (${act.durationMin}m)`}
                        </span>
                        <span className="text-zinc-400 shrink-0">
                          {act.caloriesBurned} kcal
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    Recuperação para voltar mais forte.
                  </p>
                )}
              </div>

              {/* Compact Bottom Badges Strip */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-2 text-center">
                  <span className="block text-[8.5px] uppercase tracking-wider text-zinc-500">
                    Refeições
                  </span>
                  <span className="text-[11px] font-medium text-white tabular-nums">
                    {recap.mealsRecordedCount}/4
                  </span>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-2 text-center">
                  <span className="block text-[8.5px] uppercase tracking-wider text-zinc-500">
                    Diário
                  </span>
                  <span className="text-[11px] font-medium text-white">
                    {recap.hasDiary ? "Escrito ✓" : "—"}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/[0.04] px-2 py-2 text-center">
                  <span className="block text-[8.5px] uppercase tracking-wider text-zinc-500">
                    Saldo
                  </span>
                  <span className="text-[11px] font-medium text-white tabular-nums">
                    {recap.netCalories > 0 ? "+" : ""}
                    {recap.netCalories}
                  </span>
                </div>
              </div>
            </div>

            {/* Story Footer Signature */}
            <div className="relative z-10 text-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.26em] text-zinc-500">
                MY APP · STORY 9:16
              </span>
            </div>
          </div>
        </div>

        {/* Save & Share Actions */}
        <GlassCard variant="frosted" className="p-3 space-y-2 !rounded-[24px]">
          {feedback && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-white pb-0.5">
              <Check className="h-3.5 w-3.5" />
              <span>{feedback}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <GlassButton
              type="button"
              disabled={exporting}
              onClick={handleSavePng}
              className="py-3 text-xs font-medium"
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? "Gerando..." : "Salvar PNG"}</span>
            </GlassButton>

            <GlassButton
              type="button"
              active
              disabled={exporting}
              onClick={handleShareStory}
              className="py-3 text-xs font-medium"
            >
              <Share2 className="h-4 w-4" />
              <span>Postar Story</span>
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
