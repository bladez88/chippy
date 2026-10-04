# Database

The Prisma schema models users, directional friend requests, recurring schedules, dated trip occurrences, ride requests, carpools, participants, and notifications.

Schedules materialize trips so matches and ride requests always reference durable occurrences. `(scheduleId, departureAt)` prevents duplicate generation. A carpool has one driver trip and multiple participant rows, avoiding a one-passenger assumption.

Locations retain display snapshots and numeric coordinates. PostGIS `geography(Point,4326)` columns support indexed distance filtering; provider-specific spatial SQL belongs in repositories rather than services. Local development uses the PostGIS Docker image, while Tiger Cloud can use the same PostgreSQL schema.
