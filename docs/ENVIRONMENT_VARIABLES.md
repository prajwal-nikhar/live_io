# 🔑 Environment Variables Reference

Comprehensive documentation of environment variables across backend and frontend environments.

---

## ⚙️ Backend Environment Variables (`backend/.env`)

| Variable                 | Description                                                   | Default / Example                     | Required in Prod |
| :----------------------- | :------------------------------------------------------------ | :------------------------------------ | :--------------: |
| `NODE_ENV`               | Application environment (`development`, `production`, `test`) | `production`                          |       Yes        |
| `PORT`                   | HTTP & WebSocket server port                                  | `4000`                                |       Yes        |
| `DATABASE_URL`           | PostgreSQL connection string                                  | `postgresql://user:pass@host:5432/db` |   **CRITICAL**   |
| `REDIS_URL`              | Redis connection string for socket clustering                 | `redis://localhost:6379`              |     Optional     |
| `JWT_SECRET`             | Secret key for signing access JWT tokens                      | `min-32-char-random-string`           |   **CRITICAL**   |
| `JWT_REFRESH_SECRET`     | Secret key for signing refresh JWT tokens                     | `min-32-char-random-string`           |   **CRITICAL**   |
| `JWT_EXPIRATION`         | Access token lifespan                                         | `15m`                                 |        No        |
| `JWT_REFRESH_EXPIRATION` | Refresh token lifespan                                        | `7d`                                  |        No        |
| `SENTRY_DSN`             | Sentry DSN endpoint for error tracking                        | `https://dsn@sentry.io/123`           |   Recommended    |
| `METRICS_API_KEY`        | Secret key protecting `/metrics` endpoint                     | `your-metrics-secret-key`             |   Recommended    |
| `FRONTEND_URL`           | Whitelisted CORS origin URL                                   | `https://cognition.up.railway.app`    |       Yes        |

---

## 🌐 Frontend Environment Variables (`frontend/.env.local`)

| Variable                 | Description                              | Default / Example                  | Required in Prod |
| :----------------------- | :--------------------------------------- | :--------------------------------- | :--------------: |
| `NEXT_PUBLIC_APP_URL`    | Frontend Web Application Base URL        | `https://cognition.up.railway.app` |       Yes        |
| `NEXT_PUBLIC_API_URL`    | Backend REST API base URL                | `http://localhost:4000`            |       Yes        |
| `NEXT_PUBLIC_SOCKET_URL` | Backend Socket.IO server base URL        | `http://localhost:4000`            |       Yes        |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN endpoint for browser tracking | `https://dsn@sentry.io/123`        |   Recommended    |
