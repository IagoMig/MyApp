"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  X,
  FileDown,
  Sun,
  Moon,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  shiftMonthKey,
  formatMonthYearPt,
  formatLongDatePt,
  sanitizeDiaryHtml,
  type DiaryEntry,
} from "@/lib/db";
import { getFontCss, getFontSizePx, type DiaryFontId } from "@/lib/fonts";

interface MonthlyBookModalProps {
  open: boolean;
  initialMonthKey: string;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
}

const PRINT_FONT_FAMILY: Record<DiaryFontId, string> = {
  inter: "'Inter', sans-serif",
  lora: "'Lora', Georgia, serif",
  playfair: "'Playfair Display', Georgia, serif",
  space: "'Space Grotesk', sans-serif",
  mono: "'JetBrains Mono', monospace",
  caveat: "'Caveat', cursive",
};

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function MonthlyBookModal({
  open,
  initialMonthKey,
  onClose,
  onSelectDate,
}: MonthlyBookModalProps) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [edition, setEdition] = useState<"dark" | "paper">("paper");
  const [customTitle, setCustomTitle] = useState("");

  useEffect(() => {
    if (open) setMonthKey(initialMonthKey);
  }, [open, initialMonthKey]);

  const entries = useLiveQuery(
    () => db.diaryEntries.where("monthKey").equals(monthKey).sortBy("date"),
    [monthKey]
  );
  const runs = useLiveQuery(
    () => db.runs.where("monthKey").equals(monthKey).toArray(),
    [monthKey]
  );
  const meta = useLiveQuery(() => db.bookMeta.get(monthKey), [monthKey]);

  useEffect(() => {
    setCustomTitle(meta?.customTitle ?? formatMonthYearPt(monthKey));
  }, [meta, monthKey]);

  if (!open) return null;

  const filledEntries: DiaryEntry[] = (entries ?? []).filter(
    (e) => e.title.trim() || e.plainText.trim()
  );
  const totalKm = (runs ?? []).reduce((s, r) => s + r.distanceKm, 0);

  const saveCustomTitle = async (val: string) => {
    setCustomTitle(val);
    await db.bookMeta.put({
      monthKey,
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
    const bookTitle = customTitle.trim() || formatMonthYearPt(monthKey);

    const chaptersHtml = filledEntries
      .map((entry, idx) => {
        const font = PRINT_FONT_FAMILY[entry.fontFamily] || "'Lora', serif";
        const size = getFontSizePx(entry.fontSize);
        const color = isDark ? entry.textColor : "#18181b";
        const safeBody = sanitizeDiaryHtml(entry.contentHtml);

        return `
          <section class="chapter">
            <div class="chapter-meta">${String(idx + 1).padStart(2, "0")} · ${escapeHtml(
              formatLongDatePt(entry.date)
            )}</div>
            ${
              entry.title
                ? `<h2 class="chapter-title" style="font-family:${font};color:${color};text-align:${entry.textAlign}">${escapeHtml(
                    entry.title
                  )}</h2>`
                : ""
            }
            <div class="chapter-body" style="font-family:${font};font-size:${size};color:${color};text-align:${entry.textAlign}">
              ${safeBody}
            </div>
          </section>
        `;
      })
      .join("\n");

    const statsLine = [
      `${filledEntries.length} ${filledEntries.length === 1 ? "página" : "páginas"}`,
      totalKm > 0 ? `${totalKm.toFixed(1).replace(".", ",")} km corridos` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const docHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bookTitle)} — My App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Inter:wght@300;400;600&family=JetBrains+Mono:wght@400&family=Lora:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Space+Grotesk:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    @page { size: A5; margin: 18mm 16mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${bg}; color: ${fg}; font-family: 'Lora', Georgia, serif; }
    .cover {
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      border: 1px solid ${border};
      padding: 48px 32px;
      page-break-after: always;
    }
    .brand { font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: ${muted}; margin-bottom: 24px; }
    .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 34px; font-weight: 600; margin: 0 0 18px; line-height: 1.2; }
    .cover .sub { font-family: 'Inter', sans-serif; font-size: 13px; color: ${muted}; }
    .chapter { padding: 20px 0 32px; border-bottom: 1px solid ${border}; break-inside: avoid-page; }
    .chapter:last-child { border-bottom: none; }
    .chapter-meta { font-family: 'Inter', sans-serif; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: ${muted}; margin-bottom: 10px; }
    .chapter-title { font-size: 22px; margin: 0 0 14px; line-height: 1.3; }
    .chapter-body { line-height: 1.8; }
    .chapter-body blockquote { border-left: 2px solid ${muted}; padding-left: 14px; margin: 12px 0; font-style: italic; opacity: 0.85; }
    .chapter-body ul, .chapter-body ol { padding-left: 22px; }
    .chapter-body hr { border: none; border-top: 1px solid ${border}; margin: 18px 0; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">My App</div>
    <h1>${escapeHtml(bookTitle)}</h1>
    <div class="sub">${escapeHtml(statsLine)}</div>
  </div>
  ${chaptersHtml}
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

    // Fallback if popup blocked: download standalone HTML book file
    const blob = new Blob([docHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `livro-${monthKey}.html`;
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
        {/* Top Bar with Month Switcher */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-1.5">
            <GlassButton
              type="button"
              onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
              aria-label="Mês anterior"
              className="h-8 w-8 !rounded-full p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </GlassButton>
            <span className="px-2 text-sm font-medium text-white">
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

          <GlassButton
            type="button"
            onClick={onClose}
            aria-label="Fechar livro"
            className="h-9 w-9 !rounded-full p-0"
          >
            <X className="h-4 w-4" />
          </GlassButton>
        </div>

        {/* Scrollable Book Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          {/* Editable Book Cover */}
          <div className="glass-obsidian rounded-[24px] p-7 text-center space-y-3">
            <span className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
              My App
            </span>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => saveCustomTitle(e.target.value)}
              placeholder={formatMonthYearPt(monthKey)}
              style={{ fontFamily: "var(--font-playfair), serif" }}
              className="w-full bg-transparent text-center text-2xl font-semibold text-white placeholder-zinc-500 outline-none"
            />
            <div className="text-xs text-zinc-400">
              {filledEntries.length}{" "}
              {filledEntries.length === 1 ? "página" : "páginas"}
              {totalKm > 0
                ? ` · ${totalKm.toFixed(1).replace(".", ",")} km`
                : ""}
            </div>
          </div>

          {filledEntries.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-400">
              Nenhuma página escrita neste mês.
            </p>
          ) : (
            filledEntries.map((entry, idx) => (
              <article
                key={entry.date}
                className="space-y-3 border-t border-white/10 pt-6"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectDate(entry.date);
                    onClose();
                  }}
                  className="text-xs uppercase tracking-[0.16em] text-zinc-400 hover:text-white cursor-pointer"
                >
                  {String(idx + 1).padStart(2, "0")} ·{" "}
                  {formatLongDatePt(entry.date)}
                </button>

                {entry.title && (
                  <h3
                    className="text-xl font-semibold"
                    style={{
                      fontFamily: getFontCss(entry.fontFamily),
                      color: entry.textColor,
                      textAlign: entry.textAlign,
                    }}
                  >
                    {entry.title}
                  </h3>
                )}

                <div
                  className="diary-editor !min-h-0"
                  style={{
                    fontFamily: getFontCss(entry.fontFamily),
                    fontSize: getFontSizePx(entry.fontSize),
                    color: entry.textColor,
                    textAlign: entry.textAlign,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDiaryHtml(entry.contentHtml),
                  }}
                />
              </article>
            ))
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
            disabled={filledEntries.length === 0}
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
