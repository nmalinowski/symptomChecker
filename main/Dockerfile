FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=app.py \
    FLASK_ENV=production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc \
    libc-dev \
    libev-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the project files
COPY . .

# Expose port
EXPOSE 5000

# Run with Gunicorn
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:5000 app:app --workers=$(nproc) --worker-class=gevent --max-requests=500 --max-requests-jitter=50 --timeout=60 --keep-alive=10 --graceful-timeout=30 --log-level=info"]