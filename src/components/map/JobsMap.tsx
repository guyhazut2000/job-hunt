"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap, Marker as MlMarker } from "maplibre-gl";
import { ChevronDown, ChevronUp, Crosshair, Info, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bestSeconds } from "@/lib/commute/best";
import { isMode } from "@/lib/commute/keys";
import type { MapMarker } from "@/lib/geo/map-markers";
import { fillN, formatDuration, type JobsMapStrings } from "@/lib/i18n/jobs-map";
import { cn } from "@/lib/utils";
import { CommuteChips } from "./CommuteChips";
import { roundedFrom } from "./CommuteBar";
import { useQueryUpdate } from "./useQueryUpdate";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const RTL_PLUGIN = "/vendor/mapbox-gl-rtl-text-0.3.0.js";
const ISRAEL: [number, number] = [34.85, 31.75];

export interface JobsMapProps {
  markers: MapMarker[];
  origin: { lat: number; lng: number; label: string } | null;
  s: JobsMapStrings;
  locale: "en" | "he";
  cmode?: string;
  remote: number;
  unmapped: number;
  estimated: boolean;
  workModeLabels: Record<string, string>;
}

/** Marker colour by commute: ≤30 min green, ≤60 amber, longer red; grey = no route. */
const COLORS = { none: "#2563eb", fast: "#15803d", mid: "#d97706", slow: "#b91c1c", noRoute: "#6b7280" };

export function JobsMap({
  markers,
  origin,
  s,
  locale,
  cmode,
  remote,
  unmapped,
  estimated,
  workModeLabels,
}: JobsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const originMarkerRef = useRef<MlMarker | null>(null);
  const pickingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [full, setFull] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { update } = useQueryUpdate();
  const mode = isMode(cmode) ? cmode : undefined;

  const secondsOf = useCallback((m: MapMarker) => bestSeconds(m.commute, mode), [mode]);
  const byId = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);
  const geojson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: markers.map((m) => ({
        type: "Feature",
        id: undefined,
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
        properties: { id: m.id, n: m.jobs.length, sec: origin ? (secondsOf(m) ?? -1) : -2 },
      })),
    }),
    [markers, origin, secondsOf],
  );
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  // Pick-on-map requests come from the commute bar.
  useEffect(() => {
    const onPick = () => {
      pickingRef.current = true;
      setPicking(true);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    window.addEventListener("jobsmap:pick", onPick);
    return () => window.removeEventListener("jobsmap:pick", onPick);
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MlMap | null = null;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !containerRef.current) return;
        if (ml.getRTLTextPluginStatus() === "unavailable") {
          ml.setRTLTextPlugin(RTL_PLUGIN, true).catch(() => {});
        }
        map = new ml.Map({
          container: containerRef.current,
          style: STYLE_URL,
          center: ISRAEL,
          zoom: 7,
          attributionControl: {
            compact: true,
            customAttribution: [
              '<a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a>',
              '<a href="https://transitous.org/sources/" target="_blank" rel="noopener">Transitous</a>',
            ],
          },
          cooperativeGestures: false,
        });
        mapRef.current = map;
        // Test hook for automated browsers only (screenshots / e2e).
        if (navigator.webdriver) (window as unknown as { __jobsMap?: unknown }).__jobsMap = map;
        map.addControl(new ml.NavigationControl({ showCompass: false }), "top-left");
        map.on("error", (e) => {
          if (!map?.loaded() && String(e.error?.message ?? "").includes("style")) setError(true);
        });
        map.on("load", () => {
          if (!map) return;
          // Hebrew / English place names.
          const field =
            locale === "he"
              ? ["coalesce", ["get", "name:he"], ["get", "name"]]
              : ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
          for (const layer of map.getStyle().layers ?? []) {
            if (layer.type !== "symbol") continue;
            const tf = map.getLayoutProperty(layer.id, "text-field");
            if (tf && JSON.stringify(tf).includes('"name')) map.setLayoutProperty(layer.id, "text-field", field);
          }
          map.addSource("jobs", {
            type: "geojson",
            data: geojsonRef.current,
            cluster: true,
            clusterRadius: 46,
            clusterMaxZoom: 13,
            clusterProperties: { n: ["+", ["get", "n"]] },
          });
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "jobs",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#1e3a8a",
              "circle-opacity": 0.88,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
              "circle-radius": ["step", ["get", "n"], 16, 10, 20, 40, 26, 120, 32],
            },
          });
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "jobs",
            filter: ["has", "point_count"],
            layout: { "text-field": ["to-string", ["get", "n"]], "text-font": ["Noto Sans Bold"], "text-size": 13 },
            paint: { "text-color": "#fff" },
          });
          map.addLayer({
            id: "points",
            type: "circle",
            source: "jobs",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": [
                "case",
                ["==", ["get", "sec"], -2],
                COLORS.none,
                ["==", ["get", "sec"], -1],
                COLORS.noRoute,
                ["<=", ["get", "sec"], 1800],
                COLORS.fast,
                ["<=", ["get", "sec"], 3600],
                COLORS.mid,
                COLORS.slow,
              ],
              "circle-radius": ["step", ["get", "n"], 9, 3, 11, 10, 13],
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
            },
          });
          map.addLayer({
            id: "point-count",
            type: "symbol",
            source: "jobs",
            filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "n"], 1]],
            layout: {
              "text-field": ["to-string", ["get", "n"]],
              "text-font": ["Noto Sans Bold"],
              "text-size": 11,
              "text-allow-overlap": true,
            },
            paint: { "text-color": "#fff" },
          });

          map.on("click", "clusters", async (e) => {
            const f = e.features?.[0];
            if (!f || pickingRef.current) return;
            const src = map!.getSource("jobs") as GeoJSONSource;
            const clusterId = f.properties?.cluster_id as number;
            const [leaves, zoom] = await Promise.all([
              src.getClusterLeaves(clusterId, 500, 0),
              src.getClusterExpansionZoom(clusterId),
            ]);
            setSelected(leaves.map((l) => String(l.properties?.id)));
            setSheetOpen(true);
            map!.easeTo({
              center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: Math.min(zoom, 15),
            });
          });
          map.on("click", "points", (e) => {
            if (pickingRef.current) return;
            const id = e.features?.[0]?.properties?.id;
            if (id) {
              setSelected([String(id)]);
              setSheetOpen(true);
            }
          });
          map.on("click", (e) => {
            if (!pickingRef.current) return;
            pickingRef.current = false;
            setPicking(false);
            const from = roundedFrom(e.lngLat.lat, e.lngLat.lng);
            if (from) update({ from, origin: null });
          });
          for (const id of ["clusters", "points"]) {
            map.on("mouseenter", id, () => (map!.getCanvas().style.cursor = "pointer"));
            map.on("mouseleave", id, () => (map!.getCanvas().style.cursor = ""));
          }
          setReady(true);
        });
      } catch {
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; data is synced below
  }, []);

  // Sync data and fit the view when results change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("jobs") as GeoJSONSource | undefined)?.setData(geojson);
    const pts = geojson.features.map((f) => f.geometry.coordinates as [number, number]);
    if (origin) pts.push([origin.lng, origin.lat]);
    if (pts.length) {
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 12, duration: 0 },
      );
    }
    setSelected(null);
  }, [geojson, origin, ready]);

  // Origin marker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    originMarkerRef.current?.remove();
    originMarkerRef.current = null;
    if (!origin) return;
    let alive = true;
    import("maplibre-gl").then((ml) => {
      if (!alive) return;
      const el = document.createElement("div");
      el.className = "jobs-map-origin";
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", `${s.origin}: ${origin.label}`);
      el.title = `${s.origin}: ${origin.label}`;
      originMarkerRef.current = new ml.Marker({ element: el }).setLngLat([origin.lng, origin.lat]).addTo(map);
    });
    return () => {
      alive = false;
    };
  }, [origin, ready, s.origin]);

  useEffect(() => {
    mapRef.current?.getCanvas().style.setProperty("cursor", picking ? "crosshair" : "");
  }, [picking]);
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 50);
    return () => clearTimeout(t);
  }, [full]);

  const panelMarkers = useMemo(() => {
    const list = selected ? selected.map((id) => byId.get(id)).filter((m): m is MapMarker => !!m) : markers;
    return [...list].sort((a, b) =>
      origin
        ? (secondsOf(a) ?? Infinity) - (secondsOf(b) ?? Infinity) || b.jobs.length - a.jobs.length
        : b.jobs.length - a.jobs.length || a.company.name.localeCompare(b.company.name),
    );
  }, [selected, byId, markers, origin, secondsOf]);
  // Distinct jobs: a multi-city posting sits in several markers.
  const panelJobs = new Set(panelMarkers.flatMap((m) => m.jobs.map((j) => j.id))).size;

  function focus(m: MapMarker) {
    setSelected([m.id]);
    mapRef.current?.flyTo({ center: [m.lng, m.lat], zoom: Math.max(mapRef.current.getZoom(), 14) });
  }

  const notes = (
    <>
      {remote > 0 && (
        <p className="text-muted-foreground inline-flex items-center gap-1 text-xs" data-testid="remote-note">
          <Info className="size-3.5 shrink-0" aria-hidden />
          {remote === 1 ? s.remoteNote1 : fillN(s.remoteNote, { n: remote })}
        </p>
      )}
      {unmapped > 0 && <p className="text-muted-foreground text-xs">{fillN(s.unmappedNote, { n: unmapped })}</p>}
      {estimated && <p className="text-muted-foreground text-xs">{s.estimateNote}</p>}
    </>
  );

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="map-panel">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-bold">
          {panelJobs === 1 ? s.job1 : fillN(s.jobsHere, { n: panelJobs })}
          {panelMarkers.length > 1 && (
            <span className="text-muted-foreground font-normal">
              {" · "}
              {fillN(s.companies, { n: panelMarkers.length })}
            </span>
          )}
        </p>
        {selected && (
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} data-testid="panel-clear">
            <X data-icon="inline-start" aria-hidden />
            {s.close}
          </Button>
        )}
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
        {panelMarkers.length === 0 && <li className="text-muted-foreground p-4 text-sm">{s.noMapped}</li>}
        {panelMarkers.slice(0, 80).map((m) => (
          <li key={m.id} className="flex flex-col gap-1.5 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/companies/${m.company.slug}`} className="font-bold hover:underline" dir="auto">
                  {m.company.name}
                </Link>
                <button
                  type="button"
                  onClick={() => focus(m)}
                  className="text-muted-foreground hover:text-foreground block text-start text-xs"
                >
                  {m.place}
                  {m.precision !== "office" && ` · ${fillN(s.approx, { what: s.precision[m.precision] })}`}
                </button>
              </div>
              {origin && secondsOf(m) != null && (
                <span className="bg-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                  {formatDuration(secondsOf(m)!, s)}
                </span>
              )}
            </div>
            {m.commute && <CommuteChips commute={m.commute} s={s} active={mode} size="sm" />}
            <ul className="flex flex-col gap-0.5">
              {m.jobs.slice(0, selected ? 12 : 4).map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/jobs/${j.id}`}
                    className="hover:text-primary min-w-0 truncate py-1 hover:underline"
                    dir="auto"
                  >
                    {j.title}
                  </Link>
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                    {j.workMode === "HYBRID" && <span>{workModeLabels.HYBRID}</span>}
                    {j.score !== undefined && (
                      <span className="text-fit font-mono font-bold" title={fillN(s.match, { n: j.score })}>
                        {j.score}%
                      </span>
                    )}
                  </span>
                </li>
              ))}
              {m.jobs.length > (selected ? 12 : 4) && (
                <li>
                  <button type="button" onClick={() => focus(m)} className="text-primary text-xs font-semibold">
                    +{m.jobs.length - (selected ? 12 : 4)}
                  </button>
                </li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className={cn(
        "bg-card relative flex overflow-hidden rounded-lg border",
        full ? "fixed inset-0 z-50 rounded-none border-0" : "h-[calc(100dvh-9rem)] min-h-[28rem] lg:h-[70vh]",
      )}
      data-testid="jobs-map"
    >
      <div className="relative min-w-0 flex-1">
        <div ref={containerRef} className="size-full" dir="ltr" role="region" aria-label={s.mapLabel} />
        {!ready && !error && (
          <div className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">{s.loadingMap}</div>
        )}
        {error && (
          <div role="alert" className="absolute inset-0 grid place-items-center p-6 text-center text-sm">
            {s.mapError}
          </div>
        )}
        <div className="absolute end-2 top-2 flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="shadow"
            onClick={() => setFull((v) => !v)}
            aria-label={full ? s.close : s.viewMap}
            aria-pressed={full}
            data-testid="map-fullscreen"
          >
            {full ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
          </Button>
        </div>
        {picking && (
          <div className="bg-foreground text-background absolute inset-x-2 top-2 me-12 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm shadow">
            <span className="inline-flex items-center gap-2">
              <Crosshair className="size-4" aria-hidden />
              {s.pickOnMapHint}
            </span>
            <button
              type="button"
              className="underline"
              onClick={() => {
                pickingRef.current = false;
                setPicking(false);
              }}
            >
              {s.consentCancel}
            </button>
          </div>
        )}
        <div className="pointer-events-none absolute start-2 bottom-8 hidden flex-col gap-1 rounded bg-white/85 px-2 py-1 text-xs text-black shadow lg:flex dark:bg-black/70 dark:text-white">
          {origin && (
            <span className="flex flex-wrap gap-x-2">
              <span style={{ color: COLORS.fast }}>● ≤30</span>
              <span style={{ color: COLORS.mid }}>● ≤60</span>
              <span style={{ color: COLORS.slow }}>● 60+</span>
              <span style={{ color: COLORS.noRoute }}>● {s.noRoute}</span>
            </span>
          )}
        </div>

        {/* Mobile bottom sheet */}
        <div
          className={cn(
            "bg-card absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-xl border-t shadow-[0_-4px_16px_rgba(0,0,0,.12)] lg:hidden",
            sheetOpen ? "h-[65%]" : "h-auto",
          )}
          data-testid="map-sheet"
        >
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold"
            onClick={() => setSheetOpen((v) => !v)}
            aria-expanded={sheetOpen}
          >
            <span className="bg-muted-foreground/40 absolute top-1.5 h-1 w-10 rounded-full" aria-hidden />
            {sheetOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
            {panelJobs === 1 ? s.job1 : fillN(s.jobsHere, { n: panelJobs })}
            {panelMarkers.length > 1 && ` · ${fillN(s.companies, { n: panelMarkers.length })}`}
          </button>
          {sheetOpen && (
            <>
              <div className="flex flex-col gap-0.5 px-3 pb-1">{notes}</div>
              {panel}
            </>
          )}
        </div>
      </div>

      {/* Desktop side panel */}
      <aside className="hidden w-80 shrink-0 flex-col border-s lg:flex xl:w-96" aria-label={s.showList}>
        <div className="flex flex-col gap-0.5 border-b px-3 py-2 empty:hidden">{notes}</div>
        {panel}
        <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">
          ©{" "}
          <a href="https://openfreemap.org" target="_blank" rel="noopener" className="underline">
            OpenFreeMap
          </a>{" "}
          ·{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">
            OpenStreetMap
          </a>{" "}
          ·{" "}
          <a href="https://www.geonames.org/" target="_blank" rel="noopener" className="underline">
            GeoNames
          </a>{" "}
          ·{" "}
          <a href="https://transitous.org/sources/" target="_blank" rel="noopener" className="underline">
            {s.attributionTransit} ({s.sources})
          </a>
        </p>
      </aside>
    </div>
  );
}
