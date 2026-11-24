"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  Type,
  Palette,
  SlidersHorizontal,
  Layers,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Quote,
  List,
  Heading2,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  BookMarked,
  Calendar,
  Check,
  Highlighter,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { MonthlyBookModal } from "./MonthlyBookModal";
import {
  db,
  getDateKey,
  getMonthKey,
  shiftDateKey,
  getSurroundingDays,
  formatLongDatePt,
  formatShortDayPt,
  sanitizeDiaryHtml,
  type DiaryEntry,
} from "@/lib/db";
import {
  DIARY_FONTS,
  DIARY_COLORS,
  DIARY_FONT_SIZES,
  DIARY_PAPER_STYLES,
  getFontCss,
  getFontSizePx,
  type DiaryFontId,
  type DiaryFontSize,
  type DiaryPaperStyle,
  type DiaryTextAlign,
} from "@/lib/fonts";

type ToolPanel = "none" | "font" | "color" | "format" | "paper";

const DEFAULT_STYLE = {
  fontFamily: "lora" as DiaryFontId,
  fontSize: "md" as DiaryFontSize,
  textColor: "#FFFFFF",
  textAlign: "left" as DiaryTextAlign,
  paperStyle: "clear" as DiaryPaperStyle,
};

export function DiaryEditor() {
  const [todayKey] = useState(() => getDateKey());
  const [selectedDate, setSelectedDate] = useState(() => getDateKey());
  const [activePanel, setActivePanel] = useState<ToolPanel>("none");
  const [bookOpen, setBookOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [fontFamily, setFontFamily] = useState<DiaryFontId>(
    DEFAULT_STYLE.fontFamily
  );
  const [fontSize, setFontSize] = useState<DiaryFontSize>(
    DEFAULT_STYLE.fontSize
  );
  const [textColor, setTextColor] = useState<string>(DEFAULT_STYLE.textColor);
  const [textAlign, setTextAlign] = useState<DiaryTextAlign>(
    DEFAULT_STYLE.textAlign
  );
  const [paperStyle, setPaperStyle] = useState<DiaryPaperStyle>(
    DEFAULT_STYLE.paperStyle
  );
  const [savedPulse, setSavedPulse] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveFnRef = useRef<(() => Promise<void>) | null>(null);
  const loadedDateRef = useRef<string>("");

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const fn = pendingSaveFnRef.current;
    if (fn) {
      pendingSaveFnRef.current = null;
      await fn();
    }
  }, []);

  const changeDate = useCallback(
    async (nextDate: string) => {
      await flushPendingSave();
      setSelectedDate(nextDate);
    },
    [flushPendingSave]
  );

  const monthKey = getMonthKey(selectedDate);
  const surroundingDays = getSurroundingDays(selectedDate);

  const monthEntries = useLiveQuery(
    () => db.diaryEntries.where("monthKey").equals(monthKey).sortBy("date"),
    [monthKey]
  );

  const datesWithEntries = new Set(
    (monthEntries ?? [])
      .filter((e) => e.title.trim() || e.plainText.trim())
      .map((e) => e.date)
  );

  // Load selected day entry from IndexedDB
  useEffect(() => {
    let active = true;
    db.diaryEntries.get(selectedDate).then((entry) => {
      if (!active) return;
      loadedDateRef.current = selectedDate;
      if (entry) {
        setTitle(entry.title);
        setFontFamily(entry.fontFamily);
        setFontSize(entry.fontSize);
        setTextColor(entry.textColor);
        setTextAlign(entry.textAlign);
        setPaperStyle(entry.paperStyle);
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeDiaryHtml(entry.contentHtml);
        }
      } else {
        setTitle("");
        setFontFamily(DEFAULT_STYLE.fontFamily);
        setFontSize(DEFAULT_STYLE.fontSize);
        setTextColor(DEFAULT_STYLE.textColor);
        setTextAlign(DEFAULT_STYLE.textAlign);
        setPaperStyle(DEFAULT_STYLE.paperStyle);
        if (editorRef.current) {
          editorRef.current.innerHTML = "";
        }
      }
    });
    return () => {
      active = false;
    };
  }, [selectedDate]);

  const persistEntry = useCallback(
    (overrides?: Partial<DiaryEntry>) => {
      if (loadedDateRef.current !== selectedDate) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      const htmlSnapshot = sanitizeDiaryHtml(
        overrides?.contentHtml ?? editorRef.current?.innerHTML ?? ""
      );
      const textSnapshot =
        overrides?.plainText ?? editorRef.current?.innerText ?? "";

      const payload: DiaryEntry = {
        date: selectedDate,
        monthKey: getMonthKey(selectedDate),
        title: overrides?.title ?? title,
        contentHtml: htmlSnapshot,
        plainText: textSnapshot,
        fontFamily: overrides?.fontFamily ?? fontFamily,
        fontSize: overrides?.fontSize ?? fontSize,
        textColor: overrides?.textColor ?? textColor,
        textAlign: overrides?.textAlign ?? textAlign,
        paperStyle: overrides?.paperStyle ?? paperStyle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const runSave = async () => {
        const existing = await db.diaryEntries.get(selectedDate);
        if (existing) {
          payload.createdAt = existing.createdAt;
        }
        if (!payload.title.trim() && !payload.plainText.trim()) {
          if (existing) await db.diaryEntries.delete(selectedDate);
          return;
        }
        await db.diaryEntries.put(payload);
        setSavedPulse(true);
        setTimeout(() => setSavedPulse(false), 1200);
      };

      pendingSaveFnRef.current = runSave;
      saveTimerRef.current = setTimeout(async () => {
        saveTimerRef.current = null;
        if (pendingSaveFnRef.current === runSave) {
          pendingSaveFnRef.current = null;
          await runSave();
        }
      }, 220);
    },
    [
      selectedDate,
      title,
      fontFamily,
      fontSize,
      textColor,
      textAlign,
      paperStyle,
    ]
  );

  const togglePanel = (panel: ToolPanel) => {
    setActivePanel((prev) => (prev === panel ? "none" : panel));
  };

  const applyExecCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    persistEntry();
  };

  const handleColorPick = (hex: string) => {
    const selection = window.getSelection();
    const hasSelectionInsideEditor =
      selection &&
      !selection.isCollapsed &&
      editorRef.current &&
      editorRef.current.contains(selection.anchorNode);

    if (hasSelectionInsideEditor) {
      document.execCommand("foreColor", false, hex);
      persistEntry();
    } else {
      setTextColor(hex);
      persistEntry({ textColor: hex });
    }
  };

  const handleHighlightSelection = () => {
    const selection = window.getSelection();
    if (
      selection &&
      !selection.isCollapsed &&
      editorRef.current?.contains(selection.anchorNode)
    ) {
      document.execCommand("hiliteColor", false, "rgba(255,255,255,0.16)");
      persistEntry();
    }
  };

  const cardVariant =
    paperStyle === "frosted"
      ? "frosted"
      : paperStyle === "lined"
        ? "lined"
        : paperStyle === "obsidian"
          ? "obsidian"
          : "default";

  const fontCss = getFontCss(fontFamily);
  const fontSizePx = getFontSizePx(fontSize);

  return (
    <div className="space-y-4 pt-2">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">
            Diário
          </h1>
          {savedPulse && (
            <span className="glass-pill inline-flex h-6 w-6 items-center justify-center rounded-full">
              <Check className="h-3.5 w-3.5 text-zinc-200" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedDate !== todayKey && (
            <GlassButton
              type="button"
              onClick={() => changeDate(todayKey)}
              className="h-10 px-3.5 text-xs font-medium"
            >
              Hoje
            </GlassButton>
          )}
          <GlassButton
            type="button"
            onClick={() => setBookOpen(true)}
            className="h-10 px-3.5 text-xs font-medium"
          >
            <BookMarked className="h-4 w-4" />
            <span>Livro</span>
          </GlassButton>
        </div>
      </header>

      {/* Day Separator Strip */}
      <GlassCard className="p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <GlassButton
            type="button"
            onClick={() => changeDate(shiftDateKey(selectedDate, -1))}
            aria-label="Dia anterior"
            className="h-8 w-8 !rounded-full p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </GlassButton>

          <label className="relative inline-flex items-center gap-2 text-sm font-medium text-white cursor-pointer px-2 py-1">
            <span>{formatLongDatePt(selectedDate)}</span>
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) changeDate(e.target.value);
              }}
              className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
              aria-label="Escolher data"
            />
          </label>

          <GlassButton
            type="button"
            onClick={() => changeDate(shiftDateKey(selectedDate, 1))}
            aria-label="Próximo dia"
            className="h-8 w-8 !rounded-full p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </GlassButton>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {surroundingDays.map((dayKey) => {
            const isSelected = dayKey === selectedDate;
            const hasContent = datesWithEntries.has(dayKey);
            const dayNum = Number(dayKey.slice(8, 10));

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => changeDate(dayKey)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "glass-pill-active"
                    : "hover:bg-white/[0.06] text-zinc-400"
                }`}
              >
                <span
                  className={`text-[10px] uppercase ${
                    isSelected ? "text-black/70" : "text-zinc-500"
                  }`}
                >
                  {formatShortDayPt(dayKey)}
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {dayNum}
                </span>
                <span
                  className={`h-1 w-1 rounded-full ${
                    hasContent
                      ? isSelected
                        ? "bg-black"
                        : "bg-white/80"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* Compact Glass Customization Bar */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-4 gap-2">
          <GlassButton
            type="button"
            active={activePanel === "font"}
            onClick={() => togglePanel("font")}
            className="h-11 text-xs font-medium"
          >
            <Type className="h-4 w-4" />
            <span>Fonte</span>
          </GlassButton>

          <GlassButton
            type="button"
            active={activePanel === "color"}
            onClick={() => togglePanel("color")}
            className="h-11 text-xs font-medium"
          >
            <span
              className="h-3.5 w-3.5 rounded-full border border-white/40"
              style={{ backgroundColor: textColor }}
            />
            <span>Cor</span>
          </GlassButton>

          <GlassButton
            type="button"
            active={activePanel === "format"}
            onClick={() => togglePanel("format")}
            className="h-11 text-xs font-medium"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Estilo</span>
          </GlassButton>

          <GlassButton
            type="button"
            active={activePanel === "paper"}
            onClick={() => togglePanel("paper")}
            className="h-11 text-xs font-medium"
          >
            <Layers className="h-4 w-4" />
            <span>Vidro</span>
          </GlassButton>
        </div>

        {/* Expandable Font Tray */}
        {activePanel === "font" && (
          <GlassCard variant="frosted" className="p-3.5 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {DIARY_FONTS.map((f) => (
                <GlassButton
                  key={f.id}
                  type="button"
                  active={fontFamily === f.id}
                  onClick={() => {
                    setFontFamily(f.id);
                    persistEntry({ fontFamily: f.id });
                  }}
                  style={{ fontFamily: f.cssVar }}
                  className="py-2.5 text-sm"
                >
                  {f.label}
                </GlassButton>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/10">
              {DIARY_FONT_SIZES.map((s) => (
                <GlassButton
                  key={s.id}
                  type="button"
                  active={fontSize === s.id}
                  onClick={() => {
                    setFontSize(s.id);
                    persistEntry({ fontSize: s.id });
                  }}
                  className="py-2 text-xs font-medium"
                >
                  {s.label}
                </GlassButton>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Expandable Color Tray */}
        {activePanel === "color" && (
          <GlassCard variant="frosted" className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {DIARY_COLORS.map((c) => {
                const isSelected = textColor === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    aria-label={c.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleColorPick(c.hex)}
                    className={`h-8 w-8 rounded-full transition-transform active:scale-90 cursor-pointer ${
                      isSelected
                        ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110"
                        : "border border-white/25 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Palette className="h-3.5 w-3.5" />
                <span>Texto ou seleção</span>
              </div>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleHighlightSelection}
                className="h-8 px-3 text-xs"
              >
                <Highlighter className="h-3.5 w-3.5" />
                <span>Destacar</span>
              </GlassButton>
            </div>
          </GlassCard>
        )}

        {/* Expandable Rich Formatting & Alignment Tray */}
        {activePanel === "format" && (
          <GlassCard variant="frosted" className="p-3.5 space-y-2.5">
            <div className="grid grid-cols-4 gap-2">
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("bold")}
                aria-label="Negrito"
                className="h-10"
              >
                <Bold className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("italic")}
                aria-label="Itálico"
                className="h-10"
              >
                <Italic className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("underline")}
                aria-label="Sublinhado"
                className="h-10"
              >
                <Underline className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("strikeThrough")}
                aria-label="Tachado"
                className="h-10"
              >
                <Strikethrough className="h-4 w-4" />
              </GlassButton>

              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("formatBlock", "H2")}
                aria-label="Subtítulo"
                className="h-10"
              >
                <Heading2 className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("formatBlock", "BLOCKQUOTE")}
                aria-label="Citação"
                className="h-10"
              >
                <Quote className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("insertUnorderedList")}
                aria-label="Lista"
                className="h-10"
              >
                <List className="h-4 w-4" />
              </GlassButton>
              <GlassButton
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyExecCommand("insertHorizontalRule")}
                aria-label="Divisor"
                className="h-10"
              >
                <Minus className="h-4 w-4" />
              </GlassButton>
            </div>

            <div className="grid grid-cols-4 gap-2 border-t border-white/10 pt-2.5">
              {(
                [
                  { id: "left", icon: AlignLeft, label: "Esquerda" },
                  { id: "center", icon: AlignCenter, label: "Centro" },
                  { id: "right", icon: AlignRight, label: "Direita" },
                  { id: "justify", icon: AlignJustify, label: "Justificado" },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <GlassButton
                  key={id}
                  type="button"
                  active={textAlign === id}
                  aria-label={label}
                  onClick={() => {
                    setTextAlign(id);
                    persistEntry({ textAlign: id });
                  }}
                  className="h-9"
                >
                  <Icon className="h-4 w-4" />
                </GlassButton>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Expandable Glass Texture Tray */}
        {activePanel === "paper" && (
          <GlassCard variant="frosted" className="p-3.5">
            <div className="grid grid-cols-4 gap-2">
              {DIARY_PAPER_STYLES.map((p) => (
                <GlassButton
                  key={p.id}
                  type="button"
                  active={paperStyle === p.id}
                  onClick={() => {
                    setPaperStyle(p.id);
                    persistEntry({ paperStyle: p.id });
                  }}
                  className="py-2.5 text-xs font-medium"
                >
                  {p.label}
                </GlassButton>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Main Writing Canvas */}
      <GlassCard variant={cardVariant} className="p-6 space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            const val = e.target.value;
            setTitle(val);
            persistEntry({ title: val });
          }}
          placeholder="Título"
          style={{
            fontFamily: fontCss,
            color: textColor,
            textAlign,
          }}
          className="w-full bg-transparent text-2xl font-semibold tracking-tight placeholder-white/25 outline-none"
        />

        <div className="h-px w-full bg-white/10" />

        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => persistEntry()}
          data-placeholder="Escreva seu dia..."
          style={{
            fontFamily: fontCss,
            fontSize: fontSizePx,
            color: textColor,
            textAlign,
          }}
          className="diary-editor"
        />
      </GlassCard>

      {/* Monthly Book Compiler & PDF Export Modal */}
      <MonthlyBookModal
        open={bookOpen}
        initialMonthKey={monthKey}
        onClose={() => setBookOpen(false)}
        onSelectDate={(dateKey) => changeDate(dateKey)}
      />
    </div>
  );
}
