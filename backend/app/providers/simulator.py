import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from app.core.logging import logger
from app.providers.base import ContactCenterProvider, ProviderContactResult, ProviderHealth


class SimulatorProvider(ContactCenterProvider):
    """
    Deterministic Local Contact Center Simulator.
    Simulates inbound voice calls and digital chat interactions for local testing
    and portfolio demonstration. All interactions are explicitly labeled as simulated
    and do NOT connect to any PSTN telephone carrier.
    """

    @property
    def provider_name(self) -> str:
        return "SimulatorProvider (Local Deterministic Sandbox)"

    @property
    def is_simulated(self) -> bool:
        return True

    async def initiate_contact(
        self,
        customer_identifier: str,
        channel: str,
        queue_id: Optional[int] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> ProviderContactResult:
        short_id = uuid.uuid4().hex[:8].upper()
        prefix = "SIM-VOICE" if channel.lower() == "voice" else "SIM-CHAT"
        provider_contact_id = f"{prefix}-{short_id}"

        logger.info(
            f"[SIMULATOR] Initiated simulated contact {provider_contact_id} "
            f"for customer {customer_identifier} (channel={channel}, queue={queue_id})"
        )

        return ProviderContactResult(
            provider_contact_id=provider_contact_id,
            channel=channel,
            status="QUEUED",
            is_simulated=True,
            metadata={
                "customer_identifier": customer_identifier,
                "queue_id": queue_id,
                "initiated_at": datetime.now(timezone.utc).isoformat(),
                "simulation_notes": "Local deterministic simulation. No real phone lines connected.",
                "attributes": attributes or {},
            },
        )

    async def terminate_contact(
        self,
        provider_contact_id: str,
        reason: Optional[str] = None,
    ) -> bool:
        logger.info(f"[SIMULATOR] Terminated simulated contact {provider_contact_id}. Reason: {reason or 'Normal wrap-up'}")
        return True

    async def process_event(
        self,
        idempotency_key: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        logger.info(f"[SIMULATOR] Processed event {event_type} with key {idempotency_key}")
        return {
            "status": "PROCESSED",
            "provider": "simulator",
            "idempotency_key": idempotency_key,
            "event_type": event_type,
            "processed_at": datetime.now(timezone.utc).isoformat(),
            "payload_summary": f"Processed {len(payload)} fields",
        }

    async def check_health(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name=self.provider_name,
            is_connected=True,
            is_simulated=True,
            details={
                "status": "READY",
                "mode": "deterministic_local_simulation",
                "notes": "Fully functional offline simulator without AWS dependency.",
            },
        )
