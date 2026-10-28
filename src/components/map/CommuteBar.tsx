"use client";

import Link from "next/link";
import { useState } from "react";
import { Crosshair, Loader2, LocateFixed, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_COMMUTE_OPTIONS } from "@/lib/commute/filter";
import { DAY_TYPES, MODES, departureKey, inServiceArea, parseDeparture, roundOrigin } from "@/lib/commute/keys";
import { fillN, type JobsMapStrings } from "@/lib/i18n/jobs-map";
import { useQueryUpdate } from "./useQueryUpdate";

export interface CommuteBarProps {
  s: JobsMapStrings;
  savedPlaces: { id: string; label: string }[];
  /** Resolved origin (server side): "here" = ad-hoc point, "saved" = a saved place. */
  origin: { source: "here" | "saved"; placeId?: string } | null;
  cmode?: string;
  maxc?: number;
  dep?: string;
  view: "list" | "map";
  signedIn: boolean;
}

const TIMES = Array.from({ length: 38 }, (_, i) => 5 * 60 + i * 30); // 05:00 … 23:30
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const selectCls =
  "border-input bg-background focus-visible:ring-ring/50 h-10 min-w-0 rounded-md border px-2 text-sm font-medium outline-none focus-visible:ring-[3px]";

/** Rounds a browser position to the ~200 m grid before it ever leaves the page. */
export function roundedFrom(lat: number, lng: number): string | null {
  if (!inServiceArea({ lat, lng })) return null;
  const r = roundOrigin({ lat, lng });
  return `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
}

export function CommuteBar({ s, savedPlaces, origin, cmode, maxc, dep, view, signedIn }: CommuteBarProps) {
  const { update, pending } = useQueryUpdate();
  const [consent, setConsent] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const departure = parseDeparture(dep);
  const originValue = origin ? (origin.source === "here" ? "here" : (origin.placeId ?? "none")) : "none";

  function locate() {
    setConsent(false);
    setError(null);
    if (!("geolocation" in navigator)) return setError(s.geoUnavailable);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const from = roundedFrom(pos.coords.latitude, pos.coords.longitude);
        if (!from) return setError(s.outsideArea);
        update({ from, origin: null });
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? s.geoDenied : s.geoUnavailable);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function onOrigin(v: string) {
    setError(null);
    if (v === "__geo") return setConsent(true);
    if (v === "__pick") return window.dispatchEvent(new CustomEvent("jobsmap:pick"));
    if (v === "none") return update({ from: null, origin: savedPlaces.length ? "none" : null, sort: null, maxc: null });
    if (v === "here") return;
    update({ from: null, origin: v });
  }

  const setDep = (day: string, minutes: number) => {
    const key = departureKey(parseDeparture(`${day}-${hhmm(minutes).replace(":", "")}`));
    update({ dep: key === "sun-thu-0830" ? null : key });
  };

  return (
    <section
      className="bg-card flex flex-col gap-3 rounded-lg border p-3"
      aria-labelledby="commute-h"
      data-testid="commute-bar"
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <h2 id="commute-h" className="sr-only">
          {s.commute}
        </h2>
        <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-semibold sm:flex-none">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {s.commuteFrom}
          </span>
          <select
            className={selectCls}
            value={originValue}
            onChange={(e) => onOrigin(e.target.value)}
            data-testid="origin-select"
          >
            <option value="none">{s.noOrigin}</option>
            {origin?.source === "here" && <option value="here">{s.customPoint}</option>}
            <option value="__geo">{s.useMyLocation}</option>
            {view === "map" && <option value="__pick">{s.pickOnMap}</option>}
            {savedPlaces.length > 0 && (
              <optgroup label={s.savedPlaces}>
                {savedPlaces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          onClick={() => setConsent(true)}
          aria-label={s.useMyLocation}
          title={s.useMyLocation}
        >
          {locating ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
        </Button>
        {view === "map" && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10"
            onClick={() => window.dispatchEvent(new CustomEvent("jobsmap:pick"))}
            aria-label={s.pickOnMap}
            title={s.pickOnMap}
          >
            <Crosshair aria-hidden />
          </Button>
        )}
        {origin && (
          <>
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-semibold sm:flex-none">
              <span className="text-muted-foreground">{s.mode}</span>
              <select
                className={selectCls}
                value={cmode ?? ""}
                onChange={(e) => update({ cmode: e.target.value || null })}
                data-testid="mode-select"
              >
                <option value="">{s.anyMode}</option>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {s.modes[m]}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="order-last flex flex-col gap-1 text-xs font-semibold sm:order-none">
              <legend className="text-muted-foreground mb-1">{s.departure}</legend>
              <div className="flex gap-1">
                <select
                  className={selectCls}
                  value={departure.day}
                  onChange={(e) => setDep(e.target.value, departure.minutes)}
                  aria-label={s.departure}
                >
                  {DAY_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {s.days[d]}
                    </option>
                  ))}
                </select>
                <select
                  className={selectCls}
                  value={departure.minutes}
                  onChange={(e) => setDep(departure.day, Number(e.target.value))}
                  aria-label={s.departure}
                  dir="ltr"
                >
                  {TIMES.map((m) => (
                    <option key={m} value={m}>
                      {hhmm(m)}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
            <label className="flex min-w-32 flex-1 flex-col gap-1 text-xs font-semibold sm:flex-none">
              <span className="text-muted-foreground">{s.maxCommute}</span>
              <select
                className={selectCls}
                value={maxc ?? ""}
                onChange={(e) => update({ maxc: e.target.value || null })}
                data-testid="maxc-select"
              >
                <option value="">{s.anyCommute}</option>
                {MAX_COMMUTE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {fillN(s.upTo, { n })}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {pending && <Loader2 className="text-muted-foreground mb-2.5 size-5 animate-spin" aria-label="…" />}
      </div>

      {consent && (
        <div
          role="alertdialog"
          aria-labelledby="geo-consent-h"
          className="bg-muted/60 flex flex-col gap-2 rounded-md p-3"
        >
          <p id="geo-consent-h" className="font-bold">
            {s.consentTitle}
          </p>
          <p className="text-sm">{s.consentBody}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={locate} data-testid="geo-allow">
              <LocateFixed data-icon="inline-start" aria-hidden />
              {s.consentAllow}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConsent(false)}>
              {s.consentCancel}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {!origin && !consent && <p className="text-muted-foreground text-xs">{s.setOriginForSort}</p>}
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
        <span>{s.privacy}</span>
        {signedIn && (
          <Link href="/settings/places" className="hover:text-foreground underline underline-offset-4">
            {s.managePlaces}
          </Link>
        )}
      </p>
    </section>
  );
}
