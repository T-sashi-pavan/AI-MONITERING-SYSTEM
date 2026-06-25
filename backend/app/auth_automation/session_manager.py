import json
import logging
import asyncio
from datetime import datetime
from playwright.async_api import Page
from app.db import db
from app.encryption import encrypt_value
from app.auth_automation.google_auth import log_auth, authenticate_google
from app.auth_automation.github_auth import authenticate_github

logger = logging.getLogger("dashboard.auth.session_manager")

async def check_existing_session(service: str, page: Page) -> bool:
    """
    Checks if a valid, unexpired session is already present for the given service.
    Navigates to the platform's keys/dashboard URL and checks for redirect to login.
    """
    service = service.lower()
    
    # Define verification target URLs
    targets = {
        "groq": "https://console.groq.com/keys",
        "elevenlabs": "https://elevenlabs.io/app/developers/api-keys",
        "render": "https://dashboard.render.com/"
    }
    
    target_url = targets.get(service)
    if not target_url:
        return False
        
    try:
        # Load existing cookies from DB into browser context first (if we have any)
        session = await db.oauth_sessions.find_one({"service": service})
        if not session or not session.get("storage_state"):
            return False
            
        await page.goto(target_url, wait_until="domcontentloaded", timeout=20000)
        await asyncio.sleep(3.0)
        
        current_url = page.url.lower()
        
        # Check for redirects to login/auth pages
        login_indicators = ["login", "auth", "signin", "sign-in", "accounts.google.com", "github.com/login"]
        
        # If redirected to a login-related URL, session is expired
        if any(indicator in current_url for indicator in login_indicators):
            return False
            
        # Verify dashboard presence by checking common selectors
        dashboard_selectors = {
            "groq": ["table tbody tr", "button:has-text('Create API Key')", "a[href*='logout']"],
            "elevenlabs": ["tr, [role='row']", "button:has-text('Create')", "a[href*='logout']"],
            "render": ["a[href*='/srv/']", "a[href*='/web/']", "tr:has-text('deploy')", "button:has-text('Logout')"]
        }
        
        selectors = dashboard_selectors.get(service, [])
        for sel in selectors:
            try:
                if await page.locator(sel).first.is_visible():
                    # We see dashboard content, session is valid!
                    await log_auth(service, "[AUTH] Existing session detected.")
                    await log_auth(service, "[AUTH] Login skipped.")
                    await log_auth(service, "")
                    return True
            except Exception:
                continue
                
        # If we didn't redirect to login but dashboard selectors are missing, check if it looks logged-in
        # (e.g. no login input fields visible)
        try:
            if await page.locator("input[type='email'], input[type='password']").count() == 0:
                await log_auth(service, "[AUTH] Existing session detected.")
                await log_auth(service, "[AUTH] Login skipped.")
                await log_auth(service, "")
                return True
        except Exception:
            pass
            
        return False
        
    except Exception as e:
        logger.debug(f"Failed checking existing session for {service}: {e}")
        return False

async def perform_auto_login(service: str, page: Page) -> bool:
    """
    Runs automated authentication based on service platform,
    saves captured storage state, and updates database records.
    """
    service = service.lower()
    from app.config import settings
    
    expected_email = None
    if service in ["groq", "elevenlabs"]:
        expected_email = settings.GOOGLE_EMAIL
    elif service == "render":
        expected_email = settings.GITHUB_EMAIL
    
    if service in ["groq", "elevenlabs"]:
        success = await authenticate_google(service, page)
    elif service == "render":
        success = await authenticate_github(service, page)
    else:
        await log_auth(service, f"[AUTH] Unsupported service for auto-login: {service}", "FAILED")
        return False
        
    if success:
        try:
            # Capture storage state
            state = await page.context.storage_state()
            state_json = json.dumps(state)
            encrypted_state = encrypt_value(state_json)
            
            # Save storage state to DB
            await db.oauth_sessions.update_one(
                {"service": service},
                {
                    "$set": {
                        "storage_state": encrypted_state,
                        "status": "active",
                        "last_login": datetime.utcnow(),
                        "error_message": None,
                        "current_account_id": expected_email
                    }
                },
                upsert=True
            )
            return True
        except Exception as e:
            await log_auth(service, f"[AUTH] Login succeeded, but failed to save session to DB: {e}", "FAILED")
            return False
            
    return False
