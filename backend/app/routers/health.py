from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from bson import ObjectId

from app.db import db
from app.auth import get_current_admin, log_audit_action
from app.services.health_checker import check_service_health

router = APIRouter(prefix="/api/health", tags=["Service Health Monitoring"])

# Schemas
class ServiceURLCreate(BaseModel):
    name: str = Field(..., description="Service name/label")
    url: str = Field(..., description="Target service URL (starts with http/https)")
    is_enabled: bool = Field(True, description="Enable automatic checks")

class ServiceURLUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    is_enabled: Optional[bool] = None

class ServiceURLResponse(BaseModel):
    id: str
    name: str
    url: str
    is_enabled: bool
    status: str
    response_time_ms: float
    uptime_percentage: float
    last_successful_check: Optional[datetime] = None
    last_check_time: Optional[datetime] = None
    failure_count: int
    discovered_from: Optional[str] = None
    render_status: Optional[str] = None

class HealthCheckHistoryPoint(BaseModel):
    status_code: int
    response_time_ms: float
    is_up: bool
    checked_at: datetime

@router.get("", response_model=List[ServiceURLResponse])
async def list_services(
    discovered_only: bool = Query(False, description="List only auto-discovered disabled URLs"),
    admin: dict = Depends(get_current_admin)
):
    """Retrieve all monitored service URLs and auto-discovered targets."""
    query = {}
    if discovered_only:
        # Service URLs found by Render scraping that are not yet manually enabled
        query["discovered_from"] = {"$exists": True}
        query["is_enabled"] = False
    
    services = []
    cursor = db.service_urls.find(query).sort("created_at", -1)
    async for doc in cursor:
        services.append(ServiceURLResponse(
            id=str(doc["_id"]),
            name=doc["name"],
            url=doc["url"],
            is_enabled=doc.get("is_enabled", True),
            status=doc.get("status", "unknown"),
            response_time_ms=doc.get("response_time_ms", 0.0),
            uptime_percentage=doc.get("uptime_percentage", 100.0),
            last_successful_check=doc.get("last_successful_check"),
            last_check_time=doc.get("last_check_time"),
            failure_count=doc.get("failure_count", 0),
            discovered_from=doc.get("discovered_from"),
            render_status=doc.get("render_status")
        ))
    return services

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service_url(
    data: ServiceURLCreate,
    admin: dict = Depends(get_current_admin)
):
    """Add a new service URL target to monitor."""
    existing = await db.service_urls.find_one({"url": data.url})
    if existing:
        # If it was already discovered but disabled, enable it!
        if not existing.get("is_enabled", False) and existing.get("discovered_from"):
            await db.service_urls.update_one(
                {"_id": existing["_id"]},
                {"$set": {"is_enabled": True, "name": data.name}}
            )
            
            # Trigger first check immediately in background
            try:
                await check_service_health(existing)
            except Exception:
                pass
                
            return {"id": str(existing["_id"]), "message": "Discovered URL was successfully activated."}
            
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A service monitoring configuration for this URL already exists."
        )

    new_doc = {
        "name": data.name,
        "url": data.url,
        "is_enabled": data.is_enabled,
        "status": "unknown",
        "response_time_ms": 0.0,
        "uptime_percentage": 100.0,
        "failure_count": 0,
        "created_at": datetime.utcnow(),
        "last_successful_check": None,
        "last_check_time": None
    }
    
    res = await db.service_urls.insert_one(new_doc)
    doc_id = str(res.inserted_id)
    
    # Run immediate check
    inserted_doc = await db.service_urls.find_one({"_id": res.inserted_id})
    try:
        await check_service_health(inserted_doc)
    except Exception as e:
        print(f"Failed initial health check: {e}")

    await log_audit_action("create_service_url", f"Added service health checking for '{data.name}' ({data.url})")
    return {"id": doc_id, "message": "Service URL successfully registered for monitoring."}

@router.put("/{url_id}")
async def update_service_url(
    url_id: str,
    data: ServiceURLUpdate,
    admin: dict = Depends(get_current_admin)
):
    """Update URL configuration parameters (e.g. toggle enabled state)."""
    if not ObjectId.is_valid(url_id):
        raise HTTPException(status_code=400, detail="Invalid service URL ID.")

    existing = await db.service_urls.find_one({"_id": ObjectId(url_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Service URL monitoring entry not found.")

    update_fields = {}
    update_data = data.dict(exclude_unset=True)
    
    for field in ["name", "url", "is_enabled"]:
        if field in update_data:
            update_fields[field] = update_data[field]

    if update_fields:
        await db.service_urls.update_one({"_id": ObjectId(url_id)}, {"$set": update_fields})
        
        # Trigger immediate health check if newly enabled
        if update_fields.get("is_enabled", False):
            updated = await db.service_urls.find_one({"_id": ObjectId(url_id)})
            try:
                await check_service_health(updated)
            except Exception:
                pass

        await log_audit_action("update_service_url", f"Updated monitoring configurations for service '{existing['name']}'")
        
    return {"message": "Service URL configuration updated successfully."}

@router.delete("/{url_id}")
async def delete_service_url(
    url_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Delete a service URL target and purge its checking history."""
    if not ObjectId.is_valid(url_id):
        raise HTTPException(status_code=400, detail="Invalid service URL ID.")

    existing = await db.service_urls.find_one({"_id": ObjectId(url_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Service URL monitoring entry not found.")

    # Remove the target and its check history logs
    await db.service_urls.delete_one({"_id": ObjectId(url_id)})
    await db.health_checks.delete_many({"service_url_id": ObjectId(url_id)})
    
    # Clean up corresponding unresolved service down alerts
    await db.alerts.delete_many({"service_name": existing["name"], "type": "service_down"})

    await log_audit_action("delete_service_url", f"Removed service health checking for '{existing['name']}' ({existing['url']})")
    return {"message": "Service URL successfully removed and history purged."}

@router.post("/{url_id}/check")
async def force_check_service(
    url_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Trigger an immediate, on-demand health check for this URL."""
    if not ObjectId.is_valid(url_id):
        raise HTTPException(status_code=400, detail="Invalid service URL ID.")

    doc = await db.service_urls.find_one({"_id": ObjectId(url_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Service URL monitoring entry not found.")

    await check_service_health(doc)
    
    updated_doc = await db.service_urls.find_one({"_id": ObjectId(url_id)})
    return {
        "status": updated_doc.get("status"),
        "response_time_ms": updated_doc.get("response_time_ms"),
        "uptime_percentage": updated_doc.get("uptime_percentage"),
        "failure_count": updated_doc.get("failure_count")
    }

@router.get("/{url_id}/history", response_model=List[HealthCheckHistoryPoint])
async def get_check_history(
    url_id: str,
    limit: int = Query(50, ge=5, le=200),
    admin: dict = Depends(get_current_admin)
):
    """Fetch chronological health check data points for charting response latency."""
    if not ObjectId.is_valid(url_id):
        raise HTTPException(status_code=400, detail="Invalid service URL ID.")

    history = []
    cursor = db.health_checks.find({"service_url_id": ObjectId(url_id)}).sort("checked_at", -1).limit(limit)
    async for h_doc in cursor:
        history.append(HealthCheckHistoryPoint(
            status_code=h_doc["status_code"],
            response_time_ms=h_doc["response_time_ms"],
            is_up=h_doc.get("is_up", True),
            checked_at=h_doc["checked_at"]
        ))
        
    # Return chronologically (oldest to newest) for charting
    history.reverse()
    return history

@router.post("/render/trigger")
async def trigger_render_keep_warm(
    admin: dict = Depends(get_current_admin)
):
    """
    Executes concurrent keep-warm triggers/pings on all enabled Render service URLs.
    Specifically designed for Method 3's keep-warm link triggering system.
    """
    cursor = db.service_urls.find({"discovered_from": "render", "is_enabled": True})
    targets = []
    async for doc in cursor:
        targets.append(doc)
        
    if not targets:
        return {"message": "No active Render services are currently configured for keep-warm triggering."}
        
    # Execute checks in parallel
    import asyncio
    await asyncio.gather(*(check_service_health(t) for t in targets))
    
    # Reload and map outputs
    results = []
    for t in targets:
        updated = await db.service_urls.find_one({"_id": t["_id"]})
        results.append({
            "name": updated["name"],
            "url": updated["url"],
            "status": updated.get("status"),
            "latency_ms": updated.get("response_time_ms")
        })
        
    await log_audit_action("render_keep_warm_trigger", f"Executed keep-warm trigger ping on {len(targets)} Render service URLs.")
    
    return {
        "message": f"Successfully triggered {len(targets)} keep-warm service URLs.",
        "results": results
    }

