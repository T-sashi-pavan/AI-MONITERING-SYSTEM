import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from cryptography.fernet import Fernet

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    MONGODB_URI: str
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]

    # Automated OAuth Authentication Credentials
    GOOGLE_EMAIL: Optional[str] = None
    GOOGLE_PASSWORD: Optional[str] = None
    GITHUB_EMAIL: Optional[str] = None
    GITHUB_PASSWORD: Optional[str] = None
    HEADLESS: bool = False

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v):
        if isinstance(v, str):
            import json
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    MY_OAUTH_MAIL: str = "SESSI111111@GMAIL.COM"
    
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "secretary"
    
    JWT_SECRET_KEY: str = "9f8e7d6c5b4a3a2a1a0a9f8e7d6c5b4a3a2a1a0a9f8e7d6c5b4a3a2a1a0a9f8e"
    ENCRYPTION_SECRET: str = ""
    SESSION_SECRET: str = "session_secret_key_123456_change_me"

    # Platform Admin Keys (read from .env — no browser login required for these platforms)
    OPENAI_ADMIN_KEY: str = ""
    RENDER_API_KEY: str = ""
    ELEVENLABS_ADMIN_KEY: str = ""    # Will be set when madam provides her service-settings key

    # Twilio credentials (Account SID + Auth Token from console.twilio.com)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""

    # Convex Personal Access Token (from dashboard.convex.dev → Team Settings → Access Tokens)
    CONVEX_ACCESS_TOKEN: str = ""
    
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""
    SMTP_FROM: str = ""

    PROVIDER_ROUTES: dict = {
        "groq": {
            "name": "Groq",
            "domain": "console.groq.com",
            "monitoring_pages": [
                "https://console.groq.com/keys",
                "https://console.groq.com/dashboard/metrics",
                "https://console.groq.com/dashboard/usage",
                "https://console.groq.com/dashboard/limits"
            ],
            "selectors": {
                "keys_table": "table tbody tr",
                "spend": r"Total Spend\s*(\$[0-9,.]+)"
            }
        },
        "openai": {
            "name": "OpenAI",
            "domain": "platform.openai.com",
            "monitoring_pages": [
                "https://platform.openai.com/api-keys",
                "https://platform.openai.com/usage"
            ],
            "selectors": {
                "keys_table": "tr, [role='row']",
                "spend": r"Usage this month\s*(\$[0-9,.]+)",
                "limit": r"limit\s*(\$[0-9,.]+)"
            }
        },
        "elevenlabs": {
            "name": "ElevenLabs",
            "domain": "elevenlabs.io",
            "monitoring_pages": [
                "https://elevenlabs.io/app/developers/api-keys",
                "https://elevenlabs.io/app/subscription/creative"
            ],
            "selectors": {
                "keys_table": "tr, [role='row']"
            }
        },
        "gemini": {
            "name": "Google AI Studio",
            "domain": "aistudio.google.com",
            "monitoring_pages": [
                "https://aistudio.google.com/app/api-keys",
                "https://aistudio.google.com/app/usage?timeRange=last-90-days",
                "https://aistudio.google.com/app/rate-limit?timeRange=last-90-days",
                "https://aistudio.google.com/app/billing"
            ],
            "selectors": {
                "keys_table": "tr, [role='row']",
                "spend": r"total spend\s*(\$[0-9,.]+)"
            }
        },
        "render": {
            "name": "Render",
            "domain": "dashboard.render.com",
            "monitoring_pages": [
                "https://dashboard.render.com/"
            ],
            "selectors": {
                "services": "a[href*='/srv/'], a[href*='/web/'], a[href*='/dbs/']",
                "onrender_urls": "a[href*='.onrender.com']"
            }
        },
        "anthropic": {
            "name": "Anthropic Claude",
            "domain": "console.anthropic.com",
            "monitoring_pages": [
                "https://console.anthropic.com/settings/keys",
                "https://console.anthropic.com/settings/usage",
                "https://console.anthropic.com/settings/limits",
                "https://console.anthropic.com/settings/billing"
            ],
            "selectors": {
                "keys_table": "tr, [role='row']",
                "spend": r"spend\s*(\$[0-9,.]+)"
            }
        },
        "twilio": {
            "name": "Twilio",
            "domain": "console.twilio.com",
            "monitoring_pages": [
                "https://console.twilio.com/"
            ],
            "selectors": {}
        },
        "convex": {
            "name": "Convex",
            "domain": "dashboard.convex.dev",
            "monitoring_pages": [
                "https://dashboard.convex.dev/"
            ],
            "selectors": {}
        }
    }

    def get_encryption_key(self) -> bytes:
        """
        Returns a valid 32-byte base64 encoded Fernet key.
        If ENCRYPTION_SECRET is invalid or empty, generates a new one.
        """
        secret = self.ENCRYPTION_SECRET.strip()
        if not secret:
            # Fallback to a stable hash of MONGODB_URI or a generated one
            # For robustness, let's generate a key and save it in-memory or try to make it stable.
            # To ensure it is stable during server lifecycle, we check if we generated one already.
            if not hasattr(self, "_generated_encryption_secret"):
                self._generated_encryption_secret = Fernet.generate_key().decode()
            secret = self._generated_encryption_secret
        
        try:
            # Verify if it's a valid Fernet key
            Fernet(secret.encode())
            return secret.encode()
        except Exception:
            # If invalid format, generate a new one
            if not hasattr(self, "_generated_encryption_secret"):
                self._generated_encryption_secret = Fernet.generate_key().decode()
            return self._generated_encryption_secret.encode()

# Global settings instance
settings = Settings()
