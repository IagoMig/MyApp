import {
  formatLongDatePt,
  formatMonthYearPt,
  formatShortDatePt,
  formatWeekRangePt,
  getDateKey,
  getMonthKey,
  getWeekBounds,
  parseDateKey,
  shiftDateKey,
  shiftMonthKey,
  shiftWeekDateKey,
} from "./db";

export type PeriodMode = "daily" | "yesterday" | "weekly" | "monthly";

export interface PeriodRange {
  mode: PeriodMode;
  anchorDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (inclusive)
  monthKey: string; // YYYY-MM
  weekKey: string; // YYYY-Www
  days: string[];
  daysCount: number;
  label: string;
  shortLabel: string;
  isSingleDay: boolean;
}

export function getMonthDateBounds(monthKey: string): {
  startDate: string;
  endDate: string;
  daysCount: number;
  days: string[];
} {
  const [y, m] = monthKey.split("-").map(Number);
  const year = y || new Date().getFullYear();
  const monthIdx = (m || 1) - 1;
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(
      `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return {
    startDate: days[0],
    endDate: days[days.length - 1],
    daysCount: lastDay,
    days,
  };
}

export function resolvePeriodRange(
  mode: PeriodMode,
  anchorDate: string,
  todayKey: string = getDateKey()
): PeriodRange {
  const yesterdayKey = shiftDateKey(todayKey, -1);

  if (mode === "yesterday") {
    const wb = getWeekBounds(yesterdayKey);
    return {
      mode,
      anchorDate: yesterdayKey,
      startDate: yesterdayKey,
      endDate: yesterdayKey,
      monthKey: getMonthKey(yesterdayKey),
      weekKey: wb.weekKey,
      days: [yesterdayKey],
      daysCount: 1,
      label: `Ontem · ${formatShortDatePt(yesterdayKey)}`,
      shortLabel: "Ontem",
      isSingleDay: true,
    };
  }

  if (mode === "daily") {
    const wb = getWeekBounds(anchorDate);
    const isToday = anchorDate === todayKey;
    const isYesterday = anchorDate === yesterdayKey;
    return {
      mode,
      anchorDate,
      startDate: anchorDate,
      endDate: anchorDate,
      monthKey: getMonthKey(anchorDate),
      weekKey: wb.weekKey,
      days: [anchorDate],
      daysCount: 1,
      label: isToday
        ? `Hoje · ${formatShortDatePt(anchorDate)}`
        : isYesterday
          ? `Ontem · ${formatShortDatePt(anchorDate)}`
          : formatLongDatePt(anchorDate),
      shortLabel: isToday ? "Hoje" : formatShortDatePt(anchorDate),
      isSingleDay: true,
    };
  }

  if (mode === "weekly") {
    const wb = getWeekBounds(anchorDate);
    const weekNum = wb.weekKey.split("-W")[1];
    return {
      mode,
      anchorDate,
      startDate: wb.startDate,
      endDate: wb.endDate,
      monthKey: getMonthKey(anchorDate),
      weekKey: wb.weekKey,
      days: wb.days,
      daysCount: 7,
      label: `Sem ${weekNum} · ${formatWeekRangePt(wb.startDate, wb.endDate)}`,
      shortLabel: `Sem ${weekNum}`,
      isSingleDay: false,
    };
  }

  // monthly
  const mKey = getMonthKey(anchorDate);
  const mb = getMonthDateBounds(mKey);
  const wb = getWeekBounds(anchorDate);
  return {
    mode,
    anchorDate,
    startDate: mb.startDate,
    endDate: mb.endDate,
    monthKey: mKey,
    weekKey: wb.weekKey,
    days: mb.days,
    daysCount: mb.daysCount,
    label: formatMonthYearPt(mKey),
    shortLabel: formatMonthYearPt(mKey),
    isSingleDay: false,
  };
}

export function isDateInPeriod(dateKey: string, range: PeriodRange): boolean {
  return dateKey >= range.startDate && dateKey <= range.endDate;
}

export function stepPeriodAnchor(
  mode: PeriodMode,
  anchorDate: string,
  delta: -1 | 1,
  todayKey: string = getDateKey()
): { nextMode: PeriodMode; nextAnchor: string } {
  const yesterdayKey = shiftDateKey(todayKey, -1);

  if (mode === "yesterday") {
    const next = shiftDateKey(yesterdayKey, delta);
    return {
      nextMode: next === yesterdayKey ? "yesterday" : "daily",
      nextAnchor: next,
    };
  }

  if (mode === "daily") {
    const next = shiftDateKey(anchorDate, delta);
    return {
      nextMode: next === yesterdayKey ? "yesterday" : "daily",
      nextAnchor: next,
    };
  }

  if (mode === "weekly") {
    return {
      nextMode: "weekly",
      nextAnchor: shiftWeekDateKey(anchorDate, delta),
    };
  }

  // monthly
  const nextMonth = shiftMonthKey(getMonthKey(anchorDate), delta);
  const dt = parseDateKey(`${nextMonth}-01`);
  return {
    nextMode: "monthly",
    nextAnchor: getDateKey(dt),
  };
}
