# REST API

All endpoints use `/api`, JSON, ISO timestamps, shared error objects, and cookie authentication.

`GET /api/health` returns `{ status, store }`, where `store` is `memory` or `prisma`, so local setup can confirm which persistence adapter is active.

- Auth: `POST /auth/google`, `POST /auth/dev-login`, `POST /auth/logout`, `GET /auth/me`
- Trips/schedules: `GET|POST /trips`, `DELETE /trips/:id`, `POST /schedules`, `GET /trips/:id/matches`, `GET /trips/:id/route-plan`
- Calendar/map: `GET /calendar?start&end&timezone`, `GET /map`
- Friends: `GET /friends`, `POST /friends/requests`, `PATCH /friends/requests/:id`, `DELETE /friends/:id`
- Rides: `GET|POST /ride-requests`, `PATCH /ride-requests/:id/{accept|decline|cancel}`, `GET /carpools`, `POST /carpools/:id/cancel`, `POST /carpools/:id/leave`, `DELETE /carpools/:id/passengers/:tripId`
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`

Validation failures include a stable code, safe message, field errors when available, and request identifier.
