"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ChevronRight,
  Utensils,
  Moon,
  Plus,
  Minus,
  X,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import {
  db,
  DEFAULT_SETTINGS,
  getDateKey,
  shiftDateKey,
  formatLongDatePt,
  saveMealLog,
  type MealItem,
  type MealLog,
} from "@/lib/db";
import {
  searchFoods,
  computeKcal,
  parseQuickMealLine,
  type FoodReference,
} from "@/lib/foods";

export function MealsView() {
  const [todayKey] = useState(() => getDateKey());
  const [selectedDate, setSelectedDate] = useState(() => getDateKey());
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Sheet states
  const [query, setQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<FoodReference | null>(null);
  const [grams, setGrams] = useState(150);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");

  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const customFoods = useLiveQuery(() => db.customFoods.toArray(), []);
  const dayMeals = useLiveQuery(
    () => db.mealLogs.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const dayRuns = useLiveQuery(
    () => db.runs.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );
  const dayWorkouts = useLiveQuery(
    () => db.workouts.where("date").equals(selectedDate).toArray(),
    [selectedDate]
  );

  const activeSettings = settings ?? DEFAULT_SETTINGS;
  const slots = activeSettings.mealSlots.slice(0, 4);

  const mealBySlot = useMemo(() => {
    const map = new Map<number, MealLog>();
    for (const m of dayMeals ?? []) {
      map.set(m.slotIndex, m);
    }
    return map;
  }, [dayMeals]);

  const totalConsumed = (dayMeals ?? []).reduce(
    (sum, m) => sum + (m.isFasting ? 0 : m.totalKcal),
    0
  );
  const burnedToday =
    (dayRuns ?? []).reduce((sum, r) => sum + r.caloriesBurned, 0) +
    (dayWorkouts ?? []).reduce((sum, w) => sum + w.caloriesBurned, 0);
  const effectiveGoal = activeSettings.calorieGoal + burnedToday;
  const pct = Math.min(
    100,
    Math.round((totalConsumed / Math.max(1, effectiveGoal)) * 100)
  );

  const currentMeal =
    activeSlot !== null ? mealBySlot.get(activeSlot) : undefined;
  const currentItems = currentMeal?.items ?? [];
  const currentFasting = currentMeal?.isFasting ?? false;

  const suggestions = useMemo(
    () => searchFoods(query, customFoods ?? [], 6),
    [query, customFoods]
  );

  const quickParsed = useMemo(() => {
    if (!query.trim()) return [];
    // Detect if user typed a multi-item or quantity line like "200g arroz, 150g frango"
    if (/[,\d]/.test(query)) {
      return parseQuickMealLine(query, customFoods ?? []);
    }
    return [];
  }, [query, customFoods]);

  const openSlot = (index: number) => {
    setActiveSlot(index);
    setQuery("");
    setSelectedFood(null);
    setCustomMode(false);
    setCustomName("");
    setCustomKcal("");
  };

  const toggleFasting = async () => {
    if (activeSlot === null) return;
    await saveMealLog(selectedDate, activeSlot, {
      isFasting: !currentFasting,
      items: currentItems,
    });
  };

  const addItemsToActiveMeal = async (newItems: MealItem[]) => {
    if (activeSlot === null || newItems.length === 0) return;
    await saveMealLog(selectedDate, activeSlot, {
      isFasting: false,
      items: [...currentItems, ...newItems],
    });
    setQuery("");
    setSelectedFood(null);
  };

  const handleConfirmSelectedFood = async () => {
    if (!selectedFood) return;
    const item: MealItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: selectedFood.name,
      grams,
      kcal: computeKcal(selectedFood.kcalPer100g, grams),
    };
    await addItemsToActiveMeal([item]);
  };

  const handleQuickAddParsed = async () => {
    if (quickParsed.length === 0) return;
    const items: MealItem[] = quickParsed.map((p, idx) => ({
      id: `${Date.now()}_${idx}`,
      name: p.name,
      grams: p.grams,
      kcal: p.kcal,
    }));
    await addItemsToActiveMeal(items);
  };

  const handleAddCustom = async () => {
    const kcalNum = Math.round(Number(customKcal));
    const trimmed = customName.trim();
    if (!trimmed || !kcalNum || kcalNum <= 0) return;

    await db.customFoods.add({
      name: trimmed,
      kcalPer100g: kcalNum,
      defaultGrams: 100,
      createdAt: Date.now(),
    });

    await addItemsToActiveMeal([
      {
        id: `${Date.now()}_custom`,
        name: trimmed,
        grams: 100,
        kcal: kcalNum,
      },
    ]);
    setCustomName("");
    setCustomKcal("");
    setCustomMode(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (activeSlot === null) return;
    const next = currentItems.filter((i) => i.id !== itemId);
    await saveMealLog(selectedDate, activeSlot, {
      isFasting: currentFasting,
      items: next,
    });
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Minimal Header */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">
          Refeições
        </h1>

        <div className="flex items-center gap-1.5">
          <GlassButton
            type="button"
            onClick={() => setSelectedDate((d) => shiftDateKey(d, -1))}
            aria-label="Dia anterior"
            className="h-9 w-9 !rounded-full p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </GlassButton>

          <button
            type="button"
            onClick={() => setSelectedDate(todayKey)}
            className="glass-pill rounded-full px-3.5 py-2 text-xs font-medium text-zinc-200 cursor-pointer"
          >
            {selectedDate === todayKey ? "Hoje" : formatLongDatePt(selectedDate)}
          </button>

          <GlassButton
            type="button"
            onClick={() => setSelectedDate((d) => shiftDateKey(d, 1))}
            aria-label="Próximo dia"
            className="h-9 w-9 !rounded-full p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </GlassButton>
        </div>
      </header>

      {/* Minimalist Calorie Summary Card */}
      <GlassCard variant="frosted" className="p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <div className="text-4xl font-light tracking-tight text-white tabular-nums">
            {totalConsumed.toLocaleString("pt-BR")}{" "}
            <span className="text-lg text-zinc-400">kcal</span>
          </div>
          <span className="text-sm text-zinc-400 tabular-nums">
            {effectiveGoal.toLocaleString("pt-BR")} kcal
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-zinc-300 via-white to-white transition-all duration-500 ease-out shadow-[0_0_16px_rgba(255,255,255,0.45)]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </GlassCard>

      {/* 4 Meal Slots */}
      <div className="space-y-3">
        {slots.map((slotName, idx) => {
          const log = mealBySlot.get(idx);
          const isFasting = log?.isFasting ?? false;
          const kcal = log?.totalKcal ?? 0;
          const itemsPreview =
            !isFasting && log?.items?.length
              ? log.items.map((i) => i.name).join(" · ")
              : "";

          return (
            <button
              key={idx}
              type="button"
              onClick={() => openSlot(idx)}
              className="block w-full text-left cursor-pointer"
            >
              <GlassCard className="p-5 transition-transform duration-150 active:scale-[0.985]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="glass-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      {isFasting ? (
                        <Moon className="h-4 w-4 text-white" strokeWidth={1.8} />
                      ) : (
                        <Utensils
                          className="h-4 w-4 text-zinc-200"
                          strokeWidth={1.8}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-base font-medium text-white">
                        {slotName}
                      </span>
                      {itemsPreview && (
                        <span className="block text-xs text-zinc-400 truncate mt-0.5">
                          {itemsPreview}
                        </span>
                      )}
                    </div>
                  </div>

                  {isFasting ? (
                    <span className="glass-pill-active rounded-full px-3 py-1 text-xs font-medium shrink-0">
                      Jejum
                    </span>
                  ) : kcal > 0 ? (
                    <span className="text-sm font-medium text-white tabular-nums shrink-0">
                      {kcal} kcal
                    </span>
                  ) : (
                    <span className="glass-pill flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 shrink-0">
                      <Plus className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </GlassCard>
            </button>
          );
        })}
      </div>

      {/* Meal Editor Sheet Modal */}
      {activeSlot !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-3 sm:items-center"
          onClick={() => setActiveSlot(null)}
        >
          <GlassCard
            variant="frosted"
            className="flex max-h-[86dvh] w-full max-w-[440px] flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-medium text-white">
                  {slots[activeSlot]}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  active={currentFasting}
                  onClick={toggleFasting}
                  className="h-9 px-3.5 text-xs font-medium"
                >
                  <Moon className="h-3.5 w-3.5" />
                  <span>Jejum</span>
                </GlassButton>
                <GlassButton
                  type="button"
                  onClick={() => setActiveSlot(null)}
                  aria-label="Fechar"
                  className="h-9 w-9 !rounded-full p-0"
                >
                  <X className="h-4 w-4" />
                </GlassButton>
              </div>
            </div>

            {/* Sheet Body */}
            <div className="overflow-y-auto p-5 space-y-4 no-scrollbar">
              {currentFasting ? (
                <div className="glass-obsidian rounded-[22px] p-8 text-center space-y-3">
                  <Moon className="mx-auto h-7 w-7 text-zinc-200" strokeWidth={1.6} />
                  <p className="text-base font-medium text-white">
                    Marcado como jejum
                  </p>
                </div>
              ) : (
                <>
                  {/* Instant Search / Automatic Calorie Input */}
                  {!customMode ? (
                    <div className="space-y-3">
                      <div className="glass-pill flex items-center gap-2.5 rounded-2xl px-4 py-3">
                        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                        <input
                          type="text"
                          value={query}
                          onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedFood(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && quickParsed.length > 0) {
                              e.preventDefault();
                              handleQuickAddParsed();
                            }
                          }}
                          placeholder="Ex: 150g arroz, 180g frango ou busque"
                          className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
                        />
                        {query && (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery("");
                              setSelectedFood(null);
                            }}
                            className="text-zinc-400 hover:text-white cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Auto-parsed quick line preview */}
                      {quickParsed.length > 0 && !selectedFood && (
                        <button
                          type="button"
                          onClick={handleQuickAddParsed}
                          className="w-full text-left glass-pill-active rounded-2xl p-3.5 transition-transform active:scale-[0.98] cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Sparkles className="h-4 w-4 shrink-0" />
                              <span className="text-xs font-medium truncate">
                                {quickParsed
                                  .map((p) => `${p.grams}g ${p.name}`)
                                  .join(" + ")}
                              </span>
                            </div>
                            <span className="text-xs font-semibold tabular-nums shrink-0">
                              +{quickParsed.reduce((s, i) => s + i.kcal, 0)} kcal
                            </span>
                          </div>
                        </button>
                      )}

                      {/* Selected food gram adjuster */}
                      {selectedFood ? (
                        <GlassCard className="p-4 space-y-4 !rounded-2xl">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">
                              {selectedFood.name}
                            </span>
                            <span className="text-sm font-semibold text-white tabular-nums">
                              {computeKcal(selectedFood.kcalPer100g, grams)} kcal
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <GlassButton
                                type="button"
                                onClick={() =>
                                  setGrams((g) => Math.max(10, g - 25))
                                }
                                className="h-9 w-9 !rounded-full p-0"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </GlassButton>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={grams}
                                onChange={(e) =>
                                  setGrams(Math.max(0, Number(e.target.value)))
                                }
                                className="glass-pill w-20 rounded-xl py-2 text-center text-sm text-white outline-none tabular-nums"
                              />
                              <span className="text-xs text-zinc-400">g</span>
                              <GlassButton
                                type="button"
                                onClick={() => setGrams((g) => g + 25)}
                                className="h-9 w-9 !rounded-full p-0"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </GlassButton>
                            </div>

                            <GlassButton
                              type="button"
                              active
                              onClick={handleConfirmSelectedFood}
                              className="h-10 px-4 text-xs font-medium"
                            >
                              Adicionar
                            </GlassButton>
                          </div>
                        </GlassCard>
                      ) : (
                        <div className="space-y-1.5">
                          {suggestions.map((food) => (
                            <button
                              key={food.name}
                              type="button"
                              onClick={() => {
                                setSelectedFood(food);
                                setGrams(food.defaultGrams);
                              }}
                              className="flex w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.08] cursor-pointer"
                            >
                              <span className="text-sm text-zinc-100 truncate pr-3">
                                {food.name}
                              </span>
                              <span className="text-xs text-zinc-400 tabular-nums shrink-0">
                                {computeKcal(food.kcalPer100g, food.defaultGrams)} kcal
                              </span>
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              setCustomMode(true);
                              setCustomName(query);
                            }}
                            className="w-full rounded-2xl border border-dashed border-white/15 py-2.5 text-xs text-zinc-400 hover:border-white/30 hover:text-white transition-colors cursor-pointer"
                          >
                            + Adicionar alimento personalizado
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <GlassCard className="p-4 space-y-3 !rounded-2xl">
                      <input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Nome do alimento"
                        className="glass-pill w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={customKcal}
                        onChange={(e) => setCustomKcal(e.target.value)}
                        placeholder="Calorias (kcal)"
                        className="glass-pill w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none tabular-nums"
                      />
                      <div className="flex items-center gap-2">
                        <GlassButton
                          type="button"
                          onClick={() => setCustomMode(false)}
                          className="flex-1 py-2.5 text-xs"
                        >
                          Voltar
                        </GlassButton>
                        <GlassButton
                          type="button"
                          active
                          onClick={handleAddCustom}
                          className="flex-1 py-2.5 text-xs font-medium"
                        >
                          Salvar
                        </GlassButton>
                      </div>
                    </GlassCard>
                  )}

                  {/* Current Meal Items */}
                  {currentItems.length > 0 && (
                    <div className="space-y-2 border-t border-white/10 pt-4">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs text-zinc-400">Adicionados</span>
                        <span className="text-xs font-medium text-white tabular-nums">
                          {currentMeal?.totalKcal ?? 0} kcal
                        </span>
                      </div>

                      {currentItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"
                        >
                          <div className="min-w-0 pr-3">
                            <span className="block text-sm text-white truncate">
                              {item.name}
                            </span>
                            <span className="text-xs text-zinc-400 tabular-nums">
                              {item.grams}g · {item.kcal} kcal
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label="Remover item"
                            className="text-zinc-500 hover:text-white p-1.5 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
