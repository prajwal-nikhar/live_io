# 📈 Capacity Planning & Infrastructure Estimation Guide

This document provides capacity models, resource predictions, and scaling guidance for the Real-Time Quiz Platform across player scales from **100** to **10,000** concurrent active users.

---

## 📊 Scale Resource Predictions Matrix

| Concurrent Players | CPU Cores  | Memory (RAM) | Active Sockets | DB Connection Pool | Bandwidth (Egress) |        Recommended Railway Tier        |
| :----------------: | :--------: | :----------: | :------------: | :----------------: | :----------------: | :------------------------------------: |
|      **100**       |  0.5 Core  |    256 MB    |      100       |         10         |     ~1.5 Mbps      |          Starter Tier ($5/mo)          |
|      **500**       |  1.0 Core  |    512 MB    |      500       |         20         |     ~7.5 Mbps      |        Developer Tier ($10/mo)         |
|     **1,000**      | 2.0 Cores  |    1.0 GB    |     1,000      |         35         |     ~15.0 Mbps     |         Standard Tier ($20/mo)         |
|     **5,000**      | 8.0 Cores  |    4.0 GB    |     5,000      |         75         |     ~75.0 Mbps     |     Cluster (2x Instances + Redis)     |
|     **10,000**     | 16.0 Cores |    8.0 GB    |     10,000     |        150         |    ~150.0 Mbps     | Cluster (4x Instances + Redis Cluster) |

---

## ⚡ Bottleneck Analysis & Scaling Triggers

1. **CPU Bound (WebSocket Serialization)**:
   - _Scaling Trigger_: CPU utilization exceeds 75% for 3 consecutive minutes.
   - _Remediation_: Horizontal scaling with Railway replica containers and Redis Socket.IO adapter.

2. **Memory Bound (In-Memory Room State)**:
   - _Scaling Trigger_: Heap usage exceeds 800 MB per Node.js worker instance.
   - _Remediation_: Enable Redis adapter room state partitioning and reduce lobby update broadcast payloads.

3. **Database Connection Pool**:
   - _Scaling Trigger_: Connection pool queue wait time exceeds 50ms.
   - _Remediation_: Increase `connection_limit` in `DATABASE_URL` (up to PostgreSQL max_connections limit) and use PgBouncer.
