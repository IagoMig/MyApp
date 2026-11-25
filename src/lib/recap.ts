import {
  DEFAULT_SETTINGS,
  formatLongDatePt,
  parseDateKey,
  type DiaryEntry,
  type MealLog,
  type ProgressPhoto,
  type RunSession,
  type UserSettings,
  type WaterLog,
  type WeightLog,
  type WorkoutSession,
} from "./db";
import {
  formatMinutesHuman,
  mergeWorkoutsAndRuns,
  summarizeUnifiedWorkouts,
  type UnifiedWorkoutEntry,
  type WorkoutPeriodSummary,
} from "./workouts";
import { formatKm } from "./running";

export interface DailyRecapData {
  date: string;
  waterMl: number;
  waterGoalMl: number;
  waterPct: number;
  caloriesConsumed: number;
  caloriesBurned: number;
  calorieGoal: number;
  netCalories: number;
  mealLogs: MealLog[];
  mealsRecordedCount: number;
  fastingCount: number;
  mealSlots: string[];
  activities: UnifiedWorkoutEntry[];
  workoutSummary: WorkoutPeriodSummary;
  diary?: DiaryEntry;
  hasDiary: boolean;
  weightLog?: WeightLog;
  photos: ProgressPhoto[];
  hasAnyData: boolean;
}

export function buildDailyRecap(params: {
  date: string;
  settings?: UserSettings;
  waterLogs: WaterLog[];
  mealLogs: MealLog[];
  workouts: WorkoutSession[];
  runs: RunSession[];
  diary?: DiaryEntry;
  weightLog?: WeightLog;
  photos: ProgressPhoto[];
}): DailyRecapData {
  const activeSettings = params.settings ?? DEFAULT_SETTINGS;
  const waterMl = params.waterLogs.reduce((s, w) => s + w.amountMl, 0);
  const waterGoalMl = Math.max(1, activeSettings.waterGoalMl);
  const waterPct = Math.min(100, Math.round((waterMl / waterGoalMl) * 100));

  const sortedMeals = [...params.mealLogs].sort(
    (a, b) => a.slotIndex - b.slotIndex
  );
  const caloriesConsumed = sortedMeals.reduce(
    (s, m) => s + (m.isFasting ? 0 : m.totalKcal),
    0
  );
  const fastingCount = sortedMeals.filter((m) => m.isFasting).length;
  const mealsRecordedCount = sortedMeals.filter(
    (m) => m.isFasting || m.totalKcal > 0 || m.items.length > 0
  ).length;

  const activities = mergeWorkoutsAndRuns(params.workouts, params.runs);
  const workoutSummary = summarizeUnifiedWorkouts(activities);
  const caloriesBurned = workoutSummary.totalCalories;
  const netCalories = caloriesConsumed - caloriesBurned;

  const hasDiary = Boolean(
    params.diary &&
      (params.diary.title.trim().length > 0 ||
        params.diary.plainText.trim().length > 0)
  );

  const hasAnyData =
    waterMl > 0 ||
    mealsRecordedCount > 0 ||
    activities.length > 0 ||
    hasDiary ||
    Boolean(params.weightLog) ||
    params.photos.length > 0;

  return {
    date: params.date,
    waterMl,
    waterGoalMl,
    waterPct,
    caloriesConsumed,
    caloriesBurned,
    calorieGoal: activeSettings.calorieGoal,
    netCalories,
    mealLogs: sortedMeals,
    mealsRecordedCount,
    fastingCount,
    mealSlots: activeSettings.mealSlots,
    activities,
    workoutSummary,
    diary: params.diary,
    hasDiary,
    weightLog: params.weightLog,
    photos: params.photos,
    hasAnyData,
  };
}

export function formatWeekdayYearPt(dateKey: string): string {
  const dt = parseDateKey(dateKey);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(dt);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${dt.getFullYear()}`;
}

export function formatLitersPt(ml: number): string {
  return (ml / 1000).toFixed(2).replace(".", ",");
}

export type StoryStyle = "glass" | "noir";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawGlassPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: StoryStyle
) {
  ctx.save();
  drawRoundedRect(ctx, x, y, w, h, r);

  if (style === "glass") {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, "rgba(255,255,255,0.13)");
    grad.addColorStop(0.55, "rgba(255,255,255,0.04)");
    grad.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.stroke();

    // Specular top highlight
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1.5);
    ctx.lineTo(x + w - r, y + 1.5);
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.stroke();
  }
  ctx.restore();
}

function drawStoryPie(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  consumed: number,
  burned: number
) {
  const total = consumed + burned;
  const innerR = radius * 0.54;

  // Base subtle circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fill();

  if (total > 0) {
    const startAngle = -Math.PI / 2;
    const consumedAngle = (consumed / total) * Math.PI * 2;

    if (consumed > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + consumedAngle);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    if (burned > 0) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(
        cx,
        cy,
        radius,
        startAngle + consumedAngle,
        startAngle + Math.PI * 2
      );
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.30)";
      ctx.fill();
    }

    // Crisp black slice separator when both slices exist
    if (consumed > 0 && burned > 0) {
      ctx.strokeStyle = "#060608";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(startAngle) * (radius + 2),
        cy + Math.sin(startAngle) * (radius + 2)
      );
      ctx.moveTo(cx, cy);
      ctx.lineTo(
        cx + Math.cos(startAngle + consumedAngle) * (radius + 2),
        cy + Math.sin(startAngle + consumedAngle) * (radius + 2)
      );
      ctx.stroke();
    }
  }

  // Donut inner cutout
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = "#09090b";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.stroke();

  // Center text
  const burnPct = total > 0 ? Math.round((burned / total) * 100) : 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 30px Inter, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(total > 0 ? `${burnPct}%` : "—", cx, cy - 10);

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = "500 16px Inter, -apple-system, sans-serif";
  ctx.fillText("GASTO", cx, cy + 18);
  ctx.restore();
}

/**
 * Generates an Instagram Story optimized 1080x1920 PNG Blob (9:16),
 * strictly monochrome black & white glassmorphism, without before/after photos.
 */
export async function renderStoryPngBlob(
  recap: DailyRecapData,
  style: StoryStyle = "glass"
): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed with fallback fonts
    }
  }

  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  // 1. Pure obsidian black backdrop
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, H);

  if (style === "glass") {
    // Ambient monochrome light orbs
    const orb1 = ctx.createRadialGradient(140, 220, 20, 140, 220, 560);
    orb1.addColorStop(0, "rgba(255,255,255,0.20)");
    orb1.addColorStop(0.5, "rgba(180,180,190,0.06)");
    orb1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, W, H);

    const orb2 = ctx.createRadialGradient(960, 860, 20, 960, 860, 540);
    orb2.addColorStop(0, "rgba(240,240,248,0.16)");
    orb2.addColorStop(0.5, "rgba(140,140,150,0.05)");
    orb2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, W, H);

    const orb3 = ctx.createRadialGradient(280, 1680, 20, 280, 1680, 520);
    orb3.addColorStop(0, "rgba(255,255,255,0.13)");
    orb3.addColorStop(0.55, "rgba(150,150,160,0.04)");
    orb3.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = orb3;
    ctx.fillRect(0, 0, W, H);

    // Fine monochrome dot matrix
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let x = 40; x < W; x += 48) {
      for (let y = 40; y < H; y += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const padX = 76;
  const cardW = W - padX * 2;

  // 2. Top editorial header (safe margin for Instagram Story top chrome)
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Brand pill
  drawGlassPanel(ctx, padX, 150, 428, 56, 28, style);
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "600 20px Inter, -apple-system, sans-serif";
  ctx.fillText("MY APP  ·  RETROSPECTIVA DO DIA", padX + 30, 186);

  // Date display
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 72px 'Playfair Display', Georgia, serif";
  ctx.fillText(formatLongDatePt(recap.date), padX, 304);

  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = "400 28px Inter, -apple-system, sans-serif";
  ctx.fillText(formatWeekdayYearPt(recap.date), padX, 356);

  // 3. Card 1 — Hydration
  const card1Y = 418;
  const card1H = 264;
  drawGlassPanel(ctx, padX, card1Y, cardW, card1H, 44, style);

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = "600 22px Inter, -apple-system, sans-serif";
  ctx.fillText("HIDRATAÇÃO", padX + 46, card1Y + 62);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "400 34px Inter, -apple-system, sans-serif";
  ctx.fillText("Você bebeu", padX + 46, card1Y + 126);

  const litersStr = formatLitersPt(recap.waterMl);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 62px Inter, -apple-system, sans-serif";
  const waterMeasure = ctx.measureText(`${litersStr} L`);
  ctx.fillText(`${litersStr} L`, padX + 46, card1Y + 194);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "400 34px Inter, -apple-system, sans-serif";
  ctx.fillText("de água", padX + 64 + waterMeasure.width, card1Y + 192);

  // Right pct badge
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.font = "500 26px Inter, -apple-system, sans-serif";
  ctx.fillText(
    `${recap.waterPct}% da meta (${(recap.waterGoalMl / 1000).toFixed(1).replace(".", ",")} L)`,
    padX + cardW - 46,
    card1Y + 62
  );
  ctx.textAlign = "left";

  // Water progress bar
  const barX = padX + 46;
  const barY = card1Y + 220;
  const barW = cardW - 92;
  const barH = 14;
  drawRoundedRect(ctx, barX, barY, barW, barH, 7);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  ctx.fill();

  if (recap.waterPct > 0) {
    const fillW = Math.max(20, (barW * recap.waterPct) / 100);
    drawRoundedRect(ctx, barX, barY, fillW, barH, 7);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
    barGrad.addColorStop(0, "rgba(212,212,216,0.85)");
    barGrad.addColorStop(1, "#ffffff");
    ctx.fillStyle = barGrad;
    ctx.fill();
  }

  // 4. Card 2 — Calories Consumed x Burned + Monochrome Pie Chart
  const card2Y = card1Y + card1H + 34;
  const card2H = 384;
  drawGlassPanel(ctx, padX, card2Y, cardW, card2H, 44, style);

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = "600 22px Inter, -apple-system, sans-serif";
  ctx.fillText("CALORIAS  ·  CONSUMIDAS × GASTADAS", padX + 46, card2Y + 62);

  // Left stats
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "400 28px Inter, -apple-system, sans-serif";
  ctx.fillText("Você ingeriu", padX + 46, card2Y + 126);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 54px Inter, -apple-system, sans-serif";
  ctx.fillText(
    `${recap.caloriesConsumed.toLocaleString("pt-BR")} kcal`,
    padX + 46,
    card2Y + 184
  );

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "400 28px Inter, -apple-system, sans-serif";
  ctx.fillText("Você queimou", padX + 46, card2Y + 246);

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 54px Inter, -apple-system, sans-serif";
  ctx.fillText(
    `${recap.caloriesBurned.toLocaleString("pt-BR")} kcal`,
    padX + 46,
    card2Y + 304
  );

  // Net pill
  const netSign = recap.netCalories > 0 ? "+" : "";
  ctx.fillStyle = "rgba(255,255,255,0.52)";
  ctx.font = "500 24px Inter, -apple-system, sans-serif";
  ctx.fillText(
    `Saldo do dia: ${netSign}${recap.netCalories.toLocaleString("pt-BR")} kcal`,
    padX + 46,
    card2Y + 348
  );

  // Right pie chart
  drawStoryPie(
    ctx,
    padX + cardW - 166,
    card2Y + 216,
    114,
    recap.caloriesConsumed,
    recap.caloriesBurned
  );

  // 5. Card 3 — Workouts & Runs
  const card3Y = card2Y + card2H + 34;
  const card3H = 382;
  drawGlassPanel(ctx, padX, card3Y, cardW, card3H, 44, style);

  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = "600 22px Inter, -apple-system, sans-serif";
  ctx.fillText("TREINOS & MOVIMENTO", padX + 46, card3Y + 62);

  const count = recap.workoutSummary.totalSessions;
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 54px Inter, -apple-system, sans-serif";
  const trainHeadline =
    count === 0
      ? "Dia de descanso"
      : count === 1
        ? "Você treinou 1 vez"
        : `Você treinou ${count} vezes`;
  ctx.fillText(trainHeadline, padX + 46, card3Y + 144);

  ctx.fillStyle = "rgba(255,255,255,0.62)";
  ctx.font = "400 28px Inter, -apple-system, sans-serif";
  const subParts = [
    count > 0
      ? `${formatMinutesHuman(recap.workoutSummary.totalMinutes)} em atividade`
      : "Recuperação para voltar mais forte",
    recap.workoutSummary.totalRunKm > 0
      ? `${formatKm(recap.workoutSummary.totalRunKm)} km corridos`
      : "",
  ].filter(Boolean);
  ctx.fillText(subParts.join("  ·  "), padX + 46, card3Y + 194);

  // Up to 3 activity pills inside the card
  const shownActivities = recap.activities.slice(0, 3);
  if (shownActivities.length > 0) {
    shownActivities.forEach((act, idx) => {
      const rowY = card3Y + 224 + idx * 46;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "500 25px Inter, -apple-system, sans-serif";
      const label =
        act.source === "run" && act.distanceKm
          ? `Corrida · ${formatKm(act.distanceKm)} km`
          : `${act.title} · ${act.durationMin} min`;
      ctx.fillText(`•  ${label}`, padX + 46, rowY + 26);

      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.58)";
      ctx.font = "500 24px Inter, -apple-system, sans-serif";
      ctx.fillText(`${act.caloriesBurned} kcal`, padX + cardW - 46, rowY + 26);
      ctx.textAlign = "left";
    });
  } else {
    drawGlassPanel(ctx, padX + 46, card3Y + 244, cardW - 92, 86, 26, style);
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.font = "400 26px Inter, -apple-system, sans-serif";
    ctx.fillText(
      "Nenhum exercício registrado neste dia.",
      padX + 76,
      card3Y + 296
    );
  }

  // 6. Card 4 — Compact Day Highlights Strip (no photos, no private diary text)
  const card4Y = card3Y + card3H + 34;
  const card4H = 166;
  drawGlassPanel(ctx, padX, card4Y, cardW, card4H, 40, style);

  const highlights: { label: string; value: string }[] = [
    {
      label: "REFEIÇÕES",
      value:
        recap.fastingCount > 0
          ? `${recap.mealsRecordedCount} (${recap.fastingCount} jejum)`
          : `${recap.mealsRecordedCount} de 4`,
    },
    {
      label: "DIÁRIO",
      value: recap.hasDiary ? "Escrito ✓" : "—",
    },
    {
      label: "META ÁGUA",
      value: recap.waterPct >= 100 ? "Batida ✓" : `${recap.waterPct}%`,
    },
  ];

  const colW = cardW / highlights.length;
  highlights.forEach((h, i) => {
    const cx = padX + colW * i + colW / 2;
    if (i > 0) {
      ctx.beginPath();
      ctx.moveTo(padX + colW * i, card4Y + 38);
      ctx.lineTo(padX + colW * i, card4Y + card4H - 38);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "600 20px Inter, -apple-system, sans-serif";
    ctx.fillText(h.label, cx, card4Y + 64);

    ctx.fillStyle = "#ffffff";
    ctx.font = "500 32px Inter, -apple-system, sans-serif";
    ctx.fillText(h.value, cx, card4Y + 118);
  });

  // 7. Editorial Footer (above Instagram bottom UI safe zone)
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.font = "600 22px Inter, -apple-system, sans-serif";
  ctx.fillText("MY APP  ·  ROTINA EM PRETO & BRANCO", W / 2, 1786);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Falha ao gerar imagem do Story"));
      },
      "image/png",
      1
    );
  });
}
