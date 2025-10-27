# DART Analytics - Production Deployment Guide

This guide covers deploying DART Analytics in production environments with proper security, performance, and reliability considerations.

## 🎯 Deployment Overview

DART Analytics can be deployed in various production environments:
- **Cloud Platforms**: AWS, Azure, Google Cloud, DigitalOcean
- **On-Premises**: Corporate servers, private cloud
- **Containerized**: Docker, Kubernetes
- **Traditional**: Linux/Windows servers with reverse proxy

## 🏗 Architecture Options

### Option 1: Single Server Deployment
```
Internet → Nginx/Apache → DART Analytics (Flask + Gunicorn)
```

### Option 2: Load Balanced Deployment
```
Internet → Load Balancer → Multiple DART Instances → Shared Storage
```

### Option 3: Containerized Deployment
```
Internet → Ingress Controller → Kubernetes Pods → Persistent Volumes
```

## 🚀 Production Setup

### 1. Server Requirements

#### Minimum Production Specs
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04 LTS, CentOS 8, or Windows Server 2019

#### Recommended Production Specs
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: 1Gbps connection

### 2. System Preparation

#### Ubuntu/Debian Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and dependencies
sudo apt install python3 python3-pip python3-venv nginx supervisor -y

# Install system dependencies for matplotlib
sudo apt install python3-dev build-essential libfreetype6-dev libpng-dev -y

# Create application user
sudo useradd -m -s /bin/bash dartapp
sudo usermod -aG sudo dartapp
```

#### CentOS/RHEL Setup
```bash
# Update system
sudo yum update -y

# Install Python and dependencies
sudo yum install python3 python3-pip nginx supervisor -y

# Install development tools
sudo yum groupinstall "Development Tools" -y
sudo yum install freetype-devel libpng-devel -y

# Create application user
sudo useradd -m dartapp
```

### 3. Application Deployment

#### Deploy Application Files
```bash
# Switch to application user
sudo su - dartapp

# Create application directory
mkdir -p /home/dartapp/dart-analytics
cd /home/dartapp/dart-analytics

# Copy application files (replace with your method)
# Option 1: Git clone
git clone <repository-url> .

# Option 2: SCP/SFTP upload
# scp -r /local/dart-project/* dartapp@server:/home/dartapp/dart-analytics/

# Set permissions
chmod +x backend.py
```

#### Create Virtual Environment
```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install production WSGI server
pip install gunicorn
```

#### Configure Application for Production
```bash
# Create production configuration
cat > production_config.py << EOF
import os

class ProductionConfig:
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
    
    # Security headers
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 year
    
    # Logging
    LOG_LEVEL = 'INFO'
    LOG_FILE = '/var/log/dart-analytics/app.log'
EOF
```

#### Update Backend for Production
```python
# Add to backend.py (at the top)
import os
from production_config import ProductionConfig

# Update Flask app configuration
if os.environ.get('FLASK_ENV') == 'production':
    app.config.from_object(ProductionConfig)

# Update the main block
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)
```

### 4. Process Management with Supervisor

#### Create Supervisor Configuration
```bash
sudo tee /etc/supervisor/conf.d/dart-analytics.conf << EOF
[program:dart-analytics]
command=/home/dartapp/dart-analytics/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 backend:app
directory=/home/dartapp/dart-analytics
user=dartapp
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/dart-analytics/gunicorn.log
environment=FLASK_ENV=production,SECRET_KEY=your-secret-key-here
EOF

# Create log directory
sudo mkdir -p /var/log/dart-analytics
sudo chown dartapp:dartapp /var/log/dart-analytics

# Update supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start dart-analytics
```

### 5. Reverse Proxy with Nginx

#### Create Nginx Configuration
```bash
sudo tee /etc/nginx/sites-available/dart-analytics << EOF
server {
    listen 80;
    server_name your-domain.com;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # File upload size limit
    client_max_body_size 100M;
    
    # Static files
    location /static/ {
        alias /home/dartapp/dart-analytics/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API and application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts for large file uploads
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/dart-analytics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL/HTTPS Setup with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

## 🔒 Security Configuration

### 1. Firewall Setup
```bash
# Ubuntu/Debian (UFW)
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 2. Application Security

#### Environment Variables
```bash
# Create environment file
sudo tee /etc/environment << EOF
FLASK_ENV=production
SECRET_KEY=your-very-secure-secret-key-here
DATABASE_URL=your-database-url-if-needed
EOF
```

#### Rate Limiting (Optional)
```python
# Add to requirements.txt
Flask-Limiter==2.6.2

# Add to backend.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/api/upload', methods=['POST'])
@limiter.limit("10 per minute")
def upload_file():
    # existing code
```

### 3. File System Security
```bash
# Set proper permissions
sudo chown -R dartapp:dartapp /home/dartapp/dart-analytics
sudo chmod -R 755 /home/dartapp/dart-analytics
sudo chmod 600 /home/dartapp/dart-analytics/production_config.py

# Secure temporary directories
sudo mkdir -p /var/lib/dart-analytics/temp
sudo chown dartapp:dartapp /var/lib/dart-analytics/temp
sudo chmod 750 /var/lib/dart-analytics/temp
```

## 📊 Monitoring and Logging

### 1. Application Logging
```python
# Add to backend.py
import logging
from logging.handlers import RotatingFileHandler

if not app.debug:
    file_handler = RotatingFileHandler(
        '/var/log/dart-analytics/app.log', 
        maxBytes=10240000, 
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('DART Analytics startup')
```

### 2. System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Create monitoring script
cat > /home/dartapp/monitor.sh << EOF
#!/bin/bash
echo "=== DART Analytics System Status ==="
echo "Date: \$(date)"
echo "Uptime: \$(uptime)"
echo "Memory Usage:"
free -h
echo "Disk Usage:"
df -h /
echo "Process Status:"
sudo supervisorctl status dart-analytics
echo "Nginx Status:"
sudo systemctl status nginx --no-pager -l
EOF

chmod +x /home/dartapp/monitor.sh
```

### 3. Log Rotation
```bash
sudo tee /etc/logrotate.d/dart-analytics << EOF
/var/log/dart-analytics/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 dartapp dartapp
    postrotate
        sudo supervisorctl restart dart-analytics
    endscript
}
EOF
```

## 🚀 Performance Optimization

### 1. Gunicorn Configuration
```bash
# Create gunicorn config
cat > /home/dartapp/dart-analytics/gunicorn.conf.py << EOF
bind = "127.0.0.1:5000"
workers = 4
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100
timeout = 300
keepalive = 2
preload_app = True
EOF

# Update supervisor config
sudo sed -i 's/gunicorn -w 4 -b 127.0.0.1:5000 backend:app/gunicorn -c gunicorn.conf.py backend:app/' /etc/supervisor/conf.d/dart-analytics.conf
```

### 2. Nginx Optimization
```nginx
# Add to nginx config
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

# Enable caching
location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. System Optimization
```bash
# Increase file limits
echo "dartapp soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "dartapp hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize kernel parameters
echo "net.core.somaxconn = 1024" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 1024" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## 🔄 Backup and Recovery

### 1. Backup Strategy
```bash
# Create backup script
cat > /home/dartapp/backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/var/backups/dart-analytics"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup application files
tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz -C /home/dartapp dart-analytics

# Backup configuration
cp /etc/nginx/sites-available/dart-analytics \$BACKUP_DIR/nginx_\$DATE.conf
cp /etc/supervisor/conf.d/dart-analytics.conf \$BACKUP_DIR/supervisor_\$DATE.conf

# Cleanup old backups (keep 30 days)
find \$BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find \$BACKUP_DIR -name "*.conf" -mtime +30 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /home/dartapp/backup.sh

# Schedule daily backups
echo "0 2 * * * /home/dartapp/backup.sh" | crontab -
```

### 2. Recovery Procedures
```bash
# Application recovery
sudo supervisorctl stop dart-analytics
cd /home/dartapp
tar -xzf /var/backups/dart-analytics/app_YYYYMMDD_HHMMSS.tar.gz
sudo supervisorctl start dart-analytics

# Configuration recovery
sudo cp /var/backups/dart-analytics/nginx_YYYYMMDD_HHMMSS.conf /etc/nginx/sites-available/dart-analytics
sudo nginx -t && sudo systemctl reload nginx
```

## 🐳 Docker Deployment

### 1. Dockerfile
```dockerfile
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libfreetype6-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 dartapp

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy application files
COPY . .
RUN chown -R dartapp:dartapp /app

# Switch to app user
USER dartapp

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "backend:app"]
```

### 2. Docker Compose
```yaml
version: '3.8'

services:
  dart-analytics:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=production
      - SECRET_KEY=your-secret-key
    volumes:
      - ./temp_data:/app/temp_data
      - ./temp_exports:/app/temp_exports
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - dart-analytics
    restart: unless-stopped
```

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Server provisioned and configured
- [ ] Domain name configured (if applicable)
- [ ] SSL certificate obtained
- [ ] Firewall rules configured
- [ ] Backup strategy implemented

### Application Deployment
- [ ] Application files deployed
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] Configuration files created
- [ ] Environment variables set

### Service Configuration
- [ ] Supervisor configuration created
- [ ] Nginx configuration created
- [ ] SSL configured
- [ ] Log rotation configured
- [ ] Monitoring setup

### Testing
- [ ] Application starts successfully
- [ ] Health check endpoint responds
- [ ] File upload works
- [ ] Chart generation works
- [ ] PowerPoint export works
- [ ] SSL certificate valid
- [ ] Performance acceptable

### Post-Deployment
- [ ] Monitoring alerts configured
- [ ] Backup tested
- [ ] Documentation updated
- [ ] Team notified

## 🆘 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
sudo supervisorctl tail -f dart-analytics
tail -f /var/log/dart-analytics/gunicorn.log

# Check process
ps aux | grep gunicorn
```

**High memory usage:**
```bash
# Monitor memory
htop
# Restart application
sudo supervisorctl restart dart-analytics
```

**Nginx errors:**
```bash
# Check nginx logs
sudo tail -f /var/log/nginx/error.log
# Test configuration
sudo nginx -t
```