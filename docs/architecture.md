# Architecture

Chippy is an npm-workspaces monorepo. `apps/web` is a React/Vite PWA, `apps/api` is an Express API, and `packages/shared` owns runtime-validated contracts and domain constants.

The web app is organized by product feature. TanStack Query owns server state, forms own only unsaved drafts, and rendering components do not fetch. Calendar day/week/month views consume one normalized `CalendarEvent` contract. Map layers receive backend-composed geometry.

The API exposes a common store contract with two adapters. `CoreStore` is the deterministic, credential-free test/demo adapter. `PrismaStore` persists the vertical-slice workflows in PostgreSQL/PostGIS and is selected with `DATA_STORE=prisma`. External identity and routing providers are isolated in integrations. Multi-record ride acceptance and carpool transitions use database transactions in the Prisma adapter.

Sessions are signed HTTP-only cookies. Development login and mock routing are configuration-gated and forbidden in production. Friend match DTOs omit exact pickup details until acceptance.
