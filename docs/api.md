# REST API

All endpoints use `/api`, JSON, ISO timestamps, shared error objects, and cookie authentication.

`GET /api/health` returns `{ status, store }`, where `store` is `memory` or `prisma`, so local setup can confirm which persistence adapter is active.

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/dev-login`, `POST /auth/logout`, `GET /auth/me`
- Trips/schedules: `GET|POST /trips`, `PATCH|DELETE /trips/:id`, `POST /schedules`, `GET /trips/:id/matches`, `GET /trips/:id/route-plan`
- Calendar/map: `GET /calendar?start&end&timezone&friendIds`, `GET /map`
- Friends: `GET /friends`, `POST /friends/requests`, `PATCH /friends/requests/:id`, `DELETE /friends/:id`
- Rides: `GET|POST /ride-requests`, `PATCH /ride-requests/:id/{accept|decline|cancel}`, `GET /carpools`, `POST /carpools/:id/cancel`, `POST /carpools/:id/leave`, `DELETE /carpools/:id/passengers/:tripId`
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`

Validation failures include a stable code, safe message, field errors when available, and request identifier.

`POST /auth/register` accepts `{ name, email, password }`; `POST /auth/login` accepts `{ email, password }`. Emails are trimmed and normalized to lowercase, passwords must contain 10–128 characters, and successful responses set the signed HTTP-only session cookie. Registration returns `409 EMAIL_IN_USE` for an existing address. Sign-in failures use the generic `401 INVALID_CREDENTIALS` response. Both routes are rate-limited. Password hashes are never returned by the API.

`POST /auth/dev-login` is available only when development auth is explicitly enabled outside production. Google sign-in remains optional.

`PATCH /trips/:id` edits one dated occurrence with optional `origin` and `destination` snapshots plus `departureAt`, `timezone`, `transportationMode`, `carpoolStatus`, and optional `availableSeats`. It does not rewrite a recurring series. Changing a location, time, transportation mode, or carpool state removes the occurrence from any confirmed carpool, restores affected passenger trips, cancels related ride requests, and creates in-app notifications. Persistent location edits also refresh the occurrence's PostGIS geography points.

`GET /calendar` accepts an optional comma-separated `friendIds` list (up to 20). Only accepted friends are honored. Their events use the `FRIEND_TRIP` discriminator and expose private schedule blocks without exact origin or destination labels.

Potential-match calendar events include `originalArrivalAt`, `carpoolArrivalAt`, and a signed `arrivalDifferenceMinutes`. Positive differences mean the passenger would arrive later; negative differences mean earlier.

Pending ride requests keep passenger pickup details private. The route comparison returns a generalized city-area label unless the pickup is within 150 metres of the driver's own origin; in that same-origin case, it reuses the driver's already-visible origin label without exposing the passenger's private label or address. Confirmed participants receive the exact pickup details through the trip route plan.

`PATCH /ride-requests/:id/cancel` is requester-only. It marks the pending request as cancelled, restores the passenger trip to `LOOKING_FOR_RIDE`, and creates a withdrawal notification for the driver.
