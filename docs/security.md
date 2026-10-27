# CloudConnect Security Architecture & Threat Model

## 1. Security Principles

CloudConnect is engineered following defense-in-depth principles:
- **Least Privilege:** Users, microservices, and external integrations only have access to permissions strictly required for their role.
- **Fail-Safe Defaults:** Access control default is deny; endpoints require explicit authentication unless designated public (`/health/*`, `/api/v1/auth/login`).
- **Complete Mediation:** Authorization is verified on every backend request via FastAPI dependency injection, not client-side UI visibility.
- **Zero Secrets In Source Code:** Credentials, JWT secret keys, and database passwords are injected strictly via environment variables.

---

## 2. Authentication & Credential Security

### 2.1 Password Hashing
- Passwords are never stored in plaintext.
- Stored credentials utilize Passlib with Bcrypt (`12` work factor rounds) with unique cryptographic salts per user.

### 2.2 JWT Token Mechanics
- Access tokens are digitally signed using HMAC-SHA256 (`HS256`).
- Tokens carry standard JWT claims:
  - `sub`: User ID
  - `role`: RBAC Role (`admin`, `supervisor`, `agent`)
  - `exp`: Expiration epoch timestamp (defaults to 8 hours for dev/staging)
- Cryptographic verification executes on every authenticated endpoint.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Admin | Supervisor | Agent | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: |
| **Login (`/auth/login`)** | Allowed | Allowed | Allowed | Allowed |
| **View Dashboard Metrics** | Full | Full | Read Only | Denied (401) |
| **View All Agents** | Full | Full | View Only | Denied (401) |
| **Change Agent Availability** | Any Agent | Any Agent | Self Only | Denied (401) |
| **Modify Agent Skills** | Allowed | Allowed | Denied (403) | Denied (401) |
| **Create / Delete Queues** | Allowed | Allowed | Denied (403) | Denied (401) |
| **Dispatch Routing Simulator** | Allowed | Allowed | Allowed | Denied (401) |
| **Manage Routing Rules** | Allowed | Allowed | Denied (403) | Denied (401) |
| **Create & Update Cases** | Allowed | Allowed | Allowed | Denied (401) |
| **Escalate / Resolve Cases** | Allowed | Allowed | Assigned Only | Denied (401) |
| **Inspect System Audit Logs** | Allowed | Allowed | Denied (403) | Denied (401) |
| **Ingest Provider Webhook** | Allowed | Allowed | Allowed | Allowed (Key Check)|

---

## 4. Privacy & PII Protection

### Customer Data Minimization
- Customer phone numbers are masked on ingestion (`customer_phone_masked`) in the format `+1-***-0149`.
- Unmasked telephony identifiers are never persisted to plain logs or returned in public API payloads.
- Free-form interaction content is validated to prevent arbitrary script injections.

---

## 5. Audit Logging & Non-Repudiation

- Significant administrative and lifecycle mutations are persisted to the `audit_logs` database table.
- Each log entry records:
  - `timestamp`: UTC timestamp
  - `action`: State modification code (`AGENT_STATUS_UPDATE`, `ROUTING_DECISION`, `CASE_ESCALATED`)
  - `resource_type` & `resource_id`: Target entity
  - `actor_name` & `actor_user_id`: Executing user identity
  - `request_id`: Tracing correlation UUID
  - `details`: JSON snapshot of parameters or state diff

---

## 6. Known Limitations & Roadmap

1. **Formal Security Audit Disclaimer:** While built with production best practices, this platform has not undergone a third-party SOC2 Type II or ISO 27001 audit.
2. **Refresh Token Rotation:** Current implementation utilizes single-token session expiration; a production enterprise roadmap item is introducing short-lived access tokens (15m) paired with rotating refresh tokens stored in HTTP-only Secure SameSite cookies.
3. **Distributed Rate Limiting:** Current in-memory rate limiting should be migrated to a distributed Redis backend for multi-node deployments.
