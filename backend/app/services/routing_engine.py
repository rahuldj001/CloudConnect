from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.datetime_util import ensure_utc
from app.core.logging import logger
from app.core.websocket_manager import ws_manager
from app.models.agent import AgentProfile, AgentStatus
from app.models.contact import Contact, ContactStatus
from app.models.interaction import ActorType, Interaction
from app.models.queue import AgentQueue, ChannelType, Queue
from app.models.routing_rule import RoutingRule
from app.models.skill import AgentSkill, Skill
from app.schemas.routing import RoutingDecisionAudit
from app.services.audit_service import log_audit_event


class RoutingEngine:
    """
    Deterministic Contact Center Routing Engine.
    Evaluates queue routing rules, required agent skills, agent availability,
    concurrency limits, and overflow triggers. Produces a full audit trail.
    """

    @staticmethod
    async def route_contact(
        db: AsyncSession,
        contact: Contact,
        actor_user_id: Optional[int] = None,
    ) -> RoutingDecisionAudit:
        now = datetime.now(timezone.utc)
        reasons: List[str] = []

        # 1. Verify Queue
        if not contact.queue_id:
            reasons.append("Contact has no assigned queue; routing aborted.")
            return RoutingDecisionAudit(
                selected_agent_id=None,
                queue_id=0,
                decision="ROUTING_FAILED",
                reasons=reasons,
                eligible_agents_count=0,
                overflow_triggered=False,
                routed_at=now,
            )

        queue_stmt = select(Queue).where(Queue.id == contact.queue_id)
        queue_res = await db.execute(queue_stmt)
        queue = queue_res.scalar_one_or_none()
        if not queue or not queue.is_active:
            reasons.append(f"Target Queue ID {contact.queue_id} is inactive or does not exist.")
            return RoutingDecisionAudit(
                selected_agent_id=None,
                queue_id=contact.queue_id,
                decision="QUEUE_INACTIVE",
                reasons=reasons,
                eligible_agents_count=0,
                overflow_triggered=False,
                routed_at=now,
            )

        reasons.append(f"Evaluating queue: '{queue.name}' (Priority {queue.priority}, Channel {queue.channel.value})")

        # 2. Gather routing rules for queue
        rules_stmt = (
            select(RoutingRule)
            .where(RoutingRule.queue_id == queue.id, RoutingRule.is_active.is_(True))
            .order_by(RoutingRule.priority.desc())
        )
        rules_res = await db.execute(rules_stmt)
        rules = rules_res.scalars().all()

        required_skills: List[str] = []
        min_proficiency = 1
        for rule in rules:
            if rule.required_skills:
                required_skills.extend(rule.required_skills)
                min_proficiency = max(min_proficiency, rule.min_proficiency)
                reasons.append(f"Applied Rule '{rule.name}' requiring skills: {rule.required_skills} (min level {rule.min_proficiency})")

        # Also merge any contact-level required skills
        contact_skills = contact.attributes.get("required_skills", [])
        if contact_skills:
            required_skills.extend(contact_skills)
            reasons.append(f"Contact attribute required skills: {contact_skills}")

        required_skills = list(set(required_skills))

        # 3. Query candidate agents assigned to this queue with status == AVAILABLE
        candidate_agents_stmt = (
            select(AgentProfile)
            .join(AgentQueue, AgentQueue.agent_id == AgentProfile.id)
            .where(
                AgentQueue.queue_id == queue.id,
                AgentProfile.current_status == AgentStatus.AVAILABLE,
            )
            .options(
                selectinload(AgentProfile.user),
                selectinload(AgentProfile.skills).selectinload(AgentSkill.skill),
            )
        )
        candidate_agents_res = await db.execute(candidate_agents_stmt)
        candidates = candidate_agents_res.scalars().all()

        reasons.append(f"Found {len(candidates)} available agent(s) subscribed to queue '{queue.name}'")

        # 4. Filter and score candidates
        eligible_agents: List[Tuple[AgentProfile, int, int]] = []
        for agent in candidates:
            # Check concurrency
            active_contacts_stmt = select(func.count(Contact.id)).where(
                Contact.assigned_agent_id == agent.id,
                Contact.status.in_([ContactStatus.CONNECTED, ContactStatus.WRAP_UP]),
            )
            active_count = (await db.execute(active_contacts_stmt)).scalar() or 0

            max_concurrency = (
                agent.max_concurrency_voice
                if queue.channel == ChannelType.VOICE
                else agent.max_concurrency_chat
            )

            if active_count >= max_concurrency:
                continue  # Agent at max concurrency

            # Check skills
            agent_skill_map = {
                askill.skill.code: askill.proficiency_level
                for askill in agent.skills
                if askill.skill
            }
            skills_satisfied = True
            total_prof = 0
            for req_skill in required_skills:
                if req_skill not in agent_skill_map or agent_skill_map[req_skill] < min_proficiency:
                    skills_satisfied = False
                    break
                total_prof += agent_skill_map[req_skill]

            if skills_satisfied:
                eligible_agents.append((agent, active_count, total_prof))

        # 5. Deterministic selection
        if eligible_agents:
            # Sort order:
            # 1. Lowest active contacts (workload balancing)
            # 2. Highest total skill proficiency
            # 3. Longest idle (earliest status_updated_at)
            # 4. Lowest agent.id (strict tie-break)
            eligible_agents.sort(
                key=lambda item: (
                    item[1],  # active contacts ASC
                    -item[2],  # skill proficiency DESC
                    ensure_utc(item[0].status_updated_at) or now,  # status_updated_at ASC
                    item[0].id,  # agent_id ASC
                )
            )

            selected_agent, active_load, _ = eligible_agents[0]
            agent_name = selected_agent.user.full_name if selected_agent.user else f"Agent {selected_agent.id}"
            decision_msg = f"Routed to agent {agent_name} (ID: {selected_agent.id}) - lowest load ({active_load}), qualified skills."
            reasons.append(decision_msg)

            # Update contact
            contact.assigned_agent_id = selected_agent.id
            contact.status = ContactStatus.CONNECTED
            contact.connected_at = now
            q_at = ensure_utc(contact.queued_at)
            wait_time = int((now - q_at).total_seconds()) if q_at else 0
            contact.waiting_time_seconds = max(wait_time, 0)
            contact.routing_reason = decision_msg

            # Add system interaction message
            db.add(
                Interaction(
                    contact_id=contact.id,
                    actor_type=ActorType.SYSTEM,
                    message=f"Contact routed and connected to {agent_name}.",
                    timestamp=now,
                    metadata_json={"agent_id": selected_agent.id, "active_load": active_load},
                )
            )

            await log_audit_event(
                db=db,
                action="CONTACT_ROUTED",
                resource_type="contact",
                resource_id=str(contact.id),
                actor_user_id=actor_user_id,
                details={
                    "assigned_agent_id": selected_agent.id,
                    "agent_name": agent_name,
                    "queue_id": queue.id,
                    "queue_name": queue.name,
                    "reasons": reasons,
                },
            )

            # Broadcast live update
            await ws_manager.broadcast(
                {
                    "event": "contact_assigned",
                    "contact_id": contact.id,
                    "agent_id": selected_agent.id,
                    "agent_name": agent_name,
                    "queue_id": queue.id,
                    "status": contact.status.value,
                },
                topic="contacts",
            )

            return RoutingDecisionAudit(
                selected_agent_id=selected_agent.id,
                selected_agent_name=agent_name,
                queue_id=queue.id,
                decision="AGENT_ASSIGNED",
                reasons=reasons,
                eligible_agents_count=len(eligible_agents),
                overflow_triggered=False,
                routed_at=now,
            )

        # 6. No eligible agent found - check queue overflow
        overflow_triggered = False
        q_at = ensure_utc(contact.queued_at)
        wait_seconds = int((now - q_at).total_seconds()) if q_at else 0
        contact.waiting_time_seconds = max(wait_seconds, 0)

        if queue.overflow_queue_id and wait_seconds >= queue.max_wait_time_seconds:
            overflow_stmt = select(Queue).where(Queue.id == queue.overflow_queue_id)
            overflow_res = await db.execute(overflow_stmt)
            overflow_queue = overflow_res.scalar_one_or_none()
            if overflow_queue and overflow_queue.is_active:
                overflow_triggered = True
                old_queue_name = queue.name
                contact.queue_id = overflow_queue.id
                contact.status = ContactStatus.OVERFLOWED
                overflow_msg = f"Wait time ({wait_seconds}s) exceeded limit ({queue.max_wait_time_seconds}s). Overflowed from '{old_queue_name}' to '{overflow_queue.name}'."
                contact.routing_reason = overflow_msg
                reasons.append(overflow_msg)

                db.add(
                    Interaction(
                        contact_id=contact.id,
                        actor_type=ActorType.SYSTEM,
                        message=overflow_msg,
                        timestamp=now,
                        metadata_json={"from_queue_id": queue.id, "to_queue_id": overflow_queue.id},
                    )
                )

                await log_audit_event(
                    db=db,
                    action="QUEUE_OVERFLOW",
                    resource_type="contact",
                    resource_id=str(contact.id),
                    actor_user_id=actor_user_id,
                    details={
                        "from_queue_id": queue.id,
                        "to_queue_id": overflow_queue.id,
                        "wait_time_seconds": wait_seconds,
                    },
                )

                return RoutingDecisionAudit(
                    selected_agent_id=None,
                    queue_id=overflow_queue.id,
                    decision="OVERFLOW_TRIGGERED",
                    reasons=reasons,
                    eligible_agents_count=0,
                    overflow_triggered=True,
                    routed_at=now,
                )

        # 7. Remains in Queue
        contact.status = ContactStatus.QUEUED
        no_agent_msg = f"No eligible agent available in queue '{queue.name}' matching required skills {required_skills}. Contact queued."
        contact.routing_reason = no_agent_msg
        reasons.append(no_agent_msg)

        return RoutingDecisionAudit(
            selected_agent_id=None,
            queue_id=queue.id,
            decision="QUEUED_WAITING_AGENT",
            reasons=reasons,
            eligible_agents_count=0,
            overflow_triggered=False,
            routed_at=now,
        )
