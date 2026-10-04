# AGENTS.md

## Purpose

This file defines repository-wide working agreements for coding agents and contributors. It applies to every file in this monorepo unless a more specific `AGENTS.md` exists deeper in the directory tree.

Chippy is a mobile-first, private carpool coordination PWA for existing friends. It is not a public rideshare marketplace. Preserve that product boundary in data models, API design, copy, and privacy decisions.

## Start Here

Before making changes:

1. Read `README.md` for the current runtime state and environment setup.
2. Read the relevant document under `docs/`:
   - `architecture.md` for system boundaries
   - `database.md` for persistence and spatial data
   - `api.md` for HTTP resources
   - `matching.md` for carpool eligibility and detours
   - `product-requirements.md` for MVP scope
3. Inspect the existing implementation before proposing a new abstraction.
4. Check `git status` and preserve unrelated or user-authored changes.

Do not assume that a documented future integration is already active. Verify the code path.

## Repository Map

```text
apps/web/         React, Vite, TypeScript, TanStack Query, Leaflet, PWA
apps/api/         Express, TypeScript, auth, domain workflows, integrations
apps/api/prisma/  PostgreSQL/PostGIS persistence schema
packages/shared/  Zod contracts, inferred DTOs, enums, shared constants
docs/             Product and engineering documentation
```

This is an npm-workspaces monorepo. Use npm; do not introduce a second package manager or nested lockfile.

## Current Runtime Truth

- The API supports both the in-memory `CoreStore` and persistent `PrismaStore`; verify `DATA_STORE` before describing runtime behavior.
- Demo data resets on API restart only when `DATA_STORE=memory`.
- `DATA_STORE=prisma` persists API workflows in PostgreSQL/PostGIS, with transactional ride/carpool transitions.
- Map rendering uses Leaflet and OpenStreetMap tiles.
- Routes and detour estimates are currently deterministic demo calculations, not live road routes.
- Email/password registration and sign-in are available; password hashes use salted scrypt and are optional for Google-only or seeded accounts.
- Google Identity Services can be enabled with environment configuration.
- Google Maps and live openrouteservice variables are declared for setup, but those location providers are not wired yet.

Never describe the current app as persistent, production-ready, or traffic-aware until the relevant implementation and tests exist.

## Common Commands

Run commands from the repository root:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run db:generate
npm run db:migrate
```

Prefer a targeted workspace command while iterating:

```bash
npm test -w @chippy/api
npm run typecheck -w @chippy/web
npm run build -w @chippy/shared
```

Before handing off a material change, run the root type-check, relevant tests, and production build. Report any check that could not run and why.

## Architectural Rules

### Shared contracts

- `packages/shared` is the source of truth for cross-boundary enums, Zod schemas, DTOs, matching defaults, and error shapes.
- Infer TypeScript types from Zod schemas instead of duplicating interfaces.
- Keep Prisma models, Express types, React state, and provider-specific response types out of the shared package.
- When Prisma must duplicate enum values, maintain or extend a consistency test.
- Treat public contract changes as API changes: update consumers, tests, and `docs/api.md` together.

### Web application

- Organize product code by feature, not by generic file type.
- React components render UI and coordinate interactions. Put server state in TanStack Query hooks and reusable domain calculations in pure helpers.
- Use the centralized API client and query-key definitions. Do not call `fetch` from leaf components, markers, or route layers.
- Day, week, and month calendar views must consume the same normalized `CalendarEvent` model.
- Preserve URL-backed calendar date/view state and the user's locally persisted view preference.
- Design mobile-first, then verify tablet and desktop behavior. Respect safe areas, dynamic viewport height, reduced motion, keyboard navigation, and minimum 44px touch targets.
- Keep the floating Calendar/Map/Menu pill usable above mobile browser chrome and sheet overlays.
- Sheets are the primary phone interaction; dialogs/popovers are appropriate on wider screens.
- Do not cache authenticated API responses in the service worker or add offline mutations without an explicit synchronization design.
- Lazy-load large routes or provider SDKs when practical. Avoid increasing the initial bundle without checking the production build output.

### API application

- Maintain the intended boundary: route/controller → service → repository → database.
- Route handlers parse HTTP concerns and delegate. Business rules belong in services; persistence and spatial SQL belong in repositories.
- Keep external providers behind small interfaces in `src/integrations/`. Domain services must not construct provider HTTP requests.
- Validate every untrusted request with shared or server-only Zod schemas.
- Use the shared error envelope with a stable code, safe message, optional field errors, and request ID.
- Protect private routes with cookie authentication and enforce ownership/authorization in services, not only in the UI.
- Multi-record ride transitions must be atomic when persistence is enabled.
- Do not silently fall back to mock routing in production.

### Domain invariants

- A `Schedule` describes recurrence; a `Trip` is a dated occurrence. Never collapse them into one entity.
- Store timezone explicitly and perform recurrence/date matching in the user's IANA timezone. Test daylight-saving boundaries.
- Transportation mode and carpool status are independent concepts.
- Only accepted friends are eligible for shared schedule matching.
- A valid passenger is `LOOKING_FOR_RIDE`; a valid driver is `DRIVING`, `OFFERING_RIDE`, and has capacity.
- Matching is server-side and two-stage: inexpensive friendship/time/geospatial filtering, then provider route/detour validation.
- A carpool supports multiple passengers. Never add a uniqueness rule that limits it to one participant.
- Revalidate match eligibility and seat capacity when accepting a request; do not trust an earlier match response.
- Preserve committed trip occurrences as historical snapshots when a schedule changes.
- Fuel contributions are metadata only. Do not add payment processing without an explicit product decision.

### Privacy and security

- Exact home, origin, and pickup information is sensitive.
- Before acceptance, expose only the minimum match summary and generalized geometry needed for coordination.
- Exact pickup details are limited to confirmed participants.
- Never send database URLs, signing secrets, OAuth secrets, or routing keys to the browser.
- Values prefixed with `VITE_` are browser-visible. Only put public identifiers or properly referrer-restricted browser keys there.
- Keep local credentials in ignored `.env` files and update `.env.example` using placeholders only.
- Never commit credentials, access tokens, personal addresses, or production user data.
- Keep development login explicitly gated and impossible to enable in production.

## Maps, Search, and Routing

Use one coherent provider strategy rather than accidentally coupling providers across UI and domain code.

For the OSM stack:

- Keep Leaflet as a renderer only.
- Route geocoding, directions, matrices, and detour requests through the API.
- Do not use the public Nominatim endpoint for client-side autocomplete.
- Preserve visible OpenStreetMap attribution and the configured tile provider's usage requirements.

For a Google migration:

- Treat Maps JavaScript API, Places API (New), and Routes API as one coordinated migration.
- Use separate restricted browser and server keys.
- Keep Routes requests server-side.
- Review Google attribution, display, retention, and billing rules before mixing Google place data with a non-Google map.

Provider-specific response shapes must stop at the integration boundary. Convert them to shared Chippy location, route, and matrix models.

## Database Work

- PostgreSQL/PostGIS is the target persistent database; do not replace spatial filtering with frontend distance calculations.
- Keep address snapshots and numeric coordinates alongside PostGIS geography columns where the domain needs both display and indexed distance filtering.
- Isolate raw spatial SQL in repositories.
- Generate and inspect migrations; do not edit an existing applied migration to change production behavior.
- Seed data must be obviously fictional and safe to commit.
- Until the Prisma repository adapter is wired, keep the README honest that the runnable app is in-memory.

## Testing Expectations

Add or update tests with behavior changes.

- Shared package: schemas, enum compatibility, constants, and DTO behavior.
- API: authentication, authorization, ownership, friendship lifecycle, recurrence, matching thresholds, duplicate prevention, capacity, request transitions, notifications, and privacy serialization.
- Database: PostGIS distance filtering and transaction behavior when persistence is wired.
- Web: calendar mode switching, mobile agenda behavior, forms, sheets, loading/error/empty states, ride workflows, and accessible navigation.
- Routing integrations: mock provider contract tests plus separately gated live-provider smoke tests.

Tests must not depend on real cloud credentials by default. Use deterministic clocks/providers and reset mutable demo state between tests.

For UI changes, verify at least one phone viewport and one desktop viewport. Check the browser console for runtime errors.

## Documentation Discipline

Update documentation in the same change when behavior or setup changes:

- `README.md` for installation, environment variables, current limitations, and demo instructions
- `docs/api.md` for endpoint and DTO changes
- `docs/database.md` for schema or migration decisions
- `docs/matching.md` for eligibility, thresholds, or routing changes
- `docs/architecture.md` for boundary or provider changes
- `docs/product-requirements.md` for user-visible scope decisions

Document current truth separately from planned work. Avoid wording that makes placeholders sound implemented.

## Change Guidelines

- Prefer small, cohesive modules with one domain responsibility.
- Reuse established patterns, but do not create generic abstractions for a single speculative use.
- Avoid giant React components, route files containing business logic, and catch-all utility modules.
- Preserve backward compatibility unless the task explicitly authorizes a breaking contract or migration.
- Do not rewrite unrelated files or discard working-tree changes.
- Do not add real payment processing, live GPS tracking, public ride discovery, push/SMS/email delivery, or offline mutation queues unless explicitly requested.

## Definition of Done

A change is complete when:

1. The requested behavior works through the intended layer boundaries.
2. Security, privacy, timezone, and mobile-browser implications were considered.
3. Relevant automated tests pass.
4. Type-check and production build pass for affected workspaces.
5. Environment templates and documentation match actual behavior.
6. No secret, generated build output, or unrelated user change was committed.
7. The handoff clearly states any remaining limitation or unverified external integration.
