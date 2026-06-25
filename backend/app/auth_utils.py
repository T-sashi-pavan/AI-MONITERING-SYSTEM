from passlib.context import CryptContext
import asyncio
import logging
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

logger = logging.getLogger("dashboard.auth_utils")

def hash_password(password: str) -> str:
    """Hash a clear-text password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a clear-text password against a stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)

def deduplicate_keys(keys_list: list, platform: str) -> tuple[list, int]:
    """
    Remove duplicate keys based on unique fingerprint: (Key Name, Key Identifier, Platform Name).
    IF key already exists -> Update existing record
    ELSE -> Create new record
    """
    seen = {}
    dups_removed = 0
    unique_list = []
    for k in keys_list:
        if not isinstance(k, dict):
            continue
        
        # Unique fingerprint: key name + key identifier + platform name
        key_id = k.get("key_id") or k.get("id") or k.get("api_key") or "NM"
        key_name = k.get("name") or k.get("label") or "NM"
        
        fingerprint = (str(key_name).strip(), str(key_id).strip(), str(platform).lower().strip())
        
        if fingerprint in seen:
            dups_removed += 1
            # Update existing record
            existing = seen[fingerprint]
            for key, val in k.items():
                if val and val != "NM" and val != "Never":
                    existing[key] = val
        else:
            # Create new record
            k_copy = dict(k)
            seen[fingerprint] = k_copy
            unique_list.append(k_copy)
            
    return unique_list, dups_removed

async def validate_account_ownership(service: str):
    """
    Validates if the currently configured credential email in .env matches the
    current_account_id stored for the service session.
    If there is a mismatch, it purges the database records for that service
    and schedules a fresh scraping run.
    """
    from app.db import db
    from app.config import settings
    service = service.lower()
    
    expected_email = None
    if service in ["groq", "elevenlabs"]:
        expected_email = settings.GOOGLE_EMAIL
    elif service == "render":
        expected_email = settings.GITHUB_EMAIL
        
    if not expected_email:
        return
        
    session = await db.oauth_sessions.find_one({"service": service})
    if session:
        stored_account_id = session.get("current_account_id")
        if stored_account_id and stored_account_id != expected_email:
            print(f"[CACHE] Credential change detected for {service}. Purging old data.", flush=True)
            logger.info(f"[CACHE] Credential change detected for {service}. Purging old data.")
            
            # Invalidate session
            await db.oauth_sessions.update_one(
                {"service": service},
                {
                    "$unset": {"storage_state": ""},
                    "$set": {
                        "status": "Reconnect Required",
                        "current_account_id": expected_email,
                        "error_message": "Credentials changed. Please reconnect."
                    }
                }
            )
            # Purge keys and logs
            await db.api_monitoring.update_many(
                {"service_name": service},
                {"$set": {
                    "scraped_keys_list": [],
                    "scraped_keys_count": 0,
                    "usage_detail": {},
                    "subscription_info": {},
                    "models_list": []
                }}
            )
            await db.scraping_logs.delete_many({"service": service})
            
            # Trigger fresh scrape in background
            try:
                from app.services.scraper import scrape_groq_account, scrape_render_account, scrape_elevenlabs_account
                if service == "groq":
                    asyncio.create_task(scrape_groq_account())
                elif service == "render":
                    asyncio.create_task(scrape_render_account())
                elif service == "elevenlabs":
                    asyncio.create_task(scrape_elevenlabs_account())
            except Exception as e:
                logger.error(f"Failed to trigger auto-re-extraction: {e}")

