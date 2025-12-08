"""
Performance Monitoring and Analytics Module
==========================================

Tracks application performance, usage statistics, and generates insights.
"""

import time
import json
from datetime import datetime
from functools import wraps
from collections import defaultdict
import threading

class PerformanceMonitor:
    """Track and analyze application performance metrics"""
    
    def __init__(self):
        self.metrics = defaultdict(list)
        self.usage_stats = {
            'total_uploads': 0,
            'total_charts': 0,
            'total_exports': 0,
            'total_sessions': 0,
            'avg_processing_time': 0,
            'peak_usage_hour': None
        }
        self.lock = threading.Lock()
        
    def track_execution_time(self, func_name):
        """Decorator to track function execution time"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                result = func(*args, **kwargs)
                execution_time = time.time() - start_time
                
                with self.lock:
                    self.metrics[func_name].append({
                        'timestamp': datetime.now().isoformat(),
                        'execution_time': execution_time
                    })
                
                return result
            return wrapper
        return decorator
    
    def log_upload(self, file_size, file_type):
        """Log file upload event"""
        with self.lock:
            self.usage_stats['total_uploads'] += 1
            self.metrics['uploads'].append({
                'timestamp': datetime.now().isoformat(),
                'file_size': file_size,
                'file_type': file_type
            })
    
    def log_chart_generation(self, chart_type, outlier_count):
        """Log chart generation event"""
        with self.lock:
            self.usage_stats['total_charts'] += 1
            self.metrics['charts'].append({
                'timestamp': datetime.now().isoformat(),
                'chart_type': chart_type,
                'outlier_count': outlier_count
            })
    
    def log_export(self, export_type, chart_count):
        """Log export event"""
        with self.lock:
            self.usage_stats['total_exports'] += 1
            self.metrics['exports'].append({
                'timestamp': datetime.now().isoformat(),
                'export_type': export_type,
                'chart_count': chart_count
            })
    
    def get_statistics(self):
        """Get comprehensive statistics"""
        with self.lock:
            stats = self.usage_stats.copy()
            
            # Calculate average processing time
            if 'chart_generation' in self.metrics and self.metrics['chart_generation']:
                times = [m['execution_time'] for m in self.metrics['chart_generation']]
                stats['avg_processing_time'] = round(sum(times) / len(times), 2)
            
            # Calculate peak usage
            if 'uploads' in self.metrics and self.metrics['uploads']:
                hours = defaultdict(int)
                for upload in self.metrics['uploads']:
                    hour = datetime.fromisoformat(upload['timestamp']).hour
                    hours[hour] += 1
                stats['peak_usage_hour'] = max(hours.items(), key=lambda x: x[1])[0]
            
            return stats
    
    def get_health_status(self):
        """Get application health status"""
        stats = self.get_statistics()
        
        health = {
            'status': 'healthy',
            'uptime': 'active',
            'total_requests': stats['total_uploads'] + stats['total_charts'] + stats['total_exports'],
            'avg_response_time': stats['avg_processing_time'],
            'error_rate': 0  # Can be enhanced with error tracking
        }
        
        return health

# Global instance
monitor = PerformanceMonitor()
