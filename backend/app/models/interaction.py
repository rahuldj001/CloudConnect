from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.contact import Contact


class ActorType(str, Enum):
    CUSTOMER = "customer"
    AGENT = "agent"
    SYSTEM = "system"


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    contact_id: Mapped[int] = mapped_column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_type: Mapped[ActorType] = mapped_column(
        SQLEnum(ActorType),
        default=ActorType.SYSTEM,
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    contact: Mapped["Contact"] = relationship("Contact", back_populates="interactions")
