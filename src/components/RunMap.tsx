"use client";

import { useEffect, useRef } from "react";
import type {
  Map as LeafletMap,
  Polyline as LeafletPolyline,
  CircleMarker as LeafletCircleMarker,
} from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePoint } from "@/lib/db";

interface RunMapProps {
  route: RoutePoint[];
  currentLocation: { lat: number; lng: number } | null;
  fitRouteTrigger?: number;
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333]; // São Paulo fallback

export function RunMap({
  route,
  currentLocation,
  fitRouteTrigger = 0,
}: RunMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const glowLineRef = useRef<LeafletPolyline | null>(null);
  const mainLineRef = useRef<LeafletPolyline | null>(null);
  const haloMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const dotMarkerRef = useRef<LeafletCircleMarker | null>(null);
  const hasCenteredRef = useRef(false);

  // Initialize Leaflet map once on client (zero Web Workers, zero API keys)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      const startCenter: [number, number] = currentLocation
        ? [currentLocation.lat, currentLocation.lng]
        : DEFAULT_CENTER;

      const map = L.map(containerRef.current, {
        center: startCenter,
        zoom: currentLocation ? 15 : 13,
        zoomControl: false,
        attributionControl: true,
      });

      map.attributionControl.setPrefix(false);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      glowLineRef.current = L.polyline([], {
        color: "#ffffff",
        weight: 9,
        opacity: 0.22,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      mainLineRef.current = L.polyline([], {
        color: "#ffffff",
        weight: 3.5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      haloMarkerRef.current = L.circleMarker(startCenter, {
        radius: 11,
        stroke: false,
        fillColor: "#ffffff",
        fillOpacity: 0,
      }).addTo(map);

      dotMarkerRef.current = L.circleMarker(startCenter, {
        radius: 5.5,
        color: "#000000",
        weight: 2,
        fillColor: "#ffffff",
        fillOpacity: 0,
        opacity: 0,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      glowLineRef.current = null;
      mainLineRef.current = null;
      haloMarkerRef.current = null;
      dotMarkerRef.current = null;
    };
  }, []);

  // Update route polyline and live position dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const latLngs: [number, number][] = route.map((p) => [p.lat, p.lng]);
    glowLineRef.current?.setLatLngs(latLngs);
    mainLineRef.current?.setLatLngs(latLngs);

    const activePos: [number, number] | null =
      latLngs.length > 0
        ? latLngs[latLngs.length - 1]
        : currentLocation
          ? [currentLocation.lat, currentLocation.lng]
          : null;

    if (activePos) {
      haloMarkerRef.current?.setLatLng(activePos).setStyle({ fillOpacity: 0.24 });
      dotMarkerRef.current
        ?.setLatLng(activePos)
        .setStyle({ fillOpacity: 1, opacity: 1 });

      if (!hasCenteredRef.current || route.length > 0) {
        hasCenteredRef.current = true;
        map.setView(activePos, Math.max(map.getZoom(), 15), { animate: true });
      }
    } else {
      haloMarkerRef.current?.setStyle({ fillOpacity: 0 });
      dotMarkerRef.current?.setStyle({ fillOpacity: 0, opacity: 0 });
    }
  }, [route, currentLocation]);

  // Fit bounds when inspecting a saved historical run
  useEffect(() => {
    const map = mapRef.current;
    if (!map || route.length < 2 || fitRouteTrigger === 0) return;

    const latLngs: [number, number][] = route.map((p) => [p.lat, p.lng]);
    map.fitBounds(latLngs, { padding: [36, 36], maxZoom: 16 });
  }, [fitRouteTrigger, route]);

  return (
    <div className="obsidian-leaflet relative h-full w-full overflow-hidden rounded-[26px] bg-zinc-950">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-0 z-[400] rounded-[26px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" />
    </div>
  );
}
