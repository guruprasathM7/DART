# DART Analytics - Detailed Setup Guide

This guide provides comprehensive instructions for setting up and running the DART Analytics application in different environments.

## 📋 System Requirements

### Minimum Requirements
- **Operating System**: Windows 10, macOS 10.14, or Linux (Ubuntu 18.04+)
- **Python**: Version 3.7 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Browser**: Chrome 80+, Firefox 75+, Safari 13+, or Edge 80+

### Recommended Requirements
- **Python**: Version 3.9 or higher
- **RAM**: 8GB or more for large datasets
- **Storage**: 2GB free space for temporary files
- **Network**: Stable internet connection for initial setup

## 🔧 Installation Methods

### Method 1: Standard Installation (Recommended)

#### Step 1: Verify Python Installation
```bash
# Check Python version
python --version
# or
python3 --version

# Should output Python 3.7.x or higher
```

If Python is not installed:
- **Windows**: Download from [python.org](https://python.org) and check "Add to PATH"
- **macOS**: Use Homebrew: `brew install python3`
- **Linux**: Use package manager: `sudo apt install python3 python3-pip`

#### Step 2: Download Project Files
```bash
# Option A: If you have git
git clone <repository-url>
cd DART_PROJECT

# Option B: Download ZIP file
# Extract to desired location and navigate to folder
```

#### Step 3: Create Virtual Environment (Recommended)
```bash
# Create virtual environment
python -m venv dart_env

# Activate virtual environment
# Windows:
dart_env\Scripts\activate
# macOS/Linux:
source dart_env/bin/activate

# You should see (dart_env) in your terminal prompt
```

#### Step 4: Install Dependencies
```bash
# Install required packages
pip install -r requirements.txt

# Verify installation
pip list
```

#### Step 5: Start the Application
```bash
# Start backend server
python backend.py

# You should see:
# * Running on all addresses (0.0.0.0)
# * Running on http://127.0.0.1:5000
```

#### Step 6: Access the Application
1. Open your web browser
2. Navigate to `http://localhost:5000`
3. You should see the DART Analytics interface

### Method 2: Docker Installation (Advanced)

#### Create Dockerfile
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 5000

CMD ["python", "backend.py"]
```

#### Build and Run
```bash
# Build Docker image
docker build -t dart-analytics .

# Run container
docker run -p 5000:5000 dart-analytics
```

## 🔍 Dependency Details

### Core Dependencies
```
Flask==2.3.3              # Web framework
Flask-CORS==4.0.0          # Cross-origin resource sharing
pandas==2.1.1              # Data manipulation
matplotlib==3.7.2          # Chart generation
numpy==1.24.3              # Numerical computing
openpyxl==3.1.2           # Excel file support
python-pptx==0.6.21       # PowerPoint generation
chardet==5.2.0            # Character encoding detection
```

### System Dependencies
- **Windows**: Visual C++ Build Tools (for some packages)
- **macOS**: Xcode Command Line Tools
- **Linux**: build-essential, python3-dev

## 🚨 Common Installation Issues

### Issue 1: pip install fails
```bash
# Solution 1: Upgrade pip
python -m pip install --upgrade pip

# Solution 2: Use --user flag
pip install --user -r requirements.txt

# Solution 3: Install packages individually
pip install Flask Flask-CORS pandas matplotlib numpy openpyxl python-pptx chardet
```

### Issue 2: matplotlib installation fails
```bash
# Windows: Install Visual C++ Build Tools
# Download from Microsoft website

# macOS: Install Xcode tools
xcode-select --install

# Linux: Install development packages
sudo apt-get install python3-dev build-essential
```

### Issue 3: Permission errors
```bash
# Use virtual environment (recommended)
python -m venv dart_env
source dart_env/bin/activate  # or dart_env\Scripts\activate on Windows
pip install -r requirements.txt

# Or use --user flag
pip install --user -r requirements.txt
```

### Issue 4: Port 5000 already in use
```bash
# Check what's using port 5000
# Windows:
netstat -ano | findstr :5000
# macOS/Linux:
lsof -i :5000

# Kill the process or change port in backend.py:
# app.run(debug=True, host='0.0.0.0', port=5001)
```

## 🔧 Configuration Options

### Backend Configuration (backend.py)

#### Change Server Port
```python
# At the bottom of backend.py
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)  # Change port here
```

#### Adjust File Size Limits
```python
# Add to backend.py after app creation
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB limit
```

#### Configure Temporary File Cleanup
```python
# In cleanup_temp_files function
cleanup_temp_files(max_age_hours=2)  # Keep files for 2 hours
```

### Frontend Configuration (app.js)

#### Change Backend URL
```javascript
// In DARTAnalytics constructor
this.backendUrl = 'http://your-server:5001/api';  // Update URL
```

#### Adjust Default Settings
```javascript
// In DARTAnalytics constructor
this.userSettings = { 
    rollingWindow: 14,     // Change default rolling window
    stdDev: 3,             // Change default standard deviation
    aggregationPeriod: 'M' // Change default aggregation
};
```

## 🌐 Network Configuration

### Local Network Access
To access from other devices on your network:

1. **Find your IP address:**
   ```bash
   # Windows:
   ipconfig
   # macOS/Linux:
   ifconfig
   ```

2. **Start server with external access:**
   ```bash
   python backend.py
   # Server runs on 0.0.0.0, accessible from network
   ```

3. **Access from other devices:**
   ```
   http://YOUR_IP_ADDRESS:5000
   ```

### Firewall Configuration
- **Windows**: Allow Python through Windows Firewall
- **macOS**: System Preferences > Security & Privacy > Firewall
- **Linux**: Configure iptables or ufw

## 📊 Performance Optimization

### For Large Datasets
```python
# In backend.py, adjust pandas settings
pd.set_option('display.max_columns', None)
pd.set_option('display.max_rows', 1000)

# Use chunking for very large files
chunk_size = 10000
for chunk in pd.read_csv('large_file.csv', chunksize=chunk_size):
    # Process chunk
```

### Memory Management
```python
# Add to backend.py for memory cleanup
import gc

def cleanup_memory():
    gc.collect()
    plt.close('all')
```

## 🔒 Security Considerations

### Production Deployment
1. **Disable debug mode:**
   ```python
   app.run(debug=False, host='0.0.0.0', port=5000)
   ```

2. **Use environment variables:**
   ```python
   import os
   DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
   app.run(debug=DEBUG)
   ```

3. **Set up HTTPS with reverse proxy (nginx/Apache)**

4. **Implement rate limiting:**
   ```python
   from flask_limiter import Limiter
   limiter = Limiter(app, key_func=get_remote_address)
   ```

## 🧪 Testing Your Installation

### Basic Functionality Test
1. **Start the server:**
   ```bash
   python backend.py
   ```

2. **Test backend health:**
   ```bash
   curl http://localhost:5000/api/health
   # Should return: {"status":"healthy"}
   ```

3. **Test file upload:**
   - Open browser to `http://localhost:5000`
   - Upload `sample_data.csv`
   - Verify file analysis appears

4. **Test chart generation:**
   - Select columns in the form
   - Click "Generate Charts"
   - Verify charts appear

5. **Test PowerPoint export:**
   - Generate some charts
   - Click "Export to PowerPoint"
   - Verify download starts

### Performance Test
```bash
# Test with larger file
# Upload Data.xlsx (if available)
# Generate multiple charts
# Monitor memory usage
```

## 🔄 Updating the Application

### Update Dependencies
```bash
# Activate virtual environment
source dart_env/bin/activate  # or dart_env\Scripts\activate

# Update packages
pip install --upgrade -r requirements.txt

# Or update specific packages
pip install --upgrade pandas matplotlib
```

### Backup User Data
```bash
# Backup any custom configurations
cp backend.py backend.py.backup
cp app.js app.js.backup
```

## 🆘 Getting Help

### Debug Mode
Enable detailed error messages:
```python
# In backend.py
app.run(debug=True, host='0.0.0.0', port=5000)
```

### Log Files
Check console output for error messages:
```bash
python backend.py > app.log 2>&1
```

### Browser Developer Tools
1. Press F12 in browser
2. Check Console tab for JavaScript errors
3. Check Network tab for API call failures

### Common Error Messages

**"ModuleNotFoundError: No module named 'flask'"**
- Solution: Install dependencies with `pip install -r requirements.txt`

**"Address already in use"**
- Solution: Change port or kill existing process

**"Permission denied"**
- Solution: Use virtual environment or --user flag

**"Charts not generating"**
- Solution: Check data format and column types

## 📞 Support Checklist

Before seeking help, please verify:
- [ ] Python 3.7+ is installed
- [ ] All dependencies are installed successfully
- [ ] Backend server starts without errors
- [ ] Browser can access http://localhost:5000
- [ ] Sample data file uploads successfully
- [ ] No firewall blocking port 5000

---

**Need more help?** Check the main README.md file or review error messages in the browser console and terminal output.