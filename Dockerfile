# Use Python 3.11 slim image
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for better caching)
COPY portal_wps_backend/requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY portal_wps_backend /app/portal_wps_backend

# Set Python path
ENV PYTHONPATH=/app/portal_wps_backend

# Expose port (Railway will set PORT env var)
EXPOSE 5000

# Start command - use shell form para garantir que funciona
WORKDIR /app/portal_wps_backend
CMD ["sh", "-c", "python3 src/main.py"]
