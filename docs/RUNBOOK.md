# 📖 SRE Operational Runbook & Troubleshooting Playbook

Step-by-step diagnostic and remediation playbooks for common production incidents.

---

## 🚒 Incident Playbook 1: High CPU Usage (>80%)

### Symptoms

- `HighCPUUsage` alert firing.
- CPU gauge on `/admin/operations` exceeds 80%.

### Diagnostics & Remediation

1. **Identify Worker**: Check CPU panel on `infrastructure.json` dashboard.
2. **Inspect Event Loop**: Check if event loop lag exceeds 100ms.
3. **Scale Horizontally**: Execute `railway scale --quantity 2` to add a secondary application container instance.

---

## 🚒 Incident Playbook 2: Socket Disconnect Spike

### Symptoms

- `SocketDisconnectSpike` alert firing.
- `active_sockets` drops rapidly.

### Diagnostics & Remediation

1. **Inspect Transport**: Check `socket-io.json` panel to see if WebSockets or Polling drops.
2. **Check Railway Network**: Verify network egress limits on Railway Dashboard.
3. **Check Client Reconnects**: Verify `socket_reconnects_total` metric is increasing (proves client auto-reconnect logic is firing).

---

## 🚒 Incident Playbook 3: High Database Query Latency (>500ms)

### Symptoms

- `HighDatabaseLatency` alert firing.
- `db_slow_queries_total` counter incrementing.

### Diagnostics & Remediation

1. **Inspect Slow Query Logs**: View backend logs filtered by `[Prisma Slow Query]`.
2. **Check Connection Pool**: Check `db_connections_active` on `database.json`.
3. **Add Database Index**: Check if missing index on `PlayerAnswer(sessionId, questionId)` or `RoomSession(pin)`.
