# Amazon Connect Cloud Integration Guide

This document details how to configure an optional live integration between CloudConnect and AWS Amazon Connect.

> **CRITICAL ARCHITECTURAL NOTICE:**
> The core CloudConnect platform includes an embedded deterministic `SimulatorProvider` that fulfills all contact center routing, contact state tracking, and supervisor monitoring workflows locally **without requiring an AWS account or telephone carrier billing**.
> Do not provision paid AWS resources unless explicitly authorized.

---

## 1. Amazon Connect Architectural Overview

When operating in AWS hybrid mode, CloudConnect acts as the enterprise middleware orchestration layer while Amazon Connect manages the underlying PSTN carrier trunks, WebRTC softphones, and Interactive Voice Response (IVR) audio trees.

```
+-----------------------------------------------------------------------------------------+
|                                        AWS Cloud                                        |
|                                                                                         |
|  [Inbound Call/Chat]                                                                    |
|           |                                                                             |
|           v                                                                             |
|  +--------------------+       +--------------------+       +-------------------------+  |
|  | Amazon Connect IVR |------>| Contact Trace Recs |------>| Amazon EventBridge Bus  |  |
|  |   Contact Flow     |       |    (CTR Stream)    |       |                         |  |
|  +--------------------+       +--------------------+       +------------+------------+  |
+-------------------------------------------------------------------------|---------------+
                                                                          | HTTPS Webhook
                                                                          v
+-----------------------------------------------------------------------------------------+
|                                  CloudConnect Platform                                  |
|                                                                                         |
|  +---------------------------+       +-------------------+       +-------------------+  |
|  | Event Ingestion Webhook   |------>| Idempotency Cache |------>| Routing Engine &  |  |
|  | /api/v1/integrations/event|       |  (Postgres Table) |       | SLA Supervisor DB |  |
|  +---------------------------+       +-------------------+       +-------------------+  |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Amazon Connect Provisioning Steps

### 2.1 Create an Amazon Connect Instance
1. In the AWS Management Console, navigate to **Amazon Connect**.
2. Click **Create instance**.
3. Identity management: Choose **Store users within Amazon Connect**.
4. Telephony Options: Check **Incoming calls** and **Outgoing calls**.
5. Data Storage: Configure S3 buckets for call recordings and export CTRs to Amazon Kinesis.
6. Review and create the instance. Note your **Instance ARN** and **Instance ID**.

### 2.2 Configure Routing Profiles and Queues
1. Under **Routing > Queues**, create corresponding queues matching CloudConnect:
   - `Tier 1 General Support`
   - `Tier 2 Technical Support`
   - `VIP Escalations`
2. Under **Routing > Routing Profiles**, configure an Enterprise Profile that links agents to queues with defined priority channels.

### 2.3 Contact Flow (IVR Tree) Configuration
Design a Contact Flow that:
1. Greets customer with text-to-speech (TTS) via Amazon Polly.
2. Invokes an AWS Lambda function to verify customer phone and look up active cases in CloudConnect REST API (`/api/v1/contacts?search=phone`).
3. Sets Contact Attributes (`CustomerName`, `Priority`, `RequiredSkills`).
4. Routes to specified Amazon Connect Queue.

---

## 3. Contact Trace Record (CTR) Event Mapping

Amazon Connect streams CTRs upon call completion. CloudConnect normalizes these events into its internal schema:

| Amazon Connect CTR Field | CloudConnect Contact Model | Notes |
| :--- | :--- | :--- |
| `ContactId` | `provider_contact_id` | Unique UUID stored for idempotency |
| `Channel` | `channel` | Normalized to `voice` or `chat` |
| `CustomerEndpoint.Address` | `customer_phone_masked` | Masked on ingest (`+1-***-1234`) |
| `Queue.Name` | `queue_name` | Resolved to queue ID in CloudConnect |
| `Agent.Username` | `assigned_agent_name` | Mapped to CloudConnect Agent Profile |
| `QueueDuration` | `waiting_time_seconds` | Wait duration in queue |
| `ConnectedToAgentTimestamp` | `connected_at` | UTC timestamp |
| `DisconnectTimestamp` | `completed_at` | UTC timestamp |

---

## 4. IAM Least-Privilege Policy

To connect CloudConnect to AWS Amazon Connect, attach the following least-privilege IAM policy to the application's execution role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AmazonConnectRestrictedAccess",
      "Effect": "Allow",
      "Action": [
        "connect:StartOutboundVoiceContact",
        "connect:StopContact",
        "connect:DescribeContact",
        "connect:GetContactAttributes",
        "connect:UpdateContactAttributes",
        "connect:GetCurrentMetricData"
      ],
      "Resource": "arn:aws:connect:us-east-1:123456789012:instance/your-instance-id/*"
    },
    {
      "Sid": "KinesisCTRStreamIngestion",
      "Effect": "Allow",
      "Action": [
        "kinesis:GetRecords",
        "kinesis:GetShardIterator",
        "kinesis:DescribeStream",
        "kinesis:ListShards"
      ],
      "Resource": "arn:aws:kinesis:us-east-1:123456789012:stream/amazon-connect-ctr-stream"
    }
  ]
}
```

---

## 5. Boto3 Adapter Implementation & Fault Tolerance

CloudConnect implements `AmazonConnectAdapter` (`backend/app/providers/amazon_connect.py`) using the official AWS Boto3 SDK:

- **Exponential Backoff & Retries:** Boto3 API calls are configured with standard jittered retries to protect against AWS API throttling (`ClientError` with `TooManyRequestsException`).
- **Connection Timeout Handling:** Requests enforce a 5-second connect timeout and 10-second read timeout.
- **Idempotent Ingestion:** The adapter records the external AWS `ContactId` before persisting updates. Repeated CTR events are safely flagged `DUPLICATE_IGNORED`.
- **Zero Secrets In Logs:** AWS ARNs and Access Keys are configured strictly via environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CONNECT_INSTANCE_ID`) and never logged.
