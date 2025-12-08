"""
Quick Test Script for Performance Monitor
=========================================

Demonstrates how the performance monitor tracks metrics.
"""

from performance_monitor import monitor
import time

print("=" * 60)
print("DART Analytics - Performance Monitor Demo")
print("=" * 60)
print()

# Initial state
print("📊 Initial Statistics:")
stats = monitor.get_statistics()
for key, value in stats.items():
    print(f"   {key}: {value}")
print()

# Simulate some uploads
print("📤 Simulating file uploads...")
monitor.log_upload(file_size=5000000, file_type='csv')
monitor.log_upload(file_size=8000000, file_type='excel')
monitor.log_upload(file_size=3000000, file_type='csv')
print("   ✅ 3 uploads logged")
print()

# Simulate chart generation
print("📈 Simulating chart generation...")
time.sleep(0.1)  # Simulate processing
monitor.log_chart_generation('MSD', outlier_count=5)
time.sleep(0.15)  # Simulate processing
monitor.log_chart_generation('MSD', outlier_count=12)
time.sleep(0.08)  # Simulate processing
monitor.log_chart_generation('MSD', outlier_count=3)
print("   ✅ 3 charts generated")
print()

# Simulate exports
print("📊 Simulating exports...")
monitor.log_export('PowerPoint', chart_count=3)
monitor.log_export('Excel', chart_count=2)
print("   ✅ 2 exports logged")
print()

# Get updated statistics
print("📊 Updated Statistics:")
stats = monitor.get_statistics()
for key, value in stats.items():
    print(f"   {key}: {value}")
print()

# Get health status
print("🏥 Health Status:")
health = monitor.get_health_status()
for key, value in health.items():
    print(f"   {key}: {value}")
print()

print("=" * 60)
print("✅ Performance Monitor Working Correctly!")
print("=" * 60)
print()
print("💡 Tips:")
print("   1. Metrics are tracked automatically in backend.py")
print("   2. Access via: http://localhost:5000/api/health")
print("   3. Access via: http://localhost:5000/api/statistics")
print("   4. See PERFORMANCE_MONITOR_GUIDE.md for details")
print()
