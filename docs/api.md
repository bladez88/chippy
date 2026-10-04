# REST API

All endpoints use `/api`, JSON, ISO timestamps, shared error objects, and cookie authentication.

- Auth: `POST /auth/register` (email, name, password), `POST /auth/login` (email, password), optional `POST /auth/google`, development-only `POST /auth/dev-login`, `POST /auth/logout`, `GET /auth/me`
- Trips/schedules: `GET|POST /trips`, `POST /schedules`, `GET /trips/:id/matches`
- Calendar/map: `GET /calendar?start&end&timezone`, `GET /map`
- Friends: `GET /friends`, `POST /friends/requests`, `PATCH /friends/requests/:id`, `DELETE /friends/:id`
- Rides: `GET|POST /ride-requests`, `PATCH /ride-requests/:id/{accept|decline|cancel}`, `GET /carpools`
- Notifications: `GET /notifications`, `PATCH /notifications/:id/read`

Validation failures include a stable code, safe message, field errors when available, and request identifier.
