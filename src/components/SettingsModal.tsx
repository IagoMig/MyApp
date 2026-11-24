"use client";

import { useState, useEffect, useRef } from "react";
import { X, Minus, Plus, Download, Upload } from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  DEFAULT_SETTINGS,
  updateSettings,
  exportAllData,
  importAllData,
  getDateKey,
  type UserSettings,
  type FullBackupPayload,
} from "@/lib/db";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: UserSettings | undefined;
}

export function SettingsModal({ open, onClose, settings }: SettingsModalProps) {
  const current = settings ?? DEFAULT_SETTINGS;
  const [waterGoalMl, setWaterGoalMl] = useState(current.waterGoalMl);
  const [calorieGoal, setCalorieGoal] = useState(current.calorieGoal);
  const [weightKg, setWeightKg] = useState(current.weightKg);
  const [weightGoalKg, setWeightGoalKg] = useState(
    current.weightGoalKg ?? Math.max(40, Number((current.weightKg - 5).toFixed(1)))
  );
  const [mealSlots, setMealSlots] = useState<string[]>(current.mealSlots);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setWaterGoalMl(settings.waterGoalMl);
      setCalorieGoal(settings.calorieGoal);
      setWeightKg(settings.weightKg);
      setWeightGoalKg(
        settings.weightGoalKg ??
          Math.max(40, Number((settings.weightKg - 5).toFixed(1)))
      );
      setMealSlots(settings.mealSlots);
    }
    setBackupStatus(null);
  }, [settings, open]);

  if (!open) return null;

  const handleSave = async () => {
    await updateSettings({
      waterGoalMl,
      calorieGoal,
      weightKg,
      weightGoalKg,
      mealSlots: mealSlots.map((s, i) => s.trim() || `Refeição ${i + 1}`),
    });
    onClose();
  };

  const handleExport = async () => {
    const payload = await exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-app-backup-${getDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupStatus("Backup exportado");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as FullBackupPayload;
      await importAllData(parsed);
      setBackupStatus("Backup restaurado");
    } catch {
      setBackupStatus("Arquivo inválido");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md p-4 sm:items-center"
      onClick={onClose}
    >
      <GlassCard
        variant="frosted"
        className="max-h-[88dvh] w-full max-w-[420px] overflow-y-auto p-6 space-y-5 no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium tracking-tight text-white">
            Ajustes
          </h2>
          <GlassButton
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-9 w-9 !rounded-full p-0"
          >
            <X className="h-4 w-4" />
          </GlassButton>
        </div>

        <div className="space-y-3.5">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="text-sm text-zinc-300">Água</span>
            <div className="flex items-center gap-3">
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setWaterGoalMl((v) => Math.max(1000, v - 250))
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </GlassButton>
              <span className="w-14 text-center text-sm font-medium text-white tabular-nums">
                {(waterGoalMl / 1000).toFixed(2).replace(".", ",")} L
              </span>
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setWaterGoalMl((v) => Math.min(6000, v + 250))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="text-sm text-zinc-300">Calorias</span>
            <div className="flex items-center gap-3">
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setCalorieGoal((v) => Math.max(1200, v - 100))
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </GlassButton>
              <span className="w-16 text-center text-sm font-medium text-white tabular-nums">
                {calorieGoal} kcal
              </span>
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setCalorieGoal((v) => Math.min(5000, v + 100))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="text-sm text-zinc-300">Peso</span>
            <div className="flex items-center gap-3">
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() => setWeightKg((v) => Math.max(35, Number((v - 0.5).toFixed(1))))}
              >
                <Minus className="h-3.5 w-3.5" />
              </GlassButton>
              <span className="w-16 text-center text-sm font-medium text-white tabular-nums">
                {weightKg.toFixed(1).replace(".", ",")} kg
              </span>
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() => setWeightKg((v) => Math.min(200, Number((v + 0.5).toFixed(1))))}
              >
                <Plus className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
            <span className="text-sm text-zinc-300">Meta de peso</span>
            <div className="flex items-center gap-3">
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setWeightGoalKg((v) => Math.max(35, Number((v - 0.5).toFixed(1))))
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </GlassButton>
              <span className="w-16 text-center text-sm font-medium text-white tabular-nums">
                {weightGoalKg.toFixed(1).replace(".", ",")} kg
              </span>
              <GlassButton
                type="button"
                className="h-8 w-8 !rounded-full p-0"
                onClick={() =>
                  setWeightGoalKg((v) => Math.min(200, Number((v + 0.5).toFixed(1))))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </GlassButton>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <span className="block px-1 text-xs text-zinc-400">Refeições</span>
            <div className="grid grid-cols-2 gap-2">
              {mealSlots.map((slot, index) => (
                <input
                  key={index}
                  type="text"
                  value={slot}
                  onChange={(e) => {
                    const next = [...mealSlots];
                    next[index] = e.target.value;
                    setMealSlots(next);
                  }}
                  className="glass-pill rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-white/35"
                />
              ))}
            </div>
          </div>

          {/* Local JSON Backup */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-zinc-400">Backup local</span>
              {backupStatus && (
                <span className="text-xs text-white">{backupStatus}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <GlassButton
                type="button"
                onClick={handleExport}
                className="py-2.5 text-xs font-medium"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar</span>
              </GlassButton>
              <GlassButton
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="py-2.5 text-xs font-medium"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Importar</span>
              </GlassButton>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>
        </div>

        <GlassButton
          type="button"
          active
          onClick={handleSave}
          className="w-full py-3.5 text-sm font-medium"
        >
          Salvar
        </GlassButton>
      </GlassCard>
    </div>
  );
}
