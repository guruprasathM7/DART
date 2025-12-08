# Performance Monitor Usage Guide

## 📊 Overview

The `performance_monitor.py` module provides comprehensive performance tracking and analytics for DART Analytics. It automatically monitors:

- File uploads (size, type, frequency)
- Chart generation (processing time, outlier counts)
- Exports (PowerPoint, Excel)
- System health and performance metrics

---

## 🚀 Quick Start

### 1. **Already Integrated!**

The performance monitor is now integrated into `backend.py`. It automatically tracks:
- ✅ File uploads
- ✅ Chart generations
- ✅ PowerPoint exports
- ✅ System health

### 2. **Access Metrics via API**

#### **Health Check Endpoint**
```bash
curl http://localhost:5000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-05T10:30:00",
  "metrics": {
    "status": "healthy",
    "uptime": "active",
    "total_requests": 150,
    "avg_response_time": 0.85,
    "error_rate": 0
  }
}
```

#### **Statistics Endpoint**
```bash
curl http://localhost:5000/api/statistics
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_uploads": 25,
    "total_charts": 87,
    "total_exports": 12,
    "total_sessions": 25,
    "avg_processing_time": 0.85,
    "peak_usage_hour": 14
  },
  "timestamp": "2025-12-05T10:30:00"
}
```

---

## 📝 How It Works

### **Automatic Tracking**

The monitor automatically tracks metrics when users:

1. **Upload Files** → Tracks file size and type
```python
# Automatically called in /api/upload
monitor.log_upload(file_size, file_type)
```

2. **Generate Charts** → Tracks processing time and outlier count
```python
# Automatically called in /api/generate_chart
monitor.log_chart_generation('MSD', total_outliers)
```

3. **Export Reports** → Tracks export type and chart count
```python
# Automatically called in /api/export_ppt
monitor.log_export('PowerPoint', len(charts_data))
```

---

## 🔧 Advanced Usage

### **Manual Tracking (if needed)**

If you want to add custom tracking:

```python
from performance_monitor import monitor

# Track custom events
monitor.log_chart_generation('custom_chart_type', outlier_count=5)
monitor.log_export('Excel', chart_count=3)
monitor.log_upload(file_size=1024000, file_type='csv')

# Get current statistics
stats = monitor.get_statistics()
print(f"Total uploads: {stats['total_uploads']}")
print(f"Average processing: {stats['avg_processing_time']}s")

# Check health status
health = monitor.get_health_status()
print(f"System status: {health['status']}")
```

### **Track Custom Function Performance**

Use the decorator to track execution time:

```python
from performance_monitor import monitor

@monitor.track_execution_time('custom_function')
def my_expensive_operation():
    # Your code here
    pass

# Execution time automatically tracked!
```

---

## 📊 Metrics Collected

### **Upload Metrics**
- Total number of uploads
- File sizes
- File types (CSV vs Excel)
- Upload timestamps
- Peak usage patterns

### **Chart Generation Metrics**
- Total charts generated
- Processing time per chart
- Outlier counts
- Chart types
- Success/failure rates

### **Export Metrics**
- Total exports
- Export types (PowerPoint, Excel)
- Charts per export
- Export timestamps

### **System Health**
- Overall health status
- Total requests processed
- Average response time
- Error rate
- Peak usage hours

---

## 🎯 Use Cases

### **1. Monitor System Performance**

```bash
# Check if system is healthy
curl http://localhost:5000/api/health

# If status is "healthy", system is running well
# If "unhealthy", investigate error details
```

### **2. Analyze Usage Patterns**

```bash
# Get comprehensive statistics
curl http://localhost:5000/api/statistics

# Use data for:
# - Capacity planning
# - User behavior analysis
# - Performance optimization
```

### **3. Dashboard Integration**

```javascript
// Frontend dashboard example
async function updateDashboard() {
    const response = await fetch('/api/statistics');
    const data = await response.json();
    
    document.getElementById('total-uploads').textContent = 
        data.statistics.total_uploads;
    document.getElementById('total-charts').textContent = 
        data.statistics.total_charts;
    document.getElementById('avg-time').textContent = 
        data.statistics.avg_processing_time.toFixed(2) + 's';
}

// Update every 30 seconds
setInterval(updateDashboard, 30000);
```

### **4. Monitoring & Alerts**

```python
# Example monitoring script
import requests
import time

def monitor_health():
    while True:
        response = requests.get('http://localhost:5000/api/health')
        health = response.json()
        
        if health['status'] != 'healthy':
            send_alert(f"System unhealthy: {health.get('error')}")
        
        if health['metrics']['avg_response_time'] > 2.0:
            send_alert("High response time detected")
        
        time.sleep(60)  # Check every minute
```

---

## 📈 Example Outputs

### **After 1 Hour of Usage:**

```json
{
  "total_uploads": 15,
  "total_charts": 45,
  "total_exports": 8,
  "avg_processing_time": 0.75,
  "peak_usage_hour": 14
}
```

### **After 1 Day:**

```json
{
  "total_uploads": 120,
  "total_charts": 380,
  "total_exports": 65,
  "avg_processing_time": 0.82,
  "peak_usage_hour": 14
}
```

---

## 🔍 Troubleshooting

### **Issue: No metrics showing**

**Solution:** Metrics accumulate over time. Use the application normally and check again.

### **Issue: Import error**

**Solution:** Ensure `performance_monitor.py` is in the same directory as `backend.py`

```bash
# Check files
ls -la
# Should see: performance_monitor.py
```

### **Issue: Health endpoint returns 500**

**Solution:** Check logs for errors:

```bash
# Start backend with visible logs
python backend.py
```

---

## 🚀 Production Deployment

### **Monitor Health with Docker**

```yaml
# docker-compose.yml already includes health check!
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### **Prometheus Integration (Future)**

```python
# Can be extended to export Prometheus metrics
from prometheus_client import Counter, Histogram

upload_counter = Counter('dart_uploads_total', 'Total uploads')
processing_time = Histogram('dart_processing_seconds', 'Processing time')
```

---

## 📊 Dashboard Visualization Ideas

### **Simple HTML Dashboard**

```html
<!DOCTYPE html>
<html>
<head>
    <title>DART Analytics Dashboard</title>
    <style>
        .metric { padding: 20px; background: #f0f0f0; margin: 10px; }
        .value { font-size: 2em; font-weight: bold; color: #1786B4; }
    </style>
</head>
<body>
    <h1>DART Analytics Dashboard</h1>
    <div class="metric">
        <div>Total Uploads</div>
        <div class="value" id="uploads">-</div>
    </div>
    <div class="metric">
        <div>Charts Generated</div>
        <div class="value" id="charts">-</div>
    </div>
    <div class="metric">
        <div>Avg Processing Time</div>
        <div class="value" id="time">-</div>
    </div>
    
    <script>
        async function update() {
            const res = await fetch('/api/statistics');
            const data = await res.json();
            document.getElementById('uploads').textContent = 
                data.statistics.total_uploads;
            document.getElementById('charts').textContent = 
                data.statistics.total_charts;
            document.getElementById('time').textContent = 
                data.statistics.avg_processing_time.toFixed(2) + 's';
        }
        setInterval(update, 5000);
        update();
    </script>
</body>
</html>
```

---

## ✅ Summary

### **What's Tracked Automatically:**
- ✅ File uploads (size, type)
- ✅ Chart generation (time, outliers)
- ✅ PowerPoint exports
- ✅ System health
- ✅ Performance metrics

### **How to Access:**
- ✅ `/api/health` - Health check
- ✅ `/api/statistics` - Usage stats

### **Benefits:**
- ✅ Monitor system performance
- ✅ Identify bottlenecks
- ✅ Track usage patterns
- ✅ Plan capacity
- ✅ Debug issues

**No additional setup needed - it's already working!** 🎉

---

## 🎓 Next Steps

1. **Test it:**
   ```bash
   # Start backend
   python backend.py
   
   # In another terminal
   curl http://localhost:5000/api/health
   curl http://localhost:5000/api/statistics
   ```

2. **Use the application** - Metrics will accumulate automatically

3. **Monitor regularly** - Check `/api/health` for system status

4. **Build dashboards** - Use `/api/statistics` for visualizations

---

**Questions? Check the code in `performance_monitor.py` or `backend.py`!**
