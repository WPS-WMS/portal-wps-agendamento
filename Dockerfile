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

# Copy start script
COPY portal_wps_backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Set Python path
ENV PYTHONPATH=/app/portal_wps_backend

# Expose port (Railway will set PORT env var)
EXPOSE 5000

# Start command - use script que já está no diretório correto
CMD ["/app/start.sh"]
