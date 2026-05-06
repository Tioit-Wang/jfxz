FROM python:3.13-slim

WORKDIR /app

# Install uv package manager
RUN pip install --no-cache-dir uv

# Install production dependencies (lock file ensures reproducibility)
COPY pyproject.toml requirements.lock uv.lock ./
RUN uv pip install --system --no-cache-dir -r requirements.lock

# Copy application code
COPY app/ ./app/

# Log directory (rotating file handler in main.py)
RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]
