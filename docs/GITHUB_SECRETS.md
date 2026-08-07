# 🔒 GitHub Repository Secrets Reference

Reference guide for configuring GitHub Actions repository secrets required for automated testing, security scanning, and Railway deployment.

---

## 🔑 Required Repository Secrets

Set these in GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name     | Description                        | Example / Source                              |
| :-------------- | :--------------------------------- | :-------------------------------------------- |
| `RAILWAY_TOKEN` | Railway Account API Token          | Railway Project -> Account Settings -> Tokens |
| `PROJECT_ID`    | Railway Project Identifier         | Railway Project -> Settings -> Project ID     |
| `SERVICE_ID`    | Railway Backend Service Identifier | Railway Service -> Settings -> Service ID     |

---

## 🛡️ Secret Security Guidelines

1. **No Secrets in Code**: Never commit plain-text tokens or API keys into git files.
2. **Scanned by Trufflehog**: Every commit push is scanned by Trufflehog in CI.
3. **Environment Isolation**: Maintain separate Railway tokens for Staging and Production environments.
