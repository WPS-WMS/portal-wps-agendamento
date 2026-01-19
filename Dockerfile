# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY portal_wps_backend/requirements.txt /app/portal_wps_backend/requirements.txt

# Install Python dependencies
WORKDIR /app/portal_wps_backend
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
WORKDIR /app
COPY portal_wps_backend /app/portal_wps_backend

# Expose port (Railway will set PORT env var)
EXPOSE 5000

# Start command
WORKDIR /app/portal_wps_backend
CMD ["python3", "src/main.py"]
