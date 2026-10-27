import asyncio
from app.core.database import Base, engine, AsyncSessionLocal
from app.core.logging import logger
from app.db.seed_data import seed_demo_data
# Import all models to ensure they are registered on Base.metadata
import app.models  # noqa: F401


async def init_db(seed: bool = True):
    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema initialized.")

    if seed:
        async with AsyncSessionLocal() as session:
            await seed_demo_data(session)


if __name__ == "__main__":
    asyncio.run(init_db(seed=True))
