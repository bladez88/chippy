# Architecture

Chippy is an npm-workspaces monorepo. `apps/web` is a React/Vite PWA, `apps/api` is an Express API, and `packages/shared` owns runtime-validated contracts and domain constants.

The web app is organized by product feature. TanStack Query owns server state, forms own only unsaved drafts, and rendering components do not fetch. Calendar day/week/month views consume one normalized `CalendarEvent` contract. Map layers receive backend-composed geometry.

The API boundary is route/controller → service → repository → database. The current runnable development adapter packages the vertical-slice workflows in `CoreStore`; the Prisma schema is the production persistence contract. External identity and routing providers are isolated in integrations. Multi-record ride acceptance is designed as a transaction.

Sessions are signed HTTP-only cookies. Email/password accounts use scrypt password hashes; Google sign-in is optional. Account profiles and password hashes currently live in the in-memory `CoreStore`, so newly created accounts are reset when the API restarts. Development login and mock routing are configuration-gated and forbidden in production. Friend match DTOs omit exact pickup details until acceptance.
