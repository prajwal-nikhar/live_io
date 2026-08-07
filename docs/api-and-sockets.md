# Enterprise Quiz Platform: API & Socket Protocol Documentation

This document serves as the formal specification for developers, QA engineers, and operations teams integrating with the Real-Time Quiz Platform.

---

## 1. REST API Specification

All HTTP endpoints are prefixed with `/api` (or matching backend service routing).

### Authentication Module

#### `POST /auth/register`

Creates a new user profile on the platform (Default role is `HOST`).

- **Request Body:**

```json
{
  "email": "professor@university.edu",
  "password": "secure_password_1029",
  "name": "Professor Alex",
  "role": "HOST"
}
```

- **Success Response (201 Created):**

```json
{
  "user": {
    "id": "e4a7a8d0-c3d5-494b-9cf9-797cfce0bf2d",
    "email": "professor@university.edu",
    "name": "Professor Alex",
    "role": "HOST"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `POST /auth/login`

Authenticates a registered host or administrator.

- **Request Body:**

```json
{
  "email": "host@quiz.com",
  "password": "password123"
}
```

- **Success Response (200 OK):** Standard JWT tokens payload.

#### `POST /auth/google`

Authenticates or registers a user via verified Google OAuth.

- **Request Body:**

```json
{
  "token": "oauth-google-token-credential-string",
  "email": "user@gmail.com",
  "name": "Jane Doe"
}
```

---

### Quizzes & Question Bank Module

#### `POST /quizzes`

Creates a new quiz template with questions and option sets. (Requires `HOST` or `ADMIN` roles).

- **Headers:** `Authorization: Bearer <accessToken>`
- **Request Body:**

```json
{
  "title": "React 19 Core Concepts",
  "description": "Evaluate understanding of Actions, useActionState, and Server Components.",
  "isPublic": true,
  "negativeMarking": false,
  "pointsMultiplier": 1.0,
  "questions": [
    {
      "text": "Which React hook is used to access form action status easily?",
      "type": "MULTIPLE_CHOICE",
      "points": 100,
      "timeLimit": 20,
      "explanation": "useFormStatus helps nested fields access parent form pending states.",
      "options": [
        { "text": "useFormStatus", "isCorrect": true },
        { "text": "useActionState", "isCorrect": false },
        { "text": "useState", "isCorrect": false }
      ]
    }
  ]
}
```

#### `POST /quizzes/ai-generate`

Generates a quiz using natural language topics.

- **Request Body:**

```json
{
  "topic": "Kubernetes Pod Lifecycle",
  "numQuestions": 5
}
```

---

## 2. Real-Time Socket.IO Protocol Specification

The real-time bidirectional gateway operates on the root socket connection port `4000` (or proxy endpoint).

### A. Host Events (Emitted by Host Clients)

#### `host_create_room`

Creates a live game lobby for a specific quiz template.

- **Payload:**

```json
{
  "quizId": "quiz-uuid-string",
  "hostId": "host-uuid-string"
}
```

- **Server Response (`room_created`):**

```json
{
  "pin": "540912",
  "sessionId": "session-uuid-string"
}
```

#### `host_start_game`

Launches the quiz, transitioning the room state from `LOBBY` into the first question countdown.

- **Payload:**

```json
{ "pin": "540912" }
```

#### `host_next_question`

Advances to the next phase (Show Leaderboard or transition to the next Question slide).

- **Payload:**

```json
{ "pin": "540912" }
```

---

### B. Participant Events (Emitted by Participant Clients)

#### `player_join`

Attempts to register a nickname into an active room PIN.

- **Payload:**

```json
{
  "pin": "540912",
  "name": "QuizMaster99"
}
```

- **Server Response (`join_success`):**

```json
{
  "player": {
    "id": "player-uuid",
    "name": "QuizMaster99",
    "score": 0,
    "streak": 0
  }
}
```

#### `submit_answer`

Sends a participant's option selection to the game engine.

- **Payload:**

```json
{
  "pin": "540912",
  "name": "QuizMaster99",
  "questionId": "question-uuid",
  "optionId": "selected-option-uuid"
}
```

- **Server Private Response (`answer_acknowledged`):**

```json
{
  "isCorrect": true,
  "pointsEarned": 140,
  "newScore": 140,
  "newStreak": 1
}
```
