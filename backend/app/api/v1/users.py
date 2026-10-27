from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.auth import UserCreate, UserResponse, UserUpdate
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/users", tags=["Users Management"])


@router.get("", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    stmt = select(User).order_by(User.id.asc())
    result = await db.execute(stmt)
    return [UserResponse.model_validate(u) for u in result.scalars().all()]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    existing = await db.execute(select(User).where(User.email == user_in.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = User(
        email=user_in.email.lower(),
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(new_user)
    await db.flush()

    await log_audit_event(
        db=db,
        action="USER_CREATED",
        resource_type="user",
        resource_id=str(new_user.id),
        actor_user_id=current_user.id,
        details={"email": new_user.email, "role": new_user.role.value},
    )
    await db.commit()
    await db.refresh(new_user)
    return UserResponse.model_validate(new_user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if user_in.email:
        user.email = user_in.email.lower()
    if user_in.full_name:
        user.full_name = user_in.full_name
    if user_in.role:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)

    await log_audit_event(
        db=db,
        action="USER_UPDATED",
        resource_type="user",
        resource_id=str(user.id),
        actor_user_id=current_user.id,
        details={"updated_fields": user_in.model_dump(exclude_unset=True, exclude={"password"})},
    )
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
