# 🚨 Incident Response & Escalation Workflow

Standard operating procedures for managing production incidents.

---

## 🔄 Incident Lifecycle Phases

```mermaid
flowchart LR
    Detect[1. Detection & Alert] --> Triage[2. Triage & Severity Assignment]
    Triage --> Mitigate[3. Mitigation & Rollback]
    Mitigate --> Resolve[4. Resolution & Verification]
    Resolve --> PostMortem[5. Post-Mortem & Action Items]
```

---

## 👥 Escalation Roles

1. **Incident Commander (IC)**: Leads triage, delegates actions, and makes rollback decisions.
2. **Operations Lead**: Executes infrastructure, database, or Railway scaling commands.
3. **Communications Lead**: Updates status page and notifies stakeholders.

---

## 📝 Post-Mortem Requirements

Every P1/P2 incident requires a completed [INCIDENT_TEMPLATE.md](docs/INCIDENT_TEMPLATE.md) within 48 hours.
