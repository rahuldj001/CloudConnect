from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import logger
from app.core.security import get_password_hash
from app.models.agent import AgentProfile, AgentStatus
from app.models.case import Case, CaseNote, CasePriority, CaseStatus
from app.models.contact import Contact, ContactStatus
from app.models.interaction import ActorType, Interaction
from app.models.queue import AgentQueue, ChannelType, Queue
from app.models.routing_rule import RoutingRule
from app.models.skill import AgentSkill, Skill
from app.models.sla_policy import CaseSLA, SLAPolicy
from app.models.user import User, UserRole


async def seed_demo_data(db: AsyncSession):
    """
    Seeds local development demo data.
    All data is clearly identified as simulated demo fixtures.
    """
    # Check if already seeded
    existing_user = await db.execute(select(User).where(User.email == "admin@cloudconnect.dev"))
    if existing_user.scalar_one_or_none():
        logger.info("Database already seeded with demo data. Skipping.")
        return

    logger.info("Starting demo database seeding...")
    now = datetime.now(timezone.utc)

    # 1. Seed Users
    admin_user = User(
        email="admin@cloudconnect.dev",
        hashed_password=get_password_hash("AdminPass123!"),
        full_name="Alex Mercer (Admin)",
        role=UserRole.ADMIN,
        is_active=True,
    )
    sup_user = User(
        email="supervisor@cloudconnect.dev",
        hashed_password=get_password_hash("SupervisorPass123!"),
        full_name="Elena Vance (Supervisor)",
        role=UserRole.SUPERVISOR,
        is_active=True,
    )
    agent1_user = User(
        email="agent1@cloudconnect.dev",
        hashed_password=get_password_hash("AgentPass123!"),
        full_name="Sarah Connor (Tier 2 Lead)",
        role=UserRole.AGENT,
        is_active=True,
    )
    agent2_user = User(
        email="agent2@cloudconnect.dev",
        hashed_password=get_password_hash("AgentPass123!"),
        full_name="Marcus Wright (Billing Specialist)",
        role=UserRole.AGENT,
        is_active=True,
    )
    agent3_user = User(
        email="agent3@cloudconnect.dev",
        hashed_password=get_password_hash("AgentPass123!"),
        full_name="Kyle Reese (Frontline Support)",
        role=UserRole.AGENT,
        is_active=True,
    )
    db.add_all([admin_user, sup_user, agent1_user, agent2_user, agent3_user])
    await db.flush()

    # 2. Seed Skills
    skill_tier1 = Skill(name="General Support", code="tier_1", description="Level 1 Customer Inquiry Handling")
    skill_tier2 = Skill(name="Technical Support", code="tier_2", description="Level 2 Diagnostics & Troubleshooting")
    skill_billing = Skill(name="Billing & Refunds", code="billing", description="Invoicing, Payment Dispute, and Credit")
    skill_spanish = Skill(name="Spanish Bilingual", code="spanish", description="Fluent Spanish Customer Service")
    db.add_all([skill_tier1, skill_tier2, skill_billing, skill_spanish])
    await db.flush()

    # 3. Seed Queues
    q_overflow = Queue(
        name="General Overflow",
        channel=ChannelType.VOICE,
        priority=30,
        max_wait_time_seconds=600,
        is_active=True,
    )
    db.add(q_overflow)
    await db.flush()

    q_voice_support = Queue(
        name="Voice Customer Support",
        channel=ChannelType.VOICE,
        priority=60,
        max_wait_time_seconds=180,
        overflow_queue_id=q_overflow.id,
        is_active=True,
    )
    q_tech_chat = Queue(
        name="Technical Chat Support",
        channel=ChannelType.CHAT,
        priority=75,
        max_wait_time_seconds=120,
        overflow_queue_id=q_overflow.id,
        is_active=True,
    )
    q_vip_billing = Queue(
        name="VIP Accounts & Billing",
        channel=ChannelType.VOICE,
        priority=90,
        max_wait_time_seconds=90,
        overflow_queue_id=q_overflow.id,
        is_active=True,
    )
    db.add_all([q_voice_support, q_tech_chat, q_vip_billing])
    await db.flush()

    # 4. Seed Agent Profiles & Skill Associations
    agent1_profile = AgentProfile(
        user_id=agent1_user.id,
        current_status=AgentStatus.AVAILABLE,
        status_updated_at=now - timedelta(minutes=45),
        max_concurrency_voice=1,
        max_concurrency_chat=3,
        routing_profile_name="Tier 2 Technical Lead",
    )
    agent2_profile = AgentProfile(
        user_id=agent2_user.id,
        current_status=AgentStatus.AVAILABLE,
        status_updated_at=now - timedelta(minutes=15),
        max_concurrency_voice=1,
        max_concurrency_chat=2,
        routing_profile_name="Billing & VIP Specialist",
    )
    agent3_profile = AgentProfile(
        user_id=agent3_user.id,
        current_status=AgentStatus.AWAY,
        status_updated_at=now - timedelta(minutes=5),
        max_concurrency_voice=1,
        max_concurrency_chat=2,
        routing_profile_name="General Support Agent",
    )
    db.add_all([agent1_profile, agent2_profile, agent3_profile])
    await db.flush()

    # Assign skills
    db.add_all([
        AgentSkill(agent_id=agent1_profile.id, skill_id=skill_tier1.id, proficiency_level=5),
        AgentSkill(agent_id=agent1_profile.id, skill_id=skill_tier2.id, proficiency_level=5),
        AgentSkill(agent_id=agent2_profile.id, skill_id=skill_billing.id, proficiency_level=5),
        AgentSkill(agent_id=agent2_profile.id, skill_id=skill_spanish.id, proficiency_level=4),
        AgentSkill(agent_id=agent3_profile.id, skill_id=skill_tier1.id, proficiency_level=3),
    ])

    # Assign queues
    db.add_all([
        AgentQueue(agent_id=agent1_profile.id, queue_id=q_voice_support.id),
        AgentQueue(agent_id=agent1_profile.id, queue_id=q_tech_chat.id),
        AgentQueue(agent_id=agent2_profile.id, queue_id=q_vip_billing.id),
        AgentQueue(agent_id=agent2_profile.id, queue_id=q_voice_support.id),
        AgentQueue(agent_id=agent3_profile.id, queue_id=q_voice_support.id),
        AgentQueue(agent_id=agent3_profile.id, queue_id=q_overflow.id),
    ])
    await db.flush()

    # 5. Seed Routing Rules
    rule_tech = RoutingRule(
        name="Tier 2 Tech Diagnostics",
        queue_id=q_tech_chat.id,
        priority=80,
        required_skills=["tier_2"],
        min_proficiency=4,
        rule_condition={"category": "technical"},
        is_active=True,
    )
    rule_billing = RoutingRule(
        name="VIP Billing Escalation",
        queue_id=q_vip_billing.id,
        priority=90,
        required_skills=["billing"],
        min_proficiency=4,
        rule_condition={"vip": True},
        is_active=True,
    )
    rule_general = RoutingRule(
        name="Standard Voice Inbound",
        queue_id=q_voice_support.id,
        priority=50,
        required_skills=["tier_1"],
        min_proficiency=1,
        rule_condition={},
        is_active=True,
    )
    db.add_all([rule_tech, rule_billing, rule_general])

    # 6. Seed SLA Policies
    sla_crit = SLAPolicy(name="Critical SLA", priority=CasePriority.CRITICAL, response_time_minutes=15, resolution_time_minutes=60, is_active=True)
    sla_high = SLAPolicy(name="High SLA", priority=CasePriority.HIGH, response_time_minutes=30, resolution_time_minutes=240, is_active=True)
    sla_med = SLAPolicy(name="Medium SLA", priority=CasePriority.MEDIUM, response_time_minutes=120, resolution_time_minutes=480, is_active=True)
    sla_low = SLAPolicy(name="Low SLA", priority=CasePriority.LOW, response_time_minutes=240, resolution_time_minutes=1440, is_active=True)
    db.add_all([sla_crit, sla_high, sla_med, sla_low])
    await db.flush()

    # 7. Seed Sample Contacts
    contact1 = Contact(
        provider_contact_id="SIM-VOICE-A1B2C3D4",
        channel=ChannelType.VOICE,
        customer_name="Jordan Reed",
        customer_phone_masked="+1-555-***-0199",
        queue_id=q_vip_billing.id,
        assigned_agent_id=agent2_profile.id,
        status=ContactStatus.CONNECTED,
        priority=90,
        queued_at=now - timedelta(minutes=8),
        connected_at=now - timedelta(minutes=7),
        waiting_time_seconds=60,
        routing_reason="Routed to Marcus Wright (Billing Specialist) - VIP tier match",
        provider="simulator",
        attributes={"plan": "Enterprise", "simulated": True},
    )
    contact2 = Contact(
        provider_contact_id="SIM-CHAT-E5F6G7H8",
        channel=ChannelType.CHAT,
        customer_name="Morgan Bailey",
        customer_phone_masked="+1-555-***-8472",
        queue_id=q_tech_chat.id,
        assigned_agent_id=None,
        status=ContactStatus.QUEUED,
        priority=75,
        queued_at=now - timedelta(minutes=2),
        waiting_time_seconds=120,
        routing_reason="Queued waiting for available Tier 2 agent",
        provider="simulator",
        attributes={"issue": "API 504 Gateway Timeout", "simulated": True},
    )
    contact3 = Contact(
        provider_contact_id="SIM-VOICE-99887766",
        channel=ChannelType.VOICE,
        customer_name="Casey Rivera",
        customer_phone_masked="+1-555-***-4321",
        queue_id=q_voice_support.id,
        assigned_agent_id=agent1_profile.id,
        status=ContactStatus.COMPLETED,
        priority=50,
        queued_at=now - timedelta(hours=2),
        connected_at=now - timedelta(hours=2) + timedelta(seconds=45),
        ended_at=now - timedelta(hours=1, minutes=45),
        waiting_time_seconds=45,
        duration_seconds=900,
        routing_reason="Handled successfully and resolved",
        provider="simulator",
        attributes={"resolved": True, "simulated": True},
    )
    db.add_all([contact1, contact2, contact3])
    await db.flush()

    # Add interactions
    db.add_all([
        Interaction(
            contact_id=contact1.id,
            actor_type=ActorType.CUSTOMER,
            message="Hi, I noticed an unexpected overage charge on our company invoice.",
            timestamp=now - timedelta(minutes=7),
        ),
        Interaction(
            contact_id=contact1.id,
            actor_type=ActorType.AGENT,
            message="Hello Jordan! I would be glad to check your billing breakdown right away.",
            timestamp=now - timedelta(minutes=6),
        ),
        Interaction(
            contact_id=contact2.id,
            actor_type=ActorType.CUSTOMER,
            message="We are seeing sporadic 504 gateway timeouts when calling the webhook API endpoint.",
            timestamp=now - timedelta(minutes=2),
        ),
    ])

    # 8. Seed Sample Cases with SLA
    case1 = Case(
        case_number="CASE-20261027-001001",
        contact_id=contact1.id,
        title="Enterprise Billing Discrepancy Inquiry",
        description="Customer reported discrepancy in month-end storage usage and requested credit adjustment.",
        customer_identifier="Jordan Reed (Acme Corp)",
        assigned_to_user_id=agent2_user.id,
        status=CaseStatus.IN_PROGRESS,
        priority=CasePriority.HIGH,
    )
    case2 = Case(
        case_number="CASE-20261027-001002",
        contact_id=contact2.id,
        title="Webhook Gateway Timeout Investigation",
        description="Intermittent 504 Gateway Timeouts reported on European cluster endpoint during peak traffic.",
        customer_identifier="Morgan Bailey (TechCo)",
        assigned_to_user_id=agent1_user.id,
        status=CaseStatus.OPEN,
        priority=CasePriority.CRITICAL,
    )
    case3 = Case(
        case_number="CASE-20261026-000999",
        contact_id=contact3.id,
        title="Password Reset and 2FA Assistance",
        description="Helped employee reset lost hardware authenticator key and configured backup email.",
        customer_identifier="Casey Rivera",
        assigned_to_user_id=agent1_user.id,
        status=CaseStatus.RESOLVED,
        priority=CasePriority.LOW,
        resolved_at=now - timedelta(hours=1, minutes=45),
    )
    db.add_all([case1, case2, case3])
    await db.flush()

    # Case SLAs
    db.add_all([
        CaseSLA(
            case_id=case1.id,
            sla_policy_id=sla_high.id,
            response_deadline=now + timedelta(minutes=22),
            resolution_deadline=now + timedelta(minutes=232),
            first_responded_at=now - timedelta(minutes=6),
            is_response_breached=False,
            is_resolution_breached=False,
        ),
        CaseSLA(
            case_id=case2.id,
            sla_policy_id=sla_crit.id,
            response_deadline=now - timedelta(minutes=5),  # Intentionally breached to demonstrate supervisor SLA alert
            resolution_deadline=now + timedelta(minutes=40),
            first_responded_at=None,
            is_response_breached=True,
            is_resolution_breached=False,
        ),
        CaseSLA(
            case_id=case3.id,
            sla_policy_id=sla_low.id,
            response_deadline=now - timedelta(hours=2),
            resolution_deadline=now - timedelta(hours=1),
            first_responded_at=now - timedelta(hours=2, minutes=50),
            is_response_breached=False,
            is_resolution_breached=False,
        ),
        CaseNote(
            case_id=case1.id,
            author_user_id=agent2_user.id,
            note="Verified billing ledger against October data usage logs. Adjusting $140 balance.",
        ),
    ])

    await db.commit()
    logger.info("Demo database seeding successfully completed.")
