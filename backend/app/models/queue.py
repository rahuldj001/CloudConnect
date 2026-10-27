from enum import Enum
from datetime import datetime, timezone
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.agent import AgentProfile
    from app.models.routing_rule import RoutingRule
    from app.models.contact import Contact


class ChannelType(str, Enum):
    VOICE = "voice"
    CHAT = "chat"


class Queue(Base):
    __tablename__ = "queues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    channel: Mapped[ChannelType] = mapped_column(
        SQLEnum(ChannelType),
        default=ChannelType.VOICE,
        nullable=False,
    )
    priority: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    max_wait_time_seconds: Mapped[int] = mapped_column(Integer, default=300, nullable=False)
    overflow_queue_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("queues.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    agent_associations: Mapped[List["AgentQueue"]] = relationship(
        "AgentQueue",
        back_populates="queue",
        cascade="all, delete-orphan",
    )
    routing_rules: Mapped[List["RoutingRule"]] = relationship(
        "RoutingRule",
        back_populates="queue",
        cascade="all, delete-orphan",
    )
    contacts: Mapped[List["Contact"]] = relationship(
        "Contact",
        back_populates="queue",
        foreign_keys="Contact.queue_id",
    )


class AgentQueue(Base):
    __tablename__ = "agent_queues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agent_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    queue_id: Mapped[int] = mapped_column(Integer, ForeignKey("queues.id", ondelete="CASCADE"), nullable=False, index=True)

    # Relationships
    agent: Mapped["AgentProfile"] = relationship("AgentProfile", back_populates="queues")
    queue: Mapped["Queue"] = relationship("Queue", back_populates="agent_associations")
