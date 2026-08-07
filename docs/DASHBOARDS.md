# 🖥️ Grafana Dashboards Documentation

Guide to importing and utilizing the 5 production Grafana dashboards.

---

## 📂 Dashboard Files & Features

1. **`application-overview.json`**:
   - High-level system overview.
   - Panels: API throughput, error rate %, p95 latency, node process uptime.

2. **`quiz-operations.json`**:
   - Real-time quiz operations telemetry.
   - Panels: Active quizzes, rooms, connected players, answer submission rate, p99 broadcast latency.

3. **`socket-io.json`**:
   - WebSocket connection and event diagnostics.
   - Panels: Active sockets, disconnect/reconnect rates, event throughput breakdown, failed join attempts.

4. **`database.json`**:
   - Prisma ORM and PostgreSQL pool performance.
   - Panels: p95/p99 query latency, slow queries count, active pool connections, transactions/sec.

5. **`infrastructure.json`**:
   - Hardware resource utilization.
   - Panels: CPU usage %, Heap & RSS memory bytes, event loop lag, open file descriptors.

---

## 📥 How to Import Dashboards in Grafana

1. Open Grafana UI -> **Dashboards** -> **Import**.
2. Upload JSON file from `grafana/dashboards/<name>.json`.
3. Select **Prometheus** as data source and click **Import**.
