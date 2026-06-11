import logging
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger("dashboard.encryption")

def get_fernet() -> Fernet:
    """Helper to get a Fernet instance with the configured key."""
    key = settings.get_encryption_key()
    return Fernet(key)

def encrypt_value(value: str) -> str:
    """Encrypts a string value into a base64 encoded token."""
    if not value:
        return ""
    fernet = get_fernet()
    return fernet.encrypt(value.encode()).decode()

def decrypt_value(token: str) -> str:
    """Decrypts a base64 encoded token back into a string."""
    if not token:
        return ""
    try:
        fernet = get_fernet()
        return fernet.decrypt(token.encode()).decode()
    except Exception as e:
        # Fallback or log if decryption fails
        logger.debug(f"Decryption failure: {str(e)}")
        return ""
