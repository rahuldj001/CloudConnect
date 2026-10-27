from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.skill import AgentSkill
    from app.models.queue import AgentQueue
    from app.models.contact import Contact


class AgentStatus(str, Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    AWAY = "away"
    OFFLINE = "offline"


# Valid transition state machine
VALID_AGENT_STATUS_TRANSITIONS = {
    AgentStatus.OFFLINE: {AgentStatus.AVAILABLE, AgentStatus.AWAY},
    AgentStatus.AVAILABLE: {AgentStatus.BUSY, AgentStatus.AWAY, AgentStatus.OFFLINE},
    AgentStatus.BUSY: {AgentStatus.AVAILABLE, AgentStatus.AWAY, AgentStatus.OFFLINE},
    AgentStatus.AWAY: {AgentStatus.AVAILABLE, AgentStatus.BUSY, AgentStatus.OFFLINE},
}


class AgentProfile(Base, TimestampMixin):
    __tablename__ = "agent_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    current_status: Mapped[AgentStatus] = mapped_column(
        SQLEnum(AgentStatus),
        default=AgentStatus.OFFLINE,
        nullable=False,
        index=True,
    )
    status_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    max_concurrency_voice: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    max_concurrency_chat: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    routing_profile_name: Mapped[str] = mapped_column(String(100), default="Standard Agent", nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="agent_profile")
    skills: Mapped[List["AgentSkill"]] = relationship(
        "AgentSkill",
        back_populates="agent",
        cascade="all, delete-orphan",
    )
    queues: Mapped[List["AgentQueue"]] = relationship(
        "AgentQueue",
        back_populates="agent",
        cascade="all, delete-orphan",
    )
    assigned_contacts: Mapped[List["Contact"]] = relationship(
        "Contact",
        back_populates="assigned_agent",
    )
    status_history: Mapped[List["AgentStatusHistory"]] = relationship(
        "AgentStatusHistory",
        back_populates="agent",
        cascade="all, delete-orphan",
        order_by="desc(AgentStatusHistory.created_at)",
    )


class AgentStatusHistory(Base):
    __tablename__ = "agent_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    agent_id: Mapped[int] = mapped_column(Integer, ForeignKey("agent_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    previous_status: Mapped[AgentStatus] = mapped_column(SQLEnum(AgentStatus), nullable=False)
    new_status: Mapped[AgentStatus] = mapped_column(SQLEnum(AgentStatus), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    agent: Mapped["AgentProfile"] = relationship("AgentProfile", back_populates="status_history")
