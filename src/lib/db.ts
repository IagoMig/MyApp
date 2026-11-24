import Dexie, { type EntityTable } from "dexie";
import type {
  DiaryFontId,
  DiaryFontSize,
  DiaryPaperStyle,
  DiaryTextAlign,
} from "./fonts";

export interface UserSettings {
  id: "user";
  waterGoalMl: number;
  calorieGoal: number;
  weightKg: number;
  weightGoalKg?: number;
  startWeightKg?: number;
  mealSlots: string[];
  updatedAt: number;
}

export interface WaterLog {
  id?: number;
  date: string; // YYYY-MM-DD
  amountMl: number;
  createdAt: number;
}

export interface DiaryEntry {
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  title: string;
  contentHtml: string;
  plainText: string;
  fontFamily: DiaryFontId;
  fontSize: DiaryFontSize;
  textColor: string;
  textAlign: DiaryTextAlign;
  paperStyle: DiaryPaperStyle;
  createdAt: number;
  updatedAt: number;
}

export interface MealItem {
  id: string;
  name: string;
  grams: number;
  kcal: number;
}

export interface MealLog {
  id: string; // `${date}_${slotIndex}`
  date: string; // YYYY-MM-DD
  slotIndex: number; // 0..3
  isFasting: boolean;
  items: MealItem[];
  totalKcal: number;
  updatedAt: number;
}

export interface CustomFood {
  id?: number;
  name: string;
  kcalPer100g: number;
  defaultGrams: number;
  createdAt: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  ts: number;
}

export interface RunSession {
  id?: number;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  startedAt: number;
  endedAt: number;
  durationSec: number;
  distanceKm: number;
  avgPaceSecPerKm: number;
  caloriesBurned: number;
  route: RoutePoint[];
}

export type PhotoAngle = "frente" | "lado" | "costas";

export interface ProgressPhoto {
  id?: number;
  date: string; // YYYY-MM-DD
  angle: PhotoAngle;
  weightKg?: number;
  dataUrl: string;
  createdAt: number;
}

export interface MonthlyBookMeta {
  monthKey: string; // YYYY-MM or prefixed key (photos:..., workouts:...)
  customTitle: string;
  updatedAt: number;
}

export interface WeightLog {
  id?: number;
  date: string; // YYYY-MM-DD
  weekKey: string; // YYYY-Www (ISO week)
  monthKey: string; // YYYY-MM
  weightKg: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export type WorkoutCategoryId =
  | "musculacao"
  | "muay_thai"
  | "jiu_jitsu"
  | "boxe"
  | "hiit"
  | "funcional"
  | "crossfit"
  | "ciclismo"
  | "natacao"
  | "futebol"
  | "caminhada"
  | "yoga"
  | "outro";

export type WorkoutIntensity = "leve" | "moderado" | "intenso";

export interface WorkoutSession {
  id?: number;
  date: string; // YYYY-MM-DD
  weekKey: string; // YYYY-Www
  monthKey: string; // YYYY-MM
  category: WorkoutCategoryId;
  name: string;
  durationMin: number;
  intensity: WorkoutIntensity;
  caloriesBurned: number;
  notes?: string;
  createdAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: "user",
  waterGoalMl: 3000,
  calorieGoal: 2200,
  weightKg: 75,
  weightGoalKg: 70,
  startWeightKg: undefined,
  mealSlots: ["Café", "Almoço", "Lanche", "Jantar"],
  updatedAt: 0,
};

class MyAppDatabase extends Dexie {
  settings!: EntityTable<UserSettings, "id">;
  waterLogs!: EntityTable<WaterLog, "id">;
  diaryEntries!: EntityTable<DiaryEntry, "date">;
  mealLogs!: EntityTable<MealLog, "id">;
  customFoods!: EntityTable<CustomFood, "id">;
  runs!: EntityTable<RunSession, "id">;
  progressPhotos!: EntityTable<ProgressPhoto, "id">;
  bookMeta!: EntityTable<MonthlyBookMeta, "monthKey">;
  weightLogs!: EntityTable<WeightLog, "id">;
  workouts!: EntityTable<WorkoutSession, "id">;

  constructor() {
    super("MyAppLocalDB");

    this.version(1).stores({
      settings: "id",
      waterLogs: "++id, date, createdAt",
      diaryEntries: "date, monthKey, updatedAt",
    });

    this.version(2).stores({
      settings: "id",
      waterLogs: "++id, date, createdAt",
      diaryEntries: "date, monthKey, updatedAt",
      mealLogs: "id, date, [date+slotIndex]",
      customFoods: "++id, name",
      runs: "++id, date, monthKey, startedAt",
      progressPhotos: "++id, date, angle, createdAt",
      bookMeta: "monthKey",
    });

    this.version(3).stores({
      settings: "id",
      waterLogs: "++id, date, createdAt",
      diaryEntries: "date, monthKey, updatedAt",
      mealLogs: "id, date, [date+slotIndex]",
      customFoods: "++id, name",
      runs: "++id, date, monthKey, startedAt",
      progressPhotos: "++id, date, angle, createdAt",
      bookMeta: "monthKey",
      weightLogs: "++id, date, weekKey, monthKey, createdAt",
      workouts: "++id, date, weekKey, monthKey, category, createdAt",
    });
  }
}

export const db = new MyAppDatabase();

export async function ensureSettings(): Promise<UserSettings> {
  const existing = await db.settings.get("user");
  if (existing) {
    if (existing.weightGoalKg === undefined) {
      const patched: UserSettings = {
        ...existing,
        weightGoalKg: Math.max(40, Number((existing.weightKg - 5).toFixed(1))),
      };
      await db.settings.put(patched);
      return patched;
    }
    return existing;
  }
  const created: UserSettings = {
    ...DEFAULT_SETTINGS,
    updatedAt: Date.now(),
  };
  await db.settings.put(created);
  return created;
}

export async function updateSettings(
  partial: Partial<Omit<UserSettings, "id">>
): Promise<UserSettings> {
  const current = await ensureSettings();
  const next: UserSettings = {
    ...current,
    ...partial,
    id: "user",
    updatedAt: Date.now(),
  };
  await db.settings.put(next);
  return next;
}

export async function addWater(date: string, amountMl: number): Promise<void> {
  await db.waterLogs.add({
    date,
    amountMl,
    createdAt: Date.now(),
  });
}

export async function undoLastWater(date: string): Promise<void> {
  const logs = await db.waterLogs.where("date").equals(date).sortBy("createdAt");
  const last = logs[logs.length - 1];
  if (last?.id !== undefined) {
    await db.waterLogs.delete(last.id);
  }
}

export function getMealLogId(date: string, slotIndex: number): string {
  return `${date}_${slotIndex}`;
}

export async function saveMealLog(
  date: string,
  slotIndex: number,
  data: { isFasting: boolean; items: MealItem[] }
): Promise<void> {
  const totalKcal = data.isFasting
    ? 0
    : data.items.reduce((sum, item) => sum + Math.max(0, Math.round(item.kcal)), 0);

  await db.mealLogs.put({
    id: getMealLogId(date, slotIndex),
    date,
    slotIndex,
    isFasting: data.isFasting,
    items: data.items,
    totalKcal,
    updatedAt: Date.now(),
  });
}

export async function saveWeeklyWeight(data: {
  date: string;
  weightKg: number;
  note?: string;
}): Promise<void> {
  const cleanWeight = Number(data.weightKg.toFixed(1));
  const weekKey = getIsoWeekKey(data.date);
  const monthKey = getMonthKey(data.date);
  const now = Date.now();

  const existing = await db.weightLogs.where("weekKey").equals(weekKey).first();
  if (existing?.id !== undefined) {
    await db.weightLogs.put({
      ...existing,
      date: data.date,
      weekKey,
      monthKey,
      weightKg: cleanWeight,
      note: data.note?.trim() || undefined,
      updatedAt: now,
    });
  } else {
    await db.weightLogs.add({
      date: data.date,
      weekKey,
      monthKey,
      weightKg: cleanWeight,
      note: data.note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  const allLogs = await db.weightLogs.orderBy("date").toArray();
  if (allLogs.length > 0) {
    const latest = allLogs[allLogs.length - 1];
    const earliest = allLogs[0];
    const currentSettings = await ensureSettings();
    await updateSettings({
      weightKg: latest.weightKg,
      startWeightKg: currentSettings.startWeightKg ?? earliest.weightKg,
    });
  }
}

export async function deleteWeightLog(id: number): Promise<void> {
  await db.weightLogs.delete(id);
  const allLogs = await db.weightLogs.orderBy("date").toArray();
  if (allLogs.length > 0) {
    const latest = allLogs[allLogs.length - 1];
    await updateSettings({ weightKg: latest.weightKg });
  }
}

export interface FullBackupPayload {
  version: number;
  exportedAt: string;
  settings: UserSettings[];
  waterLogs: WaterLog[];
  diaryEntries: DiaryEntry[];
  mealLogs: MealLog[];
  customFoods: CustomFood[];
  runs: RunSession[];
  progressPhotos: ProgressPhoto[];
  bookMeta: MonthlyBookMeta[];
  weightLogs?: WeightLog[];
  workouts?: WorkoutSession[];
}

export async function exportAllData(): Promise<FullBackupPayload> {
  const [
    settings,
    waterLogs,
    diaryEntries,
    mealLogs,
    customFoods,
    runs,
    progressPhotos,
    bookMeta,
    weightLogs,
    workouts,
  ] = await Promise.all([
    db.settings.toArray(),
    db.waterLogs.toArray(),
    db.diaryEntries.toArray(),
    db.mealLogs.toArray(),
    db.customFoods.toArray(),
    db.runs.toArray(),
    db.progressPhotos.toArray(),
    db.bookMeta.toArray(),
    db.weightLogs.toArray(),
    db.workouts.toArray(),
  ]);

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    settings,
    waterLogs,
    diaryEntries,
    mealLogs,
    customFoods,
    runs,
    progressPhotos,
    bookMeta,
    weightLogs,
    workouts,
  };
}

export async function importAllData(payload: FullBackupPayload): Promise<void> {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.diaryEntries)) {
    throw new Error("Arquivo de backup inválido");
  }

  await db.transaction(
    "rw",
    [
      db.settings,
      db.waterLogs,
      db.diaryEntries,
      db.mealLogs,
      db.customFoods,
      db.runs,
      db.progressPhotos,
      db.bookMeta,
      db.weightLogs,
      db.workouts,
    ],
    async () => {
      if (payload.settings?.length) {
        await db.settings.clear();
        await db.settings.bulkPut(payload.settings);
      }
      if (Array.isArray(payload.waterLogs)) {
        await db.waterLogs.clear();
        await db.waterLogs.bulkPut(payload.waterLogs);
      }
      if (Array.isArray(payload.diaryEntries)) {
        await db.diaryEntries.clear();
        await db.diaryEntries.bulkPut(payload.diaryEntries);
      }
      if (Array.isArray(payload.mealLogs)) {
        await db.mealLogs.clear();
        await db.mealLogs.bulkPut(payload.mealLogs);
      }
      if (Array.isArray(payload.customFoods)) {
        await db.customFoods.clear();
        await db.customFoods.bulkPut(payload.customFoods);
      }
      if (Array.isArray(payload.runs)) {
        await db.runs.clear();
        await db.runs.bulkPut(payload.runs);
      }
      if (Array.isArray(payload.progressPhotos)) {
        await db.progressPhotos.clear();
        await db.progressPhotos.bulkPut(payload.progressPhotos);
      }
      if (Array.isArray(payload.bookMeta)) {
        await db.bookMeta.clear();
        await db.bookMeta.bulkPut(payload.bookMeta);
      }
      if (Array.isArray(payload.weightLogs)) {
        await db.weightLogs.clear();
        await db.weightLogs.bulkPut(payload.weightLogs);
      }
      if (Array.isArray(payload.workouts)) {
        await db.workouts.clear();
        await db.workouts.bulkPut(payload.workouts);
      }
    }
  );
}

export function getDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return getDateKey(dt);
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1 + deltaMonths, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

export function getMonthKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** ISO-8601 week key (Monday–Sunday), e.g. "2026-W48" */
export function getIsoWeekKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7; // Mon=1 .. Sun=7
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getWeekBounds(dateKey: string): {
  startDate: string;
  endDate: string;
  weekKey: string;
  days: string[];
} {
  const dt = parseDateKey(dateKey);
  const day = dt.getDay(); // Sun=0, Mon=1..Sat=6
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + diffToMon);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    days.push(getDateKey(cur));
  }
  return {
    startDate: days[0],
    endDate: days[6],
    weekKey: getIsoWeekKey(days[0]),
    days,
  };
}

export function shiftWeekDateKey(dateKey: string, deltaWeeks: number): string {
  return shiftDateKey(dateKey, deltaWeeks * 7);
}

export function formatWeekRangePt(startDate: string, endDate: string): string {
  return `${formatShortDatePt(startDate)} – ${formatShortDatePt(endDate)}`;
}

export function formatFullDatePt(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(dt)
    .replace(/\./g, "");
}

export function formatWeightKg(kg: number): string {
  return kg.toFixed(1).replace(".", ",");
}

export function daysBetweenDateKeys(a: string, b: string): number {
  const da = parseDateKey(a).getTime();
  const dbTime = parseDateKey(b).getTime();
  return Math.round((dbTime - da) / 86400000);
}

export function formatLongDatePt(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
  }).format(dt);
}

export function formatShortDatePt(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(dt)
    .replace(".", "");
}

export function formatShortDayPt(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
  })
    .format(dt)
    .replace(".", "")
    .slice(0, 3);
}

export function formatMonthYearPt(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, 1);
  const raw = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(dt);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getSurroundingDays(centerDateKey: string): string[] {
  const days: string[] = [];
  for (let offset = -3; offset <= 3; offset++) {
    days.push(shiftDateKey(centerDateKey, offset));
  }
  return days;
}

export function sanitizeDiaryHtml(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allowedTags = new Set([
    "B",
    "STRONG",
    "I",
    "EM",
    "U",
    "S",
    "STRIKE",
    "DIV",
    "P",
    "BR",
    "H2",
    "BLOCKQUOTE",
    "UL",
    "OL",
    "LI",
    "HR",
    "SPAN",
    "FONT",
  ]);

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!allowedTags.has(el.tagName)) {
          if (el.tagName === "SCRIPT" || el.tagName === "STYLE") {
            el.remove();
            continue;
          }
          const fragment = doc.createDocumentFragment();
          while (el.firstChild) fragment.appendChild(el.firstChild);
          el.replaceWith(fragment);
          walk(node);
          continue;
        }
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          if (name === "color" && el.tagName === "FONT") continue;
          if (name === "style") {
            const safeColor = el.style.color;
            const safeBg = el.style.backgroundColor;
            const safeAlign = el.style.textAlign;
            el.removeAttribute("style");
            if (safeColor) el.style.color = safeColor;
            if (safeBg) el.style.backgroundColor = safeBg;
            if (safeAlign) el.style.textAlign = safeAlign;
            continue;
          }
          el.removeAttribute(attr.name);
        }
        walk(el);
      }
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}
