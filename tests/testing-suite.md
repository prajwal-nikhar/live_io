# Enterprise Quiz Platform: Testing Matrix & QA Documentation

This document defines the complete testing suite and QA architecture for our Production-Ready Real-Time Quiz Platform.

---

## 1. Unit Tests

Unit testing focuses on isolated functions, helper libraries, and stateless service logic.

### Key Targets:

- **Scoring & Decay Algorithm**: Validating that base points decrease properly according to response time, and streak bonuses are correctly accumulated up to the limit of 5 consecutive questions.
- **Password Encryption Services**: Ensuring that `bcryptjs` correctly hashes password values and invalid checks are appropriately caught.
- **Cache Mocks**: Testing that the `CacheService` handles in-memory and Redis adapters interchangeably.

---

## 2. Integration Tests

Integration testing verifies boundaries, controllers, gateways, and relational database joins.

### Key Targets:

- **Auth Flow Controllers**: Checking that registrations write to the DB, create JWT tokens, and that the `RolesGuard` rejects unauthorized profile lookups.
- **Quiz CRUD & AI Generation**: Testing that generating quizzes with AI mock endpoints inserts the resulting question arrays correctly into SQLite/Postgres.
- **State Transitions**: Simulating host-side room status shifts (`LOBBY` ➔ `PLAYING` ➔ `REVEAL_ANSWER` ➔ `LEADERBOARD` ➔ `FINISHED`) and verifying DB state persistence.

---

## 3. Real-Time Socket Tests

Verify reliable WebSocket frames, room segmentation, and sequence counts.

### Key Targets:

- **Lobby Broadcasts**: When Player A joins, verify that a `lobby_update` payload containing Player A's name is broadcast only to other clients in `room:123456`.
- **Anti-Cheat Payload Verification**: Ensuring that correct answer flags (`isCorrect: true`) are omitted from `question_start` events broadcast to participants, but included in host-specific payloads.
- **Disconnection & Reconnection States**: Simulating packet drops and verifying that players can reconnect to the same session with their historical scores and streaks intact.

---

## 4. Race Condition & Concurrency Tests

Ensure safety during high-frequency write stress.

### Key Targets:

- **Double-Submit Prevention**: Validating that consecutive `submit_answer` requests from the same player ID within 1ms result in a safe warning rejection rather than duplicate records.
- **Simultaneous Responders**: Spinning up 100+ concurrent players (tested in `tests/load-test.ts`) that trigger requests within 50ms of each other, ensuring that database connections do not bottleneck and latency remains **under 200ms**.

---

## 5. Performance, Load & Stress Testing

Validate infrastructure stability under peak traffic.

### Key Targets:

- **10,000 Concurrent User Simulation**: Scaling up Kubernetes replica counts to evaluate CPU scaling, memory leaks, and socket limits on individual gateways.
- **Redis Connection Drops**: Simulating Redis crashes and proving that the backend recovers instantly without dropping client sockets or crashing servers by falling back to in-memory buffers.
