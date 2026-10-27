import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.case import Case, CaseNote, CasePriority, CaseStatus
from app.models.sla_policy import CaseSLA
from app.models.user import User, UserRole
from app.schemas.auth import UserResponse
from app.schemas.case import (
    CaseCreate,
    CaseNoteCreate,
    CaseNoteResponse,
    CaseResponse,
    CaseSLAResponse,
    CaseUpdate,
    PaginatedCases,
)
from app.core.datetime_util import ensure_utc
from app.services.audit_service import log_audit_event
from app.services.sla_service import evaluate_sla_breach, initialize_case_sla

router = APIRouter(prefix="/cases", tags=["Case Management"])


async def format_case_response(case: Case) -> CaseResponse:
    now = datetime.now(timezone.utc)
    sla_resp = None
    if case.sla:
        await evaluate_sla_breach(case, case.sla)
        resp_deadline = ensure_utc(case.sla.response_deadline)
        res_deadline = ensure_utc(case.sla.resolution_deadline)
        resp_rem = int((resp_deadline - now).total_seconds() / 60) if resp_deadline else 0
        res_rem = int((res_deadline - now).total_seconds() / 60) if res_deadline else 0
        sla_resp = CaseSLAResponse(
            id=case.sla.id,
            case_id=case.sla.case_id,
            sla_policy_id=case.sla.sla_policy_id,
            policy_name=case.sla.policy.name if case.sla.policy else None,
            response_deadline=case.sla.response_deadline,
            resolution_deadline=case.sla.resolution_deadline,
            first_responded_at=case.sla.first_responded_at,
            is_response_breached=case.sla.is_response_breached,
            is_resolution_breached=case.sla.is_resolution_breached,
            response_time_remaining_minutes=resp_rem,
            resolution_time_remaining_minutes=res_rem,
        )

    notes = [
        CaseNoteResponse(
            id=n.id,
            case_id=n.case_id,
            author_user_id=n.author_user_id,
            author_name=n.author.full_name if n.author else f"User {n.author_user_id}",
            note=n.note,
            created_at=n.created_at,
        )
        for n in case.notes
    ]

    assigned_user_resp = (
        UserResponse.model_validate(case.assigned_user) if case.assigned_user else None
    )

    return CaseResponse(
        id=case.id,
        case_number=case.case_number,
        title=case.title,
        description=case.description,
        customer_identifier=case.customer_identifier,
        priority=case.priority,
        contact_id=case.contact_id,
        assigned_to_user_id=case.assigned_to_user_id,
        status=case.status,
        created_at=case.created_at,
        updated_at=case.updated_at,
        resolved_at=case.resolved_at,
        assigned_user=assigned_user_resp,
        sla=sla_resp,
        notes=notes,
    )


@router.get("", response_model=PaginatedCases)
async def list_cases(
    case_status: Optional[CaseStatus] = None,
    priority: Optional[CasePriority] = None,
    assigned_to_user_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Case)
        .options(
            selectinload(Case.assigned_user),
            selectinload(Case.sla).selectinload(CaseSLA.policy),
            selectinload(Case.notes).selectinload(CaseNote.author),
        )
        .order_by(Case.created_at.desc())
    )

    if case_status:
        query = query.where(Case.status == case_status)
    if priority:
        query = query.where(Case.priority == priority)
    if assigned_to_user_id:
        query = query.where(Case.assigned_to_user_id == assigned_to_user_id)
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Case.case_number).like(term),
                func.lower(Case.title).like(term),
                func.lower(Case.customer_identifier).like(term),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    cases = result.scalars().all()

    return PaginatedCases(
        total=total,
        items=[await format_case_response(c) for c in cases],
        page=page,
        page_size=page_size,
    )


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    case_in: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    short_num = f"CASE-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    new_case = Case(
        case_number=short_num,
        title=case_in.title,
        description=case_in.description,
        customer_identifier=case_in.customer_identifier,
        priority=case_in.priority,
        contact_id=case_in.contact_id,
        assigned_to_user_id=case_in.assigned_to_user_id or current_user.id,
        status=CaseStatus.OPEN,
    )
    db.add(new_case)
    await db.flush()

    # Initialize SLA policy & deadlines
    await initialize_case_sla(db, new_case)

    # Initial creation note
    db.add(
        CaseNote(
            case_id=new_case.id,
            author_user_id=current_user.id,
            note=f"Case created with {new_case.priority.value.upper()} priority.",
        )
    )

    await log_audit_event(
        db=db,
        action="CASE_CREATED",
        resource_type="case",
        resource_id=str(new_case.id),
        actor_user_id=current_user.id,
        details={"case_number": new_case.case_number, "priority": new_case.priority.value},
    )
    await db.commit()

    # Re-fetch fully loaded
    stmt = (
        select(Case)
        .where(Case.id == new_case.id)
        .options(
            selectinload(Case.assigned_user),
            selectinload(Case.sla).selectinload(CaseSLA.policy),
            selectinload(Case.notes).selectinload(CaseNote.author),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return await format_case_response(loaded)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Case)
        .where(Case.id == case_id)
        .options(
            selectinload(Case.assigned_user),
            selectinload(Case.sla).selectinload(CaseSLA.policy),
            selectinload(Case.notes).selectinload(CaseNote.author),
        )
    )
    result = await db.execute(stmt)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")
    return await format_case_response(case)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: int,
    case_in: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Case)
        .where(Case.id == case_id)
        .options(
            selectinload(Case.assigned_user),
            selectinload(Case.sla).selectinload(CaseSLA.policy),
            selectinload(Case.notes).selectinload(CaseNote.author),
        )
    )
    result = await db.execute(stmt)
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    now = datetime.now(timezone.utc)
    changes = []

    if case_in.title is not None and case_in.title != case.title:
        case.title = case_in.title
        changes.append("Title updated")
    if case_in.description is not None and case_in.description != case.description:
        case.description = case_in.description
        changes.append("Description updated")
    if case_in.priority is not None and case_in.priority != case.priority:
        old_p = case.priority
        case.priority = case_in.priority
        changes.append(f"Priority changed from {old_p.value} to {case_in.priority.value}")
    if case_in.assigned_to_user_id is not None and case_in.assigned_to_user_id != case.assigned_to_user_id:
        case.assigned_to_user_id = case_in.assigned_to_user_id
        changes.append(f"Reassigned to user {case_in.assigned_to_user_id}")
    if case_in.status is not None and case_in.status != case.status:
        old_s = case.status
        case.status = case_in.status
        changes.append(f"Status changed from {old_s.value} to {case_in.status.value}")
        if case_in.status in (CaseStatus.RESOLVED, CaseStatus.CLOSED):
            case.resolved_at = now

    # If first response hasn't been recorded, record it on first agent update
    if case.sla and not case.sla.first_responded_at:
        case.sla.first_responded_at = now

    if changes:
        db.add(
            CaseNote(
                case_id=case.id,
                author_user_id=current_user.id,
                note=f"Updates applied: {'; '.join(changes)}",
            )
        )

    await log_audit_event(
        db=db,
        action="CASE_UPDATED",
        resource_type="case",
        resource_id=str(case.id),
        actor_user_id=current_user.id,
        details={"changes": changes},
    )
    await db.commit()
    await db.refresh(case)
    return await format_case_response(case)


@router.post("/{case_id}/notes", response_model=CaseNoteResponse, status_code=status.HTTP_201_CREATED)
async def add_case_note(
    case_id: int,
    note_in: CaseNoteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Case).where(Case.id == case_id).options(selectinload(Case.sla))
    case = (await db.execute(stmt)).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found.")

    note = CaseNote(
        case_id=case.id,
        author_user_id=current_user.id,
        note=note_in.note,
    )
    db.add(note)
    
    # Mark first response if pending
    if case.sla and not case.sla.first_responded_at:
        case.sla.first_responded_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(note)

    return CaseNoteResponse(
        id=note.id,
        case_id=note.case_id,
        author_user_id=note.author_user_id,
        author_name=current_user.full_name,
        note=note.note,
        created_at=note.created_at,
    )
