from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from app.db import db
from app.auth_utils import verify_password
from app.auth import create_access_token, get_current_admin, log_audit_action

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username: str = Field(..., description="Administrator username")
    password: str = Field(..., description="Administrator password")

class AdminProfileResponse(BaseModel):
    username: str
    role: str

@router.post("/login")
async def login(
    response: Response,
    request: Request,
    data: LoginRequest
):
    """
    Authenticate administrator credentials and issue a JWT token.
    Stores the token in a secure, HTTP-only cookie and returns it in JSON body.
    """
    username = data.username.strip()
    password = data.password
    
    admin_user = await db.users.find_one({"username": username})
    
    if not admin_user or not verify_password(password, admin_user["password_hash"]):
        await log_audit_action("login_failed", f"Failed login attempt for user '{username}'", request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate token
    access_token = create_access_token(data={"sub": username})
    
    # Store token in cookie (Secure, HTTP-only, SameSite=Lax for robust CSRF safety)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=3600 * 24, # 24 hours
        expires=3600 * 24,
        samesite="lax",
        secure=False # Set to True in HTTPS production environments
    )
    
    await log_audit_action("login_success", f"Administrator '{username}' logged in successfully.", request)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": username,
        "role": admin_user["role"]
    }

@router.post("/logout")
async def logout(
    response: Response,
    request: Request,
    admin: dict = Depends(get_current_admin)
):
    """Logs out the administrator by clearing session cookies."""
    response.delete_cookie("access_token")
    await log_audit_action("logout", f"Administrator '{admin['username']}' logged out.", request)
    return {"message": "Successfully logged out."}

@router.get("/me", response_model=AdminProfileResponse)
async def get_profile(admin: dict = Depends(get_current_admin)):
    """Fetch profile information for the authenticated administrator."""
    return AdminProfileResponse(
        username=admin["username"],
        role=admin["role"]
    )
