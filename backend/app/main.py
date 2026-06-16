import os
import sys
import logging
import asyncio

if sys.platform == 'win32':
    # Force ProactorEventLoop to prevent NotImplementedError when launching Playwright headed browser.
    # Uvicorn overrides policy to SelectorEventLoop on Windows, which doesn't support subprocesses.
    asyncio.WindowsSelectorEventLoopPolicy = asyncio.WindowsProactorEventLoopPolicy
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Fix passlib/bcrypt incompatibility issue where passlib reads __about__.__version__ which bcrypt 4.0.0+ does not have.
try:
    import bcrypt
    if not hasattr(bcrypt, "__about__"):
        class BcryptAbout:
            pass
        bcrypt.__about__ = BcryptAbout()
        bcrypt.__about__.__version__ = getattr(bcrypt, "__version__", "4.0.0")
except ImportError:
    pass



from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import db
from app.scheduler import start_scheduler, stop_scheduler
from app.services.health_checker import run_all_health_checks
from app.services.official_api import sync_all_official_keys, seed_env_admin_keys

# Routers
from app.routers.auth import router as auth_router
from app.routers.api_keys import router as api_keys_router
from app.routers.oauth_sessions import router as oauth_sessions_router
from app.routers.health import router as health_router
from app.routers.analytics import router as analytics_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("dashboard.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event manager for database connection and task scheduling."""
    # 1. Startup Logic
    logger.info("Starting up API Key Monitoring & Service Health Dashboard server...")
    
    # Connect to MongoDB Atlas
    db.connect()
    
    # Establish indices and seed admin credentials
    await db.ensure_indexes_and_seed()
    
    # Configure and start background task scheduler
    start_scheduler()
    
    # Dispatch immediate off-thread data hydration jobs
    async def initial_sync_job():
        logger.info("Dispatched initial dashboard data hydration sync...")
        await asyncio.sleep(2.0) # Grace period

        # 0. Auto-register admin keys from .env (OpenAI, Render, ElevenLabs)
        try:
            await seed_env_admin_keys()
        except Exception as e:
            logger.error(f"Env admin key seeding failed: {e}")

        try:
            await run_all_health_checks()
        except Exception as e:
            logger.error(f"Initial startup URL checks failed: {e}")
            
        try:
            await sync_all_official_keys()
        except Exception as e:
            logger.error(f"Initial startup API key sync failed: {e}")
            
    asyncio.create_task(initial_sync_job())
    
    yield
    
    # 2. Shutdown Logic
    logger.info("Shutting down dashboard server...")
    
    # Stop background task scheduler
    stop_scheduler()
    
    # Close database client
    if db.client:
        db.client.close()
        logger.info("Closed MongoDB client.")

# Instantiate FastAPI application
app = FastAPI(
    title="API Key Monitoring & Service Health Dashboard API",
    description="Backend API for centralized monitoring, website automation, and status tracking",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS policy based on settings (configurable for AWS production deployments)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import FileResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)}
    )

# Serve compiled static react client in production if it exists
static_dir = "/frontend/dist" if os.path.exists("/frontend/dist") else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

@app.exception_handler(StarletteHTTPException)
async def spa_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404 and os.path.exists(static_dir):
        path = request.url.path
        if not (path.startswith("/api") or path.startswith("/docs") or path.startswith("/openapi.json")):
            index_file = os.path.join(static_dir, "index.html")
            if os.path.exists(index_file):
                return FileResponse(index_file)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# Mount REST API routers
app.include_router(auth_router)
app.include_router(api_keys_router)
app.include_router(oauth_sessions_router)
app.include_router(health_router)
app.include_router(analytics_router)

if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    @app.get("/")
    async def root():
        """Simple API wellness ping endpoint."""
        return {
            "app": "API Key Monitoring & Service Health Dashboard",
            "api_status": "healthy",
            "version": "1.0.0"
        }
