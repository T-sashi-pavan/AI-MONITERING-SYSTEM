# ==========================================
# STAGE 1: Compile React Production Web Assets
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend

# Copy dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy source code and compile production assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Prepare Production Playwright Python App
# ==========================================
FROM python:3.10-slim AS backend-runner
WORKDIR /app

# Install system dependencies required for Playwright Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser binaries and all required OS system libraries
RUN playwright install --with-deps chromium

# Copy FastAPI backend code
COPY backend/ ./

# Copy compiled React frontend assets from Stage 1 into backend's dist mount target
COPY --from=frontend-builder /frontend/dist /frontend/dist

# Expose server port
EXPOSE 8000

# Set environment variables for production execution
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run FastAPI server using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
