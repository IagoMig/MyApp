import type { RoutePoint } from "./db";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(
  a: Pick<RoutePoint, "lat" | "lng">,
  b: Pick<RoutePoint, "lat" | "lng">
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calculateRunCalories(
  weightKg: number,
  distanceKm: number,
  durationSec: number
): number {
  const safeWeight = Math.max(35, weightKg || 75);
  if (distanceKm > 0.02) {
    // Standard ACSM running energy expenditure: ~1.036 kcal / kg / km
    return Math.round(safeWeight * distanceKm * 1.036);
  }
  if (durationSec > 30) {
    // Light movement fallback (~7 METs) if GPS distance hasn't moved yet
    return Math.round((7 * 3.5 * safeWeight) / 200 * (durationSec / 60));
  }
  return 0;
}

export function calculatePaceSecPerKm(
  distanceKm: number,
  durationSec: number
): number {
  if (distanceKm < 0.03 || durationSec <= 0) return 0;
  return Math.round(durationSec / distanceKm);
}

export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const clamped = Math.min(secPerKm, 3599);
  const min = Math.floor(clamped / 60);
  const sec = Math.round(clamped % 60);
  return `${min}'${String(sec).padStart(2, "0")}"`;
}

export function formatKm(km: number): string {
  return km.toFixed(2).replace(".", ",");
}
