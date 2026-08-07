# 💻 Local Development & Testing Guide

This document covers local workspace setup, running development servers, executing test suites, and database migrations.

---

## 🛠 Local Setup Instructions

```bash
# 1. Clone Repository
git clone https://github.com/prajwal-nikhar/live_io.git
cd live_io

# 2. Install Root & Service Dependencies
npm install
cd backend && npm install
cd ../frontend && npm install --legacy-peer-deps
cd ..

# 3. Configure Environment Variables
cp .env.example backend/.env

# 4. Generate Prisma Client & Apply Database Migrations
npm run prisma:generate
```

---

## 🏃 Running Development Servers

```bash
# Start NestJS Backend (Port 4000)
cd backend
npm run start:dev

# Start Next.js Frontend (Port 3000)
cd frontend
npm run dev
```

---

## 🧪 Running Automated Tests

```bash
# Run Backend Unit & Integration Tests
npm test

# Run Unit Tests with Coverage (≥80% Check)
npm run test:coverage

# Run Post-Deployment Smoke Tests Locally
npm run smoke-test
```
