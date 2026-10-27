from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case import Case, CasePriority, CaseStatus
from app.models.sla_policy import CaseSLA
from app.services.sla_service import evaluate_sla_breach


@pytest.mark.asyncio
async def test_case_creation_and_sla_initialization(client: AsyncClient, admin_token: str):
    response = await client.post(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "title": "Database Read Replica Latency Spike",
            "description": "Replica lag in us-east-1 reached 450 seconds causing stale reads.",
            "customer_identifier": "DataCorp Systems",
            "priority": "critical",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["case_number"].startswith("CASE-")
    assert data["status"] == "open"
    assert data["priority"] == "critical"
    assert data["sla"] is not None
    # Critical response deadline should be approximately 15 minutes
    assert data["sla"]["response_time_remaining_minutes"] <= 15
    assert data["sla"]["is_response_breached"] is False


@pytest.mark.asyncio
async def test_case_escalation_and_note(client: AsyncClient, supervisor_token: str):
    # Fetch existing case
    cases_res = await client.get(
        "/api/v1/cases",
        headers={"Authorization": f"Bearer {supervisor_token}"},
    )
    first_case = cases_res.json()["items"][0]
    case_id = first_case["id"]

    # Escalate case
    update_res = await client.patch(
        f"/api/v1/cases/{case_id}",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json={"status": "escalated"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "escalated"

    # Add internal note
    note_res = await client.post(
        f"/api/v1/cases/{case_id}/notes",
        headers={"Authorization": f"Bearer {supervisor_token}"},
        json={"note": "Escalating directly to Principal SRE on-call due to multi-tenant impact."},
    )
    assert note_res.status_code == 201
    assert "Escalating directly" in note_res.json()["note"]


@pytest.mark.asyncio
async def test_sla_breach_detection_calculation():
    now = datetime.now(timezone.utc)
    # Simulate a past deadline that was not responded to
    test_case = Case(
        case_number="CASE-BREACH-001",
        title="Breached SLA Case",
        description="Testing deadline evaluation",
        customer_identifier="Cust1",
        priority=CasePriority.CRITICAL,
        status=CaseStatus.OPEN,
    )
    test_sla = CaseSLA(
        case_id=100,
        sla_policy_id=1,
        response_deadline=now - timedelta(minutes=10),  # 10 minutes past deadline
        resolution_deadline=now + timedelta(minutes=50),
        first_responded_at=None,
        is_response_breached=False,
        is_resolution_breached=False,
    )

    await evaluate_sla_breach(test_case, test_sla)
    assert test_sla.is_response_breached is True
    assert test_sla.is_resolution_breached is False
