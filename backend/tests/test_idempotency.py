import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_provider_event_idempotency(client: AsyncClient):
    idempotency_key = f"evt-idem-{uuid.uuid4().hex}"
    payload = {
        "idempotency_key": idempotency_key,
        "event_type": "CONTACT_DISCONNECTED",
        "provider": "simulator",
        "payload": {
            "ContactId": "SIM-CALL-12345",
            "DisconnectReason": "CUSTOMER_DISCONNECT",
        },
    }

    # First event submission -> PROCESSED
    res1 = await client.post("/api/v1/integrations/events", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "PROCESSED"
    assert data1["idempotency_key"] == idempotency_key

    # Repeated event submission with same key -> DUPLICATE (idempotent, no side effects)
    res2 = await client.post("/api/v1/integrations/events", json=payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "DUPLICATE"
    assert "already been processed" in data2["message"]


@pytest.mark.asyncio
async def test_provider_health_status(client: AsyncClient):
    response = await client.get("/api/v1/integrations/status")
    assert response.status_code == 200
    data = response.json()
    assert "provider_name" in data
    assert "is_simulated" in data
    assert data["is_simulated"] is True
