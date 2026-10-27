# CloudConnect: Cloud Contact Center Implementation Platform

[![CI Pipeline](https://github.com/portfolio/cloudconnect/actions/workflows/ci.yml/badge.svg)](https://github.com/portfolio/cloudconnect/actions)
![Python](https://img.shields.io/badge/Python-3.10-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

CloudConnect is a full-stack Cloud Contact Center Implementation Platform engineered for demonstrating senior-level full-stack engineering, cloud architecture, automated QA, and contact-center concepts suitable for an entry-level **Custom Software Engineering Associate** role.

Unlike simple mockups or static prototypes, CloudConnect features a fully functional backend API, persistent database migrations, deterministic contact routing, live WebSocket broadcasts, SLA breach calculations, workforce state machines, and a deterministic local simulator.

---

## 1. System Architecture

```
                                  +------------------------------------+
                                  |      React 18 + Vite Frontend      |
                                  |   (TypeScript, Tailwind, Recharts) |
                                  +-----------------+------------------+
                                                    |
                                       HTTPS REST   |  WebSocket Push
                                       & JSON API   |  (/api/v1/ws)
                                                    v
                                  +-----------------+------------------+
                                  |     FastAPI Backend Gateway        |
                                  |   - JWT Auth & RBAC Authorization  |
                                  |   - Correlation ID Tracing         |
                                  |   - Deterministic Routing Engine   |
                                  |   - Automated SLA Breach Evaluator |
                                  +--------+------------------+--------+
                                           |                  |
                          SQLAlchemy Async |                  | Provider Adapter
                                           v                  v
                 +-------------------------+---+      +-------+--------------------+
                 | PostgreSQL Database         |      | Contact Center Provider    |
                 | - Agents, Queues & Skills   |      | - SimulatorProvider (Dev)  |
                 | - Contacts & Interactions   |      | - AmazonConnectAdapter(AWS)|
                 | - Cases & SLA Policies      |      +----------------------------+
                 | - Immutable Audit Trail     |
                 +-----------------------------+
```

---

## 2. Key Features

- **RBAC Authentication & Access Control:** Seeded demo credentials for **Admin**, **Supervisor**, and **Agent** roles with backend-enforced route permissions and Bcrypt password hashing.
- **Supervisor Operational Dashboard:** Real-time KPI summary (active agents, waiting contacts, open cases, average wait duration, and SLA breaches) powered by database aggregations and Recharts visual metrics.
- **Workforce Management:** Agent directory with skill assignments, queue subscriptions, and an enforced presence state machine (`available`, `busy`, `away`, `offline`).
- **Deterministic Contact Routing Engine:** Automated contact distribution based on required agent skills, minimum proficiency levels, current workload concurrency limits, and priority weights, backed by step-by-step decision audit logs.
- **Queue Overflow Handling:** Automated rerouting to secondary backup queues when wait times exceed thresholds or agent concurrency is exhausted.
- **Contact & Interaction Lifecycle:** Comprehensive interaction timeline with channel support (Voice/Chat), customer phone masking for privacy, transcript inspection, and live WebSocket status updates.
- **Case Management & Deterministic SLA Engine:** Support incident workflows with dynamic response and resolution deadline calculations, breach flags, and escalation notes.
- **Zero-AWS Local Simulation Sandbox:** Built-in deterministic `SimulatorProvider` allowing comprehensive testing of routing scenarios and contact lifecycles without AWS charges or PSTN telecom dependencies.
- **Idempotent Webhook Processing:** Atomic event ingestion with database-level deduplication keys to prevent duplicate records during network retries or replay events.
- **Production Observability:** Structured JSON logging, unique request correlation IDs (`X-Request-ID`), health check endpoints (`/health/live`, `/health/ready`), and an immutable administrative audit log.

---

## 3. Seeded Demo Accounts (Local Development)

All demo accounts are pre-seeded in the local database:

| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@cloudconnect.dev` | `AdminPass123!` | Full administrative access, queues, rules, audit logs |
| **Supervisor** | `supervisor@cloudconnect.dev` | `SupervisorPass123!` | Dashboard metrics, workforce supervision, routing rules |
| **Agent 1** | `agent1@cloudconnect.dev` | `AgentPass123!` | Presence status controls, assigned contacts, cases |
| **Agent 2** | `agent2@cloudconnect.dev` | `AgentPass123!` | Presence status controls, assigned contacts, cases |
| **Agent 3** | `agent3@cloudconnect.dev` | `AgentPass123!` | Presence status controls, assigned contacts, cases |

*Quick-Fill demo buttons are provided on the login page for one-click testing.*

---

## 4. Quickstart Guide

### Option A: Run with Docker Compose (Recommended)

Start all services (React frontend, FastAPI backend, PostgreSQL database) with a single command:

```bash
docker compose up --build
```

Access the services:
- **Web Interface:** [http://localhost:3000](http://localhost:3000)
- **FastAPI API & Health:** [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

To stop and remove containers:
```bash
docker compose down -v
```

---

### Option B: Local Non-Docker Development

#### Prerequisites:
- Python 3.10+
- Node.js 20+

#### 1. Backend Setup:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.db.init_db
python -m app.db.seed_data
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Automated Testing & Verification

Both backend and frontend test suites are fully automated and verified:

### Run Backend Tests (Pytest):
```bash
cd backend
pytest -v
```
**Verified Results:**
- `test_agents.py`: Agent listing, valid state transitions, invalid transition rejections, cross-agent update authorization guards (**4 passed**).
- `test_auth.py`: Login success, invalid credentials, profile verification, RBAC permissions (**5 passed**).
- `test_cases_sla.py`: Case creation, SLA target initialization, escalation notes, breach calculations (**3 passed**).
- `test_idempotency.py`: Webhook event deduplication, provider health status (**2 passed**).
- `test_routing.py`: Deterministic skill matching, no-agent fallback, queue overflow trigger (**3 passed**).
- **Total: 17 passed in ~1.1s.**

### Run Frontend Tests (Vitest + React Testing Library):
```bash
cd frontend
npm test
```
**Verified Results:**
- `StatusBadge.test.tsx`: Presence badges, priority levels, channels (**5 passed**).
- `Login.test.tsx`: Form rendering, demo quick-fill, submission authentication (**4 passed**).
- `RoutingWorkflow.test.tsx`: Simulation console, rules table, deterministic routing dispatch (**3 passed**).
- **Total: 12 passed in ~5.9s.**

### Verify Production Frontend Build:
```bash
cd frontend
npm run build
```
**Verified Results:** TypeScript compilation (`tsc`) and Vite bundling completed with exit code 0.

---

## 6. Engineering Documentation

Detailed engineering specifications and architecture guides are available in the `docs/` directory:

- [Architecture Blueprint (`docs/architecture.md`)](docs/architecture.md) - System topology, component interactions, and routing decision flowchart.
- [Database Schema & ERD (`docs/database.md`)](docs/database.md) - Relational schema, foreign keys, indexes, and Alembic migrations.
- [REST & WebSocket API (`docs/api.md`)](docs/api.md) - Endpoints, request/response models, and status codes.
- [Amazon Connect Integration (`docs/amazon-connect-setup.md`)](docs/amazon-connect-setup.md) - AWS Boto3 adapter, CTR event mapping, and IAM least-privilege policies.
- [Deployment & Cloud Guide (`docs/deployment.md`)](docs/deployment.md) - Docker Compose, AWS ECS/Fargate + RDS + CloudFront deployment, and cost estimation.
- [Security Architecture (`docs/security.md`)](docs/security.md) - Threat modeling, RBAC matrix, token security, and audit logging.

---

## 7. Technical Limitations & Evaluation Context

1. **Simulated Telephony Audio:** CloudConnect simulates telephony signaling and contact routing deterministically. It does not place live telephone calls to the public telephone network (PSTN) unless paired with an authorized Amazon Connect instance.
2. **Third-Party Security Audit:** While following OWASP secure coding practices and defense-in-depth principles, this application has not undergone a formal third-party SOC2 or ISO 27001 audit.
3. **Distributed Caching:** Real-time updates utilize an in-memory topic broadcaster; production multi-node deployments should connect to a Redis pub/sub layer.
