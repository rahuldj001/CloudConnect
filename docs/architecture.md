# CloudConnect Architecture Blueprint

## 1. System Overview

CloudConnect is an enterprise-grade Cloud Contact Center Implementation Platform engineered to demonstrate custom software engineering, full-stack integration, real-time deterministic routing, service level agreement (SLA) enforcement, and cloud provider abstraction.

The architecture decouples the core contact center routing and agent management mechanics from third-party cloud telephony carrier systems through a formal provider abstraction interface (`ContactCenterProvider`). This allows complete, zero-cost deterministic simulation locally while enabling seamless integration with Amazon Connect in AWS production environments.

```
                              +-------------------------------------------+
                              |         Browser Client (React 18)         |
                              |  - Supervisor Dashboard (Recharts KPIs)   |
                              |  - Agent Presence & Interaction Manager   |
                              |  - Deterministic Routing Simulator        |
                              |  - Real-Time Push Events via WebSocket    |
                              +---------------------+---------------------+
                                                    |
                                                    | HTTPS REST / WSS
                                                    v
                              +-------------------------------------------+
                              |         FastAPI Application Server        |
                              |  - Request Context Middleware (RequestID) |
                              |  - JWT Authentication & RBAC Engine       |
                              |  - Deterministic Routing Decision Engine  |
                              |  - Automated Case & SLA Lifecycle Service |
                              |  - Structured Audit Event Logger          |
                              |  - Topic-Based WebSocket Broadcaster      |
                              +---------------------+---------------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                                                     |
                         v                                                     v
          +-------------------------------+                     +-------------------------------+
          |   PostgreSQL / SQLite Database|                     |   Contact Center Provider     |
          |  - Normalized Relation Schema |                     |  - Base ABC Interface         |
          |  - Foreign Key Constraints    |                     |  - SimulatorProvider (Local)  |
          |  - Indexed Lookups & Audits   |                     |  - AmazonConnectAdapter (AWS) |
          +-------------------------------+                     +-------------------------------+
```

---

## 2. Component Architecture

### 2.1 Backend Architecture (FastAPI & Python 3.10)
- **FastAPI Layer:** Implements RESTful API endpoints organized under `/api/v1` with Pydantic v2 validation, explicit status codes, OpenAPI schema generation, and asynchronous request handling.
- **Middleware Pipeline:**
  - `RequestContextMiddleware`: Generates and injects a unique UUID `X-Request-ID` into every HTTP request context and response header, recording latency metrics in microseconds.
  - `CORSMiddleware`: Restricts cross-origin interactions to configured enterprise origins.
- **Security & Authorization:**
  - Password hashing utilizing Passlib with Bcrypt.
  - Signed JWT access tokens carrying subject ID, user role (`admin`, `supervisor`, `agent`), and expiration timestamps.
  - Role-Based Access Control (RBAC) enforced via FastAPI dependency injection (`require_roles("admin", "supervisor")`).
- **Database Layer (SQLAlchemy 2 Async):**
  - Fully asynchronous database operations (`asyncpg` for PostgreSQL in production/Docker, `aiosqlite` for tests/local zero-dependency development).
  - Explicit database transactions, foreign key referential integrity, composite indexes, and Alembic database versioning.

### 2.2 Frontend Architecture (React 18 & TypeScript)
- **Vite & React 18:** Ultra-fast bundling, TypeScript type-safety, and modern concurrent mode.
- **TanStack Query v5:** Server-state caching, background revalidation, optimistic updates, and mutation invalidation.
- **Tailwind CSS & Vanilla Design System:** Glassmorphism dashboard aesthetic, dark-mode styling, glowing accents, and high visual appeal suitable for enterprise software demonstrations.
- **WebSockets:** Bi-directional real-time connection for instantaneous push updates when agents toggle availability, contacts enter queues, or routing decisions complete.

---

## 3. Contact Routing Engine

The routing engine implements deterministic, skill-based distribution with concurrency management and queue overflow mechanics.

```
                          Inbound Contact Created
                                     |
                                     v
                        Queue & Skill Requirement Match
                                     |
                                     v
                       Find Subscribed Agents in Queue
                                     |
                                     v
                  Filter Agents: current_status == "available"
                                     |
                                     v
            Filter Agents: active_contacts < max_concurrency
                                     |
                                     v
         Filter Agents: agent.skills >= rule.min_proficiency
                                     |
                    +----------------+----------------+
                    |                                 |
            [Agents Eligible]                [No Agents Eligible]
                    |                                 |
                    v                                 v
        Sort by:                              Check Queue Overflow:
        1. Max Skill Proficiency              Has overflow_queue_id?
        2. Lowest Active Concurrency                  |
        3. Longest Idle Since Transition      +-------+-------+
                    |                         |               |
                    v                        Yes              No
             Assign to Agent                  |               |
                    |                         v               v
            Update Concurrency          Reroute to     Queue Contact:
            Status -> "busy"          Overflow Queue   Status -> "queued"
                    |                         |               |
                    +-------------------------+---------------+
                                              |
                                              v
                              Audit Trail Record Persisted
```

### Routing Decision Algorithm:
1. **Queue Matching:** Identify the target queue or fallback to the channel default queue.
2. **Skill Prerequisite Check:** Evaluate required skill codes and minimum proficiency thresholds (e.g. Level 3+).
3. **Availability Filter:** Exclude agents who are `busy`, `away`, or `offline`.
4. **Concurrency Guard:** Ensure `active_contacts_count < max_concurrent_contacts`.
5. **Deterministic Tie-Breaking:**
   - Primary: Highest total proficiency score across required skills.
   - Secondary: Lowest current active workload.
   - Tertiary: Longest idle duration since the last status transition.
6. **Overflow Handling:** If no agent matches and queue wait time exceeds limits or no capacity exists, the contact automatically transitions to the designated `overflow_queue_id`.
7. **Audit Trail:** Every step (eligible candidates considered, skills inspected, load evaluated, final decision) is persisted to the database and broadcasted via WebSockets.

---

## 4. SLA Management & Compliance Engine

CloudConnect features a deterministic SLA computation engine:
- Upon case creation, the system looks up the configured `SLAPolicy` matching the case priority (`critical`, `high`, `medium`, `low`).
- Persists explicit target timestamps: `response_deadline` and `resolution_deadline`.
- Dynamic breach detection computes elapsed time in minutes without relying on client-side approximations.
- Cases approaching deadline thresholds (< 30 minutes) trigger warning badges in supervisor and monitoring views.

---

## 5. Webhook Idempotency & Fault Tolerance

To withstand repeated webhooks from third-party systems (such as AWS EventBridge or telephony carriers):
- Every inbound event requires a client-generated or provider-generated idempotency key (e.g. CTR ID or UUID).
- The `IntegrationEvent` table maintains a `unique` constraint on `event_key`.
- Ingestion executes inside an atomic database transaction. If the key already exists, the event payload is retrieved, status `DUPLICATE_IGNORED` is returned with HTTP 200, and no duplicate contacts or database mutations occur.
