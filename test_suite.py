"""
Comprehensive Test Suite for DART Analytics
==========================================

Test coverage for backend API, data processing, and chart generation.
"""

import unittest
import json
import io
import os
from backend import app
import pandas as pd
import numpy as np

class TestDARTAnalytics(unittest.TestCase):
    """Test suite for DART Analytics backend"""
    
    def setUp(self):
        """Set up test client and sample data"""
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        
        # Create sample test data
        self.sample_csv = self._create_sample_csv()
        self.sample_excel = self._create_sample_excel()
    
    def _create_sample_csv(self):
        """Create sample CSV data for testing"""
        data = {
            'Date': pd.date_range('2024-01-01', periods=100, freq='D'),
            'Sales': np.random.randint(100, 1000, 100),
            'Region': np.random.choice(['North', 'South', 'East', 'West'], 100)
        }
        df = pd.DataFrame(data)
        
        # Save to bytes
        csv_buffer = io.BytesIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        return csv_buffer
    
    def _create_sample_excel(self):
        """Create sample Excel data for testing"""
        data = {
            'Year': [2024] * 50,
            'Month': list(range(1, 13)) * 4 + [1, 2],
            'Revenue': np.random.randint(10000, 50000, 50),
            'Category': np.random.choice(['A', 'B', 'C'], 50)
        }
        df = pd.DataFrame(data)
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, engine='openpyxl')
        excel_buffer.seek(0)
        return excel_buffer
    
    # ===== File Upload Tests =====
    
    def test_upload_csv_success(self):
        """Test successful CSV file upload"""
        response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('session_id', data)
        self.assertIn('columns', data)
    
    def test_upload_excel_success(self):
        """Test successful Excel file upload"""
        response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_excel, 'test.xlsx')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('session_id', data)
    
    def test_upload_no_file(self):
        """Test upload with no file provided"""
        response = self.client.post('/api/upload')
        self.assertEqual(response.status_code, 400)
    
    def test_upload_invalid_format(self):
        """Test upload with invalid file format"""
        invalid_file = io.BytesIO(b"invalid content")
        response = self.client.post(
            '/api/upload',
            data={'file': (invalid_file, 'test.txt')},
            content_type='multipart/form-data'
        )
        self.assertEqual(response.status_code, 400)
    
    # ===== Chart Generation Tests =====
    
    def test_generate_chart_basic(self):
        """Test basic chart generation"""
        # First upload a file
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        session_id = json.loads(upload_response.data)['session_id']
        
        # Generate chart
        chart_data = {
            'session_id': session_id,
            'date_col': 'Date',
            'value_col': 'Sales',
            'rolling_window': 10,
            'std_multiplier': 3
        }
        
        response = self.client.post(
            '/api/generate_chart',
            data=json.dumps(chart_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('chart_data', data)
    
    def test_generate_chart_with_grouping(self):
        """Test chart generation with grouping"""
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        session_id = json.loads(upload_response.data)['session_id']
        
        chart_data = {
            'session_id': session_id,
            'date_col': 'Date',
            'value_col': 'Sales',
            'group_col': 'Region',
            'rolling_window': 10,
            'std_multiplier': 3
        }
        
        response = self.client.post(
            '/api/generate_chart',
            data=json.dumps(chart_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
    
    def test_generate_chart_multi_column_date(self):
        """Test chart generation with multiple date columns"""
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_excel, 'test.xlsx')},
            content_type='multipart/form-data'
        )
        session_id = json.loads(upload_response.data)['session_id']
        
        chart_data = {
            'session_id': session_id,
            'date_col': ['Year', 'Month'],
            'value_col': 'Revenue',
            'rolling_window': 5,
            'std_multiplier': 2
        }
        
        response = self.client.post(
            '/api/generate_chart',
            data=json.dumps(chart_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
    
    def test_generate_chart_missing_session(self):
        """Test chart generation with invalid session"""
        chart_data = {
            'session_id': 'invalid_session',
            'date_col': 'Date',
            'value_col': 'Sales'
        }
        
        response = self.client.post(
            '/api/generate_chart',
            data=json.dumps(chart_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 404)
    
    # ===== Export Tests =====
    
    def test_export_ppt_success(self):
        """Test PowerPoint export"""
        # Upload and generate chart first
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        session_id = json.loads(upload_response.data)['session_id']
        
        chart_data = {
            'session_id': session_id,
            'date_col': 'Date',
            'value_col': 'Sales'
        }
        self.client.post(
            '/api/generate_chart',
            data=json.dumps(chart_data),
            content_type='application/json'
        )
        
        # Export to PPT
        response = self.client.get(f'/api/export_ppt/{session_id}')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers['Content-Type'].startswith('application/'))
    
    def test_export_ppt_no_charts(self):
        """Test PPT export with no charts generated"""
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        session_id = json.loads(upload_response.data)['session_id']
        
        response = self.client.get(f'/api/export_ppt/{session_id}')
        self.assertEqual(response.status_code, 404)
    
    # ===== Health Check Tests =====
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('status', data)
    
    # ===== Data Processing Tests =====
    
    def test_column_detection(self):
        """Test automatic column type detection"""
        upload_response = self.client.post(
            '/api/upload',
            data={'file': (self.sample_csv, 'test.csv')},
            content_type='multipart/form-data'
        )
        
        data = json.loads(upload_response.data)
        columns = data['columns']
        
        self.assertIn('numeric', columns)
        self.assertIn('date_like', columns)
        self.assertIn('categorical', columns)
        self.assertIn('Sales', columns['numeric'])
        self.assertIn('Date', columns['date_like'])
        self.assertIn('Region', columns['categorical'])
    
    def tearDown(self):
        """Clean up test data"""
        # Close file handles
        if hasattr(self.sample_csv, 'close'):
            self.sample_csv.close()
        if hasattr(self.sample_excel, 'close'):
            self.sample_excel.close()

# ===== Performance Tests =====

class TestPerformance(unittest.TestCase):
    """Performance and load testing"""
    
    def setUp(self):
        self.app = app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
    
    def test_large_file_upload(self):
        """Test upload of large dataset"""
        # Create large dataset
        data = {
            'Date': pd.date_range('2020-01-01', periods=10000, freq='H'),
            'Value': np.random.randint(1, 1000, 10000)
        }
        df = pd.DataFrame(data)
        
        csv_buffer = io.BytesIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        response = self.client.post(
            '/api/upload',
            data={'file': (csv_buffer, 'large.csv')},
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 200)
    
    def test_concurrent_requests(self):
        """Test handling of concurrent requests"""
        # This would require threading/multiprocessing
        # Simplified version here
        responses = []
        for i in range(5):
            data = {
                'Date': pd.date_range('2024-01-01', periods=50, freq='D'),
                'Value': np.random.randint(1, 100, 50)
            }
            df = pd.DataFrame(data)
            csv_buffer = io.BytesIO()
            df.to_csv(csv_buffer, index=False)
            csv_buffer.seek(0)
            
            response = self.client.post(
                '/api/upload',
                data={'file': (csv_buffer, f'test{i}.csv')},
                content_type='multipart/form-data'
            )
            responses.append(response.status_code)
        
        self.assertTrue(all(code == 200 for code in responses))

if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
