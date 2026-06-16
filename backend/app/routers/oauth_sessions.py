import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel, Field
from bson import ObjectId

from app.db import db
from app.auth import get_current_admin, log_audit_action
from app.services.scraper import (
    run_interactive_login, 
    save_manual_storage_state, 
    scrape_groq_account, 
    scrape_render_account,
    scrape_openai_account,
    scrape_anthropic_account,
    scrape_gemini_account,
    scrape_elevenlabs_account,
    stop_active_session,
    get_session_status_db
)

logger = logging.getLogger("dashboard.sessions")

router = APIRouter(prefix="/api/sessions", tags=["OAuth Sessions"])

SUPPORTED_SERVICES = ["groq", "render", "openai", "anthropic", "gemini", "elevenlabs", "twilio", "convex"]

# Schemas
class ManualSessionImport(BaseModel):
    storage_state: str = Field(..., description="Playwright storageState JSON string")

class SessionStatusResponse(BaseModel):
    service: str
    status: str
    last_login: Optional[datetime] = None
    last_successful_scrape: Optional[datetime] = None
    error_message: Optional[str] = None
    current_stage: Optional[str] = None
    stage_message: Optional[str] = None
    stage_updated_at: Optional[datetime] = None
    logs_feed: Optional[List[dict]] = None
    mail_trigger_enabled: bool = True

class ScrapingLogResponse(BaseModel):
    id: str
    service: str
    status: str
    error_message: Optional[str] = None
    extracted_data: dict
    scraped_at: datetime

@router.get("", response_model=List[SessionStatusResponse])
async def list_sessions(admin: dict = Depends(get_current_admin)):
    """List OAuth session statuses for supported services."""
    services = SUPPORTED_SERVICES
    results = []
    
    logger.info("[SYNC] Dashboard Refreshed")
    
    for svc in services:
        doc = await db.oauth_sessions.find_one({"service": svc})
        if doc:
            current_status = await get_session_status_db(svc)
            results.append(SessionStatusResponse(
                service=svc,
                status=current_status,
                last_login=doc.get("last_login"),
                last_successful_scrape=doc.get("last_successful_scrape"),
                error_message=doc.get("error_message"),
                current_stage=doc.get("current_stage"),
                stage_message=doc.get("stage_message"),
                stage_updated_at=doc.get("stage_updated_at"),
                logs_feed=doc.get("logs_feed"),
                mail_trigger_enabled=doc.get("mail_trigger_enabled", True)
            ))
        else:
            results.append(SessionStatusResponse(
                service=svc,
                status="unauthenticated",
                last_login=None,
                last_successful_scrape=None,
                error_message=None,
                current_stage=None,
                stage_message=None,
                stage_updated_at=None,
                logs_feed=None,
                mail_trigger_enabled=True
            ))
    return results

@router.post("/mail-trigger/{service}")
async def toggle_mail_trigger(
    service: str,
    enabled: bool,
    admin: dict = Depends(get_current_admin)
):
    """Toggle automated email alerts for a given service."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    await db.oauth_sessions.update_one(
        {"service": service},
        {"$set": {"mail_trigger_enabled": enabled}},
        upsert=True
    )
    
    await log_audit_action("toggle_mail_trigger", f"Updated email alerts for {service} to {enabled}")
    return {"message": f"Mail trigger alert for {service} updated to {enabled}."}

@router.post("/interactive/{service}")
async def start_headed_login(
    service: str,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(get_current_admin)
):
    """
    Launches a headed login browser on the server/host machine.
    Designed for local runs where the user can manually authenticate.
    Runs asynchronously in the background.
    """
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    # Launch headed capture as a background task so it doesn't block the HTTP thread
    # We update the session status to 'authenticating' first
    await db.oauth_sessions.update_one(
        {"service": service},
        {
            "$set": {
                "status": "authenticating",
                "error_message": None
            }
        },
        upsert=True
    )

    background_tasks.add_task(run_interactive_login, service)
    await log_audit_action("start_interactive_login", f"Launched interactive login browser for {service}")
    
    return {"message": f"Interactive login browser launched for {service}. Please authenticate and close the browser window to save."}

@router.post("/manual/{service}")
async def import_session(
    service: str,
    data: ManualSessionImport,
    admin: dict = Depends(get_current_admin)
):
    """Import Playwright storageState JSON manually. Excellent for headless/Docker runs."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    res = await save_manual_storage_state(service, data.storage_state)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])

    await log_audit_action("import_manual_session", f"Manually imported Playwright session state for {service}")
    return {"message": res["message"]}

@router.post("/scrape/{service}")
async def trigger_scrape(
    service: str,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(get_current_admin)
):
    """Trigger an immediate headless scraping run for Groq or Render."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    logger.info("[SYNC] Browser Sync Requested")

    session = await db.oauth_sessions.find_one({"service": service})
    if not session or not session.get("storage_state"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No authenticated session state found for {service}. Please complete login first."
        )

    current_status = await get_session_status_db(service)
    if current_status == "EXPIRED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session expired. Reconnect browser."
        )

    # Scrape function map
    async def run_scrape_task():
        if service == "groq":
            await scrape_groq_account()
        elif service == "render":
            await scrape_render_account()
        elif service == "openai":
            await scrape_openai_account()
        elif service == "anthropic":
            await scrape_anthropic_account()
        elif service == "gemini":
            await scrape_gemini_account()
        elif service == "elevenlabs":
            await scrape_elevenlabs_account()

    background_tasks.add_task(run_scrape_task)
    await log_audit_action("trigger_scrape", f"Manually triggered automated scraping for {service}")
    
    return {"message": f"Scraping task for {service} scheduled successfully in the background."}

@router.get("/logs/{service}", response_model=List[ScrapingLogResponse])
async def get_scraping_logs(
    service: str,
    limit: int = Query(20, ge=1, le=100),
    admin: dict = Depends(get_current_admin)
):
    """Retrieve historical scraping execution logs for the specified service."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    logs = []
    cursor = db.scraping_logs.find({"service": service}).sort("scraped_at", -1).limit(limit)
    async for doc in cursor:
        logs.append(ScrapingLogResponse(
            id=str(doc["_id"]),
            service=doc["service"],
            status=doc.get("status", "unknown"),
            error_message=doc.get("error_message"),
            extracted_data=doc.get("extracted_data", {}),
            scraped_at=doc["scraped_at"]
        ))
    return logs

@router.post("/logs/clear/{service}")
async def clear_scraping_logs(
    service: str,
    admin: dict = Depends(get_current_admin)
):
    """Delete all historical scraping execution logs for the specified service."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    result = await db.scraping_logs.delete_many({"service": service})
    await log_audit_action("clear_scraping_logs", f"Cleared {result.deleted_count} logs for {service}")
    return {"message": f"Successfully deleted {result.deleted_count} historical logs for {service}."}

@router.post("/stop/{service}")
async def stop_execution_flow(
    service: str,
    admin: dict = Depends(get_current_admin)
):
    """Terminates any active headless/headed browser capture or scraping and resets status to idle."""
    service = service.lower()
    if service not in SUPPORTED_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unsupported service. Choose from {SUPPORTED_SERVICES}.")

    res = await stop_active_session(service)
    if res:
        await log_audit_action("stop_execution_flow", f"Forced stop of browser execution flow for {service}")
        return {"message": f"Execution flow for {service} was successfully stopped and reset to idle."}
    else:
        raise HTTPException(status_code=404, detail=f"No active session database record found for {service}.")

@router.get("/debug/browser-health")
async def browser_health(admin: dict = Depends(get_current_admin)):
    """Diagnostic endpoint to verify Playwright installation and browser launch capabilities."""
    import os
    import sys
    import asyncio
    from playwright.async_api import async_playwright

    playwright_installed = False
    chromium_exists = False
    executable_path = "N/A"
    launch_test_passed = False
    error_msg = None

    try:
        import playwright
        playwright_installed = True
    except ImportError:
        pass

    try:
        from app.services.scraper import run_in_proactor_thread
        
        async def test_launch_fn():
            nonlocal executable_path, chromium_exists
            async with async_playwright() as p:
                executable_path = p.chromium.executable_path
                if os.path.exists(executable_path):
                    chromium_exists = True
                browser = await p.chromium.launch(headless=True, timeout=5000)
                await browser.close()
            return True

        launch_test_passed = await run_in_proactor_thread(test_launch_fn())
    except Exception as e:
        error_msg = str(e)

    return {
        "playwrightInstalled": playwright_installed,
        "chromiumExists": chromium_exists or (executable_path != "N/A" and os.path.exists(executable_path)),
        "executablePath": executable_path,
        "launchTestPassed": launch_test_passed,
        "error": error_msg,
        "platform": sys.platform,
        "eventLoopPolicy": type(asyncio.get_event_loop_policy()).__name__
    }

