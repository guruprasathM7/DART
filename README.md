# DART Analytics - MSD Control Chart Generator

A professional web application for generating MSD (Moving Standard Deviation) control charts from CSV/Excel data with PowerPoint export functionality.

## 🎯 Overview

DART Analytics is a comprehensive statistical process control tool that helps organizations monitor data quality and identify anomalies through professional control charts. The application combines advanced statistical analysis with an intuitive web interface to make data analysis accessible to both technical and non-technical users.

### Key Capabilities
- **Statistical Process Control**: Generate MSD control charts with proper statistical foundations
- **Anomaly Detection**: Automatically identify outliers and unusual patterns in your data
- **Business Reporting**: Export professional PowerPoint presentations for stakeholder review
- **Multi-format Support**: Handle CSV and Excel files with automatic encoding detection
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices

##  Features

### Data Processing
- **Smart File Upload**: Automatic encoding detection for international CSV files
- **Column Type Detection**: Automatically identifies numeric, date, and categorical columns
- **Data Quality Analysis**: Reports on data completeness and quality issues
- **Flexible Filtering**: Apply filters to focus analysis on specific data subsets

### Chart Generation
- **Professional Control Charts**: High-quality matplotlib charts with statistical rigor
- **Customizable Parameters**: Adjust rolling windows, standard deviation multipliers, and time aggregation
- **Multiple Groupings**: Generate separate charts for different data segments
- **Real-time Analysis**: Interactive form-based chart generation

### Export & Reporting
- **PowerPoint Export**: Automatically generate professional business reports
- **Priority Ordering**: Charts ordered by anomaly count for business priority
- **Executive Summary**: Key findings and statistics summary
- **High-Quality Images**: 150 DPI charts suitable for presentations

### User Experience
- **Dark/Light Themes**: Toggle between professional themes
- **Session Management**: Handle multiple analyses in a single session
- **Chart History**: Track generated charts in sidebar
- **Mobile Responsive**: Full functionality on all device sizes

## 📁 Project Structure

```
DART_PROJECT/
├── backend.py              # Flask REST API server
├── app.js                  # Frontend JavaScript application
├── index.html              # Main web interface
├── styles.css              # Application styling
├── requirements.txt        # Python dependencies
├── sample_data.csv         # Example data file
├── Data.xlsx              # Additional sample data
├── README.md              # This documentation
└── SETUP_GUIDE.md         # Detailed setup instructions
```

## ⚡ Quick Start

### Prerequisites
- Python 3.7 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone or Download the Project**
   ```bash
   # If using git
   git clone <repository-url>
   cd DART_PROJECT
   
   # Or download and extract the ZIP file
   ```

2. **Install Python Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Backend Server**
   ```bash
   python backend.py
   ```
   
   You should see:
   ```
   * Running on all addresses (0.0.0.0)
   * Running on http://127.0.0.1:5000
   * Running on http://[your-ip]:5000
   ```

4. **Open the Application**
   - Open your web browser
   - Navigate to `http://localhost:5000`
   - You should see the DART Analytics interface

##  How to Use

### Step 1: Upload Your Data

1. Click the **file upload button** (📁) in the chat interface
2. Select a CSV or Excel file containing your data
3. The system will automatically:
   - Detect column types (numeric, date, categorical)
   - Analyze data quality
   - Present available columns for analysis

### Step 2: Configure Your Analysis

After upload, you'll see an interactive form with:

- **Value Column**: Select the numeric column to analyze (e.g., sales, defects, performance metrics)
- **Time Series Column**: Select the date/time column for trend analysis
- **Data Cut Column** (Optional): Group data by categories (e.g., region, product, team)
- **Aggregation Period**: Choose Daily, Weekly, Monthly, or Yearly aggregation
- **Rolling Window**: Number of periods for rolling average (default: 7)
- **Standard Deviation**: Multiplier for control limits (default: 2σ)

### Step 3: Generate Charts

1. Click **"🚀 Generate Charts"**
2. The system will:
   - Process your data using statistical methods
   - Generate professional control charts
   - Identify outliers and anomalies
   - Display results with comprehensive statistics

### Step 4: Export Results

1. Click **"📊 Export to PowerPoint"** to create a business report
2. The system generates a professional presentation with:
   - Executive summary with key findings
   - Individual chart slides ordered by priority
   - Statistical summaries and insights
   - High-priority indicators for urgent issues

## 📋 Data Format Requirements

### CSV Files
- Must have a header row with column names
- Use standard CSV format with comma separators
- Encoding: UTF-8 recommended (auto-detected)

### Excel Files
- Support for .xlsx and .xls formats
- Data should be in the first worksheet
- Header row required

### Column Types

**Numeric Columns** (for analysis):
```
sales, revenue, defects, performance_score, quantity
```

**Date/Time Columns**:
```
date, week, month, timestamp
Formats: YYYY-MM-DD, MM/DD/YYYY, 1YYWW (week format)
```

**Categorical Columns** (for grouping):
```
region, product, team, category, status
```

### Example Data Structure
```csv
date,sales,region,defects,product
2023-01-01,150,North,2,ProductA
2023-01-02,165,North,1,ProductA
2023-01-03,142,South,3,ProductB
2023-01-04,178,North,0,ProductA
```

## 🧪 Testing with Sample Data

The project includes sample data files for testing:

1. **sample_data.csv**: Basic sales data with regions
2. **Data.xlsx**: More comprehensive dataset

### Quick Test:
1. Upload `sample_data.csv`
2. Select:
   - Value Column: `sales`
   - Date Column: `week` 
   - Cut Column: `region`
3. Click "Generate Charts"
4. Export to PowerPoint to see the full report

## 🔧 Technical Architecture

### Backend (Python/Flask)
- **Framework**: Flask with CORS support
- **Data Processing**: pandas for data manipulation
- **Visualization**: matplotlib with professional styling
- **Statistics**: NumPy for statistical calculations
- **Export**: python-pptx for PowerPoint generation

### Frontend (JavaScript/HTML/CSS)
- **Framework**: Vanilla JavaScript (no dependencies)
- **Styling**: Tailwind CSS with custom variables
- **Communication**: Fetch API for REST calls
- **Responsive**: Mobile-first design approach

### API Endpoints
- `POST /api/upload` - File upload and analysis
- `POST /api/generate_chart` - Chart generation
- `GET /api/export_ppt/<session_id>` - PowerPoint export
- `DELETE /api/clear_session/<session_id>` - Session cleanup
- `GET /api/health` - Health check

## 🐛 Troubleshooting

### Backend Issues

**Server won't start:**
```bash
# Check Python version
python --version  # Should be 3.7+

# Install dependencies
pip install -r requirements.txt

# Check port availability
netstat -an | grep 5000
```

**Import errors:**
```bash
# Install missing packages
pip install Flask Flask-CORS pandas matplotlib numpy openpyxl python-pptx chardet
```

### Frontend Issues

**Charts not generating:**
- Verify backend is running on port 5000
- Check browser console for JavaScript errors
- Ensure data has numeric columns for analysis

**File upload fails:**
- Check file format (CSV/Excel only)
- Verify file has header row
- Try with sample_data.csv first

### Data Issues

**No charts generated:**
- Ensure numeric data in value column
- Check date column format
- Verify sufficient data points (minimum 2)

**Poor chart quality:**
- Check for missing values in data
- Verify date column is properly formatted
- Consider data aggregation period

## 🚀 Production Deployment

For production use:

1. **Use a proper WSGI server:**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 backend:app
   ```

2. **Configure environment variables:**
   ```bash
   export FLASK_ENV=production
   export FLASK_DEBUG=False
   ```

3. **Set up reverse proxy (nginx/Apache)**
4. **Configure SSL certificates**
5. **Set up monitoring and logging**

## 📈 Statistical Methodology

### MSD Control Charts
- **Center Line**: Rolling mean of non-zero values
- **Control Limits**: Center line ± (σ × standard deviation multiplier)
- **Sigma Estimation**: Moving range method (R̄/1.128)
- **Outlier Detection**: Points outside control limits

### Data Processing
- **Aggregation**: Time-based grouping (daily/weekly/monthly/yearly)
- **Missing Data**: Automatic handling with interpolation
- **Zero Values**: Tracked separately as potential special causes

## 🤝 Support

For technical support or questions:

1. Check this README for common issues
2. Review the SETUP_GUIDE.md for detailed instructions
3. Test with provided sample data first
4. Check browser console for error messages


---