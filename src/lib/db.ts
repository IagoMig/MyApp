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
  monthKey: string; // YYYY-MM
  customTitle: string;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  id: "user",
  waterGoalMl: 3000,
  calorieGoal: 2200,
  weightKg: 75,
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
  }
}

export const db = new MyAppDatabase();

export async function ensureSettings(): Promise<UserSettings> {
  const existing = await db.settings.get("user");
  if (existing) return existing;
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
  ] = await Promise.all([
    db.settings.toArray(),
    db.waterLogs.toArray(),
    db.diaryEntries.toArray(),
    db.mealLogs.toArray(),
    db.customFoods.toArray(),
    db.runs.toArray(),
    db.progressPhotos.toArray(),
    db.bookMeta.toArray(),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    settings,
    waterLogs,
    diaryEntries,
    mealLogs,
    customFoods,
    runs,
    progressPhotos,
    bookMeta,
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
