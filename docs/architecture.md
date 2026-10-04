# Architecture

Chippy is an npm-workspaces monorepo. `apps/web` is a React/Vite PWA, `apps/api` is an Express API, and `packages/shared` owns runtime-validated contracts and domain constants.

The web app is organized by product feature. TanStack Query owns server state, forms own only unsaved drafts, and rendering components do not fetch. Calendar day/week/month views consume one normalized `CalendarEvent` contract. Selected accepted friends are a query input, and `FRIEND_TRIP` blocks are assigned stable palette colors in the presentation layer. Map layers receive backend-composed geometry.

The API exposes a common store contract with two adapters. `CoreStore` is the deterministic, credential-free test/demo adapter. `PrismaStore` persists the vertical-slice workflows in PostgreSQL/PostGIS and is selected with `DATA_STORE=prisma`. External identity and routing providers are isolated in integrations. Multi-record ride acceptance and carpool transitions use database transactions in the Prisma adapter.

Sessions are signed HTTP-only cookies. Email/password authentication hashes passwords with a per-account salt and Node's scrypt implementation; the password hash remains inside the persistence adapter. Registration and sign-in use shared validation contracts and a bounded in-memory attempt limiter. Google Identity is an optional parallel sign-in method. Development login and mock routing are configuration-gated and forbidden in production. Friend match DTOs omit exact pickup details until acceptance, while friend schedule comparison returns only generalized private blocks. Coordination-changing occurrence edits atomically restore affected trips and cancel their carpool relationships in the persistent adapter.
