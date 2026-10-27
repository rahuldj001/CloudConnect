import json
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "CloudConnect Implementation Platform"
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-min-32-chars-long"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # CORS: Accepts JSON string or list of strings
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return [i.strip() for i in v.split(",") if i.strip()]
        return v

    # Database
    # Default to local SQLite with aiosqlite for zero-dependency local dev & testing
    # In Docker or production, DATABASE_URL is overridden to PostgreSQL
    DATABASE_URL: str = "sqlite+aiosqlite:///./cloudconnect.db"

    # Contact Center Provider
    CONTACT_CENTER_PROVIDER: str = "simulator"  # "simulator" or "amazon_connect"

    # Amazon Connect settings (Optional - for adapter interface demonstration)
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_CONNECT_INSTANCE_ID: str = ""
    AWS_CONNECT_CONTACT_FLOW_ID: str = ""
    AWS_CONNECT_SOURCE_PHONE: str = ""

    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
