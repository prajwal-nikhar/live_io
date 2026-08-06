# AuraQuiz: Enterprise Live Quiz & Event Engagement Platform

AuraQuiz is a production-grade, enterprise-quality real-time event engagement platform (Kahoot alternative) designed to support **10,000+ concurrent players** across multiple rooms with **sub-200ms real-time latency**, resilient connections, and a gorgeous glassmorphic UX.

---

## 🌟 Primary Features

### 👑 Host Dashboard
* **Dynamic Quiz Authoring**: Design custom quizzes manually, duplicate with single-clicks, and schedule events.
* **AI Quiz Generator**: Simply input any academic or engineering topic and dynamically generate high-fidelity trivia instantly.
* **Spreadsheet & PDF Import**: Bulk upload questions from CSV spreadsheets, DOCX, or PDF syllabus documents.
* **Game Session Control**: Launch lobbies, trigger synchronized timers, reveal answer response curves, review active leaderboards, and launch winner celebrations.

### 🎮 Participant Engagement
* **Seamless Join**: Join with a 6-digit PIN and choose a nickname in seconds—no registration required.
* **Interactive Play**: Highly optimized, accessible layout cards (Cards A, B, C, D) corresponding instantly to question states.
* **Instant Feedback**: Real-time points allocation, hot-streak bonuses, and correct answer breakdowns.
* **Live Chat & Reactions**: Send real-time messages and trigger floating emoji reactions to share excitement!

### 🔒 Enterprise Resilience & Security
* **Sub-200ms Synced Timer**: Distributed countdown tickers managed using Redis or local high-speed state loops.
* **Disconnect Grace Period**: Players can experience internet drops, refresh their browser, or switch tabs, and automatically reconnect to the session without losing their score or streak.
* **Anti-Cheat Boundaries**: Question answers are completely excluded from participant packets until the official host-side reveal triggers.
* **Clean Architecture**: Built using NestJS (SOLID dependency injection, modular controllers, and global database connectors) and Next.js 15 (App Router, Framer Motion, and global responsive layouts).

---

## 🏗️ Clean Enterprise Architecture

```
/home/user/
├── backend/                  # NestJS TypeScript Core Services
│   ├── src/
│   │   ├── main.ts           # Global bootstrap, security limits, & CORS configs
│   │   ├── app.module.ts     # Main Orchestrator module
│   │   └── modules/
│   │       ├── auth/         # Secure JWT auth, Google simulator, & RBAC guards
│   │       ├── quiz/         # Quiz & question bank management (with AI Gen)
│   │       ├── room/         # Live state machine, timer tickers, & Socket.IO
│   │       └── analytics/    # Host analytics and CSV/Excel reports exports
│   └── prisma/
│       ├── schema.prisma     # SQLite (Dev) / PostgreSQL (Prod) database schema
│       └── seed.ts           # Demo host, admin, and quiz templates seed script
│
├── frontend/                 # Next.js 15 (App Router) Premium UI
│   ├── src/
│   │   ├── app/              # Home landing, auth, host, and player workspaces
│   │   ├── lib/              # API clients & Socket connection pools
│   │   └── components/       # Tailwind responsive cards & animations
│   └── public/
│       └── manifest.json     # PWA descriptor configuration
│
├── kubernetes/               # Enterprise Deployment Manifests (HPAs, Services)
├── docker-compose.yml        # Multi-container orchestration (DB, Cache, App)
└── README.md                 # Product documentation and setup guides
```

---

## ⚡ Quick Start (Local Development)

### 1. Database & Schema Initialization
We utilize Prisma with local SQLite by default in development to ensure seamless startup without postgres dependencies:
```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
```
This generates the Prisma types, configures `dev.db`, and registers our standard credentials:
* **Host**: `host@quiz.com` | `password123`
* **Admin**: `admin@quiz.com` | `password123`

### 2. Start the Backend API & Socket Server
```bash
npm run start
```
The server will boot on `http://localhost:4000`.

### 3. Start the Frontend Next.js Client
```bash
cd ../frontend
npm install --legacy-peer-deps
npm run dev
```
The client website will load on `http://localhost:3000`.

---

## 🐳 Docker Multi-Container Launch

To spin up a fully optimized production setup containing a Postgres SQL database, Redis in-memory cache, compiled NestJS API server, and Next.js container, execute:
```bash
docker-compose up --build -d
```
All schema migrations, health checks, and database dependencies are handled automatically.

---

## ☸️ Kubernetes Scalability & HPAs

For enterprise cloud environments (EKS, GKE, AKS), we supply a robust k8s deployment stack under the `kubernetes/` folder:
* **Ingress Single Domain mapping** routes `/` to Next.js, and `/api` / `/socket.io` to NestJS.
* **Horizontal Pod Autoscaling (HPA)** automatically scales our backend containers from 3 to 15 replicas based on CPU/Memory load to easily accommodate **10,000+ simultaneous players**.

Deploy to your cluster:
```bash
kubectl apply -f kubernetes/
```
Verify pods:
```bash
kubectl get pods -w
```
