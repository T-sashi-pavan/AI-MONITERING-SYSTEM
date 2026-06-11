import io
import pandas as pd
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from fastapi.responses import StreamingResponse
from bson import ObjectId
from pydantic import BaseModel, Field

from app.db import db
from app.auth import get_current_admin, log_audit_action
from app.encryption import encrypt_value, decrypt_value
from app.services.official_api import sync_single_key, save_admin_key, get_admin_key_status

router = APIRouter(prefix="/api/keys", tags=["Official API Keys"])

# Schemas
class APIKeyCreate(BaseModel):
    service_name: str = Field(..., description="Service name (e.g. OpenAI, Anthropic, Groq)")
    provider_name: str = Field(..., description="Provider or account identifier")
    api_key: str = Field(..., description="The raw API key")
    total_quota: float = Field(100.0, description="Total quota assigned (e.g. USD)")
    used_quota: float = Field(0.0, description="Known used quota")
    custom_ping_url: Optional[str] = Field(None, description="Custom ping URL for generic keys")
    is_enabled: bool = Field(True, description="Enable periodic checking")

class APIKeyUpdate(BaseModel):
    service_name: Optional[str] = None
    provider_name: Optional[str] = None
    api_key: Optional[str] = None
    total_quota: Optional[float] = None
    used_quota: Optional[float] = None
    custom_ping_url: Optional[str] = None
    is_enabled: Optional[bool] = None

class APIKeyResponse(BaseModel):
    id: str
    service_name: str
    provider_name: str
    masked_key: str
    status: str
    usage_info: dict
    rate_limits: dict
    is_enabled: bool
    last_sync_time: Optional[datetime] = None
    error_message: Optional[str] = None
    custom_ping_url: Optional[str] = None
    balance: float = 0.0
    created_at_time: Optional[datetime] = None
    expiry_time: Optional[datetime] = None
    last_used_time: Optional[datetime] = None
    daily_usage_logs: Optional[List[dict]] = None
    hourly_usage_logs: Optional[List[dict]] = None

def mask_key(raw_key: str) -> str:
    """Masks keys for safety before sending to client."""
    if len(raw_key) <= 10:
        return "****"
    return f"{raw_key[:6]}...{raw_key[-4:]}"

@router.get("", response_model=List[APIKeyResponse])
async def list_keys(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    admin: dict = Depends(get_current_admin)
):
    """List all official API keys with optional search and status filtering."""
    query = {}
    if search:
        query["$or"] = [
            {"service_name": {"$regex": search, "$options": "i"}},
            {"provider_name": {"$regex": search, "$options": "i"}}
        ]
    if status_filter:
        query["status"] = status_filter

    keys = []
    cursor = db.api_monitoring.find(query)
    async for doc in cursor:
        raw_key = decrypt_value(doc["api_key"])
        keys.append(APIKeyResponse(
            id=str(doc["_id"]),
            service_name=doc["service_name"],
            provider_name=doc["provider_name"],
            masked_key=mask_key(raw_key),
            status=doc.get("status", "unknown"),
            usage_info=doc.get("usage_info", {"used": 0, "total": doc.get("total_quota", 100), "remaining": doc.get("total_quota", 100)}),
            rate_limits=doc.get("rate_limits", {}),
            is_enabled=doc.get("is_enabled", True),
            last_sync_time=doc.get("last_sync_time"),
            error_message=doc.get("error_message"),
            custom_ping_url=doc.get("custom_ping_url"),
            balance=doc.get("balance", 0.0),
            created_at_time=doc.get("created_at_time"),
            expiry_time=doc.get("expiry_time"),
            last_used_time=doc.get("last_used_time"),
            daily_usage_logs=doc.get("daily_usage_logs"),
            hourly_usage_logs=doc.get("hourly_usage_logs")
        ))
    return keys

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_key(
    data: APIKeyCreate,
    admin: dict = Depends(get_current_admin)
):
    """Add a new API key to be monitored."""
    # Normalize service name
    service_name_input = data.service_name.strip()
    service_name_lower = service_name_input.lower()
    
    if service_name_lower == "groq":
        service_name_fixed = "Groq"
    elif service_name_lower == "openai":
        service_name_fixed = "OpenAI"
    elif service_name_lower == "anthropic" or service_name_lower == "claude":
        service_name_fixed = "Anthropic"
    elif service_name_lower == "gemini":
        service_name_fixed = "Gemini"
    elif service_name_lower == "elevenlabs":
        service_name_fixed = "ElevenLabs"
    else:
        service_name_fixed = service_name_input.title()
    
    existing = await db.api_monitoring.find_one({
        "service_name": service_name_fixed,
        "provider_name": data.provider_name
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A {service_name_fixed} key with this account label already exists."
        )

    encrypted = encrypt_value(data.api_key)
    
    new_doc = {
        "service_name": service_name_fixed,
        "provider_name": data.provider_name,
        "api_key": encrypted,
        "total_quota": data.total_quota,
        "used_quota": data.used_quota,
        "custom_ping_url": data.custom_ping_url,
        "is_enabled": data.is_enabled,
        "status": "unknown",
        "usage_info": {
            "used": data.used_quota,
            "total": data.total_quota,
            "remaining": max(0.0, data.total_quota - data.used_quota)
        },
        "rate_limits": {},
        "created_at": datetime.utcnow(),
        "last_sync_time": None
    }
    
    res = await db.api_monitoring.insert_one(new_doc)
    doc_id = str(res.inserted_id)
    
    # Run an initial sync immediately in the background
    inserted_doc = await db.api_monitoring.find_one({"_id": res.inserted_id})
    try:
        await sync_single_key(inserted_doc)
    except Exception as e:
        print(f"Failed initial sync: {e}")

    await log_audit_action("create_api_key", f"Created API key monitoring for {data.service_name} ({data.provider_name})")
    return {"id": doc_id, "message": "API key successfully registered for monitoring."}

@router.put("/{key_id}")
async def update_key(
    key_id: str,
    data: APIKeyUpdate,
    admin: dict = Depends(get_current_admin)
):
    """Update a monitored API key's parameters."""
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID.")

    existing = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="API key monitoring entry not found.")

    update_fields = {}
    update_data = data.dict(exclude_unset=True)

    if "api_key" in update_data:
        update_fields["api_key"] = encrypt_value(update_data["api_key"])
    
    for field in ["service_name", "provider_name", "total_quota", "used_quota", "custom_ping_url", "is_enabled"]:
        if field in update_data:
            update_fields[field] = update_data[field]

    # Recalculate usage_info remaining if quotas were updated
    if "total_quota" in update_fields or "used_quota" in update_fields:
        tq = update_fields.get("total_quota", existing.get("total_quota", 100.0))
        uq = update_fields.get("used_quota", existing.get("used_quota", 0.0))
        update_fields["usage_info"] = {
            "used": uq,
            "total": tq,
            "remaining": max(0.0, tq - uq)
        }

    if update_fields:
        await db.api_monitoring.update_one({"_id": ObjectId(key_id)}, {"$set": update_fields})
        
        # Trigger immediate sync
        updated_doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
        try:
            await sync_single_key(updated_doc)
        except Exception as e:
            print(f"Failed sync after update: {e}")
            
        await log_audit_action("update_api_key", f"Updated API key monitoring details for {existing['service_name']} ({existing['provider_name']})")
        
    return {"message": "API key monitoring details updated successfully."}

@router.delete("/{key_id}")
async def delete_key(
    key_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Remove an API key from monitoring list."""
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID.")

    existing = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="API key monitoring entry not found.")

    await db.api_monitoring.delete_one({"_id": ObjectId(key_id)})
    await log_audit_action("delete_api_key", f"Deleted API key monitoring for {existing['service_name']} ({existing['provider_name']})")
    
    return {"message": "API key successfully removed from monitoring."}

@router.post("/{key_id}/sync")
async def sync_key(
    key_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Force an on-demand sync of the selected API key."""
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID.")

    doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="API key monitoring entry not found.")

    await sync_single_key(doc)
    
    updated_doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    return {
        "status": updated_doc.get("status"),
        "usage_info": updated_doc.get("usage_info"),
        "balance": updated_doc.get("balance", 0.0),
        "created_at_time": updated_doc.get("created_at_time"),
        "expiry_time": updated_doc.get("expiry_time"),
        "last_used_time": updated_doc.get("last_used_time"),
        "daily_usage_logs": updated_doc.get("daily_usage_logs"),
        "hourly_usage_logs": updated_doc.get("hourly_usage_logs"),
        "rate_limits": updated_doc.get("rate_limits", {}),
        "last_sync_time": updated_doc.get("last_sync_time"),
        "error_message": updated_doc.get("error_message")
    }

# ---------------------------------------------------------------------------
# Admin key management endpoints
# ---------------------------------------------------------------------------

class AdminKeyPayload(BaseModel):
    admin_key: str = Field(..., description="The admin/organization API key")

@router.post("/{key_id}/admin-key")
async def set_admin_key(
    key_id: str,
    payload: AdminKeyPayload,
    admin: dict = Depends(get_current_admin)
):
    """
    Store an admin/organization API key for a service.
    Used by OpenAI (sk-admin-...) and Anthropic (sk-ant-admin-...) to unlock
    management endpoints: key listing, billing, usage breakdown.
    """
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID.")

    doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="API key monitoring entry not found.")

    result = await save_admin_key(doc["service_name"], payload.admin_key)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    # Trigger a fresh sync so the new admin key is used immediately
    updated_doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    try:
        await sync_single_key(updated_doc)
    except Exception as e:
        pass  # Non-fatal — sync will happen on next scheduler run

    await log_audit_action(
        "set_admin_key",
        f"Admin key set for {doc['service_name']} ({doc['provider_name']})"
    )
    return {"message": result["message"]}


@router.get("/{key_id}/admin-key-status")
async def check_admin_key_status(
    key_id: str,
    admin: dict = Depends(get_current_admin)
):
    """Check whether an admin key is set for the service (does NOT return the key)."""
    if not ObjectId.is_valid(key_id):
        raise HTTPException(status_code=400, detail="Invalid API key ID.")

    doc = await db.api_monitoring.find_one({"_id": ObjectId(key_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="API key monitoring entry not found.")

    return await get_admin_key_status(doc["service_name"])


# EXPORTS

async def generate_dataframe() -> pd.DataFrame:
    """Helper to fetch keys and generate a Pandas DataFrame."""
    data = []
    cursor = db.api_monitoring.find({})
    async for doc in cursor:
        raw_key = decrypt_value(doc["api_key"])
        masked = mask_key(raw_key)
        usage = doc.get("usage_info", {})
        data.append({
            "Service Name": doc["service_name"],
            "Provider": doc["provider_name"],
            "Masked Key": masked,
            "Status": doc.get("status", "unknown"),
            "Used Quota": usage.get("used", 0),
            "Total Quota": usage.get("total", 0),
            "Remaining Quota": usage.get("remaining", 0),
            "Enabled": doc.get("is_enabled", True),
            "Last Sync Time": doc.get("last_sync_time"),
            "Error Message": doc.get("error_message", "")
        })
    return pd.DataFrame(data)

@router.get("/export/csv")
async def export_csv(admin: dict = Depends(get_current_admin)):
    """Export API Key monitoring data as CSV."""
    df = await generate_dataframe()
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    response = StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=api_monitoring_keys.csv"
    return response

@router.get("/export/excel")
async def export_excel(admin: dict = Depends(get_current_admin)):
    """Export API Key monitoring data as Excel (XLSX)."""
    df = await generate_dataframe()
    output = io.BytesIO()
    # Write to excel using openpyxl engine
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="API Keys", index=False)
    
    response = Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response.headers["Content-Disposition"] = "attachment; filename=api_monitoring_keys.xlsx"
    return response
