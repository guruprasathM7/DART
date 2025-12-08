@echo off
REM DART Analytics Quick Start Script for Windows
REM Automates the setup and launch process

echo.
echo ========================================
echo    DART Analytics Quick Start
echo ========================================
echo.

REM Check Python installation
echo [1/7] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+ from python.org
    pause
    exit /b 1
)
python --version
echo.

REM Check if virtual environment exists
if not exist ".venv" (
    echo [2/7] Creating virtual environment...
    python -m venv .venv
    echo Virtual environment created successfully
) else (
    echo [2/7] Virtual environment already exists
)
echo.

REM Activate virtual environment
echo [3/7] Activating virtual environment...
call .venv\Scripts\activate.bat
echo.

REM Upgrade pip
echo [4/7] Upgrading pip...
python -m pip install --upgrade pip --quiet
echo pip upgraded successfully
echo.

REM Install dependencies
echo [5/7] Installing dependencies...
pip install -r requirements.txt --quiet
echo Dependencies installed successfully
echo.

REM Create necessary directories
echo [6/7] Creating necessary directories...
if not exist "temp_data" mkdir temp_data
if not exist "temp_exports" mkdir temp_exports
echo Directories created successfully
echo.

REM Check for .env file
if not exist ".env" (
    echo [7/7] Creating .env from template...
    copy .env.example .env >nul
    echo .env file created (configure if needed)
) else (
    echo [7/7] .env file already exists
)
echo.

REM Ask about running tests
set /p run_tests="Run tests before starting? (y/N): "
if /i "%run_tests%"=="y" (
    echo.
    echo Running tests...
    python test_suite.py
    echo.
)

REM Display startup information
echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Starting DART Analytics...
echo.
echo Dashboard:      http://localhost:5000
echo API Docs:       http://localhost:5000/api/docs
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

REM Start the application
python backend.py

pause
