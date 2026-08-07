# 🔔 Alerting Rules & Escalation Matrix

Documentation of alert rules configured in `grafana/alerts/alert-rules.yml`.

---

## 🚨 Alert Severity Matrix

|     Severity      |    Response SLA     |         Notification Channel         | Example Alert Rules                                                                                          |
| :---------------: | :-----------------: | :----------------------------------: | :----------------------------------------------------------------------------------------------------------- |
| **Critical (P1)** | Immediate (< 5 min) | PagerDuty + Slack `#alerts-critical` | `APIUnavailable`, `DatabaseUnavailable`, `SocketGatewayDown`, `DeploymentFailure`                            |
|   **High (P2)**   |      < 15 min       |         Slack `#alerts-high`         | `HighCPUUsage` (>80%), `HighMemoryUsage` (>80%), `HighEventLoopLag` (>100ms), `HighDatabaseLatency` (>500ms) |
|  **Medium (P3)**  |      < 4 hours      |        Slack `#alerts-medium`        | `PlayerJoinFailuresSpike`, `SocketDisconnectSpike`, `FailedLoginsSpike`, `SlowHTTPResponses`                 |
|   **Low (P4)**    |  Next Business Day  |     Email Digest / Daily Summary     | `BuildFailureOrWarningLogs`                                                                                  |

---

## 🛠 Notification Routing Configuration

Alerts are routed via Alertmanager to Slack Webhooks and PagerDuty Integration Keys set via environment variables:

- `PAGERDUTY_SERVICE_KEY`
- `SLACK_ALERT_WEBHOOK_URL`
