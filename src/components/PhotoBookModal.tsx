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
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  getMonthKey,
  formatMonthYearPt,
  formatShortDatePt,
  formatFullDatePt,
  formatWeightKg,
  type PhotoAngle,
  type ProgressPhoto,
} from "@/lib/db";

interface PhotoBookModalProps {
  open: boolean;
  initialBlurred?: boolean;
  onClose: () => void;
}

const ANGLE_LABEL: Record<PhotoAngle, string> = {
  frente: "Frente",
  lado: "Lado",
  costas: "Costas",
};

const BOOK_META_KEY = "photos:monthly-book";

interface MonthChapter {
  monthKey: string;
  label: string;
  photos: ProgressPhoto[];
  firstWeight?: number;
  lastWeight?: number;
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function PhotoBookModal({
  open,
  initialBlurred = false,
  onClose,
}: PhotoBookModalProps) {
  const [viewMode, setViewMode] = useState<"flip" | "scroll">("flip");
  const [angleFilter, setAngleFilter] = useState<"todas" | PhotoAngle>("todas");
  const [pageIndex, setPageIndex] = useState(0); // 0 = Cover, 1..N = monthly chapters
  const [blurred, setBlurred] = useState(initialBlurred);
  const [edition, setEdition] = useState<"dark" | "paper">("paper");
  const [customTitle, setCustomTitle] = useState("Livro de Evolução");

  useEffect(() => {
    if (open) {
      setBlurred(initialBlurred);
      setPageIndex(0);
    }
  }, [open, initialBlurred]);

  const photosAsc = useLiveQuery(
    () => db.progressPhotos.orderBy("date").toArray(),
    []
  );
  const weightLogsAsc = useLiveQuery(
    () => db.weightLogs.orderBy("date").toArray(),
    []
  );
  const meta = useLiveQuery(() => db.bookMeta.get(BOOK_META_KEY), []);

  useEffect(() => {
    setCustomTitle(meta?.customTitle ?? "Livro de Evolução");
  }, [meta]);

  const filteredPhotos = useMemo(() => {
    const list = [...(photosAsc ?? [])].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.createdAt - b.createdAt;
    });
    if (angleFilter === "todas") return list;
    return list.filter((p) => p.angle === angleFilter);
  }, [photosAsc, angleFilter]);

  const chapters: MonthChapter[] = useMemo(() => {
    const grouped = new Map<string, ProgressPhoto[]>();
    for (const photo of filteredPhotos) {
      const mKey = getMonthKey(photo.date);
      const arr = grouped.get(mKey) ?? [];
      arr.push(photo);
      grouped.set(mKey, arr);
    }

    const weightsByMonth = new Map<string, number[]>();
    for (const w of weightLogsAsc ?? []) {
      const arr = weightsByMonth.get(w.monthKey) ?? [];
      arr.push(w.weightKg);
      weightsByMonth.set(w.monthKey, arr);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, photos]) => {
        const photoWeights = photos
          .map((p) => p.weightKg)
          .filter((w): w is number => typeof w === "number" && w > 0);
        const loggedWeights = weightsByMonth.get(monthKey) ?? [];
        const combined = loggedWeights.length > 0 ? loggedWeights : photoWeights;

        return {
          monthKey,
          label: formatMonthYearPt(monthKey),
          photos,
          firstWeight: combined.length > 0 ? combined[0] : undefined,
          lastWeight:
            combined.length > 0 ? combined[combined.length - 1] : undefined,
        };
      });
  }, [filteredPhotos, weightLogsAsc]);

  // Clamp page index when filter changes
  const totalPages = chapters.length + 1; // 0 = Cover, 1..N = chapters
  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1));

  // Cover highlight: first and latest front photos (fallback to any)
  const coverPair = useMemo(() => {
    const all = [...(photosAsc ?? [])].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.createdAt - b.createdAt
    );
    const fronts = all.filter((p) => p.angle === "frente");
    const pool = fronts.length > 0 ? fronts : all;
    if (pool.length === 0) return { first: null, last: null };
    if (pool.length === 1) return { first: pool[0], last: null };
    return { first: pool[0], last: pool[pool.length - 1] };
  }, [photosAsc]);

  if (!open) return null;

  const saveTitle = async (val: string) => {
    setCustomTitle(val);
    await db.bookMeta.put({
      monthKey: BOOK_META_KEY,
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
    const bookTitle = customTitle.trim() || "Livro de Evolução";

    const chaptersHtml = chapters
      .map((chap, idx) => {
        const weightLabel =
          chap.firstWeight && chap.lastWeight
            ? chap.firstWeight !== chap.lastWeight
              ? `${formatWeightKg(chap.firstWeight)} kg → ${formatWeightKg(chap.lastWeight)} kg`
              : `${formatWeightKg(chap.lastWeight)} kg`
            : "";

        const photosGridHtml = chap.photos
          .map(
            (p) => `
              <figure class="photo-card">
                <img src="${p.dataUrl}" alt="${escapeHtml(p.date)}" />
                <figcaption>
                  <span>${escapeHtml(formatShortDatePt(p.date))} · ${escapeHtml(ANGLE_LABEL[p.angle])}</span>
                  ${p.weightKg ? `<span>${formatWeightKg(p.weightKg)} kg</span>` : ""}
                </figcaption>
              </figure>
            `
          )
          .join("\n");

        return `
          <section class="chapter">
            <div class="chapter-meta">Capítulo ${String(idx + 1).padStart(2, "0")}${
              weightLabel ? ` · ${escapeHtml(weightLabel)}` : ""
            }</div>
            <h2>${escapeHtml(chap.label)}</h2>
            <div class="grid ${chap.photos.length === 1 ? "single" : ""}">
              ${photosGridHtml}
            </div>
          </section>
        `;
      })
      .join("\n");

    const coverSpan =
      chapters.length > 0
        ? `${chapters.length} ${chapters.length === 1 ? "mês" : "meses"} · ${filteredPhotos.length} ${
            filteredPhotos.length === 1 ? "foto" : "fotos"
          }`
        : "Sem fotos";

    const docHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(bookTitle)} — My App</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A5; margin: 14mm 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: ${bg}; color: ${fg}; font-family: 'Inter', sans-serif; }
    .cover {
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      border: 1px solid ${border};
      padding: 40px 24px;
      page-break-after: always;
    }
    .brand { font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; color: ${muted}; margin-bottom: 18px; }
    .cover h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600; margin: 0 0 12px; }
    .cover .sub { font-size: 12px; color: ${muted}; }
    .chapter { padding: 12px 0 24px; page-break-after: always; }
    .chapter:last-child { page-break-after: auto; }
    .chapter-meta { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: ${muted}; margin-bottom: 6px; }
    .chapter h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; margin: 0 0 16px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .grid.single { grid-template-columns: 1fr; max-width: 72%; margin: 0 auto; }
    .photo-card { margin: 0; border: 1px solid ${border}; border-radius: 14px; overflow: hidden; break-inside: avoid; }
    .photo-card img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; display: block; }
    .photo-card figcaption { display: flex; justify-content: space-between; padding: 8px 10px; font-size: 10px; color: ${muted}; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">My App · Evolução Mensal</div>
    <h1>${escapeHtml(bookTitle)}</h1>
    <div class="sub">${escapeHtml(coverSpan)}</div>
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
    a.download = "livro-evolucao-fotos.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChapter = (chap: MonthChapter, idx: number) => {
    const weightSummary =
      chap.firstWeight && chap.lastWeight
        ? chap.firstWeight !== chap.lastWeight
          ? `${formatWeightKg(chap.firstWeight)} → ${formatWeightKg(chap.lastWeight)} kg`
          : `${formatWeightKg(chap.lastWeight)} kg`
        : null;

    return (
      <section key={chap.monthKey} className="space-y-4">
        <div className="flex items-end justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-zinc-400">
              Capítulo {String(idx + 1).padStart(2, "0")}
            </span>
            <h3
              className="mt-0.5 text-xl font-semibold text-white"
              style={{ fontFamily: "var(--font-playfair), serif" }}
            >
              {chap.label}
            </h3>
          </div>

          <div className="text-right tabular-nums">
            <span className="block text-xs text-zinc-300">
              {chap.photos.length}{" "}
              {chap.photos.length === 1 ? "foto" : "fotos"}
            </span>
            {weightSummary && (
              <span className="block text-[11px] text-zinc-400">
                {weightSummary}
              </span>
            )}
          </div>
        </div>

        <div
          className={`grid gap-3 ${
            chap.photos.length === 1 ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          {chap.photos.map((photo) => (
            <div
              key={photo.id}
              className="glass-obsidian overflow-hidden rounded-[20px] p-1.5"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[16px] bg-black">
                <img
                  src={photo.dataUrl}
                  alt={`${ANGLE_LABEL[photo.angle]} ${photo.date}`}
                  className={`h-full w-full object-cover transition-all duration-300 ${
                    blurred ? "blur-2xl scale-110" : ""
                  }`}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pt-7 pb-2.5">
                  <span className="block text-[11px] font-medium text-white">
                    {formatShortDatePt(photo.date)}
                  </span>
                  <span className="block text-[10px] text-zinc-300">
                    {ANGLE_LABEL[photo.angle]}
                    {photo.weightKg ? ` · ${formatWeightKg(photo.weightKg)} kg` : ""}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderCover = () => (
    <div className="glass-obsidian rounded-[26px] p-6 text-center space-y-5">
      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.26em] text-zinc-500">
          My App · Álbum Mensal
        </span>
        <input
          type="text"
          value={customTitle}
          onChange={(e) => saveTitle(e.target.value)}
          placeholder="Livro de Evolução"
          style={{ fontFamily: "var(--font-playfair), serif" }}
          className="w-full bg-transparent text-center text-2xl font-semibold text-white placeholder-zinc-500 outline-none"
        />
        <p className="text-xs text-zinc-400 tabular-nums">
          {chapters.length} {chapters.length === 1 ? "mês" : "meses"} ·{" "}
          {filteredPhotos.length}{" "}
          {filteredPhotos.length === 1 ? "foto" : "fotos"}
        </p>
      </div>

      {/* Editorial Cover Preview */}
      {coverPair.first && (
        <div
          className={`grid gap-2.5 ${
            coverPair.last ? "grid-cols-2" : "grid-cols-1 max-w-[180px] mx-auto"
          }`}
        >
          <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] border border-white/15 bg-black">
            <img
              src={coverPair.first.dataUrl}
              alt="Primeira foto"
              className={`h-full w-full object-cover ${
                blurred ? "blur-2xl scale-110" : ""
              }`}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-left">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-400">
                Início
              </span>
              <span className="block text-[11px] font-medium text-white">
                {formatFullDatePt(coverPair.first.date)}
              </span>
            </div>
          </div>

          {coverPair.last && (
            <div className="relative aspect-[3/4] overflow-hidden rounded-[18px] border border-white/15 bg-black">
              <img
                src={coverPair.last.dataUrl}
                alt="Última foto"
                className={`h-full w-full object-cover ${
                  blurred ? "blur-2xl scale-110" : ""
                }`}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pt-6 pb-2 text-left">
                <span className="block text-[9px] uppercase tracking-wider text-zinc-400">
                  Recente
                </span>
                <span className="block text-[11px] font-medium text-white">
                  {formatFullDatePt(coverPair.last.date)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {chapters.length > 0 && viewMode === "flip" && (
        <GlassButton
          type="button"
          active
          onClick={() => setPageIndex(1)}
          className="px-5 py-2.5 text-xs font-medium"
        >
          <span>Abrir capítulo 01</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </GlassButton>
      )}
    </div>
  );

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
                active={viewMode === "flip"}
                onClick={() => setViewMode("flip")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Folhear</span>
              </GlassButton>
              <GlassButton
                type="button"
                active={viewMode === "scroll"}
                onClick={() => setViewMode("scroll")}
                className="h-8 px-3 text-xs font-medium !rounded-xl"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Tudo</span>
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
                aria-label="Fechar livro de fotos"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>
          </div>

          {/* Angle filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: "todas", label: "Todas" },
                { id: "frente", label: "Frente" },
                { id: "lado", label: "Lado" },
                { id: "costas", label: "Costas" },
              ] as const
            ).map((opt) => (
              <GlassButton
                key={opt.id}
                type="button"
                active={angleFilter === opt.id}
                onClick={() => {
                  setAngleFilter(opt.id);
                  setPageIndex(0);
                }}
                className="h-7 px-3 text-[11px] font-medium !rounded-xl shrink-0"
              >
                {opt.label}
              </GlassButton>
            ))}
          </div>

          {/* Quick chapter index strip when in flip mode */}
          {viewMode === "flip" && chapters.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setPageIndex(0)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                  safePageIndex === 0
                    ? "glass-pill-active"
                    : "glass-pill text-zinc-400"
                }`}
              >
                Capa
              </button>
              {chapters.map((ch, idx) => (
                <button
                  key={ch.monthKey}
                  type="button"
                  onClick={() => setPageIndex(idx + 1)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition-all shrink-0 cursor-pointer ${
                    safePageIndex === idx + 1
                      ? "glass-pill-active"
                      : "glass-pill text-zinc-400"
                  }`}
                >
                  {ch.label.split(" de ")[0].slice(0, 3)} {ch.monthKey.slice(2, 4)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Book Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8 no-scrollbar">
          {chapters.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-zinc-300">
                Nenhuma foto para montar o livro ainda.
              </p>
              <p className="text-xs text-zinc-500">
                Adicione fotos de evolução para gerar seus capítulos mensais.
              </p>
            </div>
          ) : viewMode === "flip" ? (
            safePageIndex === 0 ? (
              renderCover()
            ) : (
              renderChapter(chapters[safePageIndex - 1], safePageIndex - 1)
            )
          ) : (
            <>
              {renderCover()}
              {chapters.map((chap, idx) => renderChapter(chap, idx))}
            </>
          )}
        </div>

        {/* Page Turn Controls (flip mode) */}
        {viewMode === "flip" && chapters.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
            <GlassButton
              type="button"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              className="h-9 px-3 text-xs font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Anterior</span>
            </GlassButton>

            <span className="text-[11px] text-zinc-400 tabular-nums">
              {safePageIndex === 0
                ? "Capa"
                : `${safePageIndex} / ${chapters.length}`}
            </span>

            <GlassButton
              type="button"
              disabled={safePageIndex >= totalPages - 1}
              onClick={() =>
                setPageIndex((p) => Math.min(totalPages - 1, p + 1))
              }
              className="h-9 px-3 text-xs font-medium"
            >
              <span>Próximo</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </GlassButton>
          </div>
        )}

        {/* Footer Export Bar */}
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
            disabled={chapters.length === 0}
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
