# Jobs map and commute times

`/jobs?view=map` shows every non-remote job that matches the current filters and `?q=` on a map,
grouped by office and clustered. You can set an origin (your current location or a saved place),
and the list, the map and each job page then show **car / public transport** travel times. Public transport ("תחבורה ציבורית") is one combined mode: buses, trains and light rail with transfers and walking at both ends. Those times
drive the `maxc` (max commute) filter and the `sort=commute` sort.

Everything runs on free providers that need no API key. Guy doesn't have to set any env var.

## UI

| Where              | What                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/jobs`            | List / Map toggle (`view=map`). The commute bar sets origin, mode, departure and max commute.                                                                                                                                                                                                                                                                                                                                                         |
| Map                | Clustered markers per office. Click a cluster or marker to open a side panel (bottom sheet on mobile) with company, place, commute chips, the public-transport leg breakdown (first 3 offices) and jobs with match %. Zoom +/- sits top-left and fullscreen top-right (physical sides, 40px targets), the legend under the zoom control. Remote jobs are excluded and counted in a note. Hybrid jobs are shown. Jobs with no known place are counted. |
| `/jobs/[id]`       | Car / public-transport chips from your default saved place (or `?from=lat,lng`), the leg breakdown (e.g. walk → bus 18 → train → walk, transfers, walking, leave/arrive), and a "show on map" link.                                                                                                                                                                                                                                                   |
| `/settings/places` | Up to 10 saved addresses (home, partner, …). One is the default.                                                                                                                                                                                                                                                                                                                                                                                      |
| `/admin`           | "Company office" form: set an exact office address (geocoded), which overrides the city centre.                                                                                                                                                                                                                                                                                                                                                       |

### URL params

- `view=map`
- `origin=<savedPlaceId|none>`
- `from=<lat,lng>`: rounded to ~200 m in the browser
- `cmode=car|transit` (old `bus` / `train` links map to `transit`)
- `maxc=15|30|45|60|90`: minutes, using the best mode or `cmode`
- `dep=<sun-thu|fri|sat>-HHMM`: default `sun-thu-0830`
- `sort=commute`

### Hebrew labels

- Strings: `src/lib/i18n/jobs-map.ts`, with full en/he parity.
- Map labels use `coalesce(name:he, name)` (`name:en` in English).
- Arabic/Hebrew shaping uses the vendored `@mapbox/mapbox-gl-rtl-text` 0.3.0 from `public/vendor/` (BSD-2).

## Privacy

- Browser geolocation runs only after an in-page consent dialog. It is never stored.
- The position is rounded to a ~200 m grid **in the browser** before it reaches the URL or server.
- Commute cache keys use the same rounded origin. Nothing in the DB links a cache row to a user.
- Saved places are stored per user (and deleted with the user), and only their geocoded point is used.
- Providers only see rounded coordinates and the office location. The explanation appears under the commute bar and on `/settings/places`.

## Geocoding

1. **Jobs (offline, free):** `src/lib/geo/geocode.ts` matches the job location text (Hebrew or English, with aliases and typos) against `il-places.json`. That file is built by `scripts/build-gazetteer.mjs` from the GeoNames IL dump (CC BY 4.0, attribution shown on the map) plus hand-placed tech hubs (Herzliya Pituach, Matam Haifa, Kiryat Atidim, Har Hotzvim, …).
   - `Job.geoPlaces` stores the matched places.
   - `/api/cron/geocode` (and the end of the daily ingest) fills new or changed jobs.
   - `?all=1` re-geocodes everything (CRON_SECRET).
   - A company `officeLat/officeLng` (admin) wins over the city centre.
2. **Addresses (saved places, admin offices):** Nominatim, server side only.
   - Rate: ≤1 request/s, enforced via `GeoProviderCall`.
   - Identification: custom `User-Agent` and `countrycodes=il`.
   - Caching: hits and misses are stored in `GeocodeCache`.
   - Fallback: if Nominatim fails, the gazetteer city centre is used.
   - This follows the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/): low volume, no autocomplete, cached, attributed.

## Routing (`src/lib/commute/`)

- **Provider:** [Transitous](https://transitous.org) (MOTIS 2). Israeli GTFS from the Ministry of Transport covers bus, train and light rail. Car routing uses the OSM street network.
  - Car: `/api/v1/one-to-many?mode=CAR`.
  - Public transport: `/api/experimental/one-to-many-intermodal` with `transitModes=TRANSIT` (all modes combined), `maxTransfers=4`, up to 25 min walking to the first stop and from the last (`maxPre/PostTransitTime=1500`), and a 5 h window (`maxTravelTime=300`). The duration counts from the departure time, so it includes waiting for the first trip.
  - Leg breakdown: `/api/v5/plan` for one destination (earliest arrival, then fewer transfers), via `getTransitRoute` and `GET /api/commute/route?from&to&dep`. Only for destinations that already have a cached matrix row for that origin and bucket, so the public endpoint can't spend the budget on arbitrary points.
- **Why not separate bus / train modes (before Oct 2026):** bus-only couldn't use a train and train-only had no bus feeder, and the 3 h window counted the wait, so about half the jobs showed "no route" by bus and ~80% by train.
- **Batching:** one origin → many destinations per request (the destinations are company offices, de-duplicated).
- **Cache:** `CommuteCache`, keyed by (origin rounded to ~200 m, destination point, mode, time bucket = day type + 30-minute slot).
  - Modes: `car`, `transit` (matrix) and `transit-route` (itinerary JSON in `route`). Old `bus` / `train` rows are no longer read and expire on their own.
  - TTL: 30 days for car, 7 days for transit.
  - Bulk upserts.
- **Limits:**
  - `TRANSITOUS_DAILY_CAP` (default 500) counts uncached calls over a rolling 24 h, via `GeoProviderCall`.
  - Calls run in parallel batches with a 12 s timeout.
- **Graceful degradation:**
  - Past the cap, on errors, or with `COMMUTE_PROVIDER=estimate`, distance-based estimates are used (`estimate.ts`, with peak factors). These are labelled "הערכה" / "estimate" in the UI.
  - When the router finds no route (no service near the origin in the window), the job gets a distance estimate marked `≈` with a "no timetable route found" tooltip, never "unreachable". Routed values win over estimates when a multi-city job has both.
  - The page never fails because of routing.
- **Car caveat:** Transitous car times are free-flow. The UI shows a range (`free-flow … × traffic factor` for the chosen departure; peak sun–thu 06:30–09:30 and 15:30–19:00 ×1.6, otherwise ×1.1–1.25). Treat it as a guide, not live traffic.
- **Departure:** sun–thu / fri / sat at any 30-minute slot, 05:00–23:30, Israel time (DST-aware). The default is the next weekday at 08:30.

### Costs and ToS

| Provider                             | Cost                    | Terms that matter                                                                                                                                                                                                                                       |
| ------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenFreeMap (tiles, style "liberty") | Free, no key, no limits | Attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (shown)                                                                                                                                                                                |
| GeoNames                             | Free                    | CC BY 4.0 attribution (shown)                                                                                                                                                                                                                           |
| Nominatim (OSMF)                     | Free                    | ≤1 req/s, identify via UA, cache, no bulk/autocomplete                                                                                                                                                                                                  |
| Transitous                           | Free                    | Meant for **non-commercial / open-source** apps. Send an identifying UA, link to https://transitous.org/sources/ (shown), and contact them above ~720 requests/day. The project is MIT-licensed (`LICENSE`) and non-commercial, which fits their terms. |

At the default cap (500 uncached calls/day, each covering up to ~100 offices), with 7–30 day caching, expected use is a few dozen calls a day.

## Env vars (all optional)

| Var                    | Default                               | Purpose                                        |
| ---------------------- | ------------------------------------- | ---------------------------------------------- |
| `GEO_USER_AGENT`       | `job-hunt/0.1 (jobs map; +repo url)`  | UA for Transitous + Nominatim                  |
| `TRANSITOUS_DAILY_CAP` | `500`                                 | Uncached routing calls / 24 h before estimates |
| `TRANSITOUS_BASE_URL`  | `https://api.transitous.org`          | Self-hosted MOTIS                              |
| `NOMINATIM_BASE_URL`   | `https://nominatim.openstreetmap.org` | Self-hosted / commercial Nominatim             |
| `COMMUTE_PROVIDER`     | (unset)                               | `estimate` = offline estimates only            |

## Pluggable alternatives

The provider interface is in `src/lib/commute/service.ts` (`PROVIDER`: `batchSize`, `matrix(origin, dests, mode, departure)`).

- **Self-hosted MOTIS or OpenTripPlanner** on the free GTFS feed (`gtfs.mot.gov.il`) plus an OSM extract. No ToS limits; needs a small VM (~2–4 GB RAM). This is the cleanest option if usage outgrows Transitous.
- **OpenRouteService:** free key, 2,000 matrix requests/day. Car only, no transit.
- **Google Routes API (Compute Route Matrix):** traffic-aware car and transit, roughly $5–10 per 1,000 elements, and needs a key plus billing. Not wired.
- **Moovit:** best Israeli transit data, but a commercial partnership API only.
- **Geocoding:** Photon or a self-hosted Nominatim (`NOMINATIM_BASE_URL`), or Google Geocoding (paid).
