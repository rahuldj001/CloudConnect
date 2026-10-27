# CloudConnect Database Specification & Schema

## 1. Schema Overview

CloudConnect uses a normalized relational data model designed for high-throughput contact center operations, fast queue lookups, accurate workforce management, and immutable audit logs.

```
+--------------------+       +----------------------+       +--------------------+
|       users        |<----->|    agent_profiles    |<----->| agent_status_hist  |
+--------------------+       +----------------------+       +--------------------+
         ^                              |
         |                              v
         |                   +----------------------+       +--------------------+
         |                   |     agent_skills     |<----->|       skills       |
         |                   +----------------------+       +--------------------+
         |                              |
         |                              v
         |                   +----------------------+       +--------------------+
         |                   |     agent_queues     |<----->|       queues       |
         |                   +----------------------+       +--------------------+
         |                                                             ^
         |                                                             |
         v                                                             v
+--------------------+       +----------------------+       +--------------------+
|       cases        |<----->|       contacts       |<----->|   routing_rules    |
+--------------------+       +----------------------+       +--------------------+
    |            |                      |                              |
    v            v                      v                              v
+--------+  +---------+      +----------------------+       +--------------------+
|case_sla|  |case_note|      |     interactions     |       |   audit_logs       |
+--------+  +---------+      +----------------------+       +--------------------+
```

---

## 2. Table Definitions

### 2.1 `users`
Core identity table representing human administrators, supervisors, and agents.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Internal unique user ID |
| `email` | String(255) | Unique, Not Null, Index | Work email address |
| `hashed_password` | String(255) | Not Null | Passlib/Bcrypt hashed password |
| `full_name` | String(255) | Not Null | Display full name |
| `role` | String(50) | Not Null, Default: 'agent' | RBAC role (`admin`, `supervisor`, `agent`) |
| `is_active` | Boolean | Not Null, Default: True | Account active status flag |
| `created_at` | DateTime(UTC)| Not Null | Creation timestamp |
| `updated_at` | DateTime(UTC)| Not Null | Last update timestamp |

### 2.2 `agent_profiles`
Workforce metadata linked 1:1 with users who hold the `agent` or `supervisor` role.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique agent profile ID |
| `user_id` | Integer | FK(`users.id`, CASCADE), Unique | Parent user reference |
| `current_status` | String(50) | Not Null, Default: 'offline' | State: `available`, `busy`, `away`, `offline` |
| `status_updated_at`| DateTime(UTC)| Not Null | Timestamp of last presence change |
| `max_concurrent_contacts` | Integer | Not Null, Default: 2 | Maximum simultaneous interactions |
| `active_contacts_count` | Integer | Not Null, Default: 0 | Current active concurrent interactions |

### 2.3 `agent_status_history`
Immutable event log tracking all presence transitions for workforce management audits.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique event ID |
| `agent_id` | Integer | FK(`agent_profiles.id`, CASCADE), Index | Agent reference |
| `previous_status` | String(50) | Nullable | State before transition |
| `new_status` | String(50) | Not Null | State after transition |
| `duration_seconds` | Integer | Nullable | Seconds spent in previous state |
| `changed_at` | DateTime(UTC)| Not Null, Index | Transition timestamp |

### 2.4 `queues`
Inbound distribution queues grouping contacts by channel, SLA, and business priority.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique queue identifier |
| `name` | String(100) | Unique, Not Null | Display name (e.g. 'Tier 2 Voice') |
| `channel` | String(50) | Not Null | Media channel (`voice`, `chat`) |
| `priority` | Integer | Not Null, Default: 50 | Scheduling weight (1-100) |
| `max_wait_time_seconds` | Integer | Not Null, Default: 300 | SLA wait time limit before overflow |
| `overflow_queue_id`| Integer | FK(`queues.id`, SET NULL) | Backup overflow target |
| `is_active` | Boolean | Not Null, Default: True | Active status |

### 2.5 `contacts`
Represents an inbound or outbound customer interaction session.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Internal contact record ID |
| `provider_contact_id` | String(255) | Unique, Not Null, Index | External CTR or simulator UUID |
| `channel` | String(50) | Not Null | Channel (`voice`, `chat`) |
| `status` | String(50) | Not Null, Index | Status (`queued`, `routing`, `connected`, `completed`, `overflowed`) |
| `queue_id` | Integer | FK(`queues.id`), Nullable, Index | Active queue assignment |
| `assigned_agent_id` | Integer | FK(`agent_profiles.id`), Nullable, Index | Assigned agent |
| `customer_phone_masked` | String(100) | Not Null | Privacy-safe phone mask (e.g. +1-***-0149) |
| `customer_name` | String(255) | Not Null | Customer display name |
| `priority` | Integer | Not Null, Default: 50 | Current routing priority |
| `waiting_time_seconds` | Integer | Not Null, Default: 0 | Duration spent waiting in queue |
| `duration_seconds` | Integer | Not Null, Default: 0 | Total connected conversation duration |
| `created_at` | DateTime(UTC)| Not Null, Index | Contact arrival timestamp |
| `connected_at` | DateTime(UTC)| Nullable | Agent connection timestamp |
| `completed_at` | DateTime(UTC)| Nullable | Interaction termination timestamp |

### 2.6 `interactions`
Sequential conversational transcripts, events, and notes tied to a contact.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Interaction event ID |
| `contact_id` | Integer | FK(`contacts.id`, CASCADE), Index | Parent contact reference |
| `actor_type` | String(50) | Not Null | `customer`, `agent`, `system`, `bot` |
| `actor_name` | String(255) | Not Null | Display name |
| `content` | Text | Not Null | Message text or event payload |
| `timestamp` | DateTime(UTC)| Not Null, Index | Event occurrence timestamp |

### 2.7 `cases` & `case_slas`
Support incident ticket records linked with contacts and SLA compliance contracts.

| Column (`cases`) | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique case ID |
| `case_number` | String(50) | Unique, Not Null, Index | Human-readable case identifier (`CAS-YYYYMMDD-XXXX`) |
| `title` | String(255) | Not Null | Incident summary |
| `description` | Text | Not Null | Detailed incident explanation |
| `customer_identifier` | String(255) | Not Null | Account / customer ID |
| `priority` | String(50) | Not Null | `critical`, `high`, `medium`, `low` |
| `status` | String(50) | Not Null, Index | `open`, `in_progress`, `escalated`, `resolved`, `closed` |
| `contact_id` | Integer | FK(`contacts.id`, SET NULL) | Originating contact record |
| `assigned_to_user_id` | Integer | FK(`users.id`, SET NULL) | Assigned case owner |

| Column (`case_slas`) | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Unique SLA tracking record |
| `case_id` | Integer | FK(`cases.id`, CASCADE), Unique | Parent case reference |
| `response_deadline` | DateTime(UTC)| Not Null, Index | Target first response timestamp |
| `resolution_deadline` | DateTime(UTC)| Not Null, Index | Target full resolution timestamp |
| `is_response_breached` | Boolean | Not Null, Default: False | Flag indicating response SLA breach |
| `is_resolution_breached` | Boolean | Not Null, Default: False | Flag indicating resolution SLA breach |

### 2.8 `integration_events`
Audit table guaranteeing idempotent event processing from external webhooks.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | PK, Auto-increment | Event identifier |
| `event_key` | String(255) | Unique, Not Null, Index | Unique idempotency key (CTR ID or event UUID) |
| `event_type` | String(100) | Not Null | Event type name (`CTR_STREAM`, `CALL_INITIATED`) |
| `payload` | JSON | Not Null | Full raw event payload |
| `processed` | Boolean | Not Null, Default: True | Processing status flag |
| `created_at` | DateTime(UTC)| Not Null | Ingestion timestamp |

---

## 3. Database Migrations (Alembic)

Database schema versioning is managed using Alembic. Migration scripts reside under `backend/alembic/versions/`.

### Run Migrations:
```bash
cd backend
alembic upgrade head
```

### Create New Migration:
```bash
cd backend
alembic revision -m "add_new_column"
```
