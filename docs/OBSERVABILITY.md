# 🔍 Log Observability & Sentry Context Tracing

Guide to log correlation, contextual tags, and Sentry error tracking.

---

## 🏷 Contextual Correlation Tags

Every log entry and Sentry exception capture includes mandatory correlation tags:

- `requestId`: Unique HTTP request identifier.
- `socketId`: Socket.IO client connection ID.
- `sessionId`: Room PIN / session ID.
- `playerId`: Player GUID.
- `hostId`: Host GUID.
- `environment`: `production` / `staging` / `development`.
- `version`: Release tag or commit hash.

---

## 🌲 Pino Structured Log Example

```json
{
  "level": 30,
  "time": 1786082400000,
  "pid": 1234,
  "hostname": "backend-runner",
  "requestId": "req-99128",
  "socketId": "sock-x812",
  "sessionId": "999999",
  "playerId": "ply-7712",
  "service": "enterprise-quiz-backend",
  "environment": "production",
  "msg": "[Join Success] Player 'TestUser' joined PIN 999999"
}
```
