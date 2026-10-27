from app.core.config import settings
from app.providers.amazon_connect import AmazonConnectAdapter
from app.providers.base import ContactCenterProvider, ProviderContactResult, ProviderHealth
from app.providers.simulator import SimulatorProvider


def get_contact_center_provider() -> ContactCenterProvider:
    """
    Factory returning either the SimulatorProvider or AmazonConnectAdapter
    based on the CONTACT_CENTER_PROVIDER environment variable.
    """
    if settings.CONTACT_CENTER_PROVIDER.lower() == "amazon_connect":
        return AmazonConnectAdapter()
    return SimulatorProvider()


__all__ = [
    "ContactCenterProvider",
    "ProviderContactResult",
    "ProviderHealth",
    "SimulatorProvider",
    "AmazonConnectAdapter",
    "get_contact_center_provider",
]
