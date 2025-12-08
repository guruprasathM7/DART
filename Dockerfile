# DART Analytics - Professional Control Chart Generator
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backend.py .
COPY performance_monitor.py .
COPY index.html .
COPY app.js .
COPY styles.css .
COPY favicon.svg .

# Create necessary directories
RUN mkdir -p temp_data temp_exports

# Expose port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=backend.py
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/api/health')"

# Run the application
CMD ["python", "backend.py"]
