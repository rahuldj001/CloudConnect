import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.api import api_v1_router
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.logging import logger
from app.core.middleware import RequestContextMiddleware
from app.core.websocket_manager import ws_manager
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize tables and seed demo data if in dev mode
    logger.info(f"Starting {settings.PROJECT_NAME} in {settings.ENVIRONMENT} mode...")
    try:
        await init_db(seed=True)
    except Exception as e:
        logger.error(f"Error during startup database initialization: {e}")
    yield
    # Shutdown
    logger.info("Shutting down CloudConnect platform.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "CloudConnect: A Cloud Contact Center Implementation Platform demonstrating "
        "deterministic routing, real-time agent presence, SLA breach monitoring, "
        "and cloud contact center integration patterns."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    lifespan=lifespan,
)

# Request context and correlation ID middleware
app.add_middleware(RequestContextMiddleware)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health & Observability Endpoints
@app.get("/health/live", tags=["Health"])
async def liveness_probe():
    """Liveness probe indicating service process is running."""
    return {"status": "UP", "service": "cloudconnect-backend"}


@app.get("/health/ready", tags=["Health"])
async def readiness_probe():
    """Readiness probe verifying database connectivity."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return {"status": "READY", "database": "CONNECTED"}
    except Exception as e:
        logger.error(f"Readiness database health check failed: {e}")
        return {"status": "NOT_READY", "database": "UNAVAILABLE", "error": str(e)}


# WebSockets for real-time contact center events
@app.websocket(f"{settings.API_V1_PREFIX}/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")
                topic = msg.get("topic", "all")
                if action == "subscribe":
                    ws_manager.subscribe(websocket, topic)
                    await websocket.send_text(json.dumps({"status": "subscribed", "topic": topic}))
                elif action == "unsubscribe":
                    ws_manager.unsubscribe(websocket, topic)
                    await websocket.send_text(json.dumps({"status": "unsubscribed", "topic": topic}))
                elif action == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON format"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


# Mount Versioned API Router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
