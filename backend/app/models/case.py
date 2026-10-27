from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.contact import Contact
    from app.models.user import User
    from app.models.sla_policy import CaseSLA


class CaseStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    ESCALATED = "escalated"
    RESOLVED = "resolved"
    CLOSED = "closed"


class CasePriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Case(Base, TimestampMixin):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    contact_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    customer_identifier: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    assigned_to_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    status: Mapped[CaseStatus] = mapped_column(
        SQLEnum(CaseStatus),
        default=CaseStatus.OPEN,
        nullable=False,
        index=True,
    )
    priority: Mapped[CasePriority] = mapped_column(
        SQLEnum(CasePriority),
        default=CasePriority.MEDIUM,
        nullable=False,
        index=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="cases")
    assigned_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[assigned_to_user_id])
    sla: Mapped[Optional["CaseSLA"]] = relationship(
        "CaseSLA",
        back_populates="case",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notes: Mapped[List["CaseNote"]] = relationship(
        "CaseNote",
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="desc(CaseNote.created_at)",
    )


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    author_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="notes")
    author: Mapped["User"] = relationship("User")
