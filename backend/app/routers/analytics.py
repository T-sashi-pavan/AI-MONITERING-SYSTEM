from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from bson import ObjectId

from app.db import db
from app.auth import get_current_admin, log_audit_action

router = APIRouter(prefix="/api/analytics", tags=["Dashboard Analytics"])

# Schemas
class AnalyticsSummary(BaseModel):
    total_services: int
    active_services: int
    failed_services: int
    avg_response_time_ms: float
    success_rate_pct: float

class AlertResponse(BaseModel):
    id: str
    type: str
    service_name: str
    message: str
    severity: str
    is_resolved: bool
    created_at: datetime
    resolved_at: Optional[datetime] = None

class ActivityLogResponse(BaseModel):
    action: str
    details: str
    ip_address: str
    timestamp: datetime

@router.get("/summary", response_model=AnalyticsSummary)
async def get_summary_statistics(admin: dict = Depends(get_current_admin)):
    """Computes global aggregated health metrics for the dashboard."""
    # Count official key services
    keys_active = await db.api_monitoring.count_documents({"status": "active", "is_enabled": True})
    keys_total = await db.api_monitoring.count_documents({})
    
    # Count service health URLs
    url_total = await db.service_urls.count_documents({"is_enabled": True})
    url_failed = await db.service_urls.count_documents({"status": "down", "is_enabled": True})
    url_active = url_total - url_failed
    
    total_services = keys_total + url_total
    
    # Compute active vs failed services
    active_services = keys_active + url_active
    # Keys with 'invalid' or 'rate_limited' or URL Down are considered failed
    keys_failed = await db.api_monitoring.count_documents({"status": {"$in": ["invalid", "rate_limited"]}, "is_enabled": True})
    failed_services = keys_failed + url_failed

    # Calculate average response time across active URLs
    avg_latency = 0.0
    pipeline = [
        {"$match": {"is_enabled": True, "response_time_ms": {"$gt": 0}}},
        {"$group": {"_id": None, "avg_time": {"$avg": "$response_time_ms"}}}
    ]
    cursor = db.service_urls.aggregate(pipeline)
    async for result in cursor:
        if result and result.get("avg_time"):
            avg_latency = round(result["avg_time"], 2)

    # Compute overall monitoring success rate (based on health checks from last 24h)
    success_rate = 100.0
    past_24h = datetime.utcnow() - timedelta(hours=24)
    total_checks = await db.health_checks.count_documents({"checked_at": {"$gte": past_24h}})
    if total_checks > 0:
        up_checks = await db.health_checks.count_documents({
            "checked_at": {"$gte": past_24h},
            "is_up": True
        })
        success_rate = round((up_checks / total_checks) * 100.0, 2)

    return AnalyticsSummary(
        total_services=total_services,
        active_services=active_services,
        failed_services=failed_services,
        avg_response_time_ms=avg_latency,
        success_rate_pct=success_rate
    )

@router.get("/alerts", response_model=List[AlertResponse])
async def list_alerts(
    unresolved_only: bool = Query(True),
    limit: int = Query(30, ge=1, le=100),
    admin: dict = Depends(get_current_admin)
):
    """Retrieve chronological notifications and critical alerts list."""
    query = {}
    if unresolved_only:
        query["is_resolved"] = False
        
    alerts = []
    cursor = db.alerts.find(query).sort("created_at", -1).limit(limit)
    async for doc in cursor:
        alerts.append(AlertResponse(
            id=str(doc["_id"]),
            type=doc["type"],
            service_name=doc["service_name"],
            message=doc["message"],
            severity=doc.get("severity", "warning"),
            is_resolved=doc.get("is_resolved", False),
            created_at=doc["created_at"],
            resolved_at=doc.get("resolved_at")
        ))
    return alerts

@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Mark a critical alert as manually resolved."""
    if not ObjectId.is_valid(alert_id):
        raise HTTPException(status_code=400, detail="Invalid alert ID.")
        
    res = await db.alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {"$set": {"is_resolved": True, "resolved_at": datetime.utcnow()}}
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved.")
        
    await log_audit_action("resolve_alert", f"Manually resolved alert ID {alert_id}")
    return {"message": "Alert marked as resolved."}

@router.get("/activity", response_model=List[ActivityLogResponse])
async def list_activity_logs(
    limit: int = Query(25, ge=5, le=100),
    admin: dict = Depends(get_current_admin)
):
    """Fetch recent administrator audit logs representing changes and activity."""
    logs = []
    cursor = db.audit_logs.find({}).sort("timestamp", -1).limit(limit)
    async for doc in cursor:
        logs.append(ActivityLogResponse(
            action=doc["action"],
            details=doc["details"],
            ip_address=doc.get("ip_address", "127.0.0.1"),
            timestamp=doc["timestamp"]
        ))
    return logs
