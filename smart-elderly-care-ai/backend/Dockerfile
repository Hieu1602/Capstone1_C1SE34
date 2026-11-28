FROM python:3.11-slim-bookworm

WORKDIR /app

# ---- System dependencies ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    libpq-dev \
    ffmpeg \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libgdk-pixbuf-2.0-0 \
    shared-mime-info \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# ---- Python dependencies ----
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Application ----
COPY . .

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# ---- Healthcheck ----
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
