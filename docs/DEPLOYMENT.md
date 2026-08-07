# 🚀 Deployment Guide & Rollback Procedures

This document provides instructions for automated Railway deployment, manual deployment overrides, and emergency rollback procedures.

---

## 🤖 Automated Railway Deployment

Every push to `main` automatically triggers deployment when all CI quality, coverage (≥80%), and build checks pass.

### Required GitHub Repository Secrets

1. `RAILWAY_TOKEN`: Deployment API token generated in Railway Project Settings.
2. `PROJECT_ID`: Railway Project ID.
3. `SERVICE_ID`: Railway Backend Service ID.

---

## 🛠 Manual Deployment Override (Railway CLI)

If manual deployment is required:

```bash
# 1. Login to Railway
npx @railway/cli login

# 2. Link Project
npx @railway/cli link

# 3. Trigger Deployment
npx @railway/cli up --service backend --environment production
```

---

## ⏪ Emergency Rollback Procedure

If a post-deployment smoke test fails or a critical runtime incident occurs:

1. **Railway One-Click Rollback**:
   - Open [Railway Dashboard](https://railway.app).
   - Navigate to **Deployments** tab.
   - Select the previous stable deployment build and click **Rollback to this deployment**.

2. **Git Revert Rollback**:
   ```bash
   git revert HEAD
   git push origin main
   ```
   This triggers the automated pipeline to build and deploy the last stable commit.
