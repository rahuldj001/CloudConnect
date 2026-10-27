from datetime import datetime, timezone
from typing import Any, Dict
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.core.logging import logger
from app.models.integration_event import EventStatus, IntegrationEvent, ProviderType
from app.providers import get_contact_center_provider
from app.providers.base import ProviderHealth
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/integrations", tags=["Integrations & Webhooks"])


class IngestEventRequest(BaseModel):
    idempotency_key: str = Field(..., min_length=8, max_length=128)
    event_type: str = Field(..., min_length=2, max_length=100)
    provider: str = Field(default="simulator")
    payload: Dict[str, Any] = Field(default_factory=dict)


@router.post("/events")
async def ingest_provider_event(
    event_in: IngestEventRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingests provider webhook events (e.g. Amazon Connect CTR, Agent Event Streams,
    or simulated webhook calls) with idempotency verification.
    Repeated events with the same idempotency_key will NOT be duplicated.
    """
    # 1. Idempotency Check
    existing_stmt = select(IntegrationEvent).where(
        IntegrationEvent.idempotency_key == event_in.idempotency_key
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        logger.info(f"Duplicate event ignored: key '{event_in.idempotency_key}' already processed at {existing.created_at}")
        return {
            "status": "DUPLICATE",
            "message": "Event has already been processed previously.",
            "idempotency_key": event_in.idempotency_key,
            "original_processed_at": existing.created_at.isoformat(),
        }

    provider = get_contact_center_provider()

    # 2. Record new event in database
    p_type = ProviderType.AMAZON_CONNECT if event_in.provider.lower() == "amazon_connect" else ProviderType.SIMULATOR
    new_event = IntegrationEvent(
        idempotency_key=event_in.idempotency_key,
        provider=p_type,
        event_type=event_in.event_type,
        payload=event_in.payload,
        status=EventStatus.PROCESSED,
    )
    db.add(new_event)
    await db.flush()

    # 3. Delegate to provider
    try:
        proc_result = await provider.process_event(
            idempotency_key=event_in.idempotency_key,
            event_type=event_in.event_type,
            payload=event_in.payload,
        )
    except Exception as e:
        new_event.status = EventStatus.FAILED
        await db.commit()
        logger.exception(f"Failed processing provider event: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Provider failed to process event: {str(e)}",
        )

    await log_audit_event(
        db=db,
        action="INTEGRATION_EVENT_PROCESSED",
        resource_type="integration_event",
        resource_id=str(new_event.id),
        details={
            "idempotency_key": event_in.idempotency_key,
            "event_type": event_in.event_type,
            "provider": p_type.value,
        },
    )
    await db.commit()

    return {
        "status": "PROCESSED",
        "idempotency_key": event_in.idempotency_key,
        "event_type": event_in.event_type,
        "provider_result": proc_result,
    }


@router.get("/status", response_model=ProviderHealth)
async def get_provider_status():
    """
    Returns the current contact center provider status (Simulator or Amazon Connect)
    and verifies credentials/configuration.
    """
    provider = get_contact_center_provider()
    return await provider.check_health()
