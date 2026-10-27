from fastapi import APIRouter

from app.api.v1.agents import router as agents_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.audit import router as audit_router
from app.api.v1.auth import router as auth_router
from app.api.v1.cases import router as cases_router
from app.api.v1.contacts import router as contacts_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.queues import router as queues_router
from app.api.v1.routing import router as routing_router
from app.api.v1.skills import router as skills_router
from app.api.v1.sla import router as sla_router
from app.api.v1.users import router as users_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(agents_router)
api_v1_router.include_router(queues_router)
api_v1_router.include_router(skills_router)
api_v1_router.include_router(routing_router)
api_v1_router.include_router(contacts_router)
api_v1_router.include_router(cases_router)
api_v1_router.include_router(sla_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(audit_router)
api_v1_router.include_router(integrations_router)
