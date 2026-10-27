from datetime import datetime, timezone
from typing import Optional


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Ensures that a datetime has UTC tzinfo.
    SQLite stores timestamps as strings without tzinfo by default,
    returning offset-naive datetimes. This normalizes them safely.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
