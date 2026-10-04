# Matching

Only accepted friends are considered. The passenger trip must be `LOOKING_FOR_RIDE`; the driver trip must be `DRIVING`, `OFFERING_RIDE`, and have capacity.

Stage 1 filters candidates to the same local date and destinations within 2,000 metres. Production repositories perform the geographic filter with PostGIS.

Stage 2 calculates both travelers' routes and compares the driver's normal route with the route including passenger pickup. Timing is compatible when either departures are no more than 30 minutes apart or the passenger's original arrival and proposed carpool arrival are no more than 30 minutes apart. This allows a slower walking, cycling, or transit trip to match a later driver when their destination arrival windows remain useful. The signed arrival difference is returned so the passenger can see how many minutes earlier or later the carpool would arrive.

Matches over 10 minutes of driver detour are rejected. OpenRouteService is accessed only by the API integration when selected; automated tests use a deterministic adapter. Thresholds are shared configuration, not UI logic.
