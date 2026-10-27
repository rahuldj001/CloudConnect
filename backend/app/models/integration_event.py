from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict
from sqlalchemy import DateTime, Enum as SQLEnum, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class ProviderType(str, Enum):
    SIMULATOR = "simulator"
    AMAZON_CONNECT = "amazon_connect"


class EventStatus(str, Enum):
    PROCESSED = "processed"
    DUPLICATE = "duplicate"
    FAILED = "failed"


class IntegrationEvent(Base):
    __tablename__ = "integration_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    provider: Mapped[ProviderType] = mapped_column(
        SQLEnum(ProviderType),
        default=ProviderType.SIMULATOR,
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[EventStatus] = mapped_column(
        SQLEnum(EventStatus),
        default=EventStatus.PROCESSED,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
