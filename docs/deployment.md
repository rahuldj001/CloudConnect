# CloudConnect Deployment & Cloud Infrastructure Guide

## 1. Local Deployment (Docker Compose)

The fastest method to run the entire CloudConnect full-stack application (React frontend, FastAPI backend, PostgreSQL database) is via Docker Compose:

### Prerequisites:
- Docker Desktop (version 24.0+)
- Docker Compose (version 2.20+)

### Single-Command Start:
```bash
docker compose up --build
```

### Accessing Local Services:
- **Web Application:** `http://localhost:3000`
- **FastAPI Backend & API:** `http://localhost:8000`
- **OpenAPI Swagger Docs:** `http://localhost:8000/docs`
- **PostgreSQL Database:** `localhost:5432` (credentials in `.env`)

### Teardown:
```bash
docker compose down -v
```

---

## 2. Non-Docker Local Development

### 2.1 Backend Setup:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.db.init_db
python -m app.db.seed_data
uvicorn app.main:app --reload --port 8000
```

### 2.2 Frontend Setup:
```bash
cd frontend
npm install
npm run dev
```
Navigate to `http://localhost:5173`.

---

## 3. Production AWS Architecture (ECS Fargate + RDS + CloudFront)

For an enterprise production deployment, CloudConnect is architected on serverless container infrastructure:

```
+-----------------------------------------------------------------------------------------+
|                                    AWS Architecture                                     |
|                                                                                         |
|       [Internet Users]                                                                  |
|              |                                                                          |
|              +-------------------------------------+                                    |
|              | HTTPS                               | HTTPS                              |
|              v                                     v                                    |
|   +---------------------+               +---------------------+                         |
|   |  Amazon CloudFront  |               |  Application Load   |                         |
|   |  (Global Edge CDN)  |               |   Balancer (ALB)    |                         |
|   +----------+----------+               +----------+----------+                         |
|              |                                     |                                    |
|              v                                     v                                    |
|   +---------------------+               +---------------------+                         |
|   |    Amazon S3        |               |   AWS ECS Fargate   |                         |
|   | (Static React SPA)  |               |  (FastAPI Backend)  |                         |
|   +---------------------+               +----------+----------+                         |
|                                                    | Private VPC                        |
|                                                    v                                    |
|                                         +---------------------+                         |
|                                         |   Amazon RDS Postg. |                         |
|                                         |   (Multi-AZ Active) |                         |
|                                         +---------------------+                         |
+-----------------------------------------------------------------------------------------+
```

### Component Details:
1. **Frontend Hosting (Amazon S3 + Amazon CloudFront):**
   - The compiled React bundle (`dist/`) is hosted in an encrypted S3 bucket.
   - CloudFront distributes the assets globally with SSL termination (AWS Certificate Manager) and custom domain routing.
2. **Backend API (AWS ECS Fargate):**
   - FastAPI container runs as an ECS Task Definition under AWS Fargate (serverless compute).
   - Auto-scaling scales task count dynamically based on CPU utilization and incoming HTTP request rates.
3. **Database (Amazon RDS for PostgreSQL):**
   - Managed PostgreSQL 15 instance deployed across Multi-AZ subnets with automated daily snapshots and KMS storage encryption.
4. **Load Balancing & Networking:**
   - AWS Application Load Balancer routes `/api/*` and WebSocket traffic `/api/v1/ws` to ECS tasks while enforcing SSL.

---

## 4. Cost Estimation (AWS Monthly Estimates)

| Service | Dev / Low-Traffic Tier | Production High-Availability |
| :--- | :--- | :--- |
| **AWS ECS Fargate** (1 task: 0.5 vCPU, 1 GB) | ~$15 / month | ~$60 / month (2 tasks auto-scaled) |
| **Amazon RDS PostgreSQL** (db.t4g.micro) | ~$18 / month (Free tier eligible) | ~$120 / month (db.t4g.medium Multi-AZ) |
| **Application Load Balancer** | ~$22 / month | ~$25 / month |
| **Amazon S3 & CloudFront** (10 GB transfer) | < $1 / month | ~$10 / month |
| **AWS Secrets Manager & CloudWatch** | ~$3 / month | ~$15 / month |
| **Total Estimated Cost:** | **~$59 / month** | **~$230 / month** |

---

## 5. Teardown Instructions

To avoid ongoing charges after completing evaluations:
1. **ECS Tasks:** Set desired task count to 0 and delete the ECS service.
2. **RDS Database:** Delete the RDS instance (select "No" for final snapshot if testing).
3. **Application Load Balancer:** Delete the ALB and target groups.
4. **S3 Bucket:** Empty and delete the bucket hosting static assets.
5. **KMS / Secrets:** Delete secrets created in AWS Secrets Manager.
