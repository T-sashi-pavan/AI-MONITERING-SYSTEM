from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from app.config import settings
from app.db import db

# JWT Configurations
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

class OAuth2PasswordBearerWithCookie(OAuth2PasswordBearer):
    """
    Custom OAuth2 scheme that looks for the token in BOTH the 
    Authorization header and a secure cookie named 'access_token'.
    """
    async def __call__(self, request: Request) -> Optional[str]:
        # First check standard Authorization header
        try:
            return await super().__call__(request)
        except HTTPException as e:
            if e.status_code == status.HTTP_401_UNAUTHORIZED:
                # If header is missing, check cookie
                token = request.cookies.get("access_token")
                if token:
                    return token
            raise e

oauth2_scheme = OAuth2PasswordBearerWithCookie(tokenUrl="/api/auth/login", auto_error=False)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate a JWT access token containing admin credentials."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_admin(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme)
) -> dict:
    """
    Dependency injection to verify and return the currently logged-in administrator.
    Extracts from header or cookie, verifies JWT signature, and checks the database.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Fallback cookie check if tokenUrl auto_error is False
    if not token:
        token = request.cookies.get("access_token")
    
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    admin_user = await db.users.find_one({"username": username})
    if admin_user is None:
        raise credentials_exception
        
    return {
        "id": str(admin_user["_id"]),
        "username": admin_user["username"],
        "role": admin_user["role"]
    }

async def log_audit_action(action: str, details: str, request: Request = None):
    """Utility to log user actions to the audit_logs collection."""
    ip_address = "127.0.0.1"
    if request:
        # Resolve real client IP behind proxy if present
        ip_address = request.headers.get("x-forwarded-for") or request.client.host
        
    await db.audit_logs.insert_one({
        "action": action,
        "details": details,
        "ip_address": ip_address,
        "timestamp": datetime.utcnow()
    })
