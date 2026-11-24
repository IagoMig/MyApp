"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Play,
  Pause,
  Square,
  LocateFixed,
  Moon,
  Plus,
  X,
  Trash2,
  Footprints,
  Dumbbell,
} from "lucide-react";
import { GlassCard, GlassButton } from "./Glass";
import { RunMap } from "./RunMap";
import {
  db,
  DEFAULT_SETTINGS,
  getDateKey,
  getMonthKey,
  formatShortDatePt,
  type RoutePoint,
  type RunSession,
} from "@/lib/db";
import {
  haversineKm,
  calculateRunCalories,
  calculatePaceSecPerKm,
  formatDuration,
  formatPace,
  formatKm,
} from "@/lib/running";

type RunStatus = "idle" | "running" | "paused";

interface ActiveRunDraft {
  status: RunStatus;
  startedAt: number;
  elapsedSec: number;
  distanceKm: number;
  route: RoutePoint[];
}

const DRAFT_STORAGE_KEY = "my-app-active-run-draft";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export function RunView() {
  const settings = useLiveQuery(() => db.settings.get("user"), []);
  const savedRuns = useLiveQuery(
    () => db.runs.orderBy("startedAt").reverse().limit(30).toArray(),
    []
  );

  const weightKg = (settings ?? DEFAULT_SETTINGS).weightKg;

  const [status, setStatus] = useState<RunStatus>("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [oledMode, setOledMode] = useState(false);

  // History inspection
  const [inspectedRun, setInspectedRun] = useState<RunSession | null>(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  // Manual run sheet
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKm, setManualKm] = useState("5.0");
  const [manualMin, setManualMin] = useState("28");
  const [manualDate, setManualDate] = useState(() => getDateKey());

  const startedAtRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const lastPointRef = useRef<RoutePoint | null>(null);

  // Recover an interrupted active run from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as ActiveRunDraft;
      if (draft && (draft.status === "running" || draft.status === "paused")) {
        startedAtRef.current = draft.startedAt;
        setStatus("paused");
        setElapsedSec(draft.elapsedSec);
        setDistanceKm(draft.distanceKm);
        setRoute(draft.route ?? []);
        if (draft.route?.length) {
          lastPointRef.current = draft.route[draft.route.length - 1];
        }
      }
    } catch {
      // Ignore corrupt draft
    }
  }, []);

  // Persist active draft locally so refresh never loses the run
  useEffect(() => {
    if (status === "idle") {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return;
    }
    const draft: ActiveRunDraft = {
      status,
      startedAt: startedAtRef.current,
      elapsedSec,
      distanceKm,
      route,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore quota issues
    }
  }, [status, elapsedSec, distanceKm, route]);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      // Silently ignore if browser blocks wake lock
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
      wakeLockRef.current = null;
    } catch {
      // Ignore
    }
  }, []);

  const locateOnce = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("GPS indisponível");
      return;
    }
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setGpsError("Permita o GPS para o mapa");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Initial location center on mount
  useEffect(() => {
    locateOnce();
    return () => {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [locateOnce, releaseWakeLock]);

  // Timer tick when running
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // GPS tracking watcher when running
  useEffect(() => {
    if (status !== "running") {
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsError("GPS indisponível");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setCurrentLocation({ lat, lng });

        // Discard noisy GPS readings (> 35m error)
        if (accuracy && accuracy > 35) return;

        const nextPoint: RoutePoint = { lat, lng, ts: Date.now() };
        const prev = lastPointRef.current;

        if (!prev) {
          lastPointRef.current = nextPoint;
          setRoute((r) => [...r, nextPoint]);
          return;
        }

        const deltaKm = haversineKm(prev, nextPoint);
        const deltaSec = Math.max(0.5, (nextPoint.ts - prev.ts) / 1000);
        const speedKmh = (deltaKm / deltaSec) * 3600;

        // Ignore micro GPS drift (< 3m) and impossible jumps (> 42 km/h)
        if (deltaKm >= 0.003 && speedKmh <= 42) {
          lastPointRef.current = nextPoint;
          setDistanceKm((d) => d + deltaKm);
          setRoute((r) => [...r, nextPoint]);
        }
      },
      () => {
        setGpsError("Sinal GPS pausado");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1500,
        timeout: 15000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [status]);

  const handleStart = async () => {
    setInspectedRun(null);
    if (status === "idle") {
      startedAtRef.current = Date.now();
      setElapsedSec(0);
      setDistanceKm(0);
      setRoute([]);
      lastPointRef.current = null;
    }
    setStatus("running");
    await requestWakeLock();
  };

  const handlePause = async () => {
    setStatus("paused");
    setOledMode(false);
    await releaseWakeLock();
  };

  const handleFinish = async () => {
    await releaseWakeLock();
    setOledMode(false);

    if (elapsedSec >= 5 || distanceKm >= 0.02) {
      const dateKey = getDateKey(new Date(startedAtRef.current || Date.now()));
      const pace = calculatePaceSecPerKm(distanceKm, elapsedSec);
      const calories = calculateRunCalories(weightKg, distanceKm, elapsedSec);

      await db.runs.add({
        date: dateKey,
        monthKey: getMonthKey(dateKey),
        startedAt: startedAtRef.current || Date.now() - elapsedSec * 1000,
        endedAt: Date.now(),
        durationSec: elapsedSec,
        distanceKm: Number(distanceKm.toFixed(3)),
        avgPaceSecPerKm: pace,
        caloriesBurned: calories,
        route,
      });
    }

    setStatus("idle");
    setElapsedSec(0);
    setDistanceKm(0);
    setRoute([]);
    lastPointRef.current = null;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  };

  const handleSaveManualRun = async () => {
    const km = parseFloat(manualKm.replace(",", "."));
    const mins = parseFloat(manualMin.replace(",", "."));
    if (!km || km <= 0 || !mins || mins <= 0) return;

    const durationSec = Math.round(mins * 60);
    const pace = calculatePaceSecPerKm(km, durationSec);
    const calories = calculateRunCalories(weightKg, km, durationSec);
    const now = Date.now();

    await db.runs.add({
      date: manualDate,
      monthKey: getMonthKey(manualDate),
      startedAt: now - durationSec * 1000,
      endedAt: now,
      durationSec,
      distanceKm: Number(km.toFixed(2)),
      avgPaceSecPerKm: pace,
      caloriesBurned: calories,
      route: [],
    });

    setManualOpen(false);
  };

  const handleDeleteRun = async (id?: number) => {
    if (id === undefined) return;
    if (inspectedRun?.id === id) setInspectedRun(null);
    await db.runs.delete(id);
  };

  const displayedRoute = inspectedRun ? inspectedRun.route : route;
  const displayedKm = inspectedRun ? inspectedRun.distanceKm : distanceKm;
  const displayedSec = inspectedRun ? inspectedRun.durationSec : elapsedSec;
  const displayedPace = inspectedRun
    ? inspectedRun.avgPaceSecPerKm
    : calculatePaceSecPerKm(distanceKm, elapsedSec);
  const displayedKcal = inspectedRun
    ? inspectedRun.caloriesBurned
    : calculateRunCalories(weightKg, distanceKm, elapsedSec);

  const manualPreviewKm = parseFloat(manualKm.replace(",", ".")) || 0;
  const manualPreviewSec = Math.round((parseFloat(manualMin.replace(",", ".")) || 0) * 60);

  return (
    <div className="space-y-5 pt-2">
      {/* Sub-navigation switcher: Treinos | Corrida */}
      <div className="glass-obsidian grid grid-cols-2 gap-1.5 rounded-2xl p-1">
        <Link
          href="/treino"
          className="flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium text-zinc-400 hover:text-white transition-all"
        >
          <Dumbbell className="h-3.5 w-3.5" />
          <span>Treinos</span>
        </Link>
        <Link
          href="/corrida"
          className="glass-pill-active flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium transition-all"
        >
          <Footprints className="h-3.5 w-3.5" />
          <span>Corrida</span>
        </Link>
      </div>

      {/* Minimal Header */}
      <header className="flex items-center justify-between px-1">
        <h1 className="text-[26px] font-semibold tracking-tight text-white">
          Corrida
        </h1>

        <GlassButton
          type="button"
          onClick={() => setManualOpen(true)}
          className="h-10 px-3.5 text-xs font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>Manual</span>
        </GlassButton>
      </header>

      {/* Integrated Dark Monochrome Map */}
      <GlassCard className="relative h-[260px] p-1.5 overflow-hidden">
        <RunMap
          route={displayedRoute}
          currentLocation={inspectedRun ? null : currentLocation}
          fitRouteTrigger={fitTrigger}
        />

        <div className="absolute top-4 right-4 z-[500] flex items-center gap-2">
          {inspectedRun && (
            <GlassButton
              type="button"
              onClick={() => setInspectedRun(null)}
              className="h-9 px-3 text-xs font-medium"
            >
              Ao vivo
            </GlassButton>
          )}
          <GlassButton
            type="button"
            onClick={locateOnce}
            aria-label="Centralizar GPS"
            className="h-9 w-9 !rounded-full p-0"
          >
            <LocateFixed className="h-4 w-4" />
          </GlassButton>
        </div>

        {gpsError && !inspectedRun && (
          <div className="absolute bottom-4 left-4 z-[500] glass-dock rounded-full px-3.5 py-1.5 text-xs text-zinc-200">
            {gpsError}
          </div>
        )}
      </GlassCard>

      {/* 4 Core Metrics — Zero Micro-Info */}
      <GlassCard variant="frosted" className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-y-5 gap-x-4">
          <div>
            <span className="block text-xs text-zinc-400">Distância</span>
            <span className="text-3xl font-light tracking-tight text-white tabular-nums">
              {formatKm(displayedKm)}{" "}
              <span className="text-base text-zinc-400">km</span>
            </span>
          </div>

          <div>
            <span className="block text-xs text-zinc-400">Ritmo</span>
            <span className="text-3xl font-light tracking-tight text-white tabular-nums">
              {formatPace(displayedPace)}{" "}
              <span className="text-base text-zinc-400">/km</span>
            </span>
          </div>

          <div>
            <span className="block text-xs text-zinc-400">Tempo</span>
            <span className="text-2xl font-light tracking-tight text-white tabular-nums">
              {formatDuration(displayedSec)}
            </span>
          </div>

          <div>
            <span className="block text-xs text-zinc-400">Calorias</span>
            <span className="text-2xl font-light tracking-tight text-white tabular-nums">
              {displayedKcal}{" "}
              <span className="text-sm text-zinc-400">kcal</span>
            </span>
          </div>
        </div>

        {/* Run Action Controls */}
        {!inspectedRun && (
          <div className="flex items-center gap-2.5 pt-1">
            {status === "idle" ? (
              <GlassButton
                type="button"
                active
                onClick={handleStart}
                className="w-full py-3.5 text-sm font-medium"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Iniciar corrida</span>
              </GlassButton>
            ) : (
              <>
                {status === "running" ? (
                  <GlassButton
                    type="button"
                    onClick={handlePause}
                    className="flex-1 py-3.5 text-sm font-medium"
                  >
                    <Pause className="h-4 w-4" />
                    <span>Pausar</span>
                  </GlassButton>
                ) : (
                  <GlassButton
                    type="button"
                    active
                    onClick={handleStart}
                    className="flex-1 py-3.5 text-sm font-medium"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Retomar</span>
                  </GlassButton>
                )}

                {status === "running" && (
                  <GlassButton
                    type="button"
                    onClick={() => {
                      requestWakeLock();
                      setOledMode(true);
                    }}
                    aria-label="Modo tela escura"
                    className="h-[48px] w-[48px] p-0"
                  >
                    <Moon className="h-4 w-4" />
                  </GlassButton>
                )}

                <GlassButton
                  type="button"
                  onClick={handleFinish}
                  className="px-5 py-3.5 text-sm font-medium"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Salvar</span>
                </GlassButton>
              </>
            )}
          </div>
        )}
      </GlassCard>

      {/* Saved Runs History */}
      {(savedRuns?.length ?? 0) > 0 && (
        <div className="space-y-2.5">
          {(savedRuns ?? []).map((run) => {
            const isViewing = inspectedRun?.id === run.id;
            return (
              <div
                key={run.id}
                className={`rounded-[24px] transition-all ${
                  isViewing ? "glass-frosted" : "glass-surface"
                }`}
              >
                <div className="flex items-center justify-between px-5 py-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (isViewing) {
                        setInspectedRun(null);
                      } else {
                        setInspectedRun(run);
                        setFitTrigger((n) => n + 1);
                      }
                    }}
                    className="flex flex-1 items-center gap-3.5 text-left cursor-pointer"
                  >
                    <div className="glass-pill flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      <Footprints className="h-4 w-4 text-white" strokeWidth={1.8} />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-white tabular-nums">
                        {formatKm(run.distanceKm)} km · {formatPace(run.avgPaceSecPerKm)}
                      </span>
                      <span className="block text-xs text-zinc-400 tabular-nums">
                        {formatShortDatePt(run.date)} · {formatDuration(run.durationSec)} ·{" "}
                        {run.caloriesBurned} kcal
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRun(run.id)}
                    aria-label="Apagar corrida"
                    className="p-2 text-zinc-500 hover:text-white cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* OLED Dark Screen Wake Lock Overlay (keeps iPhone GPS alive) */}
      {oledMode && status === "running" && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black px-8 py-16 text-center"
          onClick={() => setOledMode(false)}
        >
          <span className="text-xs uppercase tracking-[0.25em] text-zinc-600">
            GPS ativo
          </span>

          <div className="space-y-6">
            <div className="text-7xl font-extralight tracking-tight text-zinc-200 tabular-nums">
              {formatKm(distanceKm)}
              <span className="ml-2 text-2xl text-zinc-600">km</span>
            </div>
            <div className="flex items-center justify-center gap-8 text-xl font-light text-zinc-400 tabular-nums">
              <span>{formatDuration(elapsedSec)}</span>
              <span>{formatPace(calculatePaceSecPerKm(distanceKm, elapsedSec))}/km</span>
              <span>{calculateRunCalories(weightKg, distanceKm, elapsedSec)} kcal</span>
            </div>
          </div>

          <span className="glass-pill rounded-full px-5 py-2.5 text-xs text-zinc-400">
            Toque para voltar
          </span>
        </div>
      )}

      {/* Manual Run Registration Sheet */}
      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-lg p-4 sm:items-center"
          onClick={() => setManualOpen(false)}
        >
          <GlassCard
            variant="frosted"
            className="w-full max-w-[420px] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Registrar corrida</h2>
              <GlassButton
                type="button"
                onClick={() => setManualOpen(false)}
                aria-label="Fechar"
                className="h-9 w-9 !rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </GlassButton>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="block px-1 text-xs text-zinc-400">
                    Distância (km)
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    inputMode="decimal"
                    value={manualKm}
                    onChange={(e) => setManualKm(e.target.value)}
                    className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white outline-none tabular-nums"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block px-1 text-xs text-zinc-400">
                    Tempo (min)
                  </span>
                  <input
                    type="number"
                    step="1"
                    inputMode="numeric"
                    value={manualMin}
                    onChange={(e) => setManualMin(e.target.value)}
                    className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white outline-none tabular-nums"
                  />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="block px-1 text-xs text-zinc-400">Data</span>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="glass-pill w-full rounded-xl px-4 py-3 text-sm text-white outline-none"
                />
              </label>

              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-300 tabular-nums">
                <span>
                  Ritmo:{" "}
                  <strong className="text-white">
                    {formatPace(
                      calculatePaceSecPerKm(manualPreviewKm, manualPreviewSec)
                    )}
                    /km
                  </strong>
                </span>
                <span>
                  <strong className="text-white">
                    {calculateRunCalories(
                      weightKg,
                      manualPreviewKm,
                      manualPreviewSec
                    )}{" "}
                    kcal
                  </strong>
                </span>
              </div>
            </div>

            <GlassButton
              type="button"
              active
              onClick={handleSaveManualRun}
              className="w-full py-3.5 text-sm font-medium"
            >
              Salvar corrida
            </GlassButton>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
