import {
  getIsoWeekKey,
  getMonthKey,
  type RunSession,
  type WorkoutCategoryId,
  type WorkoutIntensity,
  type WorkoutSession,
} from "./db";
import { formatKm, formatPace } from "./running";

export interface WorkoutCategoryDef {
  id: WorkoutCategoryId;
  label: string;
  met: number;
  defaultMin: number;
  placeholder: string;
}

export const WORKOUT_CATEGORIES: WorkoutCategoryDef[] = [
  {
    id: "muay_thai",
    label: "Muay Thai",
    met: 9.5,
    defaultMin: 60,
    placeholder: "Ex: Sparring, saco, técnica",
  },
  {
    id: "musculacao",
    label: "Musculação",
    met: 5.5,
    defaultMin: 60,
    placeholder: "Ex: Peito e tríceps, pernas",
  },
  {
    id: "boxe",
    label: "Boxe",
    met: 9.0,
    defaultMin: 45,
    placeholder: "Ex: Sombra, manopla, rounds",
  },
  {
    id: "jiu_jitsu",
    label: "Jiu-Jitsu",
    met: 8.5,
    defaultMin: 60,
    placeholder: "Ex: Drill + rolas",
  },
  {
    id: "hiit",
    label: "HIIT",
    met: 9.8,
    defaultMin: 30,
    placeholder: "Ex: Circuito 30/30",
  },
  {
    id: "funcional",
    label: "Funcional",
    met: 7.5,
    defaultMin: 45,
    placeholder: "Ex: Core e explosão",
  },
  {
    id: "crossfit",
    label: "Crossfit",
    met: 8.5,
    defaultMin: 60,
    placeholder: "Ex: WOD + LPO",
  },
  {
    id: "ciclismo",
    label: "Ciclismo",
    met: 7.5,
    defaultMin: 45,
    placeholder: "Ex: Bike ergométrica ou rua",
  },
  {
    id: "natacao",
    label: "Natação",
    met: 7.8,
    defaultMin: 40,
    placeholder: "Ex: 1500m crawl",
  },
  {
    id: "futebol",
    label: "Futebol",
    met: 7.5,
    defaultMin: 60,
    placeholder: "Ex: Society / campo",
  },
  {
    id: "caminhada",
    label: "Caminhada",
    met: 3.8,
    defaultMin: 40,
    placeholder: "Ex: Caminhada acelerada",
  },
  {
    id: "yoga",
    label: "Yoga",
    met: 3.0,
    defaultMin: 40,
    placeholder: "Ex: Mobilidade e alongamento",
  },
  {
    id: "outro",
    label: "Outro",
    met: 6.0,
    defaultMin: 45,
    placeholder: "Ex: Pular corda, remo, escada",
  },
];

export const INTENSITY_CONFIG: Record<
  WorkoutIntensity,
  { label: string; multiplier: number }
> = {
  leve: { label: "Leve", multiplier: 0.82 },
  moderado: { label: "Moderado", multiplier: 1.0 },
  intenso: { label: "Intenso", multiplier: 1.22 },
};

export function getCategoryDef(id: WorkoutCategoryId): WorkoutCategoryDef {
  return (
    WORKOUT_CATEGORIES.find((c) => c.id === id) ??
    WORKOUT_CATEGORIES[WORKOUT_CATEGORIES.length - 1]
  );
}

/**
 * Standard Compendium of Physical Activities MET formula:
 * kcal = (MET * intensityFactor * 3.5 * weightKg / 200) * durationMin
 */
export function estimateWorkoutCalories(
  category: WorkoutCategoryId,
  durationMin: number,
  weightKg: number,
  intensity: WorkoutIntensity = "moderado"
): number {
  const safeMin = Math.max(0, Number(durationMin) || 0);
  if (safeMin <= 0) return 0;
  const safeWeight = Math.max(35, Number(weightKg) || 75);
  const def = getCategoryDef(category);
  const mult = INTENSITY_CONFIG[intensity]?.multiplier ?? 1;
  return Math.round(((def.met * mult * 3.5 * safeWeight) / 200) * safeMin);
}

export interface UnifiedWorkoutEntry {
  uid: string;
  source: "workout" | "run";
  originalId?: number;
  date: string;
  weekKey: string;
  monthKey: string;
  categoryLabel: string;
  title: string;
  subtitle: string;
  durationMin: number;
  caloriesBurned: number;
  intensity?: WorkoutIntensity;
  notes?: string;
  distanceKm?: number;
  avgPaceSecPerKm?: number;
  createdAt: number;
}

export function mergeWorkoutsAndRuns(
  workouts: WorkoutSession[],
  runs: RunSession[]
): UnifiedWorkoutEntry[] {
  const workoutItems: UnifiedWorkoutEntry[] = workouts.map((w) => {
    const def = getCategoryDef(w.category);
    const intensityLabel = INTENSITY_CONFIG[w.intensity]?.label ?? "Moderado";
    return {
      uid: `w_${w.id ?? w.createdAt}`,
      source: "workout",
      originalId: w.id,
      date: w.date,
      weekKey: w.weekKey || getIsoWeekKey(w.date),
      monthKey: w.monthKey || getMonthKey(w.date),
      categoryLabel: def.label,
      title: w.name.trim() || def.label,
      subtitle: `${w.durationMin} min · ${intensityLabel}`,
      durationMin: w.durationMin,
      caloriesBurned: w.caloriesBurned,
      intensity: w.intensity,
      notes: w.notes,
      createdAt: w.createdAt,
    };
  });

  const runItems: UnifiedWorkoutEntry[] = runs.map((r) => {
    const durationMin = Math.max(1, Math.round(r.durationSec / 60));
    return {
      uid: `r_${r.id ?? r.startedAt}`,
      source: "run",
      originalId: r.id,
      date: r.date,
      weekKey: getIsoWeekKey(r.date),
      monthKey: r.monthKey || getMonthKey(r.date),
      categoryLabel: "Corrida",
      title: "Corrida",
      subtitle: `${formatKm(r.distanceKm)} km · ${formatPace(r.avgPaceSecPerKm)}/km · ${durationMin} min`,
      durationMin,
      caloriesBurned: r.caloriesBurned,
      distanceKm: r.distanceKm,
      avgPaceSecPerKm: r.avgPaceSecPerKm,
      createdAt: r.startedAt,
    };
  });

  return [...workoutItems, ...runItems].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });
}

export interface ModalityBreakdownItem {
  label: string;
  count: number;
  minutes: number;
  calories: number;
  pctCalories: number;
}

export interface WorkoutPeriodSummary {
  totalSessions: number;
  manualCount: number;
  runCount: number;
  totalMinutes: number;
  totalCalories: number;
  totalRunKm: number;
  activeDays: number;
  breakdown: ModalityBreakdownItem[];
}

export function summarizeUnifiedWorkouts(
  entries: UnifiedWorkoutEntry[]
): WorkoutPeriodSummary {
  let manualCount = 0;
  let runCount = 0;
  let totalMinutes = 0;
  let totalCalories = 0;
  let totalRunKm = 0;
  const activeDates = new Set<string>();
  const byModality = new Map<
    string,
    { label: string; count: number; minutes: number; calories: number }
  >();

  for (const item of entries) {
    if (item.source === "run") {
      runCount += 1;
      totalRunKm += item.distanceKm ?? 0;
    } else {
      manualCount += 1;
    }
    totalMinutes += item.durationMin;
    totalCalories += item.caloriesBurned;
    activeDates.add(item.date);

    const key = item.categoryLabel;
    const prev = byModality.get(key) ?? {
      label: key,
      count: 0,
      minutes: 0,
      calories: 0,
    };
    prev.count += 1;
    prev.minutes += item.durationMin;
    prev.calories += item.caloriesBurned;
    byModality.set(key, prev);
  }

  const breakdown: ModalityBreakdownItem[] = Array.from(byModality.values())
    .sort((a, b) => b.calories - a.calories || b.count - a.count)
    .map((m) => ({
      ...m,
      pctCalories:
        totalCalories > 0 ? Math.round((m.calories / totalCalories) * 100) : 0,
    }));

  return {
    totalSessions: entries.length,
    manualCount,
    runCount,
    totalMinutes,
    totalCalories,
    totalRunKm,
    activeDays: activeDates.size,
    breakdown,
  };
}

export function formatMinutesHuman(totalMin: number): string {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem} min`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}
