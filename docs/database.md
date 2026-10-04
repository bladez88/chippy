# Database

The Prisma schema models users, directional friend requests, recurring schedules, dated trip occurrences, ride requests, carpools, participants, and notifications.

Schedules materialize trips so matches and ride requests always reference durable occurrences. `(scheduleId, departureAt)` prevents duplicate generation. A carpool has one driver trip and multiple participant rows, avoiding a one-passenger assumption.

Locations retain display snapshots and numeric coordinates. PostGIS `geography(Point,4326)` columns support indexed distance filtering; provider-specific spatial SQL belongs in repositories rather than services. Local development uses the PostGIS Docker image, while Tiger Cloud can use the same PostgreSQL schema.

## Runtime adapters

- `DATA_STORE=memory` selects the reset-on-restart `CoreStore` for tests and credential-free demos.
- `DATA_STORE=prisma` selects persistent PostgreSQL/PostGIS repositories for API requests.
- Tests default to memory even when a developer has a cloud URL in `apps/api/.env`, so the normal suite never mutates cloud data.

The initial migration enables PostGIS, creates all relational constraints, and adds GiST indexes on schedule/trip origin and destination geography columns. Trip and schedule writes populate geography points from their numeric longitude/latitude snapshots.

Use `npm run db:migrate` for local development databases that permit Prisma shadow databases. Use `npm run db:deploy` for TigerData and other managed environments. `npm run db:test` performs a seeded PostGIS query and an authenticated Express create/delete smoke test.
