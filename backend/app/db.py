import logging
import asyncio
from datetime import datetime
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.auth_utils import hash_password, verify_password

logger = logging.getLogger("dashboard.db")

class Database:
    def __init__(self):
        self._dbs = {}  # loop -> database_instance
        self._main_client = None
        self._main_db = None

    def connect(self):
        """Initialize connection to MongoDB Atlas."""
        logger.info("Connecting to MongoDB Atlas...")
        self._main_client = AsyncIOMotorClient(settings.MONGODB_URI)
        db_name = settings.MONGODB_URI.split("/")[-1].split("?")[0]
        if not db_name:
            db_name = "secretary_dashboard"
        self._main_db = self._main_client[db_name]
        logger.info(f"Connected to database: {db_name}")

    def _get_db(self):
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return self._main_db
            
        if loop not in self._dbs:
            logger.info(f"Initializing loop-local Motor database client for event loop {id(loop)}...")
            client = AsyncIOMotorClient(settings.MONGODB_URI)
            db_name = settings.MONGODB_URI.split("/")[-1].split("?")[0]
            if not db_name:
                db_name = "secretary_dashboard"
            self._dbs[loop] = client[db_name]
        return self._dbs[loop]

    @property
    def client(self):
        try:
            loop = asyncio.get_running_loop()
            return self._get_db().client
        except RuntimeError:
            return self._main_client

    @property
    def db(self):
        return self._get_db()

    @property
    def users(self):
        return self._get_db()["users"]

    @property
    def api_monitoring(self):
        return self._get_db()["api_monitoring"]

    @property
    def scraping_logs(self):
        return self._get_db()["scraping_logs"]

    @property
    def service_urls(self):
        return self._get_db()["service_urls"]

    @property
    def health_checks(self):
        return self._get_db()["health_checks"]

    @property
    def alerts(self):
        return self._get_db()["alerts"]

    @property
    def audit_logs(self):
        return self._get_db()["audit_logs"]

    @property
    def settings(self):
        return self._get_db()["settings"]

    @property
    def oauth_sessions(self):
        return self._get_db()["oauth_sessions"]


    async def ensure_indexes_and_seed(self):
        """Ensure indexes exist and seed the default admin account."""
        if self.db is None:
            raise RuntimeError("Database not initialized. Call connect() first.")
        
        try:
            # Users Index
            await self.users.create_index("username", unique=True)
            
            # API Monitoring Index
            await self.api_monitoring.create_index([("service_name", 1), ("provider_name", 1)], unique=True)
            
            # Service URLs Index
            await self.service_urls.create_index("url", unique=True)
            
            # OAuth Sessions Index
            await self.oauth_sessions.create_index("service", unique=True)
            
            # Settings Index
            await self.settings.create_index("key", unique=True)
            
            # Health Checks Index (for fast queries)
            await self.health_checks.create_index([("service_url_id", 1), ("checked_at", -1)])
            
            # Alerts Index
            await self.alerts.create_index([("created_at", -1)])
            
            logger.info("Database indices verified.")

            # Seed admin user
            admin_user = await self.users.find_one({"username": settings.ADMIN_USERNAME})
            if not admin_user:
                logger.info(f"Seeding default admin user: {settings.ADMIN_USERNAME}")
                hashed_pw = hash_password(settings.ADMIN_PASSWORD)
                await self.users.insert_one({
                    "username": settings.ADMIN_USERNAME,
                    "password_hash": hashed_pw,
                    "role": "admin",
                    "created_at": datetime.utcnow()
                })
                # Write an initial audit log
                await self.audit_logs.insert_one({
                    "action": "system_startup",
                    "details": f"Default admin user '{settings.ADMIN_USERNAME}' seeded successfully.",
                    "ip_address": "127.0.0.1",
                    "timestamp": datetime.utcnow()
                })
            else:
                # Optionally update admin password if it changed in config
                if not verify_password(settings.ADMIN_PASSWORD, admin_user["password_hash"]):
                    logger.info("Admin password in config differs from DB. Updating DB password.")
                    hashed_pw = hash_password(settings.ADMIN_PASSWORD)
                    await self.users.update_one(
                        {"username": settings.ADMIN_USERNAME},
                        {"$set": {"password_hash": hashed_pw}}
                    )

        except Exception as e:
            logger.error(f"Failed to create indices or seed database: {str(e)}")

# Global database instance
db = Database()
