from datetime import datetime, timedelta, timezone
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentProfile, AgentStatus
from app.models.contact import Contact, ContactStatus
from app.models.queue import Queue
from app.services.routing_engine import RoutingEngine


@pytest.mark.asyncio
async def test_deterministic_skill_match_routing(client: AsyncClient, admin_token: str):
    # Simulate contact requiring tier_2 on the Technical Chat Support queue
    response = await client.post(
        "/api/v1/routing/simulate-contact",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "customer_name": "Test Customer Alpha",
            "customer_phone": "+1-555-0100",
            "channel": "chat",
            "priority": 75,
            "required_skills": ["tier_2"],
            "attributes": {"test": True},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "connected"
    assert data["assigned_agent_id"] == 1  # Sarah Connor (has tier_2)
    assert data["routing_decision"]["decision"] == "AGENT_ASSIGNED"
    assert data["is_simulated"] is True


@pytest.mark.asyncio
async def test_routing_no_available_agent(client: AsyncClient, admin_token: str, db_session: AsyncSession):
    # Set all agents to OFFLINE
    stmt = select(AgentProfile)
    agents = (await db_session.execute(stmt)).scalars().all()
    for a in agents:
        a.current_status = AgentStatus.OFFLINE
    await db_session.commit()

    response = await client.post(
        "/api/v1/routing/simulate-contact",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "customer_name": "Test Customer Beta",
            "customer_phone": "+1-555-0200",
            "channel": "voice",
            "priority": 50,
            "required_skills": ["tier_1"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert data["assigned_agent_id"] is None
    assert data["routing_decision"]["decision"] == "QUEUED_WAITING_AGENT"


@pytest.mark.asyncio
async def test_routing_overflow_trigger(db_session: AsyncSession):
    # Set all agents to OFFLINE so no agent picks up
    stmt = select(AgentProfile)
    agents = (await db_session.execute(stmt)).scalars().all()
    for a in agents:
        a.current_status = AgentStatus.OFFLINE

    # Get Voice Support Queue (which has overflow_queue_id set to General Overflow)
    q_stmt = select(Queue).where(Queue.name == "Voice Customer Support")
    voice_q = (await db_session.execute(q_stmt)).scalar_one()

    now = datetime.now(timezone.utc)
    # Create contact with queued_at 300 seconds ago (exceeds max_wait_time_seconds=180)
    old_contact = Contact(
        provider_contact_id="TEST-OVERFLOW-001",
        channel=voice_q.channel,
        customer_name="Overflow Tester",
        customer_phone_masked="+1-555-***-0099",
        queue_id=voice_q.id,
        status=ContactStatus.QUEUED,
        priority=60,
        queued_at=now - timedelta(seconds=250),
        waiting_time_seconds=250,
        provider="simulator",
    )
    db_session.add(old_contact)
    await db_session.commit()
    await db_session.refresh(old_contact)

    # Route contact
    decision = await RoutingEngine.route_contact(db_session, old_contact)
    assert decision.overflow_triggered is True
    assert decision.decision == "OVERFLOW_TRIGGERED"
    assert old_contact.queue_id == voice_q.overflow_queue_id
    assert old_contact.status == ContactStatus.OVERFLOWED
