# DART Analytics API Documentation

This document provides comprehensive documentation for the DART Analytics REST API endpoints.

## 📋 Overview

The DART Analytics API is a RESTful service built with Flask that provides endpoints for:
- File upload and data analysis
- Statistical control chart generation
- PowerPoint report export
- Session management

**Base URL**: `http://localhost:5000/api`

## 🔐 Authentication

Currently, the API does not require authentication. In production environments, consider implementing:
- API key authentication
- JWT tokens
- Rate limiting

## 📊 Data Flow

```
1. Upload File → Session Created → Data Analyzed
2. Generate Charts → Statistical Processing → Charts Stored
3. Export PowerPoint → Report Generated → File Downloaded
```

## 🛠 API Endpoints

### 1. File Upload

**Endpoint**: `POST /api/upload`

**Description**: Upload and analyze CSV or Excel files for chart generation.

**Request**:
```http
POST /api/upload HTTP/1.1
Content-Type: multipart/form-data

file: [CSV or Excel file]
```

**Response**:
```json
{
  "session_id": "1694123456789",
  "filename": "sales_data.csv",
  "rows": 1250,
  "columns": 5,
  "columns_info": [
    {
      "name": "date",
      "type": "object",
      "is_numeric": false,
      "is_date_like": true
    },
    {
      "name": "sales",
      "type": "float64",
      "is_numeric": true,
      "is_date_like": false
    }
  ],
  "filter_options": {
    "region": ["North", "South", "East", "West"],
    "product": ["ProductA", "ProductB", "ProductC"]
  },
  "quality_report": {
    "empty_rows_dropped": 5
  }
}
```

**Error Responses**:
```json
// 400 Bad Request
{
  "error": "No file provided"
}

// 400 Bad Request  
{
  "error": "Unsupported file type. Please use CSV or Excel."
}

// 400 Bad Request
{
  "error": "Failed to parse file. Details: [specific error]"
}
```

### 2. Generate Charts

**Endpoint**: `POST /api/generate_chart`

**Description**: Generate MSD control charts based on user specifications.

**Request**:
```json
{
  "session_id": "1694123456789",
  "value_column": "sales",
  "date_column": "date",
  "cut_columns": ["region"],
  "filters": {
    "product": ["ProductA", "ProductB"]
  },
  "aggregation_period": "W",
  "rolling_window": 7,
  "std_dev": 2.0
}
```

**Parameters**:
- `session_id` (string, required): Session identifier from upload
- `value_column` (string, required): Column with numeric values to analyze
- `date_column` (string, required): Column with date/time information
- `cut_columns` (array, optional): Columns to group data by
- `filters` (object, optional): Column filters to apply
- `aggregation_period` (string, optional): Time aggregation ("D", "W", "M", "Y")
- `rolling_window` (integer, optional): Rolling window size (default: 7)
- `std_dev` (float, optional): Standard deviation multiplier (default: 2.0)

**Response**:
```json
{
  "success": true,
  "charts": [
    {
      "image": "iVBORw0KGgoAAAANSUhEUgAA...", // Base64 encoded PNG
      "title": "Chart for sales - region=North",
      "group": "region=North",
      "data_points": 52,
      "outliers": 3,
      "latter_half_outliers": 2,
      "zero_values": 0,
      "statistics": {
        "mean": 156.78,
        "std": 23.45,
        "min": 98.50,
        "max": 234.67
      }
    }
  ],
  "message": "Generated 4 chart(s). Analysis complete. 5 rows excluded."
}
```

**Error Responses**:
```json
// 400 Bad Request
{
  "error": "Missing required parameters"
}

// 404 Not Found
{
  "error": "Session expired or invalid."
}

// 400 Bad Request
{
  "error": "No valid data to generate charts. No data remaining after applying filters."
}
```

### 3. Export PowerPoint

**Endpoint**: `GET /api/export_ppt/{session_id}`

**Description**: Export all charts from a session to a PowerPoint presentation.

**Request**:
```http
GET /api/export_ppt/1694123456789 HTTP/1.1
```

**Response**: 
- **Success**: PowerPoint file download (binary data)
- **Content-Type**: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- **Content-Disposition**: `attachment; filename="DART_Report_1694123456789_20230908_143022.pptx"`

**Error Responses**:
```json
// 404 Not Found
{
  "error": "No charts found for this session. Generate some charts first."
}

// 500 Internal Server Error
{
  "error": "Failed to create PowerPoint presentation"
}
```

### 4. Clear Session

**Endpoint**: `DELETE /api/clear_session/{session_id}`

**Description**: Clear stored charts and data for a specific session.

**Request**:
```http
DELETE /api/clear_session/1694123456789 HTTP/1.1
```

**Response**:
```json
{
  "success": true,
  "message": "Session charts cleared"
}
```

### 5. Health Check

**Endpoint**: `GET /api/health`

**Description**: Check if the API server is running and healthy.

**Request**:
```http
GET /api/health HTTP/1.1
```

**Response**:
```json
{
  "status": "healthy"
}
```

## 📈 Chart Data Structure

### Chart Object
```json
{
  "image": "base64_encoded_png_data",
  "title": "Chart for [column] - [grouping]",
  "group": "grouping_identifier",
  "data_points": 52,
  "outliers": 3,
  "latter_half_outliers": 2,
  "zero_values": 0,
  "statistics": {
    "mean": 156.78,
    "std": 23.45,
    "min": 98.50,
    "max": 234.67
  }
}
```

### Field Descriptions
- `image`: Base64 encoded PNG image of the chart
- `title`: Descriptive title for the chart
- `group`: Identifier for data grouping (if applicable)
- `data_points`: Total number of data points in the chart
- `outliers`: Total number of outliers detected
- `latter_half_outliers`: Outliers in the second half of the data (recent anomalies)
- `zero_values`: Number of zero values in the dataset
- `statistics`: Basic statistical measures

## 🔧 Configuration Parameters

### Aggregation Periods
- `"D"`: Daily aggregation
- `"W"`: Weekly aggregation (default)
- `"M"`: Monthly aggregation
- `"Y"`: Yearly aggregation

### Rolling Window
- **Range**: 1-52 periods
- **Default**: 7 periods
- **Purpose**: Smoothing for center line calculation

### Standard Deviation Multiplier
- **Range**: 1.0-4.0
- **Default**: 2.0
- **Purpose**: Control limit calculation (±σ × multiplier)

## 🚨 Error Handling

### HTTP Status Codes
- `200`: Success
- `400`: Bad Request (invalid parameters, malformed data)
- `404`: Not Found (session expired, no data)
- `500`: Internal Server Error (processing failure)

### Error Response Format
```json
{
  "error": "Descriptive error message"
}
```

### Common Error Scenarios

1. **File Upload Errors**:
   - No file provided
   - Unsupported file format
   - File parsing failure
   - Empty file

2. **Chart Generation Errors**:
   - Missing required parameters
   - Invalid session ID
   - No valid data after filtering
   - Insufficient data points

3. **Export Errors**:
   - No charts available
   - PowerPoint generation failure
   - File system errors

## 📊 Usage Examples

### Python Example
```python
import requests
import json

# Upload file
with open('data.csv', 'rb') as f:
    response = requests.post('http://localhost:5000/api/upload', 
                           files={'file': f})
    upload_result = response.json()

session_id = upload_result['session_id']

# Generate chart
chart_request = {
    'session_id': session_id,
    'value_column': 'sales',
    'date_column': 'date',
    'rolling_window': 7,
    'std_dev': 2.0
}

response = requests.post('http://localhost:5000/api/generate_chart',
                        json=chart_request)
chart_result = response.json()

# Export PowerPoint
response = requests.get(f'http://localhost:5000/api/export_ppt/{session_id}')
with open('report.pptx', 'wb') as f:
    f.write(response.content)
```

### JavaScript Example
```javascript
// Upload file
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData
});
const uploadResult = await uploadResponse.json();

// Generate chart
const chartRequest = {
    session_id: uploadResult.session_id,
    value_column: 'sales',
    date_column: 'date',
    rolling_window: 7,
    std_dev: 2.0
};

const chartResponse = await fetch('/api/generate_chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chartRequest)
});
const chartResult = await chartResponse.json();
```

### cURL Examples
```bash
# Upload file
curl -X POST http://localhost:5000/api/upload \
  -F "file=@data.csv"

# Generate chart
curl -X POST http://localhost:5000/api/generate_chart \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "1694123456789",
    "value_column": "sales",
    "date_column": "date"
  }'

# Export PowerPoint
curl -X GET http://localhost:5000/api/export_ppt/1694123456789 \
  -o report.pptx

# Health check
curl -X GET http://localhost:5000/api/health
```

## 🔒 Security Considerations

### Input Validation
- File type validation (CSV/Excel only)
- File size limits (configurable)
- Parameter type checking
- SQL injection prevention (not applicable - no database)

### Session Management
- Session IDs are timestamp-based
- Automatic cleanup of old sessions
- No persistent storage of sensitive data

### Production Recommendations
1. Implement rate limiting
2. Add authentication/authorization
3. Use HTTPS in production
4. Validate file content thoroughly
5. Implement proper logging
6. Set up monitoring and alerting

## 📝 Changelog

### Version 2.2
- Added comprehensive error handling
- Improved NumPy type serialization
- Enhanced PowerPoint export functionality
- Better session management

### Version 2.1
- Added PowerPoint export feature
- Improved chart prioritization
- Enhanced statistical analysis
- Better mobile responsiveness

---

**For technical support, refer to the main README.md or SETUP_GUIDE.md files.**