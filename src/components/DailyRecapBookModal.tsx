"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  X,
  FileDown,
  Sun,
  Moon,
  Eye,
  EyeOff,
  BookOpen,
  Layers,
  Droplets,
  Utensils,
  Dumbbell,
  Footprints,
  Scale,
  Camera,
  Flame,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { CaloriePieChart } from "./CaloriePieChart";
import {
  db,
  DEFAULT_SETTINGS,
  getDateKey,
  getMonthKey,
  shiftDateKey,
  shiftMonthKey,
  formatLongDatePt,
  formatShortDatePt,
  formatMonthYearPt,
  formatWeightKg,
  sanitizeDiaryHtml,
  type PhotoAngle,
  type WaterLog,
  type MealLog,
  type WorkoutSession,
  type RunSession,
  type DiaryEntry,
  type WeightLog,
  type ProgressPhoto,
} from "@/lib/db";
import {
  buildDailyRecap,
  formatLitersPt,
  formatWeekdayYearPt,
  type DailyRecapData,
} from "@/lib/recap";
import { formatMinutesHuman } from "@/lib/workouts";
import { formatKm } from "@/lib/running";
import { getFontCss, getFontSizePx } from "@/lib/fonts";

interface DailyRecapBookModalProps {
  open: boolean;
  initialDateKey: string;
  onClose: () => void;
}

const ANGLE_LABEL: Record<PhotoAngle, string> = {
  frente: "Frente",
  lado: "Lado",
  costas: "Costas",
};

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function DailyRecapBookModal({
  open,
  initialDateKey,
  onClose,
}: DailyRecapBookModalProps) {
  const [todayKey] = useState(() => getDateKey());
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const [selectedDate, setSelectedDate] = useState(initialDateKey);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(initialDateKey));
  const [blurred, setBlurred] = useState(false);
  const [edition, setEdition] = useState<"dark" | "paper">("paper");
  const [customTitle, setCustomTitle] = useState("");

  useEffect(() => {
    if (open) {
      setSelectedDate(initialDateKey);
      setMonthKey(getMonthKey(initialDateKey));
    }
  }, [open, initialDateKey]);

  const metaKey = `recap:month:${monthKey}`;

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const allWater = useLiveQuery(() => db.waterLogs.toArray(), []);
  const allMeals = useLiveQuery(() => db.mealLogs.toArray(), []);
  const allWorkouts = useLiveQuery(() => db.workouts.toArray(), []);
  const allRuns = useLiveQuery(() => db.runs.toArray(), []);
  const allDiary = useLiveQuery(() => db.diaryEntries.toArray(), []);
  const allWeights = useLiveQuery(() => db.weightLogs.toArray(), []);
  const allPhotos = useLiveQuery(() => db.progressPhotos.toArray(), []);
  const meta = useLiveQuery(() => db.bookMeta.get(metaKey), [metaKey]);

  useEffect(() => {
    setCustomTitle(
      meta?.customTitle ?? `Retrospectiva · ${formatMonthYearPt(monthKey)}`
    );
  }, [meta, monthKey]);

  // Index all records by dateKey for fast daily and monthly assembly
  const byDateMaps = useMemo(() => {
    const water = new Map<string, WaterLog[]>();
    const meals = new Map<string, MealLog[]>();
    const workouts = new Map<string, WorkoutSession[]>();
    const runs = new Map<string, RunSession[]>();
    const diary = new Map<string, DiaryEntry>();
    const weight = new Map<string, WeightLog>();
    const photos = new Map<string, ProgressPhoto[]>();
    const allDates = new Set<string>();

    for (const w of allWater ?? []) {
      const arr = water.get(w.date) ?? [];
      arr.push(w);
      water.set(w.date, arr);
      allDates.add(w.date);
    }
    for (const m of allMeals ?? []) {
      const arr = meals.get(m.date) ?? [];
      arr.push(m);
      meals.set(m.date, arr);
      if (m.isFasting || m.totalKcal > 0 || m.items.length > 0) {
        allDates.add(m.date);
      }
    }
    for (const w of allWorkouts ?? []) {
      const arr = workouts.get(w.date) ?? [];
      arr.push(w);
      workouts.set(w.date, arr);
      allDates.add(w.date);
    }
    for (const r of allRuns ?? []) {
      const arr = runs.get(r.date) ?? [];
      arr.push(r);
      runs.set(r.date, arr);
      allDates.add(r.date);
    }
    for (const d of allDiary ?? []) {
      diary.set(d.date, d);
      if (d.title.trim() || d.plainText.trim()) {
        allDates.add(d.date);
      }
    }
    for (const wl of allWeights ?? []) {
      weight.set(wl.date, wl);
      allDates.add(wl.date);
    }
    for (const p of allPhotos ?? []) {
      const arr = photos.get(p.date) ?? [];
      arr.push(p);
      photos.set(p.date, arr);
      allDates.add(p.date);
    }

    return { water, meals, workouts, runs, diary, weight, photos, allDates };
  }, [
    allWater,
    allMeals,
    allWorkouts,
    allRuns,
    allDiary,
    allWeights,
    allPhotos,
  ]);

  const assembleDay = (dateKey: string): DailyRecapData =>
    buildDailyRecap({
      date: dateKey,
      settings,
      waterLogs: byDateMaps.water.get(dateKey) ?? [],
      mealLogs: byDateMaps.meals.get(dateKey) ?? [],
      workouts: byDateMaps.workouts.get(dateKey) ?? [],
      runs: byDateMaps.runs.get(dateKey) ?? [],
      diary: byDateMaps.diary.get(dateKey),
      weightLog: byDateMaps.weight.get(dateKey),
      photos: byDateMaps.photos.get(dateKey) ?? [],
    });

  const activeDayRecap = useMemo(
    () => assembleDay(selectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, byDateMaps, settings]
  );

  // All recorded dates in the currently selected month (chronological)
  const monthRecaps = useMemo(() => {
    const dates = Array.from(byDateMaps.allDates)
      .filter((d) => getMonthKey(d) === monthKey)
      .sort((a, b) => a.localeCompare(b));
    return dates.map((d) => assembleDay(d)).filter((r) => r.hasAnyData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byDateMaps, monthKey, settings]);

  // Quick recent recorded dates for day-strip jumping
  const recentRecordedDates = useMemo(() => {
    return Array.from(byDateMaps.allDates)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, 14);
  }, [byDateMaps.allDates]);

  const monthTotals = useMemo(() => {
    return monthRecaps.reduce(
      (acc, r) => {
        acc.waterMl += r.waterMl;
        acc.consumed += r.caloriesConsumed;
        acc.burned += r.caloriesBurned;
        acc.sessions += r.workoutSummary.totalSessions;
        acc.runKm += r.workoutSummary.totalRunKm;
        acc.photos += r.photos.length;
        acc.diaries += r.hasDiary ? 1 : 0;
        return acc;
      },
      {
        waterMl: 0,
        consumed: 0,
        burned: 0,
        sessions: 0,
        runKm: 0,
        photos: 0,
        diaries: 0,
      }
    );
  }, [monthRecaps]);

  if (!open) return null;

  const activeSettings = settings ?? DEFAULT_SETTINGS;

  const saveCustomTitle = async (val: string) => {
    setCustomTitle(val);
    await db.bookMeta.put({
      monthKey: metaKey,
      customTitle: val,
      updatedAt: Date.now(),
    });
  };

  const handleExportPdf = () => {
    const isDark = edition === "dark";
    const bg = isDark ? "#050505" : "#ffffff";
    const fg = isDark ? "#f4f4f5" : "#18181b";
    const muted = isDark ? "#a1a1aa" : "#71717a";
    const border = isDark ? "rgba(255,255,255,0.14)" : "#e4e4e7";
    const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#fafafa";

    const pagesToPrint =
      viewMode === "day" ? [activeDayRecap] : monthRecaps;
    const bookTitle =
      viewMode === "day"
        ? `Retrospectiva · ${formatLongDatePt(activeDayRecap.date)}`
        : customTitle.trim() || formatMonthYearPt(monthKey);

    const chaptersHtml = pagesToPrint
      .map((recap, idx) => {
        const mealsHtml = recap.mealLogs
          .filter((m) => m.isFasting || m.items.length > 0 || m.totalKcal > 0)
          .map((m) => {
            const slotName =
              recap.mealSlots[m.slotIndex] || `Refeição ${m.slotIndex + 1}`;
            if (m.isFasting) {
              return `<div class="row"><strong>${escapeHtml(slotName)}</strong><span class="muted">Jejum</span></div>`;
            }
            const itemsLine = m.items
              .map((i) => `${escapeHtml(i.name)} (${i.grams}g · ${i.kcal} kcal)`)
              .join(", ");
            return `<div class="row"><div><strong>${escapeHtml(slotName)}</strong><div class="sub">${itemsLine}</div></div><strong>${m.totalKcal} kcal</strong></div>`;
          })
          .join("\n");

        const activitiesHtml = recap.activities
          .map(
            (a) =>
              `<div class="row"><div><strong>${escapeHtml(a.title)}</strong>${
                a.source === "run" ? ' <span class="tag">Automático</span>' : ""
              }<div class="sub">${escapeHtml(a.subtitle)}${
                a.notes ? ` · ${escapeHtml(a.notes)}` : ""
              }</div></div><strong>${a.caloriesBurned} kcal</strong></div>`
          )
          .join("\n");

        const diaryHtml =
          recap.hasDiary && recap.diary
            ? `<div class="block">
                <div class="block-title">Diário</div>
                ${
                  recap.diary.title
                    ? `<h4 class="diary-title">${escapeHtml(recap.diary.title)}</h4>`
                    : ""
                }
                <div class="diary-body">${sanitizeDiaryHtml(recap.diary.contentHtml)}</div>
              </div>`
            : "";

        const photosHtml =
          recap.photos.length > 0
            ? `<div class="block">
                <div class="block-title">Fotos do dia (${recap.photos.length})</div>
                <div class="photo-grid">
                  ${recap.photos
                    .map(
                      (p) =>
                        `<figure class="photo"><img src="${p.dataUrl}" alt="${escapeHtml(p.date)}" /><figcaption>${escapeHtml(
                          ANGLE_LABEL[p.angle]
                        )}${p.weightKg ? ` · ${formatWeightKg(p.weightKg)} kg` : ""}</figcaption></figure>`
                    )
                    .join("")}
                </div>
              </div>`
            : "";

        return `
          <section class="chapter">
            <div class="meta">${String(idx + 1).padStart(2, "0")} · ${escapeHtml(
              formatWeekdayYearPt(recap.date)
            )}</div>
            <h2>${escapeHtml(formatLongDatePt(recap.date))}</h2>
            <div class="grid">
              <div class="stat"><div class="stat-l">Água</div><div class="stat-v">${formatLitersPt(recap.waterMl)} L (${recap.waterPct}%)</div></div>
              <div class="stat"><div class="stat-l">Consumidas</div><div class="stat-v">${recap.caloriesConsumed.toLocaleString("pt-BR")} kcal</div></div>
              <div class="stat"><div class="stat-l">Gastadas</div><div class="stat-v">${recap.caloriesBurned.toLocaleString("pt-BR")} kcal</div></div>
              <div class="stat"><div class="stat-l">Treinos</div><div class="stat-v">${recap.workoutSummary.totalSessions} · ${escapeHtml(
                formatMinutesHuman(recap.workoutSummary.totalMinutes)
              )}</div></div>
            </div>
            ${
              recap.weightLog
                ? `<div class="block"><div class="block-title">Peso registrado</div><div class="row"><strong>${formatWeightKg(
                    recap.weightLog.weightKg
                  )} kg</strong><span class="muted">${escapeHtml(
                    recap.weightLog.note || "Pesagem registrada"
                  )}</span></div></div>`
                : ""
            }
            ${
              mealsHtml
                ? `<div class="block"><div class="block-title">Refeições</div>${mealsHtml}</div>`
                : ""
            }
            ${
              activitiesHtml
                ? `<div class="block"><div class="block-title">Treinos & Corridas</div>${activitiesHtml}</div>`
                : ""
            }
            ${diaryHtml}
            ${photosHtml}
          </section>
        `;
      })
      .join("\n");

    const docHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bookTitle)} — My App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A5; margin: 14mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${bg}; color: ${fg}; font-family: 'Inter', sans-serif; }
    .cover { min-height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border: 1px solid ${border}; padding: 40px 26px; page-break-after: always; }
    .brand { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: ${muted}; margin-bottom: 18px; }
    .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 30px; margin: 0 0 12px; }
    .cover .sub { font-size: 12px; color: ${muted}; }
    .chapter { padding: 12px 0 24px; page-break-after: always; }
    .chapter:last-child { page-break-after: auto; }
    .meta { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: ${muted}; }
    .chapter h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 4px 0 14px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 14px; }
    .stat { background: ${cardBg}; border: 1px solid ${border}; border-radius: 12px; padding: 10px 12px; }
    .stat-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.14em; color: ${muted}; }
    .stat-v { font-size: 15px; font-weight: 500; margin-top: 4px; }
    .block { margin-top: 14px; padding-top: 10px; border-top: 1px solid ${border}; }
    .block-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: ${muted}; margin-bottom: 8px; }
    .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 5px 0; font-size: 12px; }
    .sub { font-size: 11px; color: ${muted}; margin-top: 2px; }
    .muted { color: ${muted}; }
    .tag { font-size: 9px; border: 1px solid ${border}; border-radius: 999px; padding: 1px 6px; margin-left: 4px; }
    .diary-title { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; margin: 0 0 6px; }
    .diary-body { font-family: 'Lora', Georgia, serif; font-size: 13px; line-height: 1.75; }
    .photo-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .photo { margin: 0; border: 1px solid ${border}; border-radius: 12px; overflow: hidden; break-inside: avoid; }
    .photo img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; }
    .photo figcaption { padding: 6px 8px; font-size: 10px; color: ${muted}; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">My App · Livro de Retrospectiva Diária</div>
    <h1>${escapeHtml(bookTitle)}</h1>
    <div class="sub">${pagesToPrint.length} ${pagesToPrint.length === 1 ? "dia completo" : "dias completos"}</div>
  </div>
  ${chaptersHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(docHtml);
      printWin.document.close();
      return;
    }

    const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livro-retrospectiva-${viewMode === "day" ? selectedDate : monthKey}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderCompleteDay = (recap: DailyRecapData, chapterNum?: number) => {
    const filledMeals = recap.mealLogs.filter(
      (m) => m.isFasting || m.items.length > 0 || m.totalKcal > 0
    );

    return (
      <article
        key={recap.date}
        className="space-y-5 border-t border-white/10 pt-5 first:border-t-0 first:pt-0"
      >
        {/* Chapter Title */}
        <div className="space-y-1">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            {chapterNum !== undefined
              ? `Dia ${String(chapterNum).padStart(2, "0")} · `
              : ""}
            {formatWeekdayYearPt(recap.date)}
          </span>
          <h3
            className="text-2xl font-semibold text-white"
            style={{ fontFamily: "var(--font-playfair), serif" }}
          >
            {formatLongDatePt(recap.date)}
          </h3>
        </div>

        {!recap.hasAnyData ? (
          <div className="glass-obsidian rounded-[22px] p-6 text-center text-sm text-zinc-400">
            Nenhum dado registrado neste dia.
          </div>
        ) : (
          <>
            {/* 1. Hydration */}
            <div className="glass-obsidian rounded-[22px] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-white">
                  <Droplets className="h-3.5 w-3.5" />
                  Água
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {formatLitersPt(recap.waterMl)} L /{" "}
                  {(recap.waterGoalMl / 1000).toFixed(1).replace(".", ",")} L (
                  {recap.waterPct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-zinc-300 to-white"
                  style={{ width: `${recap.waterPct}%` }}
                />
              </div>
            </div>

            {/* 2. Calories Pie Chart (Consumed x Burned) */}
            <div className="glass-obsidian rounded-[22px] p-4 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                <Flame className="h-3.5 w-3.5" />
                Calorias · Consumidas × Gastadas
              </span>
              <CaloriePieChart
                consumed={recap.caloriesConsumed}
                burned={recap.caloriesBurned}
                mealsCount={recap.mealsRecordedCount}
                activitiesCount={recap.workoutSummary.totalSessions}
                compact
              />
            </div>

            {/* 3. Weight (if recorded on this day) */}
            {recap.weightLog && (
              <div className="glass-obsidian flex items-center justify-between rounded-[22px] px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Scale className="h-4 w-4 text-white" />
                  <div>
                    <span className="block text-xs font-medium text-white">
                      Peso registrado
                    </span>
                    {recap.weightLog.note && (
                      <span className="block text-[11px] text-zinc-400">
                        {recap.weightLog.note}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-base font-medium text-white tabular-nums">
                  {formatWeightKg(recap.weightLog.weightKg)} kg
                </span>
              </div>
            )}

            {/* 4. Meals Detailed */}
            {filledMeals.length > 0 && (
              <div className="glass-obsidian rounded-[22px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                    <Utensils className="h-3.5 w-3.5" />
                    Refeições ({filledMeals.length})
                  </span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {recap.caloriesConsumed.toLocaleString("pt-BR")} kcal
                  </span>
                </div>

                <div className="space-y-2.5">
                  {filledMeals.map((m) => {
                    const slotName =
                      activeSettings.mealSlots[m.slotIndex] ||
                      `Refeição ${m.slotIndex + 1}`;
                    return (
                      <div
                        key={m.id}
                        className="border-t border-white/[0.08] pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-200">
                            {slotName}
                          </span>
                          {m.isFasting ? (
                            <span className="glass-pill-active rounded-full px-2 py-0.5 text-[10px] font-medium">
                              Jejum
                            </span>
                          ) : (
                            <span className="text-white tabular-nums">
                              {m.totalKcal} kcal
                            </span>
                          )}
                        </div>
                        {!m.isFasting && m.items.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {m.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums"
                              >
                                <span className="truncate pr-2">
                                  • {item.name} ({item.grams}g)
                                </span>
                                <span className="shrink-0">
                                  {item.kcal} kcal
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Workouts & Auto-Synced Runs */}
            {recap.activities.length > 0 && (
              <div className="glass-obsidian rounded-[22px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                    <Dumbbell className="h-3.5 w-3.5" />
                    Treinos &amp; Corridas ({recap.activities.length})
                  </span>
                  <span className="text-xs text-zinc-400 tabular-nums">
                    {formatMinutesHuman(recap.workoutSummary.totalMinutes)} ·{" "}
                    {recap.caloriesBurned} kcal
                  </span>
                </div>

                <div className="space-y-2.5">
                  {recap.activities.map((act) => (
                    <div
                      key={act.uid}
                      className="flex items-start justify-between gap-2 border-t border-white/[0.08] pt-2.5 first:border-t-0 first:pt-0"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        {act.source === "run" ? (
                          <Footprints className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-300" />
                        ) : (
                          <Dumbbell className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-300" />
                        )}
                        <div className="min-w-0">
                          <span className="block text-xs font-medium text-white">
                            {act.title}
                            {act.source === "run" ? " · Automático" : ""}
                          </span>
                          <span className="block text-[11px] text-zinc-400 tabular-nums">
                            {act.subtitle}
                          </span>
                          {act.notes && (
                            <span className="block text-[11px] text-zinc-300 mt-0.5">
                              {act.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-white tabular-nums shrink-0">
                        {act.caloriesBurned} kcal
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Diary Entry */}
            {recap.hasDiary && recap.diary && (
              <div className="glass-obsidian rounded-[22px] p-4 space-y-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                  <BookOpen className="h-3.5 w-3.5" />
                  Diário
                </span>
                {recap.diary.title && (
                  <h4
                    className="text-lg font-semibold text-white"
                    style={{
                      fontFamily: getFontCss(recap.diary.fontFamily),
                      textAlign: recap.diary.textAlign,
                    }}
                  >
                    {recap.diary.title}
                  </h4>
                )}
                <div
                  className="diary-editor !min-h-0"
                  style={{
                    fontFamily: getFontCss(recap.diary.fontFamily),
                    fontSize: getFontSizePx(recap.diary.fontSize),
                    color: recap.diary.textColor,
                    textAlign: recap.diary.textAlign,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDiaryHtml(recap.diary.contentHtml),
                  }}
                />
              </div>
            )}

            {/* 7. Photos of the Day (ALL information included in the book) */}
            {recap.photos.length > 0 && (
              <div className="glass-obsidian rounded-[22px] p-4 space-y-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                  <Camera className="h-3.5 w-3.5" />
                  Fotos do dia ({recap.photos.length})
                </span>
                <div
                  className={`grid gap-2.5 ${
                    recap.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  }`}
                >
                  {recap.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="relative aspect-[3/4] overflow-hidden rounded-[16px] border border-white/10 bg-black"
                    >
                      <img
                        src={photo.dataUrl}
                        alt={`${ANGLE_LABEL[photo.angle]} ${photo.date}`}
                        className={`h-full w-full object-cover transition-all duration-300 ${
                          blurred ? "blur-2xl scale-110" : ""
                        }`}
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pt-6 pb-2">
                        <span className="block text-[11px] font-medium text-white">
                          {ANGLE_LABEL[photo.angle]}
                          {photo.weightKg
                            ? ` · ${formatWeightKg(photo.weightKg)} kg`
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </article>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 backdrop-blur-xl p-3"
      onClick={onClose}
    >
      <GlassCard
        variant="frosted"
        className="flex max-h-[90dvh] w-full max-w-[440px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="space-y-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <GlassButton
                type="button"
                active={viewMode === "day"}
                onClick={() => setViewMode("day")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Por dia</span>
              </GlassButton>
              <GlassButton
                type="button"
                active={viewMode === "month"}
                onClick={() => setViewMode("month")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Mês todo</span>
              </GlassButton>
            </div>

            <div className="flex items-center gap-1.5">
              <GlassButton
                type="button"
                active={blurred}
                onClick={() => setBlurred((b) => !b)}
                aria-label={blurred ? "Mostrar fotos" : "Ocultar fotos"}
                className="h-9 w-9 !rounded-full p-0"
              >
                {blurred ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </GlassButton>
              <GlassButton
                type="button"
                onClick={onClose}
                aria-label="Fechar livro de retrospectiva"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>

          {/* Date or Month Switcher */}
          {viewMode === "day" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <GlassButton
                  type="button"
                  onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
                  aria-label="Dia anterior"
                  className="h-8 w-8 !rounded-full p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </GlassButton>
                <span className="text-xs font-medium text-white">
                  {selectedDate === todayKey
                    ? `Hoje · ${formatShortDatePt(selectedDate)}`
                    : formatLongDatePt(selectedDate)}
                </span>
                <GlassButton
                  type="button"
                  disabled={selectedDate >= todayKey}
                  onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
                  aria-label="Próximo dia"
                  className="h-8 w-8 !rounded-full p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </GlassButton>
              </div>

              {recentRecordedDates.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {recentRecordedDates.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-medium shrink-0 cursor-pointer ${
                        selectedDate === d
                          ? "glass-pill-active"
                          : "glass-pill text-zinc-400"
                      }`}
                    >
                      {formatShortDatePt(d)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <GlassButton
                type="button"
                onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
                aria-label="Mês anterior"
                className="h-8 w-8 !rounded-full p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </GlassButton>
              <span className="text-xs font-medium text-white">
                {formatMonthYearPt(monthKey)}
              </span>
              <GlassButton
                type="button"
                onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
                aria-label="Próximo mês"
                className="h-8 w-8 !rounded-full p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </GlassButton>
            </div>
          )}
        </div>

        {/* Scrollable Book Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
          {viewMode === "day" ? (
            renderCompleteDay(activeDayRecap)
          ) : (
            <>
              {/* Editable Monthly Book Cover */}
              <div className="glass-obsidian rounded-[24px] p-6 text-center space-y-3">
                <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                  Livro de Retrospectiva Completa
                </span>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => saveCustomTitle(e.target.value)}
                  placeholder={formatMonthYearPt(monthKey)}
                  style={{ fontFamily: "var(--font-playfair), serif" }}
                  className="w-full bg-transparent text-center text-2xl font-semibold text-white placeholder-zinc-500 outline-none"
                />
                <p className="text-xs text-zinc-400 tabular-nums">
                  {monthRecaps.length}{" "}
                  {monthRecaps.length === 1 ? "dia" : "dias"} ·{" "}
                  {formatLitersPt(monthTotals.waterMl)} L água ·{" "}
                  {monthTotals.burned.toLocaleString("pt-BR")} kcal gastas
                  {monthTotals.runKm > 0
                    ? ` · ${formatKm(monthTotals.runKm)} km`
                    : ""}
                </p>
              </div>

              {monthRecaps.length === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-400">
                  Nenhum registro encontrado neste mês.
                </p>
              ) : (
                monthRecaps.map((recap, idx) =>
                  renderCompleteDay(recap, idx + 1)
                )
              )}
            </>
          )}
        </div>

        {/* Footer PDF Export Bar */}
        <div className="flex items-center justify-between gap-2.5 border-t border-white/10 px-5 py-3.5">
          <div className="flex items-center gap-1.5">
            <GlassButton
              type="button"
              active={edition === "paper"}
              onClick={() => setEdition("paper")}
              aria-label="PDF claro"
              className="h-9 px-3 text-xs"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Claro</span>
            </GlassButton>
            <GlassButton
              type="button"
              active={edition === "dark"}
              onClick={() => setEdition("dark")}
              aria-label="PDF escuro"
              className="h-9 px-3 text-xs"
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Escuro</span>
            </GlassButton>
          </div>

          <GlassButton
            type="button"
            active
            disabled={
              viewMode === "day"
                ? !activeDayRecap.hasAnyData
                : monthRecaps.length === 0
            }
            onClick={handleExportPdf}
            className="h-9 px-4 text-xs font-medium"
          >
            <FileDown className="h-4 w-4" />
            <span>Exportar PDF</span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
