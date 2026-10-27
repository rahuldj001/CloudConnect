from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Enum as SQLEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.case import CasePriority

if TYPE_CHECKING:
    from app.models.case import Case


class SLAPolicy(Base):
    __tablename__ = "sla_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    priority: Mapped[CasePriority] = mapped_column(
        SQLEnum(CasePriority),
        unique=True,
        nullable=False,
    )
    response_time_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    resolution_time_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class CaseSLA(Base):
    __tablename__ = "case_slas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    case_id: Mapped[int] = mapped_column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), unique=True, nullable=False)
    sla_policy_id: Mapped[int] = mapped_column(Integer, ForeignKey("sla_policies.id", ondelete="CASCADE"), nullable=False)
    
    response_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolution_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    first_responded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    is_response_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_resolution_breached: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    case: Mapped["Case"] = relationship("Case", back_populates="sla")
    policy: Mapped["SLAPolicy"] = relationship("SLAPolicy")
