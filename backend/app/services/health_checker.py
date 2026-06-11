import httpx
import logging
import asyncio
from datetime import datetime
from bson import ObjectId
from app.db import db

logger = logging.getLogger("dashboard.health_checker")

async def run_all_health_checks():
    """Runs parallel health checks for all enabled service URLs in the database."""
    logger.info("Initializing periodic health checks...")
    cursor = db.service_urls.find({"is_enabled": True})
    
    tasks = []
    async for service in cursor:
        tasks.append(check_service_health(service))
        
    if tasks:
        await asyncio.gather(*tasks)
        logger.info(f"Completed {len(tasks)} health checks.")
    else:
        logger.info("No active service URLs configured for monitoring.")

async def check_service_health(service_doc: dict):
    """
    Asynchronously checks a single URL, updates the health_checks history,
    computes rolling uptime percentage, and handles alerts on transitions.
    """
    service_id = service_doc["_id"]
    name = service_doc["name"]
    url = service_doc["url"]
    
    status_code = 0
    response_time_ms = 0.0
    is_up = False
    error_message = None
    
    start_time = datetime.utcnow()
    
    # Run async HTTP request
    async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            end_time = datetime.utcnow()
            response_time_ms = (end_time - start_time).total_seconds() * 1000.0
            status_code = resp.status_code
            
            # Deemed UP if status code is in the 2xx or 3xx range
            if 200 <= status_code < 400:
                is_up = True
            else:
                error_message = f"HTTP {status_code}: {resp.reason_phrase}"
        except httpx.RequestError as exc:
            end_time = datetime.utcnow()
            response_time_ms = (end_time - start_time).total_seconds() * 1000.0
            error_message = f"Network Request Error: {str(exc)}"
            
    # Record check history in MongoDB
    check_doc = {
        "service_url_id": service_id,
        "status_code": status_code,
        "response_time_ms": round(response_time_ms, 2),
        "is_up": is_up,
        "error_message": error_message,
        "checked_at": datetime.utcnow()
    }
    await db.health_checks.insert_one(check_doc)
    
    # Calculate rolling uptime based on the last 100 health checks
    history_cursor = db.health_checks.find({"service_url_id": service_id}).sort("checked_at", -1).limit(100)
    up_count = 0
    total_checks = 0
    async for h_doc in history_cursor:
        total_checks += 1
        if h_doc.get("is_up", True):
            up_count += 1
            
    uptime_pct = round((up_count / total_checks) * 100.0, 2) if total_checks > 0 else 100.0
    
    # Determine new failure and success tallies
    current_failure_count = service_doc.get("failure_count", 0)
    new_failure_count = 0 if is_up else (current_failure_count + 1)
    
    update_fields = {
        "status": "up" if is_up else "down",
        "response_time_ms": round(response_time_ms, 2),
        "uptime_percentage": uptime_pct,
        "failure_count": new_failure_count,
        "last_check_time": datetime.utcnow()
    }
    
    if is_up:
        update_fields["last_successful_check"] = datetime.utcnow()
        
    # Commit URL status updates
    await db.service_urls.update_one({"_id": service_id}, {"$set": update_fields})
    
    # ALERT LOGIC: Trigger an alert if state transitions or reaches failure threshold
    # 1. Transitions from UP to DOWN: Trigger instant warning
    # 2. Reaches 3 consecutive failures: Trigger CRITICAL alert (Repeated Failures)
    # 3. Transitions from DOWN to UP: Auto-resolve open alerts
    if not is_up:
        logger.warning(f"Service '{name}' ({url}) is DOWN: {error_message}")
        
        # Determine severity and trigger alerts
        severity = "critical" if new_failure_count >= 3 else "warning"
        alert_msg = f"Service '{name}' ({url}) is down. Status: {error_message or 'Timeout'}. Consecutive failures: {new_failure_count}."
        
        # Check if an unresolved alert already exists for this service URL
        existing_alert = await db.alerts.find_one({
            "service_name": name,
            "type": "service_down",
            "is_resolved": False
        })
        
        if not existing_alert:
            await db.alerts.insert_one({
                "type": "service_down",
                "service_name": name,
                "message": alert_msg,
                "severity": severity,
                "is_resolved": False,
                "created_at": datetime.utcnow()
            })
            
            # Send notification via background email
            try:
                from app.services.notifier import send_service_alert_email
                asyncio.create_task(send_service_alert_email(name, url, alert_msg, severity))
            except Exception as e:
                logger.error(f"Failed to trigger email notification dispatch: {str(e)}")
        else:
            # Update existing alert severity if upgraded to critical
            if severity == "critical" and existing_alert.get("severity") != "critical":
                await db.alerts.update_one(
                    {"_id": existing_alert["_id"]},
                    {"$set": {"severity": "critical", "message": alert_msg}}
                )
                try:
                    from app.services.notifier import send_service_alert_email
                    asyncio.create_task(send_service_alert_email(name, url, alert_msg, "critical"))
                except Exception as e:
                    logger.error(f"Failed to dispatch upgraded email: {str(e)}")
                    
    else:
        # If transitioning back to UP, resolve any open down alerts
        if current_failure_count > 0:
            logger.info(f"Service '{name}' has recovered and is now UP.")
            
            # Mark matching unresolved alerts as resolved
            await db.alerts.update_many(
                {"service_name": name, "type": "service_down", "is_resolved": False},
                {"$set": {"is_resolved": True, "resolved_at": datetime.utcnow()}}
            )
            
            # Send recovery email
            try:
                from app.services.notifier import send_service_recovery_email
                asyncio.create_task(send_service_recovery_email(name, url))
            except Exception as e:
                logger.error(f"Failed to send recovery email: {str(e)}")
