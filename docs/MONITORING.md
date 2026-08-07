# 📊 Prometheus Metrics & Monitoring Documentation

Documentation of Prometheus metrics exposed by NestJS backend on `/metrics` endpoint.

---

## 🔍 Metrics Scrape Configuration

Prometheus scrapes the backend metrics endpoint:

- **Endpoint**: `GET /metrics`
- **Port**: `4000` (or `$PORT`)
- **Authentication**: Requires `x-metrics-key` or `Authorization: Bearer <METRICS_API_KEY>` header.
- **Scrape Interval**: `5s`

---

## 📋 Metrics Catalogue

### 1. HTTP Telemetry

- `http_requests_total`: Counter tracking HTTP request volume by method, route, and status code.
- `http_request_duration_seconds`: Histogram measuring HTTP request duration.
- `http_active_requests`: Gauge tracking in-flight HTTP requests.

### 2. Socket.IO Telemetry

- `active_sockets`: Gauge tracking connected WebSockets.
- `active_rooms`: Gauge tracking active quiz rooms.
- `connected_players`: Gauge tracking total online players.
- `socket_disconnects_total`: Counter tracking socket disconnect reasons.
- `socket_reconnects_total`: Counter tracking player reconnect events.
- `socket_messages_total`: Counter tracking event message throughput.
- `socket_join_failures_total`: Counter tracking room join failures.
- `join_latency_seconds`: Histogram measuring `player:join` processing time.
- `broadcast_latency_seconds`: Histogram measuring WebSocket room broadcast latency.

### 3. Quiz Operations Telemetry

- `quiz_active_total`: Gauge tracking active quiz sessions.
- `quiz_answers_total`: Counter tracking submitted player answers.
- `quiz_answer_duration_seconds`: Histogram measuring answer submission timing.
- `quiz_leaderboard_duration_seconds`: Histogram measuring leaderboard calculation time.
- `quiz_completions_total`: Counter tracking completed quizzes.

### 4. Database Telemetry

- `db_latency_seconds`: Histogram measuring Prisma query execution time.
- `db_slow_queries_total`: Counter tracking queries exceeding 100ms.
- `db_connections_active`: Gauge tracking active DB pool connections.
- `db_transactions_total`: Counter tracking transactions executed.

### 5. Node.js Telemetry

- `nodejs_process_cpu_seconds_total`: CPU usage counter.
- `nodejs_process_resident_memory_bytes`: RSS memory footprint.
- `nodejs_process_heap_bytes`: Heap memory usage.
- `nodejs_eventloop_lag_seconds`: Event loop lag duration.
- `nodejs_process_uptime_seconds`: Process uptime.
