# 📜 Log Retention & Archival Strategy

Policy and storage guidelines for application and infrastructure logs.

---

## 🕒 Retention Schedule

| Log Type                        |  Active Search Storage   |       Cold Archive Storage        | Total Retention |
| :------------------------------ | :----------------------: | :-------------------------------: | :-------------: |
| **Application Info/Debug Logs** | 14 Days (Datadog / Loki) |        30 Days (S3 / GCS)         |     44 Days     |
| **Error & Exception Logs**      | 90 Days (Sentry / Loki)  |           365 Days (S3)           |     1 Year      |
| **Security & Auth Audit Logs**  |         180 Days         |              7 Years              |     7 Years     |
| **Metrics & Telemetry**         |   30 Days (Prometheus)   | 1 Year (Thanos / VictoriaMetrics) |     1 Year      |
