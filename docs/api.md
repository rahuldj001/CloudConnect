# CloudConnect REST & WebSocket API Specification

All REST API endpoints are versioned under `/api/v1`. The application generates an interactive OpenAPI documentation portal available at `http://localhost:8000/docs` (Swagger UI) and `http://localhost:8000/redoc`.

---

## 1. Global Conventions

### 1.1 Authentication & Headers
Protected endpoints require an HTTP Bearer JWT token in the `Authorization` header:
```http
Authorization: Bearer <access_token>
```

### 1.2 Observability & Tracing
Every request and response carries a unique trace UUID:
```http
X-Request-ID: 7a93e871-3312-4c60-b851-92b4260a9f5d
X-Process-Time-Seconds: 0.00312
```

### 1.3 Error Response Schema
All errors adhere to a standardized JSON schema:
```json
{
  "detail": "Descriptive error explanation",
  "error_code": "INVALID_STATUS_TRANSITION",
  "request_id": "7a93e871-3312-4c60-b851-92b4260a9f5d"
}
```

---

## 2. Authentication API (`/api/v1/auth`)

### 2.1 Login & Obtain JWT Token
- **POST** `/api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "admin@cloudconnect.dev",
    "password": "AdminPass123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in_minutes": 480,
    "user": {
      "id": 1,
      "email": "admin@cloudconnect.dev",
      "full_name": "Alex Mercer (Admin)",
      "role": "admin",
      "is_active": true
    }
  }
  ```

### 2.2 Current User Profile
- **GET** `/api/v1/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** User object.

---

## 3. Agent Workforce API (`/api/v1/agents`)

### 3.1 List Agents
- **GET** `/api/v1/agents`
- **Query Params:** `status` (optional), `channel` (optional)
- **Response (200 OK):** Array of agent profiles with assigned skills, queues, and active contact load.

### 3.2 Update Agent Presence Status
- **PUT** `/api/v1/agents/{id}/status`
- **Permissions:** Admin, Supervisor, or Self (Agent updating own profile)
- **Request Body:**
  ```json
  {
    "status": "available"
  }
  ```
- **Enforced State Machine:**
  - `offline` -> `available`, `away`
  - `available` -> `busy`, `away`, `offline`
  - `busy` -> `available`, `away`, `wrap_up`
  - `away` -> `available`, `offline`
- **Response (200 OK):** Updated agent profile.
- **Errors:** 400 Bad Request on invalid transition.

### 3.3 Assign Agent Skills
- **PUT** `/api/v1/agents/{id}/skills`
- **Permissions:** Admin, Supervisor
- **Request Body:**
  ```json
  {
    "skills": [
      { "skill_id": 1, "proficiency_level": 4 },
      { "skill_id": 2, "proficiency_level": 5 }
    ]
  }
  ```

---

## 4. Contact Queues API (`/api/v1/queues`)

### 4.1 List Contact Queues
- **GET** `/api/v1/queues`
- **Response (200 OK):** Array of queues with waiting contact count and subscribed agent count.

### 4.2 Create Contact Queue
- **POST** `/api/v1/queues`
- **Permissions:** Admin, Supervisor
- **Request Body:**
  ```json
  {
    "name": "VIP Accounts Voice",
    "channel": "voice",
    "priority": 80,
    "max_wait_time_seconds": 120,
    "overflow_queue_id": 1
  }
  ```

---

## 5. Contact Routing & Simulator API (`/api/v1/routing`)

### 5.1 Simulate Inbound Contact (Deterministic Routing Sandbox)
- **POST** `/api/v1/routing/simulate`
- **Request Body:**
  ```json
  {
    "customer_name": "Jordan Lee",
    "customer_phone": "+1-555-0199",
    "channel": "voice",
    "queue_id": 2,
    "priority": 75,
    "required_skills": ["tier_2"],
    "initial_message": "Experiencing VPC configuration failure."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "contact_id": 105,
    "provider_contact_id": "sim-contact-c4b92",
    "status": "connected",
    "channel": "voice",
    "queue_id": 2,
    "assigned_agent_id": 2,
    "routing_decision": {
      "decision": "ROUTED",
      "selected_agent_name": "Sarah Chen",
      "reasons": [
        "Matched queue Tier 2 Technical Support",
        "Required skill tier_2 verified at Level 4 (threshold=3)",
        "Agent Sarah Chen selected based on lowest concurrent load (0/2)"
      ],
      "queue_id": 2,
      "eligible_agents_count": 2,
      "overflow_triggered": false,
      "routed_at": "2026-10-28T00:00:00Z"
    },
    "is_simulated": true
  }
  ```

---

## 6. Cases & SLA Management API (`/api/v1/cases`, `/api/v1/sla`)

### 6.1 List Support Cases
- **GET** `/api/v1/cases`
- **Query Params:** `case_status`, `priority`, `assigned_to`, `search`, `page`, `page_size`

### 6.2 Create Case
- **POST** `/api/v1/cases`
- **Request Body:**
  ```json
  {
    "title": "Database connection timeout during peak hours",
    "description": "Customer reporting elevated 504 errors on production RDS.",
    "customer_identifier": "CUST-9921",
    "priority": "critical"
  }
  ```
- **Response (201 Created):** Case record populated with computed `response_deadline` and `resolution_deadline`.

### 6.3 SLA Breach Summary
- **GET** `/api/v1/sla/breaches`
- **Response (200 OK):** Real-time calculated response breaches, resolution breaches, and approaching deadline alerts.

---

## 7. Webhook Idempotency API (`/api/v1/integrations`)

### 7.1 Ingest External Provider Webhook
- **POST** `/api/v1/integrations/events`
- **Request Body:**
  ```json
  {
    "event_key": "ctr-aws-91823-uuid",
    "event_type": "CTR_COMPLETED",
    "payload": {
      "ContactId": "ctr-aws-91823-uuid",
      "Channel": "VOICE",
      "Duration": 182
    }
  }
  ```
- **First Submission (200 OK):** `{"status": "PROCESSED", "idempotency_key": "ctr-aws-91823-uuid"}`
- **Duplicate Submission (200 OK):** `{"status": "DUPLICATE_IGNORED", "idempotency_key": "ctr-aws-91823-uuid"}`

---

## 8. Real-Time WebSockets (`/api/v1/ws`)

### 8.1 Connect to Live Event Stream
- **URL:** `ws://localhost:8000/api/v1/ws`
- **Broadcast Events:**
  - `AGENT_STATUS_CHANGED`: Emitted when an agent toggles presence state.
  - `CONTACT_ROUTED`: Emitted when the routing engine assigns a contact.
  - `CASE_CREATED` / `CASE_ESCALATED`: Emitted on case lifecycle modifications.
  - `SLA_BREACH_ALERT`: Emitted when a case SLA deadline elapses.
