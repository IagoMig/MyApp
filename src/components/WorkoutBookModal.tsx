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
  Footprints,
  Dumbbell,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  getWeekBounds,
  shiftWeekDateKey,
  shiftMonthKey,
  formatMonthYearPt,
  formatLongDatePt,
  formatWeekRangePt,
  formatShortDatePt,
} from "@/lib/db";
import {
  mergeWorkoutsAndRuns,
  summarizeUnifiedWorkouts,
  formatMinutesHuman,
} from "@/lib/workouts";
import { formatKm } from "@/lib/running";

export type WorkoutBookPeriod = "week" | "month";

interface WorkoutBookModalProps {
  open: boolean;
  initialPeriod: WorkoutBookPeriod;
  initialDateKey: string;
  initialMonthKey: string;
  onClose: () => void;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function WorkoutBookModal({
  open,
  initialPeriod,
  initialDateKey,
  initialMonthKey,
  onClose,
}: WorkoutBookModalProps) {
  const [period, setPeriod] = useState<WorkoutBookPeriod>(initialPeriod);
  const [anchorDate, setAnchorDate] = useState(initialDateKey);
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [edition, setEdition] = useState<"dark" | "paper">("paper");
  const [customTitle, setCustomTitle] = useState("");

  useEffect(() => {
    if (open) {
      setPeriod(initialPeriod);
      setAnchorDate(initialDateKey);
      setMonthKey(initialMonthKey);
    }
  }, [open, initialPeriod, initialDateKey, initialMonthKey]);

  const weekBounds = useMemo(() => getWeekBounds(anchorDate), [anchorDate]);

  const metaKey =
    period === "week"
      ? `workouts:week:${weekBounds.weekKey}`
      : `workouts:month:${monthKey}`;

  const defaultCoverTitle =
    period === "week"
      ? `Semana ${weekBounds.weekKey.split("-W")[1]}`
      : formatMonthYearPt(monthKey);

  const periodSubtitle =
    period === "week"
      ? formatWeekRangePt(weekBounds.startDate, weekBounds.endDate)
      : formatMonthYearPt(monthKey);

  const allWorkouts = useLiveQuery(() => db.workouts.toArray(), []);
  const allRuns = useLiveQuery(() => db.runs.toArray(), []);
  const meta = useLiveQuery(() => db.bookMeta.get(metaKey), [metaKey]);

  useEffect(() => {
    setCustomTitle(meta?.customTitle ?? defaultCoverTitle);
  }, [meta, defaultCoverTitle]);

  const periodEntries = useMemo(() => {
    const merged = mergeWorkoutsAndRuns(allWorkouts ?? [], allRuns ?? []);
    const filtered =
      period === "week"
        ? merged.filter(
            (e) =>
              e.date >= weekBounds.startDate && e.date <= weekBounds.endDate
          )
        : merged.filter((e) => e.monthKey === monthKey);
    // Chronological order for book reading
    return [...filtered].reverse();
  }, [allWorkouts, allRuns, period, weekBounds, monthKey]);

  const summary = useMemo(
    () => summarizeUnifiedWorkouts(periodEntries),
    [periodEntries]
  );

  if (!open) return null;

  const saveCustomTitle = async (val: string) => {
    setCustomTitle(val);
    await db.bookMeta.put({
      monthKey: metaKey,
      customTitle: val,
      updatedAt: Date.now(),
    });
  };

  const handlePrev = () => {
    if (period === "week") {
      setAnchorDate((d) => shiftWeekDateKey(d, -1));
    } else {
      setMonthKey((m) => shiftMonthKey(m, -1));
    }
  };

  const handleNext = () => {
    if (period === "week") {
      setAnchorDate((d) => shiftWeekDateKey(d, 1));
    } else {
      setMonthKey((m) => shiftMonthKey(m, 1));
    }
  };

  const handleExportPdf = () => {
    const isDark = edition === "dark";
    const bg = isDark ? "#050505" : "#ffffff";
    const fg = isDark ? "#f4f4f5" : "#18181b";
    const muted = isDark ? "#a1a1aa" : "#71717a";
    const border = isDark ? "rgba(255,255,255,0.14)" : "#e4e4e7";
    const cardBg = isDark ? "rgba(255,255,255,0.04)" : "#fafafa";
    const bookTitle = customTitle.trim() || defaultCoverTitle;

    const breakdownHtml = summary.breakdown
      .map(
        (m) => `
          <div class="row">
            <div>
              <strong>${escapeHtml(m.label)}</strong>
              <span class="muted"> · ${m.count}x · ${escapeHtml(formatMinutesHuman(m.minutes))}</span>
            </div>
            <div><strong>${m.calories.toLocaleString("pt-BR")} kcal</strong> <span class="muted">(${m.pctCalories}%)</span></div>
          </div>
        `
      )
      .join("\n");

    const entriesHtml = periodEntries
      .map(
        (item, idx) => `
          <section class="entry">
            <div class="meta">${String(idx + 1).padStart(2, "0")} · ${escapeHtml(
              formatLongDatePt(item.date)
            )}${item.source === "run" ? " · CORRIDA AUTOMÁTICA" : ""}</div>
            <div class="entry-head">
              <h3>${escapeHtml(item.title)}</h3>
              <span class="kcal">${item.caloriesBurned.toLocaleString("pt-BR")} kcal</span>
            </div>
            <div class="sub">${escapeHtml(item.subtitle)}</div>
            ${
              item.notes
                ? `<p class="notes">${escapeHtml(item.notes)}</p>`
                : ""
            }
          </section>
        `
      )
      .join("\n");

    const coverStats = [
      `${summary.totalSessions} ${summary.totalSessions === 1 ? "treino" : "treinos"}`,
      formatMinutesHuman(summary.totalMinutes),
      `${summary.totalCalories.toLocaleString("pt-BR")} kcal`,
      summary.totalRunKm > 0 ? `${formatKm(summary.totalRunKm)} km` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const docHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bookTitle)} — Treinos · My App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A5; margin: 16mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${bg}; color: ${fg}; font-family: 'Inter', sans-serif; }
    .cover {
      min-height: 90vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      border: 1px solid ${border};
      padding: 44px 28px;
      page-break-after: always;
    }
    .brand { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: ${muted}; margin-bottom: 18px; }
    .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600; margin: 0 0 10px; }
    .period { font-size: 13px; color: ${muted}; margin-bottom: 24px; }
    .stats-line { font-size: 12px; color: ${fg}; padding: 10px 18px; border: 1px solid ${border}; border-radius: 999px; }
    .section-title { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: ${muted}; margin: 20px 0 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
    .stat-box { background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 12px 14px; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: ${muted}; }
    .stat-val { font-size: 20px; font-weight: 300; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid ${border}; font-size: 12px; }
    .muted { color: ${muted}; }
    .entry { padding: 14px 0; border-bottom: 1px solid ${border}; break-inside: avoid; }
    .entry:last-child { border-bottom: none; }
    .meta { font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: ${muted}; margin-bottom: 4px; }
    .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .entry h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; margin: 0; }
    .kcal { font-size: 13px; font-weight: 600; }
    .sub { font-size: 12px; color: ${muted}; margin-top: 4px; }
    .notes { font-size: 12px; margin: 6px 0 0; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">My App · Livro de Treinos</div>
    <h1>${escapeHtml(bookTitle)}</h1>
    <div class="period">${escapeHtml(periodSubtitle)}</div>
    <div class="stats-line">${escapeHtml(coverStats)}</div>
  </div>
  <div class="section-title">01 · Resumo de resultados</div>
  <div class="grid">
    <div class="stat-box"><div class="stat-label">Sessões</div><div class="stat-val">${summary.totalSessions}</div></div>
    <div class="stat-box"><div class="stat-label">Tempo ativo</div><div class="stat-val">${escapeHtml(formatMinutesHuman(summary.totalMinutes))}</div></div>
    <div class="stat-box"><div class="stat-label">Calorias</div><div class="stat-val">${summary.totalCalories.toLocaleString("pt-BR")} kcal</div></div>
    <div class="stat-box"><div class="stat-label">Dias ativos</div><div class="stat-val">${summary.activeDays}</div></div>
  </div>
  ${breakdownHtml}
  <div class="section-title" style="margin-top:26px;">02 · Diário de treinos</div>
  ${entriesHtml}
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 450);
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
    a.download = `livro-treinos-${period === "week" ? weekBounds.weekKey : monthKey}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl p-3"
      onClick={onClose}
    >
      <GlassCard
        variant="frosted"
        className="flex max-h-[88dvh] w-full max-w-[440px] flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar: Period Toggle + Switcher */}
        <div className="space-y-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <GlassButton
                type="button"
                active={period === "week"}
                onClick={() => setPeriod("week")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                Semanal
              </GlassButton>
              <GlassButton
                type="button"
                active={period === "month"}
                onClick={() => setPeriod("month")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                Mensal
              </GlassButton>
            </div>

            <GlassButton
              type="button"
              onClick={onClose}
              aria-label="Fechar livro de treinos"
              className="h-9 w-9 !rounded-full p-0"
            >
              <X className="h-4 w-4" />
            </GlassButton>
          </div>

          <div className="flex items-center justify-between">
            <GlassButton
              type="button"
              onClick={handlePrev}
              aria-label="Período anterior"
              className="h-8 w-8 !rounded-full p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </GlassButton>
            <span className="text-xs font-medium text-white">
              {period === "week"
                ? `Sem ${weekBounds.weekKey.split("-W")[1]} · ${periodSubtitle}`
                : periodSubtitle}
            </span>
            <GlassButton
              type="button"
              onClick={handleNext}
              aria-label="Próximo período"
              className="h-8 w-8 !rounded-full p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </GlassButton>
          </div>
        </div>

        {/* Scrollable Book Pages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7 no-scrollbar">
          {/* Editable Book Cover */}
          <div className="glass-obsidian rounded-[24px] p-6 text-center space-y-3">
            <span className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              Livro de Treinos · {period === "week" ? "Semanal" : "Mensal"}
            </span>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => saveCustomTitle(e.target.value)}
              placeholder={defaultCoverTitle}
              style={{ fontFamily: "var(--font-playfair), serif" }}
              className="w-full bg-transparent text-center text-2xl font-semibold text-white placeholder-zinc-500 outline-none"
            />
            <div className="text-xs text-zinc-400 tabular-nums">
              {summary.totalSessions}{" "}
              {summary.totalSessions === 1 ? "treino" : "treinos"} ·{" "}
              {formatMinutesHuman(summary.totalMinutes)} ·{" "}
              {summary.totalCalories.toLocaleString("pt-BR")} kcal
              {summary.totalRunKm > 0
                ? ` · ${formatKm(summary.totalRunKm)} km`
                : ""}
            </div>
          </div>

          {periodEntries.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">
              Nenhum treino ou corrida registrado neste período.
            </p>
          ) : (
            <>
              {/* Chapter 1: Results Summary */}
              <section className="space-y-3.5 border-t border-white/10 pt-5">
                <span className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  01 · Resultados
                </span>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="glass-obsidian rounded-2xl p-3.5">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Calorias queimadas
                    </span>
                    <span className="mt-1 block text-xl font-light text-white tabular-nums">
                      {summary.totalCalories.toLocaleString("pt-BR")}{" "}
                      <span className="text-xs text-zinc-400">kcal</span>
                    </span>
                  </div>
                  <div className="glass-obsidian rounded-2xl p-3.5">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Tempo ativo
                    </span>
                    <span className="mt-1 block text-xl font-light text-white tabular-nums">
                      {formatMinutesHuman(summary.totalMinutes)}
                    </span>
                  </div>
                  <div className="glass-obsidian rounded-2xl p-3.5">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Dias ativos
                    </span>
                    <span className="mt-1 block text-xl font-light text-white tabular-nums">
                      {summary.activeDays}{" "}
                      <span className="text-xs text-zinc-400">
                        {summary.activeDays === 1 ? "dia" : "dias"}
                      </span>
                    </span>
                  </div>
                  <div className="glass-obsidian rounded-2xl p-3.5">
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500">
                      Corrida (auto)
                    </span>
                    <span className="mt-1 block text-xl font-light text-white tabular-nums">
                      {summary.totalRunKm > 0
                        ? `${formatKm(summary.totalRunKm)} km`
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Breakdown by modality */}
                <div className="space-y-2.5 pt-1">
                  {summary.breakdown.map((mod) => (
                    <div key={mod.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-zinc-200 font-medium">
                          {mod.label}{" "}
                          <span className="text-zinc-500 font-normal">
                            · {mod.count}x · {formatMinutesHuman(mod.minutes)}
                          </span>
                        </span>
                        <span className="text-white">
                          {mod.calories.toLocaleString("pt-BR")} kcal
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-white/85"
                          style={{ width: `${Math.max(4, mod.pctCalories)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Chapter 2: Chronological Workout Log */}
              <section className="space-y-3 border-t border-white/10 pt-5">
                <span className="block text-[11px] uppercase tracking-[0.18em] text-zinc-400">
                  02 · Registro de treinos
                </span>

                <div className="space-y-3">
                  {periodEntries.map((item, idx) => (
                    <article
                      key={item.uid}
                      className="glass-obsidian rounded-2xl p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="uppercase tracking-[0.12em]">
                          {String(idx + 1).padStart(2, "0")} ·{" "}
                          {formatShortDatePt(item.date)}
                        </span>
                        {item.source === "run" && (
                          <span className="glass-pill rounded-full px-2 py-0.5 text-[10px] text-zinc-200">
                            Automático
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.source === "run" ? (
                            <Footprints className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                          ) : (
                            <Dumbbell className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                          )}
                          <h3
                            className="text-base font-medium text-white truncate"
                            style={{ fontFamily: "var(--font-playfair), serif" }}
                          >
                            {item.title}
                          </h3>
                        </div>
                        <span className="text-xs font-medium text-white tabular-nums shrink-0">
                          {item.caloriesBurned} kcal
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 tabular-nums">
                        {item.subtitle}
                      </p>
                      {item.notes && (
                        <p className="text-xs text-zinc-300/90 pt-0.5">
                          {item.notes}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer Export Bar */}
        <div className="flex items-center justify-between gap-2.5 border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-1.5">
            <GlassButton
              type="button"
              active={edition === "paper"}
              onClick={() => setEdition("paper")}
              aria-label="PDF claro"
              className="h-10 px-3 text-xs"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Claro</span>
            </GlassButton>
            <GlassButton
              type="button"
              active={edition === "dark"}
              onClick={() => setEdition("dark")}
              aria-label="PDF escuro"
              className="h-10 px-3 text-xs"
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Escuro</span>
            </GlassButton>
          </div>

          <GlassButton
            type="button"
            active
            disabled={periodEntries.length === 0}
            onClick={handleExportPdf}
            className="h-10 px-4 text-xs font-medium"
          >
            <FileDown className="h-4 w-4" />
            <span>Exportar PDF</span>
          </GlassButton>
        </div>
      </GlassCard>
    </div>
  );
}
