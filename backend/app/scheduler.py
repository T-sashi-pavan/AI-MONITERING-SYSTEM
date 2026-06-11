import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.services.health_checker import run_all_health_checks
from app.services.official_api import sync_all_official_keys
from app.services.scraper import (
    scrape_groq_account, 
    scrape_render_account,
    scrape_openai_account,
    scrape_anthropic_account,
    scrape_gemini_account,
    scrape_elevenlabs_account
)

logger = logging.getLogger("dashboard.scheduler")

scheduler = AsyncIOScheduler()

async def scrape_all_accounts():
    """Background task to scrape all automated provider accounts."""
    logger.info("Starting scheduled scraping of all automated provider accounts...")
    services = ["groq", "render", "openai", "anthropic", "gemini", "elevenlabs"]
    for service in services:
        try:
            logger.info(f"Triggering scheduled scraper for {service.upper()}...")
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
        except Exception as e:
            logger.error(f"Scheduled {service.upper()} scrape failed: {e}")

def start_scheduler():
    """Configures and starts the background task scheduler."""
    if scheduler.running:
        logger.warning("Scheduler is already running.")
        return

    logger.info("Initializing task scheduler triggers...")
    
    # 1. URL Health Checker: Run every 5 minutes
    scheduler.add_job(
        run_all_health_checks,
        trigger=IntervalTrigger(minutes=5),
        id="url_health_checks",
        name="URL Health Checking (Every 5m)",
        replace_existing=True
    )
    
    # 2. Official API Sync: Run every 1 hour
    scheduler.add_job(
        sync_all_official_keys,
        trigger=IntervalTrigger(hours=1),
        id="official_api_sync",
        name="Official API Key Sync (Every 1h)",
        replace_existing=True
    )
    
    # 3. Playwright Account Scraper: Run every 4 hours
    scheduler.add_job(
        scrape_all_accounts,
        trigger=IntervalTrigger(hours=4),
        id="account_scraping",
        name="OAuth Account Scraping (Every 4h)",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started successfully in the background.")

def stop_scheduler():
    """Stops the background task scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped.")
