import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_agents(client: AsyncClient, admin_token: str):
    response = await client.get(
        "/api/v1/agents",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    agents = response.json()
    assert len(agents) >= 3
    # Check that skills and queues are formatted
    first_agent = agents[0]
    assert "current_status" in first_agent
    assert "skills" in first_agent
    assert "queues" in first_agent


@pytest.mark.asyncio
async def test_agent_valid_status_transition(client: AsyncClient, agent_token: str):
    # Agent 1 (Sarah Connor) is currently AVAILABLE in seed data
    # Transition: AVAILABLE -> BUSY (valid)
    response = await client.patch(
        "/api/v1/agents/1/status",
        headers={"Authorization": f"Bearer {agent_token}"},
        json={"status": "busy", "reason": "Engaged on customer consultation"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["current_status"] == "busy"


@pytest.mark.asyncio
async def test_agent_invalid_status_transition(client: AsyncClient, admin_token: str):
    # Agent 3 (Kyle Reese) is currently AWAY in seed data
    # Attempt invalid transition directly to an unallowed status if any,
    # or set to OFFLINE, then test OFFLINE -> BUSY (which is invalid, only AVAILABLE/AWAY allowed from OFFLINE)
    res1 = await client.patch(
        "/api/v1/agents/3/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "offline"},
    )
    assert res1.status_code == 200
    assert res1.json()["current_status"] == "offline"

    # Now attempt OFFLINE -> BUSY directly (should fail 400)
    res2 = await client.patch(
        "/api/v1/agents/3/status",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "busy"},
    )
    assert res2.status_code == 400
    assert "Invalid status transition" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_agent_forbidden_from_updating_other_agent(client: AsyncClient, agent_token: str):
    # agent_token belongs to user_id=3 (Agent 1)
    # Attempting to update Agent 2 (id=2)
    response = await client.patch(
        "/api/v1/agents/2/status",
        headers={"Authorization": f"Bearer {agent_token}"},
        json={"status": "away"},
    )
    assert response.status_code == 403
    assert "Agents can only change their own" in response.json()["detail"]
