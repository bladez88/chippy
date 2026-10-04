# Matching

Only accepted friends are considered. The passenger trip must be `LOOKING_FOR_RIDE`; the driver trip must be `DRIVING`, `OFFERING_RIDE`, and have capacity.

Stage 1 filters candidates to the same local date, at most 30 minutes apart, and destinations within 2,000 metres. Production repositories perform the geographic filter with PostGIS.

Stage 2 compares the driver's normal route with the route including passenger pickup. Matches over 10 minutes of driver detour are rejected. OpenRouteService is accessed only by the API integration when selected; automated tests use a deterministic adapter. Thresholds are configuration, not UI logic.
