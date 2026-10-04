# Chippy

Chippy is a mobile-first private carpool planner for friends. It combines recurring travel schedules, a day/week/month calendar, friend-only matching, ride requests, a route map, and in-app notifications in an installable PWA.

## Current implementation

- The web app uses Leaflet and OpenStreetMap raster tiles.
- With `ROUTING_PROVIDER=ors`, location search, route geometry, travel time, matrices, and detour validation use OpenRouteService through the backend. Automated tests stay deterministic.
- Authentication supports a local two-user demo and Google Identity Services when configured.
- Application data currently lives in an in-memory store and resets whenever the API restarts.
- Prisma, PostgreSQL/PostGIS, and Docker Compose are prepared, but the API repository is not yet wired to PostgreSQL.

## Quick start

Requirements: Node.js 22+ and npm. Docker Desktop is optional until using PostgreSQL/PostGIS.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run dev
```

Open `http://localhost:5173`. Use **Demo as Jimmy** to request Daniel's seeded ride. Log out and use **Demo as Daniel** to accept it.

The demo requires no cloud credentials.

### Two-person demo walkthrough

1. Sign in as **Jimmy**. On the next day's calendar, open the orange Daniel → SFU match and compare Jimmy's original arrival with the carpool arrival. Request the ride.
2. Open **Menu → Log out**, then sign in as **Daniel**. Open **Menu → Notifications** and accept Jimmy's request.
3. Open Daniel's calendar event to see the ordered driver start, Jimmy pickup, and destination ETAs. Each address can be copied, and Jimmy can be removed from the route.
4. Switch back to **Jimmy** and open Home → SFU to see the pickup driver/time, final arrival, and original-versus-carpool arrival comparison.
5. Jimmy can leave the carpool while keeping his original trip, or remove the trip entirely. Daniel can remove Jimmy or cancel the drive; either action restores Jimmy's original trip and recalculates Daniel's route.

The dates are seeded relative to the day the API starts. Restarting the API resets the complete demo.

## Environment files and API keys

Local secrets belong in these ignored files:

- `apps/web/.env` — values intentionally available to the browser and prefixed with `VITE_`
- `apps/api/.env` — database URLs, signing secrets, and private provider keys

Never commit either file and do not put backend secrets in `apps/web/.env`. Start from the checked-in templates:

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Generate a local session secret and place the result in `apps/api/.env` as `JWT_SECRET`:

```bash
openssl rand -base64 32
```

### Google sign-in

Create a Google OAuth **Web application** client and allow `http://localhost:5173` as a JavaScript origin. Put the client ID—not the client secret—in both files:

```dotenv
# apps/web/.env
VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com

# apps/api/.env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
```

The browser receives the Google credential and the API verifies it. This flow does not currently require `GOOGLE_CLIENT_SECRET`.

### Location provider choices

Chippy should use one coherent map/search/routing stack:

1. **Current/recommended MVP stack:** Leaflet + an OSM-compatible hosted tile provider + openrouteservice for directions, matrices, and detours + an OSM-compatible hosted geocoder. Put the private ORS key in `apps/api/.env` as `OPENROUTESERVICE_API_KEY`. Do not call ORS directly from the browser.
2. **Google stack:** Maps JavaScript API + Places API (New) + Routes API. This generally provides stronger address autocomplete, place coverage, traffic-aware ETAs, and route quality, but requires billing, quotas, key restrictions, and a map migration away from Leaflet.

For a Google migration, create separate restricted keys:

```dotenv
# apps/web/.env — browser-visible; restrict to localhost/production HTTP referrers
VITE_GOOGLE_MAPS_API_KEY=your-restricted-browser-key

# apps/api/.env — private; restrict to the Routes API and server IPs in production
GOOGLE_MAPS_SERVER_API_KEY=your-restricted-server-key
```

Enable only the APIs each key needs. The Google variables are reserved for a possible later migration; the ORS integration is active when `ROUTING_PROVIDER=ors`.

Do not use the public OpenStreetMap Nominatim endpoint for client-side autocomplete, and do not treat the community OSM raster tile server as a production service with an SLA. Use a hosted provider or self-host before meaningful public traffic.

## Database setup

The current demo is **not using a local database**. Its in-memory data is intentionally disposable.

To prepare local PostGIS after installing Docker Desktop:

```bash
docker compose up -d
npm run db:generate
npm run db:migrate
```

The default connection string in `apps/api/.env.example` matches Docker Compose. Tiger Cloud can replace it by setting `DATABASE_URL` in `apps/api/.env`. Database migration alone does not switch runtime storage yet; the Prisma repositories must be wired into the API first.

## Commands

- `npm run dev` — web and API development servers
- `npm run build` — production builds for shared, API, and web
- `npm run typecheck` — strict TypeScript checks
- `npm test` — unit and API tests
- `docker compose up -d` — local PostGIS
- `npm run db:generate` / `npm run db:migrate` — Prisma client and migrations

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Project layout

```text
apps/web        React, Vite, PWA, calendar, map, and mobile UI
apps/api        Express API, domain workflows, integrations, and Prisma schema
packages/shared Zod contracts, DTOs, enums, and matching defaults
docs            architecture, database, API, matching, and product notes
```

Architecture and product decisions live in [`docs/architecture.md`](docs/architecture.md). Environment templates document all required variables.
