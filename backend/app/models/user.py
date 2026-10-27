from enum import Enum
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, Enum as SQLEnum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.agent import AgentProfile


class UserRole(str, Enum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    AGENT = "agent"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole),
        default=UserRole.AGENT,
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    agent_profile: Mapped[Optional["AgentProfile"]] = relationship(
        "AgentProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
