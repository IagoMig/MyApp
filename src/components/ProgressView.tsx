"use client";

import { useState, useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Camera,
  Plus,
  Eye,
  EyeOff,
  SlidersHorizontal,
  X,
  Trash2,
  Upload,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  DEFAULT_SETTINGS,
  getDateKey,
  formatShortDatePt,
  type PhotoAngle,
  type ProgressPhoto,
} from "@/lib/db";
import { compressImageFile } from "@/lib/images";

const ANGLES: { id: "todas" | PhotoAngle; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "frente", label: "Frente" },
  { id: "lado", label: "Lado" },
  { id: "costas", label: "Costas" },
];

const ANGLE_LABEL: Record<PhotoAngle, string> = {
  frente: "Frente",
  lado: "Lado",
  costas: "Costas",
};

export function ProgressView() {
  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const photos = useLiveQuery(
    () => db.progressPhotos.orderBy("date").reverse().toArray(),
    []
  );

  const [filter, setFilter] = useState<"todas" | PhotoAngle>("todas");
  const [blurred, setBlurred] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [sliderPct, setSliderPct] = useState(50);
  const [beforeId, setBeforeId] = useState<number | null>(null);
  const [afterId, setAfterId] = useState<number | null>(null);

  // Lightbox
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);

  // Add photo sheet
  const [addOpen, setAddOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoDate, setPhotoDate] = useState(() => getDateKey());
  const [photoAngle, setPhotoAngle] = useState<PhotoAngle>("frente");
  const [photoWeight, setPhotoWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPhotos = useMemo(() => {
    const list = photos ?? [];
    if (filter === "todas") return list;
    return list.filter((p) => p.angle === filter);
  }, [photos, filter]);

  // Chronological oldest -> newest for comparison defaults
  const comparePool = useMemo(
    () => [...filteredPhotos].reverse(),
    [filteredPhotos]
  );

  const beforePhoto =
    comparePool.find((p) => p.id === beforeId) ?? comparePool[0] ?? null;
  const afterPhoto =
    comparePool.find((p) => p.id === afterId) ??
    comparePool[comparePool.length - 1] ??
    null;

  const openAddSheet = () => {
    setPreviewUrl(null);
    setPhotoDate(getDateKey());
    setPhotoAngle(filter === "todas" ? "frente" : filter);
    setPhotoWeight(String((settings ?? DEFAULT_SETTINGS).weightKg));
    setAddOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPreviewUrl(compressed);
    } catch {
      // Ignore unreadable file
    }
  };

  const handleSavePhoto = async () => {
    if (!previewUrl) return;
    setSaving(true);
    try {
      const parsedWeight = parseFloat(photoWeight.replace(",", "."));
      await db.progressPhotos.add({
        date: photoDate,
        angle: photoAngle,
        weightKg: parsedWeight > 0 ? parsedWeight : undefined,
        dataUrl: previewUrl,
        createdAt: Date.now(),
      });
      setAddOpen(false);
      setPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePhoto = async (id?: number) => {
    if (id === undefined) return;
    await db.progressPhotos.delete(id);
    setSelectedPhoto(null);
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">
          Evolução
        </h1>

        <div className="flex items-center gap-2">
          <GlassButton
            type="button"
            active={blurred}
            onClick={() => setBlurred((b) => !b)}
            aria-label={blurred ? "Mostrar fotos" : "Ocultar fotos"}
            className="h-10 w-10 !rounded-full p-0"
          >
            {blurred ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </GlassButton>

          <GlassButton
            type="button"
            active
            onClick={openAddSheet}
            className="h-10 px-4 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Foto</span>
          </GlassButton>
        </div>
      </header>

      {/* Angle Filter + Compare Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {ANGLES.map((a) => (
            <GlassButton
              key={a.id}
              type="button"
              active={filter === a.id}
              onClick={() => {
                setFilter(a.id);
                setBeforeId(null);
                setAfterId(null);
              }}
              className="h-9 px-3.5 text-xs font-medium shrink-0"
            >
              {a.label}
            </GlassButton>
          ))}
        </div>

        {comparePool.length >= 2 && (
          <GlassButton
            type="button"
            active={compareMode}
            onClick={() => setCompareMode((c) => !c)}
            className="h-9 px-3 text-xs font-medium shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Comparar</span>
          </GlassButton>
        )}
      </div>

      {/* Empty State */}
      {filteredPhotos.length === 0 ? (
        <GlassCard
          variant="frosted"
          className="p-10 flex flex-col items-center justify-center gap-5 text-center min-h-[280px]"
        >
          <div className="glass-pill flex h-16 w-16 items-center justify-center rounded-full">
            <Camera className="h-7 w-7 text-white" strokeWidth={1.6} />
          </div>
          <span className="text-base font-medium text-white">
            Fotos de progressão
          </span>
          <GlassButton
            type="button"
            active
            onClick={openAddSheet}
            className="px-5 py-3 text-xs font-medium"
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar primeira foto</span>
          </GlassButton>
        </GlassCard>
      ) : compareMode && beforePhoto && afterPhoto ? (
        /* Interactive Before / After Glass Slider */
        <GlassCard variant="frosted" className="p-4 space-y-4">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] bg-zinc-950 select-none">
            {/* After (Right / Full background) */}
            <img
              src={afterPhoto.dataUrl}
              alt="Depois"
              className={`h-full w-full object-cover transition-all duration-200 ${
                blurred ? "blur-2xl scale-105" : ""
              }`}
            />

            {/* Before (Left clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
            >
              <img
                src={beforePhoto.dataUrl}
                alt="Antes"
                className={`h-full w-full object-cover transition-all duration-200 ${
                  blurred ? "blur-2xl scale-105" : ""
                }`}
              />
            </div>

            {/* Luminous Glass Divider Line */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_16px_rgba(255,255,255,0.8)]"
              style={{ left: `${sliderPct}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-dock flex h-9 w-9 items-center justify-center rounded-full">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Minimal Date Badges */}
            <div className="pointer-events-none absolute top-3 left-3 glass-dock rounded-full px-3 py-1 text-[11px] text-white">
              {formatShortDatePt(beforePhoto.date)}
              {beforePhoto.weightKg ? ` · ${beforePhoto.weightKg}kg` : ""}
            </div>
            <div className="pointer-events-none absolute top-3 right-3 glass-dock rounded-full px-3 py-1 text-[11px] text-white">
              {formatShortDatePt(afterPhoto.date)}
              {afterPhoto.weightKg ? ` · ${afterPhoto.weightKg}kg` : ""}
            </div>

            {/* Transparent full-surface range control for smooth iOS touch dragging */}
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPct}
              onChange={(e) => setSliderPct(Number(e.target.value))}
              aria-label="Comparar antes e depois"
              className="absolute inset-0 h-full w-full opacity-0 cursor-ew-resize"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <select
              value={beforePhoto.id ?? ""}
              onChange={(e) => setBeforeId(Number(e.target.value))}
              className="glass-pill rounded-xl px-3 py-2.5 text-xs text-white bg-zinc-950 outline-none"
            >
              {comparePool.map((p) => (
                <option key={p.id} value={p.id} className="bg-black text-white">
                  Antes: {formatShortDatePt(p.date)} ({ANGLE_LABEL[p.angle]})
                </option>
              ))}
            </select>

            <select
              value={afterPhoto.id ?? ""}
              onChange={(e) => setAfterId(Number(e.target.value))}
              className="glass-pill rounded-xl px-3 py-2.5 text-xs text-white bg-zinc-950 outline-none"
            >
              {comparePool.map((p) => (
                <option key={p.id} value={p.id} className="bg-black text-white">
                  Depois: {formatShortDatePt(p.date)} ({ANGLE_LABEL[p.angle]})
                </option>
              ))}
            </select>
          </div>
        </GlassCard>
      ) : (
        /* Minimal 2-Column Glass Photo Grid */
        <div className="grid grid-cols-2 gap-3">
          {filteredPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setSelectedPhoto(photo)}
              className="block text-left cursor-pointer"
            >
              <GlassCard className="overflow-hidden p-1.5 transition-transform duration-150 active:scale-[0.98]">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] bg-zinc-950">
                  <img
                    src={photo.dataUrl}
                    alt={`${ANGLE_LABEL[photo.angle]} ${photo.date}`}
                    className={`h-full w-full object-cover transition-all duration-300 ${
                      blurred ? "blur-2xl scale-110" : ""
                    }`}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3.5 pt-8 pb-3">
                    <span className="block text-xs font-medium text-white">
                      {formatShortDatePt(photo.date)}
                    </span>
                    <span className="block text-[11px] text-zinc-400">
                      {ANGLE_LABEL[photo.angle]}
                      {photo.weightKg ? ` · ${photo.weightKg} kg` : ""}
                    </span>
                  </div>
                </div>
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <GlassCard
            variant="frosted"
            className="w-full max-w-[420px] overflow-hidden p-3 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[22px] bg-black">
              <img
                src={selectedPhoto.dataUrl}
                alt={selectedPhoto.date}
                className={`h-full w-full object-cover ${
                  blurred ? "blur-2xl scale-105" : ""
                }`}
              />
            </div>

            <div className="flex items-center justify-between px-2 pb-1">
              <div>
                <span className="block text-sm font-medium text-white">
                  {formatShortDatePt(selectedPhoto.date)} ·{" "}
                  {ANGLE_LABEL[selectedPhoto.angle]}
                </span>
                {selectedPhoto.weightKg && (
                  <span className="text-xs text-zinc-400">
                    {selectedPhoto.weightKg} kg
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  onClick={() => handleDeletePhoto(selectedPhoto.id)}
                  aria-label="Apagar foto"
                  className="h-9 w-9 !rounded-full p-0"
                >
                  <Trash2 className="h-4 w-4 text-zinc-300" />
                </GlassButton>
                <GlassButton
                  type="button"
                  onClick={() => setSelectedPhoto(null)}
                  aria-label="Fechar"
                  className="h-9 w-9 !rounded-full p-0"
                >
                  <X className="h-4 w-4" />
                </GlassButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Add Progress Photo Sheet */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-4 sm:items-center"
          onClick={() => setAddOpen(false)}
        >
          <GlassCard
            variant="frosted"
            className="w-full max-w-[420px] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Nova foto</h2>
              <GlassButton
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative block aspect-[4/4] w-full overflow-hidden rounded-[22px] border border-white/15 bg-black cursor-pointer"
              >
                <img
                  src={previewUrl}
                  alt="Prévia"
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="glass-obsidian flex h-44 w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/20 text-zinc-300 hover:border-white/40 transition-colors cursor-pointer"
              >
                <Upload className="h-6 w-6" strokeWidth={1.6} />
                <span className="text-sm">Escolher da galeria ou câmera</span>
              </button>
            )}

            {/* Angle selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["frente", "lado", "costas"] as const).map((ang) => (
                <GlassButton
                  key={ang}
                  type="button"
                  active={photoAngle === ang}
                  onClick={() => setPhotoAngle(ang)}
                  className="py-2.5 text-xs font-medium"
                >
                  {ANGLE_LABEL[ang]}
                </GlassButton>
              ))}
            </div>

            {/* Date + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={photoDate}
                onChange={(e) => setPhotoDate(e.target.value)}
                className="glass-pill rounded-xl px-3.5 py-2.5 text-sm text-white outline-none"
              />
              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                value={photoWeight}
                onChange={(e) => setPhotoWeight(e.target.value)}
                placeholder="Peso (kg)"
                className="glass-pill rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none tabular-nums"
              />
            </div>

            <GlassButton
              type="button"
              active
              disabled={!previewUrl || saving}
              onClick={handleSavePhoto}
              className="w-full py-3.5 text-sm font-medium"
            >
              {saving ? "Salvando..." : "Salvar foto"}
            </GlassButton>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
