from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.queue import ChannelType

if TYPE_CHECKING:
    from app.models.queue import Queue
    from app.models.agent import AgentProfile
    from app.models.interaction import Interaction
    from app.models.case import Case


class ContactStatus(str, Enum):
    QUEUED = "queued"
    ROUTING = "routing"
    CONNECTED = "connected"
    WRAP_UP = "wrap_up"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    OVERFLOWED = "overflowed"


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider_contact_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    channel: Mapped[ChannelType] = mapped_column(
        SQLEnum(ChannelType),
        default=ChannelType.VOICE,
        nullable=False,
    )
    customer_name: Mapped[str] = mapped_column(String(100), default="Anonymous Customer", nullable=False)
    customer_phone_masked: Mapped[str] = mapped_column(String(50), default="+1-***-***-0000", nullable=False)
    
    queue_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("queues.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("agent_profiles.id", ondelete="SET NULL"), nullable=True, index=True)
    
    status: Mapped[ContactStatus] = mapped_column(
        SQLEnum(ContactStatus),
        default=ContactStatus.QUEUED,
        nullable=False,
        index=True,
    )
    priority: Mapped[int] = mapped_column(Integer, default=50, nullable=False, index=True)
    
    queued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    connected_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    waiting_time_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    routing_reason: Mapped[str] = mapped_column(String(255), default="Initial entry into queue", nullable=False)
    provider: Mapped[str] = mapped_column(String(50), default="simulator", nullable=False)
    attributes: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    queue: Mapped[Optional["Queue"]] = relationship("Queue", back_populates="contacts", foreign_keys=[queue_id])
    assigned_agent: Mapped[Optional["AgentProfile"]] = relationship("AgentProfile", back_populates="assigned_contacts")
    interactions: Mapped[List["Interaction"]] = relationship(
        "Interaction",
        back_populates="contact",
        cascade="all, delete-orphan",
        order_by="asc(Interaction.timestamp)",
    )
    cases: Mapped[List["Case"]] = relationship("Case", back_populates="contact")
