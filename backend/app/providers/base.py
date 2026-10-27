from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel


class ProviderContactResult(BaseModel):
    provider_contact_id: str
    channel: str
    status: str
    is_simulated: bool
    metadata: Dict[str, Any] = {}


class ProviderHealth(BaseModel):
    provider_name: str
    is_connected: bool
    is_simulated: bool
    details: Dict[str, Any] = {}


class ContactCenterProvider(ABC):
    """
    Abstract interface for Contact Center providers.
    Both the local SimulatorProvider and the AmazonConnectAdapter implement
    this contract, ensuring loose coupling and testability.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    @property
    @abstractmethod
    def is_simulated(self) -> bool:
        pass

    @abstractmethod
    async def initiate_contact(
        self,
        customer_identifier: str,
        channel: str,
        queue_id: Optional[int] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> ProviderContactResult:
        """Start or ingest an incoming/outgoing contact."""
        pass

    @abstractmethod
    async def terminate_contact(
        self,
        provider_contact_id: str,
        reason: Optional[str] = None,
    ) -> bool:
        """Disconnect/terminate contact session."""
        pass

    @abstractmethod
    async def process_event(
        self,
        idempotency_key: str,
        event_type: str,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Process external webhook/event with idempotency enforcement."""
        pass

    @abstractmethod
    async def check_health(self) -> ProviderHealth:
        """Verify provider connectivity and credentials."""
        pass
