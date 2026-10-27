from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_role
from app.models.skill import Skill
from app.models.user import User, UserRole
from app.schemas.queue import SkillCreate, SkillResponse
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/skills", tags=["Skills Management"])


@router.get("", response_model=List[SkillResponse])
async def list_skills(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Skill).order_by(Skill.name.asc())
    result = await db.execute(stmt)
    return [SkillResponse.model_validate(s) for s in result.scalars().all()]


@router.post("", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    skill_in: SkillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR)),
):
    existing = await db.execute(
        select(Skill).where((Skill.name == skill_in.name) | (Skill.code == skill_in.code.lower()))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Skill with this name or code already exists.")

    skill = Skill(
        name=skill_in.name,
        code=skill_in.code.lower(),
        description=skill_in.description,
    )
    db.add(skill)
    await db.flush()

    await log_audit_event(
        db=db,
        action="SKILL_CREATED",
        resource_type="skill",
        resource_id=str(skill.id),
        actor_user_id=current_user.id,
        details={"name": skill.name, "code": skill.code},
    )
    await db.commit()
    await db.refresh(skill)
    return SkillResponse.model_validate(skill)
